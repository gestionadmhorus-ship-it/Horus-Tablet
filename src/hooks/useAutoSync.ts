import { useEffect, useState, useRef, useCallback } from 'react';
import { Peer } from 'peerjs';
import type { AppData, AppRole, UnitStatus } from '../types';

const RECONNECT_INTERVAL = 10000;        // 10 seconds
const STATUS_BROADCAST_INTERVAL = 15000; // 15 seconds
const STALE_THRESHOLD = 35000;           // 35 seconds → mark as "no signal"

export function useAutoSync(
  role: AppRole | null,
  getUnsyncedData: () => Promise<AppData>,
  markDataAsSynced: (data: AppData) => Promise<void>,
  onDataReceived: (data: AppData) => Promise<void>,
  getStatusSnapshot?: () => Omit<UnitStatus, 'deviceName' | 'connected' | 'lastSeen'>,
  onStatusUpdate?: (status: UnitStatus) => void
) {
  const [syncStatus, setSyncStatus] = useState<string>('Inicializando red...');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<string | null>(
    () => localStorage.getItem('horus_last_sync_ts')
  );
  const [unitsStatus, setUnitsStatus] = useState<Map<string, UnitStatus>>(() => new Map());
  const peerRef = useRef<Peer | null>(null);

  const recordSyncSuccess = () => {
    const now = new Date();
    const ts = now.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    localStorage.setItem('horus_last_sync_ts', ts);
    setLastSyncTimestamp(ts);
  };

  // Use refs for stable callbacks to avoid re-triggering the effect
  const getUnsyncedDataRef = useRef(getUnsyncedData);
  const markDataAsSyncedRef = useRef(markDataAsSynced);
  const onDataReceivedRef = useRef(onDataReceived);
  const getStatusSnapshotRef = useRef(getStatusSnapshot);
  const onStatusUpdateRef = useRef(onStatusUpdate);

  useEffect(() => {
    getUnsyncedDataRef.current = getUnsyncedData;
    markDataAsSyncedRef.current = markDataAsSynced;
    onDataReceivedRef.current = onDataReceived;
    getStatusSnapshotRef.current = getStatusSnapshot;
    onStatusUpdateRef.current = onStatusUpdate;
  }, [getUnsyncedData, markDataAsSynced, onDataReceived, getStatusSnapshot, onStatusUpdate]);

  // ── Ticker that marks stale units as disconnected (server-side) ──
  useEffect(() => {
    if (role !== 'server') return;
    const ticker = setInterval(() => {
      const now = Date.now();
      setUnitsStatus(prev => {
        let changed = false;
        const next = new Map(prev);
        next.forEach((unit, key) => {
          if (unit.connected && now - unit.lastSeen > STALE_THRESHOLD) {
            next.set(key, { ...unit, connected: false });
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 5000);
    return () => clearInterval(ticker);
  }, [role]);

  // ── Handle incoming STATUS_UPDATE on the server ──
  const handleStatusUpdate = useCallback((data: any) => {
    const { deviceName, status } = data;
    if (!deviceName || !status) return;
    const unitStatus: UnitStatus = {
      deviceName,
      connected: true,
      lastSeen: Date.now(),
      ...status,
    };
    setUnitsStatus(prev => {
      const next = new Map(prev);
      next.set(deviceName, unitStatus);
      return next;
    });
    // Also register as known client
    const knownStr = localStorage.getItem('horus_known_clients') || '[]';
    let known: string[] = JSON.parse(knownStr);
    if (!known.includes(deviceName)) {
      known.push(deviceName);
      localStorage.setItem('horus_known_clients', JSON.stringify(known));
      window.dispatchEvent(new Event('horus_known_clients_updated'));
    }
    if (onStatusUpdateRef.current) {
      onStatusUpdateRef.current(unitStatus);
    }
  }, []);

  useEffect(() => {
    if (!role) return;

    let reconnectTimer: any;
    let syncAttemptTimer: any;
    let statusBroadcastTimer: any;
    let isActive = true;

    const connectPeer = () => {
      if (peerRef.current) {
        peerRef.current.destroy();
      }

      if (role === 'server') {
        const myServerId = localStorage.getItem('horus_my_server_id');
        if (!myServerId) {
          setSyncStatus('❌ Error: Falta ID de servidor.');
          return;
        }

        setSyncStatus('📡 Servidor: Iniciando...');
        const peer = new Peer(myServerId, { debug: 1 });
        peerRef.current = peer;

        peer.on('open', () => {
          if (isActive) setSyncStatus('📡 Control: En línea y escuchando.');
        });

        peer.on('connection', (conn) => {
          if (!isActive) return;
          
          conn.on('data', async (data: any) => {
            if (data.type === 'PING') {
              conn.send({ type: 'PONG' });
              return;
            }

            // ── STATUS_UPDATE from a field unit ──
            if (data.type === 'STATUS_UPDATE') {
              handleStatusUpdate(data);
              return;
            }

            // ── Explorador notifica desvinculación ──
            if (data.type === 'DISCONNECT') {
              const name = data.deviceName as string | undefined;
              if (name) {
                const known: string[] = JSON.parse(localStorage.getItem('horus_known_clients') || '[]');
                const updated = known.filter(c => c !== name);
                localStorage.setItem('horus_known_clients', JSON.stringify(updated));
                window.dispatchEvent(new Event('horus_known_clients_updated'));
                // Mark unit as disconnected in state
                setUnitsStatus(prev => {
                  const next = new Map(prev);
                  const existing = next.get(name);
                  if (existing) next.set(name, { ...existing, connected: false });
                  return next;
                });
                setSyncStatus(`🔌 "${name}" se ha desvinculado.`);
                setTimeout(() => { if (isActive) setSyncStatus('📡 Control: En línea y escuchando.'); }, 3000);
              }
              conn.close();
              return;
            }

            if (data.type === 'SYNC_PAYLOAD' && data.payload) {
              const blockedListStr = localStorage.getItem('horus_blocked_clients') || '[]';
              const blockedClients: string[] = JSON.parse(blockedListStr);
              
              let senderDeviceName = 'Unknown';
              const p = data.payload;
              if (p.shifts?.[0]) senderDeviceName = p.shifts[0].deviceName;
              else if (p.flights?.[0]) senderDeviceName = p.flights[0].deviceName;
              else if (p.batteries?.[0]) senderDeviceName = p.batteries[0].deviceName;
              else if (p.detections?.[0]) senderDeviceName = p.detections[0].deviceName;

              if (blockedClients.includes(senderDeviceName)) {
                conn.send({ type: 'SYNC_ERROR', code: 'REMOVED_BY_SERVER', message: 'Fuiste eliminado de la red por Control.' });
                conn.close();
                const updatedBlocked = blockedClients.filter(c => c !== senderDeviceName);
                localStorage.setItem('horus_blocked_clients', JSON.stringify(updatedBlocked));
                return;
              }

              if (senderDeviceName !== 'Unknown') {
                const knownStr = localStorage.getItem('horus_known_clients') || '[]';
                let known = JSON.parse(knownStr);
                if (!known.includes(senderDeviceName)) {
                  known.push(senderDeviceName);
                  localStorage.setItem('horus_known_clients', JSON.stringify(known));
                  window.dispatchEvent(new Event('horus_known_clients_updated'));
                }
              }

              setIsSyncing(true);
              setSyncStatus('🤝 Recibiendo datos de una Unidad...');
              try {
                await onDataReceivedRef.current(data.payload);
                conn.send({ type: 'SYNC_ACK' });
                setSyncStatus('✅ Datos recibidos y guardados con éxito.');
                setTimeout(() => {
                  if (isActive) setSyncStatus('📡 Control: En línea y escuchando.');
                }, 3000);
              } catch (err: any) {
                conn.send({ type: 'SYNC_ERROR', message: err.message });
                setSyncStatus('❌ Error guardando datos.');
              } finally {
                setIsSyncing(false);
              }
            }
          });
        });

        peer.on('error', (err) => {
          if (!isActive) return;
          console.error('PeerJS Server Error:', err);
          if (err.type === 'unavailable-id') {
             setSyncStatus('⚠️ Ya hay una instancia de Control activa en esta red.');
          } else {
             setSyncStatus('🔌 Error de red. Reconectando en breve...');
             reconnectTimer = setTimeout(connectPeer, RECONNECT_INTERVAL);
          }
        });

      } else if (role === 'client') {
        setSyncStatus('🔍 Cliente: Buscando red...');
        const peer = new Peer({ debug: 1 });
        peerRef.current = peer;

        // ── STATUS broadcast function for client ──
        const broadcastStatus = () => {
          if (!isActive || !peerRef.current || peerRef.current.disconnected) return;
          const targetServerId = localStorage.getItem('horus_target_server_id');
          if (!targetServerId || !getStatusSnapshotRef.current) return;

          const snapshot = getStatusSnapshotRef.current();
          const deviceName = localStorage.getItem('horus_device_name') || 'Unknown';

          try {
            const conn = peerRef.current.connect(targetServerId);
            conn.on('open', () => {
              conn.send({ type: 'STATUS_UPDATE', deviceName, status: snapshot });
              // Close quickly after sending
              setTimeout(() => { try { conn.close(); } catch {} }, 500);
            });
            conn.on('error', () => { /* silent — status is best-effort */ });
          } catch { /* silent */ }
        };

        const attemptSync = async () => {
          if (!isActive || !peerRef.current || peerRef.current.disconnected) return;

          const targetServerId = localStorage.getItem('horus_target_server_id');
          if (!targetServerId) {
             setSyncStatus('⚠️ No hay Control vinculado. Escanea un QR en Configuración.');
             setIsSyncing(false);
             return;
          }

          const unsynced = await getUnsyncedDataRef.current();
          const hasData = 
            unsynced.shifts.length > 0 || 
            unsynced.flights.length > 0 || 
            unsynced.batteries.length > 0 || 
            unsynced.detections.length > 0 || 
            (unsynced.checklists && unsynced.checklists.length > 0);
          
          if (!hasData) {
            setSyncStatus('✅ Todo está sincronizado.');
            setIsSyncing(false);
            syncAttemptTimer = setTimeout(attemptSync, RECONNECT_INTERVAL);
            return;
          }

          setSyncStatus('📤 Buscando al servidor para enviar datos...');
          setIsSyncing(true);
          const conn = peer.connect(targetServerId);
          
          conn.on('open', () => {
            setSyncStatus('📤 Conectado. Enviando datos...');
            conn.send({ type: 'SYNC_PAYLOAD', payload: unsynced });
          });

          conn.on('data', async (data: any) => {
            if (data.type === 'SYNC_ACK') {
              await markDataAsSyncedRef.current(unsynced);
              recordSyncSuccess();
              setSyncStatus('✅ Sincronización automática exitosa.');
              setTimeout(() => {
                if (isActive) setSyncStatus('✅ Todo está sincronizado.');
              }, 3000);
              setIsSyncing(false);
              conn.close();
            } else if (data.type === 'SYNC_ERROR' && data.code === 'REMOVED_BY_SERVER') {
              setSyncStatus('⚠️ Control te ha eliminado de la red. Vuelve a escanear el QR.');
              setIsSyncing(false);
              conn.close();
              isActive = false;
              setTimeout(() => {
                localStorage.removeItem('horus_target_server_id');
                localStorage.removeItem('horus_sync_role');
                window.location.reload();
              }, 2500);
            }
          });

          conn.on('error', () => {
            setSyncStatus('🔍 Control no encontrado. Reintentando luego...');
            setIsSyncing(false);
            conn.close();
          });
          
          conn.on('close', () => {
            setIsSyncing(false);
            syncAttemptTimer = setTimeout(attemptSync, RECONNECT_INTERVAL);
          });
        };

        peer.on('open', () => {
          if (!isActive) return;
          setSyncStatus('🔍 Conectado a la red. Revisando datos pendientes...');
          attemptSync();
          // Start STATUS broadcast loop
          broadcastStatus();
          statusBroadcastTimer = setInterval(broadcastStatus, STATUS_BROADCAST_INTERVAL);
        });

        peer.on('error', (err) => {
          if (!isActive) return;
          console.error('PeerJS Client Error:', err);
          if (err.type === 'peer-unavailable') {
            setSyncStatus('🔍 Central apagada o fuera de alcance.');
            syncAttemptTimer = setTimeout(attemptSync, RECONNECT_INTERVAL);
          } else {
            setSyncStatus('🔍 Sin red. Esperando conexión...');
            reconnectTimer = setTimeout(connectPeer, RECONNECT_INTERVAL);
          }
        });
      }
    };

    connectPeer();

    return () => {
      isActive = false;
      clearTimeout(reconnectTimer);
      clearTimeout(syncAttemptTimer);
      clearInterval(statusBroadcastTimer);
      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, [role, handleStatusUpdate]);

  const forceSync = (): Promise<{ success: boolean; message: string }> => {
    return new Promise(async (resolve) => {
      if (!role) {
        return resolve({ success: false, message: 'La red no está inicializada.' });
      }
      if (role === 'server') {
        return resolve({ success: true, message: 'El dispositivo está configurado como Panel de Control (Servidor). Está escuchando y listo para recibir datos.' });
      }

      const targetServerId = localStorage.getItem('horus_target_server_id');
      if (!targetServerId) {
        return resolve({ success: false, message: 'No hay un Panel de Control vinculado. Escanee el código QR en Configuración.' });
      }

      if (!peerRef.current || peerRef.current.destroyed) {
        return resolve({ success: false, message: 'El sistema de red de la tablet no está activo. Verifique su conexión Wi-Fi.' });
      }

      setSyncStatus('📤 Sincronización forzada en curso...');
      setIsSyncing(true);

      const unsynced = await getUnsyncedDataRef.current();
      const hasData = 
        unsynced.shifts.length > 0 || 
        unsynced.flights.length > 0 || 
        unsynced.batteries.length > 0 || 
        unsynced.detections.length > 0 || 
        (unsynced.checklists && unsynced.checklists.length > 0);

      const conn = peerRef.current.connect(targetServerId);
      
      const timeoutId = setTimeout(() => {
        conn.close();
        setIsSyncing(false);
        setSyncStatus(hasData ? '❌ Error de sincronización.' : '✅ Todo está sincronizado.');
        resolve({ success: false, message: 'No se pudo contactar al Panel de Control. Asegúrese de que esté encendido y en la misma red Wi-Fi.' });
      }, 8000);

      conn.on('open', () => {
        if (hasData) {
          setSyncStatus('📤 Enviando datos pendientes...');
          conn.send({ type: 'SYNC_PAYLOAD', payload: unsynced });
        } else {
          setSyncStatus('📤 Verificando conexión con Central...');
          conn.send({ type: 'PING' });
        }
      });

      conn.on('data', async (data: any) => {
        clearTimeout(timeoutId);
        if (data.type === 'SYNC_ACK') {
          try {
            await markDataAsSyncedRef.current(unsynced);
            recordSyncSuccess();
            setSyncStatus('✅ Sincronización exitosa.');
            setTimeout(() => {
              setSyncStatus('✅ Todo está sincronizado.');
            }, 3000);
            resolve({ success: true, message: 'Sincronización exitosa: El Panel de Control recibió todos los datos pendientes correctamente.' });
          } catch (err: any) {
            setSyncStatus('❌ Error al marcar datos.');
            resolve({ success: false, message: `Error guardando estado local: ${err.message}` });
          } finally {
            setIsSyncing(false);
            conn.close();
          }
        } else if (data.type === 'PONG') {
          setSyncStatus('✅ Todo está sincronizado.');
          setIsSyncing(false);
          conn.close();
          resolve({ success: true, message: 'Conexión exitosa: El Panel de Control está en línea y todos los datos del dispositivo están al día.' });
        } else if (data.type === 'SYNC_ERROR') {
          setIsSyncing(false);
          conn.close();
          resolve({ success: false, message: `El servidor rechazó la sincronización: ${data.message || 'Error desconocido'}` });
        }
      });

      conn.on('error', () => {
        clearTimeout(timeoutId);
        setIsSyncing(false);
        conn.close();
        resolve({ success: false, message: 'No se pudo establecer conexión con el Panel de Control. Verifique su red Wi-Fi.' });
      });
    });
  };

  return { syncStatus, isSyncing, forceSync, lastSyncTimestamp, unitsStatus };
}
