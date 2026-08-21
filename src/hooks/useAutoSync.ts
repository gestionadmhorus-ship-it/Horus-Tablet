import { useEffect, useState, useRef, useCallback } from 'react';
import { Peer } from 'peerjs';
import type { AppData, AppRole, UnitStatus, KnownClient, ElementEntry } from '../types';

export function getKnownClients(): KnownClient[] {
  try {
    const raw = localStorage.getItem('horus_known_clients') || '[]';
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item: any) => {
      if (typeof item === 'string') {
        return { deviceId: `legacy-${item}`, deviceName: item };
      }
      if (item && typeof item === 'object' && item.deviceId && item.deviceName) {
        return item as KnownClient;
      }
      return null;
    }).filter(Boolean) as KnownClient[];
  } catch {
    return [];
  }
}

const RECONNECT_INTERVAL = 10000;        // 10 seconds
const STATUS_BROADCAST_INTERVAL = 15000; // 15 seconds
const STALE_THRESHOLD = 35000;           // 35 seconds → mark as "no signal"

const canonicalizeKnowledgeBase = (elements: ElementEntry[]) => JSON.stringify(
  elements.map(element => ({
    name: element.name,
    category: element.category ?? '',
    anomalies: element.anomalies.map(anomaly => ({
      name: anomaly.name,
      recommendation: anomaly.recommendation
    }))
  }))
);

const getKnowledgeBaseFingerprint = async (elements: ElementEntry[]) => {
  const bytes = new TextEncoder().encode(canonicalizeKnowledgeBase(elements));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
};

const isValidKnowledgeBase = (value: unknown): value is ElementEntry[] => {
  if (!Array.isArray(value)) return false;

  const elementNames = new Set<string>();
  for (const element of value) {
    if (!element || typeof element !== 'object') return false;
    const candidate = element as Record<string, unknown>;
    if (typeof candidate.name !== 'string' || !candidate.name.trim()) return false;
    if (candidate.category !== undefined && typeof candidate.category !== 'string') return false;
    if (!Array.isArray(candidate.anomalies)) return false;

    const normalizedElementName = candidate.name.trim().toLowerCase();
    if (elementNames.has(normalizedElementName)) return false;
    elementNames.add(normalizedElementName);

    const anomalyNames = new Set<string>();
    for (const anomaly of candidate.anomalies) {
      if (!anomaly || typeof anomaly !== 'object') return false;
      const anomalyCandidate = anomaly as Record<string, unknown>;
      if (typeof anomalyCandidate.name !== 'string' || !anomalyCandidate.name.trim()) return false;
      if (typeof anomalyCandidate.recommendation !== 'string') return false;

      const normalizedAnomalyName = anomalyCandidate.name.trim().toLowerCase();
      if (anomalyNames.has(normalizedAnomalyName)) return false;
      anomalyNames.add(normalizedAnomalyName);
    }
  }

  return true;
};

const attachSourceDeviceId = (payload: AppData, sourceDeviceId: string): AppData => {
  const identify = (items: any[] | undefined) => items?.map(item => ({
    ...item,
    sourceDeviceId: item.sourceDeviceId || sourceDeviceId
  }));

  return {
    ...payload,
    shifts: identify(payload.shifts) || [],
    flights: identify(payload.flights) || [],
    batteries: identify(payload.batteries) || [],
    detections: identify(payload.detections) || [],
    checklists: identify(payload.checklists || (payload as any).vehicleChecklists),
    droneChecklists: identify(payload.droneChecklists)
  };
};

export function useAutoSync(
  role: AppRole | null,
  getUnsyncedData: () => Promise<AppData>,
  markDataAsSynced: (data: AppData) => Promise<void>,
  onDataReceived: (data: AppData) => Promise<void>,
  getStatusSnapshot?: () => Omit<UnitStatus, 'deviceId' | 'deviceName' | 'connected' | 'lastSeen'>,
  onStatusUpdate?: (status: UnitStatus) => void,
  getAllData?: () => Promise<AppData>,
  deviceName?: string,
  getKnowledgeBase?: () => ElementEntry[],
  replaceKnowledgeBase?: (elements: ElementEntry[]) => Promise<void>,
  getControlRecordsState?: (sourceDeviceId: string) => Promise<AppData>,
  applyControlRecordsState?: (data: AppData) => Promise<{ applied: number; protectedLocal: number }>
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
    const ts = now.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
    localStorage.setItem('horus_last_sync_ts', ts);
    setLastSyncTimestamp(ts);
  };

  // Use refs for stable callbacks to avoid re-triggering the effect
  const getUnsyncedDataRef = useRef(getUnsyncedData);
  const markDataAsSyncedRef = useRef(markDataAsSynced);
  const onDataReceivedRef = useRef(onDataReceived);
  const getStatusSnapshotRef = useRef(getStatusSnapshot);
  const onStatusUpdateRef = useRef(onStatusUpdate);
  const getAllDataRef = useRef(getAllData);
  const getKnowledgeBaseRef = useRef(getKnowledgeBase);
  const replaceKnowledgeBaseRef = useRef(replaceKnowledgeBase);
  const getControlRecordsStateRef = useRef(getControlRecordsState);
  const applyControlRecordsStateRef = useRef(applyControlRecordsState);

  useEffect(() => {
    getUnsyncedDataRef.current = getUnsyncedData;
    markDataAsSyncedRef.current = markDataAsSynced;
    onDataReceivedRef.current = onDataReceived;
    getStatusSnapshotRef.current = getStatusSnapshot;
    onStatusUpdateRef.current = onStatusUpdate;
    getAllDataRef.current = getAllData;
    getKnowledgeBaseRef.current = getKnowledgeBase;
    replaceKnowledgeBaseRef.current = replaceKnowledgeBase;
    getControlRecordsStateRef.current = getControlRecordsState;
    applyControlRecordsStateRef.current = applyControlRecordsState;
  }, [getUnsyncedData, markDataAsSynced, onDataReceived, getStatusSnapshot, onStatusUpdate, getAllData, getKnowledgeBase, replaceKnowledgeBase, getControlRecordsState, applyControlRecordsState]);

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
    const { deviceId, deviceName, peerId, status } = data;
    if (!deviceName || !status) return;

    const finalDeviceId = deviceId || `legacy-${deviceName}`;

    const unitStatus: UnitStatus = {
      deviceId: finalDeviceId,
      deviceName,
      peerId,
      connected: true,
      lastSeen: Date.now(),
      ...status,
    };
    setUnitsStatus(prev => {
      const next = new Map(prev);
      next.set(finalDeviceId, unitStatus);
      return next;
    });
    // Also register as known client
    const known = getKnownClients();
    const existingIdx = known.findIndex(c => c.deviceId === finalDeviceId);
    const nameClash = known.find(c => c.deviceName.toLowerCase() === deviceName.toLowerCase() && c.deviceId !== finalDeviceId);

    if (!nameClash) {
      let changed = false;
      if (existingIdx >= 0) {
        if (known[existingIdx].deviceName !== deviceName) {
          known[existingIdx].deviceName = deviceName;
          changed = true;
        }
      } else {
        known.push({ deviceId: finalDeviceId, deviceName });
        changed = true;
      }
      if (changed) {
        localStorage.setItem('horus_known_clients', JSON.stringify(known));
        window.dispatchEvent(new Event('horus_known_clients_updated'));
      }
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
      // Clear existing timers to prevent memory leaks and duplicate runs
      clearTimeout(reconnectTimer);
      clearTimeout(syncAttemptTimer);
      clearInterval(statusBroadcastTimer);

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
              
              const blockedListStr = localStorage.getItem('horus_blocked_clients') || '[]';
              const blockedClients: string[] = JSON.parse(blockedListStr);
              const senderDeviceName = data.deviceName || 'Unknown';
              const senderDeviceId = data.deviceId || `legacy-${senderDeviceName}`;
              
              const isBlocked = blockedClients.includes(senderDeviceId) || blockedClients.includes(senderDeviceName);
              
              try {
                conn.send({
                  type: 'STATUS_ACK',
                  serverVersion: localStorage.getItem('horus_current_version') || 'v2.0.0',
                  isLinked: !isBlocked,
                  recordsStateSupported: true
                });
              } catch (err) {
                console.error('Error sending STATUS_ACK:', err);
              }
              return;
            }

            if (data.type === 'RECORDS_STATE_REQUEST') {
              const senderDeviceId = typeof data.deviceId === 'string' ? data.deviceId : undefined;
              if (!senderDeviceId || !getControlRecordsStateRef.current) return;
              const blockedList: string[] = JSON.parse(localStorage.getItem('horus_blocked_clients') || '[]');
              if (blockedList.includes(senderDeviceId)) return;
              try {
                conn.send({ type: 'RECORDS_STATE_PAYLOAD', payload: await getControlRecordsStateRef.current(senderDeviceId) });
              } catch (error) {
                console.error('Error preparing Control records state:', error);
                conn.send({ type: 'RECORDS_STATE_ERROR' });
              }
              return;
            }

            // Knowledge Base request from a linked field unit
            if (data.type === 'KNOWLEDGE_BASE_REQUEST') {
              const blockedListStr = localStorage.getItem('horus_blocked_clients') || '[]';
              const blockedClients: string[] = JSON.parse(blockedListStr);
              const senderDeviceName = typeof data.deviceName === 'string' ? data.deviceName : 'Unknown';
              const senderDeviceId = typeof data.deviceId === 'string' ? data.deviceId : `legacy-${senderDeviceName}`;
              const isBlocked = blockedClients.includes(senderDeviceId) || blockedClients.includes(senderDeviceName);

              if (isBlocked || !getKnowledgeBaseRef.current || typeof data.fingerprint !== 'string') return;

              try {
                const elements = getKnowledgeBaseRef.current();
                const fingerprint = await getKnowledgeBaseFingerprint(elements);
                conn.send(
                  fingerprint === data.fingerprint
                    ? { type: 'KNOWLEDGE_BASE_PAYLOAD', fingerprint, unchanged: true }
                    : { type: 'KNOWLEDGE_BASE_PAYLOAD', fingerprint, elements }
                );
              } catch (error) {
                console.error('Error preparing Knowledge Base payload:', error);
              }
              return;
            }

            // Explorador notifica desvinculacion
            if (data.type === 'DISCONNECT') {
              const name = data.deviceName as string | undefined;
              const deviceId = data.deviceId as string | undefined;
              if (name) {
                const finalDeviceId = deviceId || `legacy-${name}`;
                const known = getKnownClients();
                const updated = known.filter(c => c.deviceId !== finalDeviceId);
                localStorage.setItem('horus_known_clients', JSON.stringify(updated));
                window.dispatchEvent(new Event('horus_known_clients_updated'));
                // Mark unit as disconnected in state
                setUnitsStatus(prev => {
                  const next = new Map(prev);
                  const existing = next.get(finalDeviceId);
                  if (existing) next.set(finalDeviceId, { ...existing, connected: false });
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
              
              const senderDeviceName = data.deviceName || 'Unknown';
              const senderDeviceId = data.deviceId || `legacy-${senderDeviceName}`;

              if (blockedClients.includes(senderDeviceId) || blockedClients.includes(senderDeviceName)) {
                conn.send({ type: 'SYNC_ERROR', code: 'REMOVED_BY_SERVER', message: 'Fuiste eliminado de la red por Control.' });
                conn.close();
                const updatedBlocked = blockedClients.filter(c => c !== senderDeviceId && c !== senderDeviceName);
                localStorage.setItem('horus_blocked_clients', JSON.stringify(updatedBlocked));
                return;
              }

              // Prevención de nombres repetidos
              const known = getKnownClients();
              const nameClash = known.find(c => c.deviceName.toLowerCase() === senderDeviceName.toLowerCase() && c.deviceId !== senderDeviceId);
              if (nameClash) {
                conn.send({ 
                  type: 'SYNC_ERROR', 
                  code: 'NAME_CLASH', 
                  message: 'El nombre de este dispositivo ya está registrado por otra tablet en el Panel de Control. Por favor cambia el nombre de esta tablet en Configuración.' 
                });
                conn.close();
                return;
              }

              if (senderDeviceName !== 'Unknown') {
                const existingIdx = known.findIndex(c => c.deviceId === senderDeviceId);
                let changed = false;
                if (existingIdx >= 0) {
                  if (known[existingIdx].deviceName !== senderDeviceName) {
                    known[existingIdx].deviceName = senderDeviceName;
                    changed = true;
                  }
                } else {
                  known.push({ deviceId: senderDeviceId, deviceName: senderDeviceName });
                  changed = true;
                }
                if (changed) {
                  localStorage.setItem('horus_known_clients', JSON.stringify(known));
                  window.dispatchEvent(new Event('horus_known_clients_updated'));
                }
              }

              setIsSyncing(true);
              setSyncStatus('🤝 Recibiendo datos de una Unidad...');
              try {
                await onDataReceivedRef.current(attachSourceDeviceId(data.payload, senderDeviceId));
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
        setSyncStatus('🔄 Conectando con Central...');
        const name = deviceName || localStorage.getItem('horus_device_name') || 'Unknown';
        const sanitizedName = name.replace(/[^a-zA-Z0-9-_]/g, '');
        const clientPeerId = `horus-tablet-peer-${sanitizedName}`;
        const peer = new Peer(clientPeerId, { debug: 1 });
        peerRef.current = peer;

        // Listen for incoming control/recovery connections on the client
        peer.on('connection', (conn) => {
          conn.on('data', async (data: any) => {
            if (data.type === 'REQUEST_FULL_BACKUP') {
              try {
                if (getAllDataRef.current) {
                  const allData = await getAllDataRef.current();
                  const jsonString = JSON.stringify(allData);
                  const CHUNK_SIZE = 16384; // 16KB chunks
                  const totalChunks = Math.ceil(jsonString.length / CHUNK_SIZE);

                  // Send header
                  conn.send({
                    type: 'FULL_BACKUP_HEADER',
                    totalChunks,
                    totalSize: jsonString.length
                  });

                  // Send chunks
                  for (let i = 0; i < totalChunks; i++) {
                    const chunk = jsonString.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
                    conn.send({
                      type: 'FULL_BACKUP_CHUNK',
                      chunkIndex: i,
                      chunkData: chunk
                    });
                    // Tiny delay to avoid saturating SCTP buffer
                    await new Promise(r => setTimeout(r, 20));
                  }

                  // Send completion signal
                  conn.send({ type: 'FULL_BACKUP_END' });
                }
              } catch (err: any) {
                console.error('Error serving full backup request:', err);
                try {
                  conn.send({ type: 'BACKUP_ERROR', message: err.message || String(err) });
                } catch {}
              }
            }
          });
        });

        // ── STATUS broadcast function for client ──
        const broadcastStatus = () => {
          if (!isActive || !peerRef.current || peerRef.current.disconnected) return;
          const targetServerId = localStorage.getItem('horus_target_server_id');
          if (!targetServerId || !getStatusSnapshotRef.current) return;

          const snapshot = getStatusSnapshotRef.current();
          const deviceName = localStorage.getItem('horus_device_name') || 'Unknown';

          try {
            const conn = peerRef.current.connect(targetServerId);
            
            let closeTimeout = setTimeout(() => {
              try { conn.close(); } catch {}
            }, 4000);

            const requestKnowledgeBase = async () => {
              if (!getKnowledgeBaseRef.current || !replaceKnowledgeBaseRef.current) {
                try { conn.close(); } catch {}
                return;
              }
              const fingerprint = await getKnowledgeBaseFingerprint(getKnowledgeBaseRef.current());
              closeTimeout = setTimeout(() => { try { conn.close(); } catch {} }, 4000);
              conn.send({
                type: 'KNOWLEDGE_BASE_REQUEST',
                deviceId: localStorage.getItem('horus_device_id') || 'dev-unknown',
                deviceName,
                fingerprint
              });
            };

            conn.on('open', () => {
              conn.send({ 
                type: 'STATUS_UPDATE', 
                deviceId: localStorage.getItem('horus_device_id') || 'dev-unknown',
                deviceName, 
                peerId: peerRef.current ? peerRef.current.id : undefined, 
                status: snapshot 
              });
            });

            conn.on('data', async (resp: any) => {
              if (resp && resp.type === 'STATUS_ACK') {
                clearTimeout(closeTimeout);
                
                // 1. Verificar si fue desvinculado por el servidor
                if (!resp.isLinked) {
                  setSyncStatus('⚠️ Control te ha desvinculado.');
                  localStorage.removeItem('horus_target_server_id');
                  localStorage.removeItem('horus_sync_role');
                  isActive = false;
                  setTimeout(() => {
                    window.location.reload();
                  }, 2500);
                  try { conn.close(); } catch {}
                  return;
                }

                // 2. Verificar versión
                const serverVer = resp.serverVersion;
                const clientVer = localStorage.getItem('horus_current_version') || 'v2.0.0';
                if (serverVer && serverVer !== clientVer) {
                  setSyncStatus(`⚠️ Versión Central distinta (${serverVer}). Por favor actualiza.`);
                }
                
                if (resp.recordsStateSupported === true) {
                  closeTimeout = setTimeout(() => { try { conn.close(); } catch {} }, 8000);
                  conn.send({
                    type: 'RECORDS_STATE_REQUEST',
                    deviceId: localStorage.getItem('horus_device_id') || 'dev-unknown',
                    deviceName
                  });
                  return;
                }

                try {
                  await requestKnowledgeBase();
                } catch (error) {
                  console.error('Error requesting Knowledge Base:', error);
                  setSyncStatus('Error al actualizar Base de Conocimiento');
                  try { conn.close(); } catch {}
                }
              } else if (resp && resp.type === 'RECORDS_STATE_PAYLOAD') {
                clearTimeout(closeTimeout);
                try {
                  if (!applyControlRecordsStateRef.current || !resp.payload) throw new Error('Aplicación de estado de Control no disponible.');
                  const result = await applyControlRecordsStateRef.current(resp.payload);
                  if (result.protectedLocal > 0) {
                    setSyncStatus(`Cambios locales protegidos: ${result.protectedLocal}. No fueron sobrescritos por Control.`);
                  }
                  await requestKnowledgeBase();
                } catch (error) {
                  console.error('Error applying Control records state:', error);
                  setSyncStatus('Error al aplicar registros vigentes de Control');
                  try { conn.close(); } catch {}
                }
              } else if (resp && resp.type === 'KNOWLEDGE_BASE_PAYLOAD') {
                clearTimeout(closeTimeout);

                try {
                  if (resp.unchanged === true) {
                    try { conn.close(); } catch {}
                    return;
                  }

                  if (!isValidKnowledgeBase(resp.elements) || typeof resp.fingerprint !== 'string') {
                    throw new Error('Payload de Base de Conocimiento inválido.');
                  }

                  const calculatedFingerprint = await getKnowledgeBaseFingerprint(resp.elements);
                  if (calculatedFingerprint !== resp.fingerprint) {
                    throw new Error('La huella de Base de Conocimiento no coincide.');
                  }

                  if (!replaceKnowledgeBaseRef.current) {
                    throw new Error('Guardado local de Base de Conocimiento no disponible.');
                  }
                  await replaceKnowledgeBaseRef.current(resp.elements);
                } catch (error) {
                  console.error('Error applying Knowledge Base payload:', error);
                  setSyncStatus('Error al actualizar Base de Conocimiento');
                } finally {
                  try { conn.close(); } catch {}
                }
              }
            });

            conn.on('error', () => {
              clearTimeout(closeTimeout);
            });
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
            setSyncStatus('✅ Sin datos pendientes.');
            setIsSyncing(false);
            syncAttemptTimer = setTimeout(attemptSync, RECONNECT_INTERVAL);
            return;
          }

          setSyncStatus('📋 Datos pendientes de envío. Conectando con Central...');
          setIsSyncing(true);
          const conn = peer.connect(targetServerId);
          
          conn.on('open', () => {
            setSyncStatus('📤 Enviando datos pendientes...');
            conn.send({ 
              type: 'SYNC_PAYLOAD', 
              payload: unsynced,
              deviceId: localStorage.getItem('horus_device_id') || 'dev-unknown',
              deviceName: localStorage.getItem('horus_device_name') || 'Unknown'
            });
          });

          conn.on('data', async (data: any) => {
            if (data.type === 'SYNC_ACK') {
              await markDataAsSyncedRef.current(unsynced);
              recordSyncSuccess();
              setSyncStatus('✅ Envío confirmado por Central.');
              setTimeout(() => {
                if (isActive) setSyncStatus('✅ Sin datos pendientes.');
              }, 3000);
              setIsSyncing(false);
              conn.close();
            } else if (data.type === 'SYNC_ERROR' && data.code === 'NAME_CLASH') {
              setSyncStatus('⚠️ Nombre duplicado en la red.');
              setIsSyncing(false);
              conn.close();
              window.customAlert('El nombre de esta tablet ya está siendo usado por otra unidad en el Panel de Control. Por favor, cámbialo en la pantalla de Configuración.');
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
            } else if (data.type === 'SYNC_ERROR') {
              setSyncStatus(`❌ Error de sincronización${data.message ? `: ${data.message}` : '.'}`);
            }
          });

          conn.on('error', () => {
            setSyncStatus('🔌 Sin conexión con Central. Reintentando luego...');
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
          setSyncStatus('🔄 Conectando con Central...');
          attemptSync();
          // Start STATUS broadcast loop
          broadcastStatus();
          statusBroadcastTimer = setInterval(broadcastStatus, STATUS_BROADCAST_INTERVAL);
        });

        peer.on('error', (err) => {
          if (!isActive) return;
          console.error('PeerJS Client Error:', err);
          if (err.type === 'peer-unavailable') {
            setSyncStatus('🔌 Sin conexión con Central: apagada o fuera de alcance.');
            syncAttemptTimer = setTimeout(attemptSync, RECONNECT_INTERVAL);
          } else {
            setSyncStatus('🔌 Sin conexión con Central. Esperando red...');
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
  }, [role, handleStatusUpdate, deviceName]);

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

      setSyncStatus('🔄 Conectando con Central...');
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
        setSyncStatus(hasData ? '❌ Error de sincronización: sin conexión con Central.' : '🔌 Sin conexión con Central.');
        resolve({ success: false, message: 'No se pudo contactar al Panel de Control. Asegúrese de que esté encendido y en la misma red Wi-Fi.' });
      }, 8000);

      conn.on('open', () => {
        if (hasData) {
          setSyncStatus('📤 Enviando datos pendientes...');
          conn.send({ 
            type: 'SYNC_PAYLOAD', 
            payload: unsynced,
            deviceId: localStorage.getItem('horus_device_id') || 'dev-unknown',
            deviceName: localStorage.getItem('horus_device_name') || 'Unknown'
          });
        } else {
          setSyncStatus('🔄 Conectando con Central...');
          conn.send({ type: 'PING' });
        }
      });

      conn.on('data', async (data: any) => {
        clearTimeout(timeoutId);
        if (data.type === 'SYNC_ACK') {
          try {
            await markDataAsSyncedRef.current(unsynced);
            recordSyncSuccess();
            setSyncStatus('✅ Envío confirmado por Central.');
            setTimeout(() => {
              setSyncStatus('✅ Sin datos pendientes.');
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
          setSyncStatus('✅ Sin datos pendientes.');
          setIsSyncing(false);
          conn.close();
          resolve({ success: true, message: 'Conexión exitosa: El Panel de Control está en línea y todos los datos del dispositivo están al día.' });
        } else if (data.type === 'SYNC_ERROR') {
          setIsSyncing(false);
          conn.close();
          if (data.code === 'NAME_CLASH') {
            setSyncStatus('⚠️ Nombre duplicado en la red.');
            window.customAlert('El nombre de esta tablet ya está siendo usado por otra unidad en el Panel de Control. Por favor, cámbialo en la pantalla de Configuración.');
            resolve({ success: false, message: 'Rechazado por nombre duplicado. Modifique el nombre en Configuración.' });
          } else {
            setSyncStatus(`❌ Error de sincronización${data.message ? `: ${data.message}` : '.'}`);
            resolve({ success: false, message: `El servidor rechazó la sincronización: ${data.message || 'Error desconocido'}` });
          }
        }
      });

      conn.on('error', () => {
        clearTimeout(timeoutId);
        setIsSyncing(false);
        conn.close();
        setSyncStatus('🔌 Sin conexión con Central.');
        resolve({ success: false, message: 'No se pudo establecer conexión con el Panel de Control. Verifique su red Wi-Fi.' });
      });
    });
  };

  const requestFullBackup = (peerId: string): Promise<{ success: boolean; message: string; payload?: AppData }> => {
    return new Promise((resolve) => {
      if (!peerRef.current || peerRef.current.destroyed) {
        return resolve({ success: false, message: 'La red del Panel de Control no está activa.' });
      }
      if (!peerId) {
        return resolve({ success: false, message: 'El dispositivo no posee una dirección de red (Peer ID) válida.' });
      }

      setSyncStatus('📡 Conectando con dispositivo para copia...');
      const conn = peerRef.current.connect(peerId);
      
      let timeoutId: any;
      const resetTimeout = (seconds = 12) => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          conn.close();
          setSyncStatus('📡 Control: En línea y escuchando.');
          resolve({ success: false, message: 'Tiempo de espera agotado al recibir los datos.' });
        }, seconds * 1000);
      };

      resetTimeout(15); // Initial connection timeout

      conn.on('open', () => {
        setSyncStatus('📥 Solicitando copia histórica completa...');
        conn.send({ type: 'REQUEST_FULL_BACKUP' });
        resetTimeout(12);
      });

      let receivedChunks: string[] = [];
      let totalExpectedChunks = 0;

      conn.on('data', (data: any) => {
        if (data.type === 'FULL_BACKUP_HEADER') {
          resetTimeout(12);
          totalExpectedChunks = data.totalChunks;
          receivedChunks = new Array(totalExpectedChunks);
          setSyncStatus(`📥 Recibiendo copia (0/${totalExpectedChunks} partes)...`);
        } else if (data.type === 'FULL_BACKUP_CHUNK') {
          resetTimeout(12); // Extend timeout on each incoming chunk
          if (data.chunkIndex >= 0 && data.chunkIndex < totalExpectedChunks) {
            receivedChunks[data.chunkIndex] = data.chunkData;
            const receivedCount = receivedChunks.filter(x => x !== undefined).length;
            setSyncStatus(`📥 Recibiendo copia (${receivedCount}/${totalExpectedChunks} partes)...`);
          }
        } else if (data.type === 'FULL_BACKUP_END') {
          if (timeoutId) clearTimeout(timeoutId);
          conn.close();
          
          try {
            const fullJson = receivedChunks.join('');
            const payload = JSON.parse(fullJson);
            
            setSyncStatus('✅ Copia histórica recibida.');
            setTimeout(() => {
              setSyncStatus('📡 Control: En línea y escuchando.');
            }, 3000);
            resolve({ success: true, message: 'Copia histórica recibida con éxito.', payload });
          } catch (parseErr: any) {
            setSyncStatus('📡 Control: En línea y escuchando.');
            resolve({ success: false, message: `Error al reconstruir la copia: ${parseErr.message || String(parseErr)}` });
          }
        } else if (data.type === 'BACKUP_ERROR') {
          if (timeoutId) clearTimeout(timeoutId);
          conn.close();
          setSyncStatus('📡 Control: En línea y escuchando.');
          resolve({ success: false, message: `El dispositivo informó un error: ${data.message || 'desconocido'}` });
        } else {
          if (timeoutId) clearTimeout(timeoutId);
          conn.close();
          setSyncStatus('📡 Control: En línea y escuchando.');
          resolve({ success: false, message: 'Respuesta inválida del dispositivo.' });
        }
      });

      conn.on('error', (err) => {
        if (timeoutId) clearTimeout(timeoutId);
        conn.close();
        setSyncStatus('📡 Control: En línea y escuchando.');
        resolve({ success: false, message: `Error al conectar: ${err.message || 'desconocido'}` });
      });
    });
  };

  return { syncStatus, isSyncing, forceSync, lastSyncTimestamp, unitsStatus, requestFullBackup };
}
