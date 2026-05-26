import { useEffect, useState, useRef } from 'react';
import { Peer } from 'peerjs';
import type { AppData, AppRole } from '../types';

const RECONNECT_INTERVAL = 10000; // 10 seconds

export function useAutoSync(
  role: AppRole | null,
  getUnsyncedData: () => Promise<AppData>,
  markDataAsSynced: (data: AppData) => Promise<void>,
  onDataReceived: (data: AppData) => Promise<void>
) {
  const [syncStatus, setSyncStatus] = useState<string>('Inicializando red...');
  const [isSyncing, setIsSyncing] = useState(false);
  const peerRef = useRef<Peer | null>(null);

  // Use refs for stable callbacks to avoid re-triggering the effect
  const getUnsyncedDataRef = useRef(getUnsyncedData);
  const markDataAsSyncedRef = useRef(markDataAsSynced);
  const onDataReceivedRef = useRef(onDataReceived);

  useEffect(() => {
    getUnsyncedDataRef.current = getUnsyncedData;
    markDataAsSyncedRef.current = markDataAsSynced;
    onDataReceivedRef.current = onDataReceived;
  }, [getUnsyncedData, markDataAsSynced, onDataReceived]);

  useEffect(() => {
    if (!role) return;

    let reconnectTimer: any;
    let syncAttemptTimer: any;
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

            // ── Explorador notifica desvinculación ──
            if (data.type === 'DISCONNECT') {
              const name = data.deviceName as string | undefined;
              if (name) {
                const known: string[] = JSON.parse(localStorage.getItem('horus_known_clients') || '[]');
                const updated = known.filter(c => c !== name);
                localStorage.setItem('horus_known_clients', JSON.stringify(updated));
                window.dispatchEvent(new Event('horus_known_clients_updated'));
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
                // Notify client it was removed; auto-unblock so re-pairing is possible
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

        const attemptSync = async () => {
          if (!isActive || !peerRef.current || peerRef.current.disconnected) return;

          const targetServerId = localStorage.getItem('horus_target_server_id');
          if (!targetServerId) {
             setSyncStatus('⚠️ No hay Control vinculado. Escanea un QR en Configuración.');
             setIsSyncing(false);
             return; // Stop reconnect loop if no target is set
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
              setSyncStatus('✅ Sincronización automática exitosa.');
              setTimeout(() => {
                if (isActive) setSyncStatus('✅ Todo está sincronizado.');
              }, 3000);
              setIsSyncing(false);
              conn.close();
            } else if (data.type === 'SYNC_ERROR' && data.code === 'REMOVED_BY_SERVER') {
              // Jefe eliminated this device — reset config and go back to RoleSetup
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
            // Server not found or connection dropped
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
      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, [role]);

  return { syncStatus, isSyncing };
}
