import { useState, useEffect, useCallback } from 'react';
import Dashboard from './components/Dashboard';
import ShiftForm from './components/ShiftForm';
import FlightForm from './components/FlightForm';
import BatteriesDetectionsForm from './components/BatteriesDetectionsForm';
import VehicleChecklistForm from './components/VehicleChecklistForm';
import { DroneChecklistForm } from './components/DroneChecklistForm';
import { ChecklistSelector } from './components/ChecklistSelector';
import SettingsPanel from './components/SettingsPanel';
import RecordsExplorer from './components/RecordsExplorer';
import { RoleSetup } from './components/RoleSetup';
import BackupViewer from './components/BackupViewer';
import type { AppRole, UnitStatus } from './types';
import { useDatabase } from './hooks/useDatabase';
import { useAutoSync } from './hooks/useAutoSync';
import { exportToExcel, exportToJSON } from './utils/exportUtils';
import { formatDateDMY, formatTimestamp, getChronologicalTime } from './utils/dateUtils';
import { FileJson, Table, X, CheckCircle, Power } from 'lucide-react';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { Capacitor } from '@capacitor/core';

declare global {
  interface Window {
    customConfirm: (message: string) => Promise<boolean>;
    customAlert: (message: string) => Promise<void>;
    customPrompt: (message: string, placeholder?: string) => Promise<string | null>;
    customChoice: (message: string, choices: string[]) => Promise<string | null>;
  }
}

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [explorerInitialDeviceId, setExplorerInitialDeviceId] = useState<string | null>(null);
  const { 
    fullData: data, 
    lists, 
    saveShift, updateShift, closeShiftClosure, reopenShiftClosure, deleteShift,
    saveFlight, updateFlight, closeFlight, deleteFlight,
    saveBattery, updateBattery, deleteBattery,
    saveDetection, updateDetection, deleteDetection,
    saveChecklist, updateChecklist, deleteChecklist,
    saveDroneChecklist, updateDroneChecklist, deleteDroneChecklist,
    updateLists, replaceKnowledgeBase, replaceOperationalLists,
    syncIncomingData,
    getUnsyncedData,
    markDataAsSynced,
    getAllData, getControlRecordsState, applyControlRecordsState,
    historicalView, historicalState, restoreHistoricalRecord,
    permanentlyRemoveHistoricalRecord, resolveHistoricalConflict
  } = useDatabase();
  
  const [showExportModal, setShowExportModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isNewFlightRequested, setIsNewFlightRequested] = useState<boolean>(false);
  const [newFlightType, setNewFlightType] = useState<'KMS' | 'HS'>('KMS');
  const [editingChecklist, setEditingChecklist] = useState<any>(undefined);
  const [deviceName, setDeviceName] = useState(() => {
    let name = localStorage.getItem('horus_device_name');
    if (!name || !name.trim()) {
      const generated = `Tablet-${Math.floor(1000 + Math.random() * 9000)}`;
      localStorage.setItem('horus_device_name', generated);
      name = generated;
    }
    // Guarantee deviceId exists
    if (!localStorage.getItem('horus_device_id')) {
      const devId = 'dev-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(36);
      localStorage.setItem('horus_device_id', devId);
    }
    return name;
  });
  const [localDeviceId] = useState(() => {
    let id = localStorage.getItem('horus_device_id');
    if (!id) {
      id = 'dev-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(36);
      localStorage.setItem('horus_device_id', id);
    }
    return id;
  });
  
  const [appRole, setAppRole] = useState<AppRole | null>(() => {
    return (localStorage.getItem('horus_sync_role') as AppRole) || null;
  });

  // Historical Overrides for adding child records from RecordsExplorer
  const [historicalShiftId, setHistoricalShiftId] = useState<string | undefined>(undefined);
  const [historicalShiftRecordUid, setHistoricalShiftRecordUid] = useState<string | undefined>(undefined);
  const [historicalFlightData, setHistoricalFlightData] = useState<any>(undefined);

  const [themeMode, setThemeMode] = useState<'hud' | 'boost'>(() => {
    const stored = localStorage.getItem('theme_mode');
    if (stored === 'boost' || stored === 'hud') {
      return stored as 'hud' | 'boost';
    }
    return 'hud';
  });

  useEffect(() => {
    document.body.classList.remove('sunlight-mode', 'boost-mode');
    if (themeMode === 'boost') {
      document.body.classList.add('boost-mode');
    }
    localStorage.setItem('theme_mode', themeMode);
  }, [themeMode]);

  // Notifica al actualizador OTA en móvil, o sincroniza versión en modo Web (PC)
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      CapacitorUpdater.notifyAppReady();
    } else {
      fetch('https://raw.githubusercontent.com/gestionadmhorus-ship-it/Horus-Tablet/ota-updates/version.json', { cache: 'no-store' })
        .then(res => {
          if (res.ok) return res.json();
          throw new Error();
        })
        .then(data => {
          if (data && data.version) {
            localStorage.setItem('horus_current_version', data.version);
          }
        })
        .catch(() => {
          // Ignorar silenciosamente si no hay internet o falla
        });
    }
  }, []);

  // ── Detectar rol forzado desde URL (usado por launch_control.vbs) ──
  // Si la URL contiene ?force_role=server, configuramos el dispositivo como Control Panel
  // y limpiamos el parámetro de la URL para no repetirlo en cada recarga.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const forcedRole = params.get('force_role') as AppRole | null;
    if (forcedRole === 'server' || forcedRole === 'client') {
      localStorage.setItem('horus_sync_role', forcedRole);
      setAppRole(forcedRole);
      
      if (forcedRole === 'server') {
        if (!localStorage.getItem('horus_my_server_id')) {
          const generatedId = 'horus-server-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
          localStorage.setItem('horus_my_server_id', generatedId);
        }
        const currentName = localStorage.getItem('horus_device_name');
        if (!currentName || !currentName.trim() || currentName.startsWith('Tablet-')) {
          localStorage.setItem('horus_device_name', 'Control-Central');
          setDeviceName('Control-Central');
        }
      }

      // Clean the URL param without triggering a page reload
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
    }
  }, []);

  // ── STATUS snapshot for broadcasting to the server ──
  // Built with useCallback so the reference is stable and won't re-trigger useAutoSync.
  const getStatusSnapshot = useCallback((): Omit<UnitStatus, 'deviceId' | 'deviceName' | 'connected' | 'lastSeen'> => {
    // Compute derived values inline from the current closure
    const todayStr = formatDateDMY(new Date());
    const sortedShiftsSnap = data.shifts
      .filter(shift => shift.sourceDeviceId === localDeviceId || shift.originDeviceId === localDeviceId)
      .sort((a, b) => getChronologicalTime(a.timestamp) - getChronologicalTime(b.timestamp));
    const latestShiftSnap = sortedShiftsSnap.length > 0 ? sortedShiftsSnap[sortedShiftsSnap.length - 1] : undefined;
    const hasActiveShiftSnap = !!(latestShiftSnap && latestShiftSnap.timestamp.split(' ')[0] === todayStr && latestShiftSnap.status !== 'closed');
    const activeShiftIdSnap = hasActiveShiftSnap ? latestShiftSnap?.id : undefined;
    const activeShiftUidSnap = hasActiveShiftSnap ? latestShiftSnap?.recordUid : undefined;

    const activeFlightsSnap = activeShiftIdSnap ? data.flights.filter(f => (activeShiftUidSnap ? f.shiftRecordUid === activeShiftUidSnap : f.shiftId === activeShiftIdSnap) && f.status !== 'closed') : [];
    const latestFlightSnap = activeFlightsSnap.length > 0 ? activeFlightsSnap[activeFlightsSnap.length - 1] : undefined;
    const hasActiveFlightSnap = !!latestFlightSnap;

    const shiftFlights = activeShiftIdSnap ? data.flights.filter(f => activeShiftUidSnap ? f.shiftRecordUid === activeShiftUidSnap : f.shiftId === activeShiftIdSnap) : [];
    const shiftFlightIds = shiftFlights.map(f => f.recordUid);
    const kmsCount = shiftFlights.filter(f => f.flightType === 'KMS').length;
    const hsCount = shiftFlights.filter(f => f.flightType === 'HS').length;
    const detectionsCount = data.detections.filter(d => shiftFlightIds.includes(d.flightRecordUid)).length;

    return {
      hasActiveShift: hasActiveShiftSnap,
      coordinator: latestShiftSnap?.coordinator,
      vehicle: latestShiftSnap?.vehicle,
      drone: latestShiftSnap?.drone,
      assistants: latestShiftSnap?.assistants,
      hasActiveFlight: hasActiveFlightSnap,
      activeFlightType: latestFlightSnap?.flightType || undefined,
      activeFlightName: latestFlightSnap?.flightType === 'HS' ? latestFlightSnap?.taskTypeAndLocation : latestFlightSnap?.lineName,
      kmsCount,
      hsCount,
      detectionsCount,
      appVersion: localStorage.getItem('horus_current_version') || 'v2.0.0',
    };
  }, [data, localDeviceId]);

  const [unitsStatus, setUnitsStatus] = useState<Map<string, UnitStatus>>(() => new Map());

  const handleStatusUpdate = useCallback((status: UnitStatus) => {
    setUnitsStatus(prev => {
      const next = new Map(prev);
      next.set(status.deviceName, status);
      return next;
    });
  }, []);

  const [syncHistory, setSyncHistory] = useState<{ deviceName: string; timestamp: number; kmsCount: number; hsCount: number }[]>(() => {
    const stored = localStorage.getItem('horus_sync_history');
    return stored ? JSON.parse(stored) : [];
  });

  const handleSyncIncomingData = useCallback(async (payload: any) => {
    let senderName = 'Unknown';
    if (payload.shifts?.[0]) senderName = payload.shifts[0].deviceName;
    else if (payload.flights?.[0]) senderName = payload.flights[0].deviceName;
    else if (payload.batteries?.[0]) senderName = payload.batteries[0].deviceName;
    else if (payload.detections?.[0]) senderName = payload.detections[0].deviceName;

    const kmsCount = (payload.flights || []).filter((f: any) => f.flightType === 'KMS').length;
    const hsCount = (payload.flights || []).filter((f: any) => f.flightType === 'HS').length;

    await syncIncomingData(payload);

    setSyncHistory(prev => {
      const updated = [{ deviceName: senderName, timestamp: Date.now(), kmsCount, hsCount }, ...prev].slice(0, 10);
      localStorage.setItem('horus_sync_history', JSON.stringify(updated));
      return updated;
    });
  }, [syncIncomingData]);

  const { syncStatus, forceSync, lastSyncTimestamp, unitsStatus: hookUnitsStatus, requestFullBackup } = useAutoSync(
    appRole,
    getUnsyncedData,
    markDataAsSynced,
    handleSyncIncomingData,
    appRole === 'client' ? getStatusSnapshot : undefined,
    appRole === 'server' ? handleStatusUpdate : undefined,
    getAllData,
    deviceName,
    () => lists.elements,
    replaceKnowledgeBase,
    () => {
      const { elements: _elements, ...operationalLists } = lists;
      return operationalLists;
    },
    replaceOperationalLists,
    getControlRecordsState,
    applyControlRecordsState
  );

  // Merge hook-managed units state into local state for the dashboard
  useEffect(() => {
    if (hookUnitsStatus.size > 0) {
      setUnitsStatus(hookUnitsStatus);
    }
  }, [hookUnitsStatus]);

  const handleDeviceNameChange = (val: string) => {
    setDeviceName(val);
    localStorage.setItem('horus_device_name', val);
  };

  const handleRequestFullBackup = async (targetDeviceName: string, peerId: string) => {
    if (!requestFullBackup) return;
    const res = await requestFullBackup(peerId);
    if (res.success && res.payload) {
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `Recuperacion_${targetDeviceName}_${timestamp}.json`;
        
        const dataStr = JSON.stringify(res.payload, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // Guardar automáticamente en el listado de copias de localStorage
        try {
          const rawBackups = localStorage.getItem('horus_saved_backups');
          const backups = rawBackups ? JSON.parse(rawBackups) : [];
          
          const newBackup = {
            id: `Recuperacion_${targetDeviceName}_${timestamp}`,
            filename: filename,
            deviceName: targetDeviceName,
            timestamp: formatTimestamp(new Date()),
            payload: res.payload
          };
          
          backups.push(newBackup);
          if (backups.length > 5) {
            backups.shift();
          }
          localStorage.setItem('horus_saved_backups', JSON.stringify(backups));
        } catch (storageErr) {
          console.error('Error guardando en localStorage:', storageErr);
        }
        
        const goToViewer = await window.customConfirm(
          `Copia histórica de "${targetDeviceName}" recibida y guardada en el Visualizador.\n\n¿Deseas abrir el Visualizador de Respaldos ahora?`
        );
        if (goToViewer) {
          setCurrentPage('backup-viewer');
        }
      } catch (err: any) {
        await window.customAlert(`Error guardando archivo local: ${err.message || err}`);
      }
    } else {
      await window.customAlert(`No se pudo recuperar los datos: ${res.message}`);
    }
  };

  // Reusable custom dialog state
  const [dialog, setDialog] = useState<{
    show: boolean;
    message: string;
    type: 'alert' | 'confirm' | 'prompt' | 'choice';
    placeholder?: string;
    inputValue?: string;
    choices?: string[];
    resolve: ((val: any) => void) | null;
  }>({
    show: false,
    message: '',
    type: 'alert',
    placeholder: '',
    inputValue: '',
    choices: [],
    resolve: null
  });

  // Register global tactical dialogs on window
  useEffect(() => {
    window.customConfirm = (message: string): Promise<boolean> => {
      return new Promise((resolve) => {
        setDialog({
          show: true,
          message,
          type: 'confirm',
          placeholder: '',
          inputValue: '',
          choices: [],
          resolve
        });
      });
    };

    window.customAlert = (message: string): Promise<void> => {
      return new Promise((resolve) => {
        setDialog({
          show: true,
          message,
          type: 'alert',
          placeholder: '',
          inputValue: '',
          choices: [],
          resolve: () => resolve()
        });
      });
    };

    window.customPrompt = (message: string, placeholder?: string): Promise<string | null> => {
      return new Promise((resolve) => {
        setDialog({
          show: true,
          message,
          type: 'prompt',
          placeholder: placeholder || '',
          inputValue: '',
          choices: [],
          resolve
        });
      });
    };

    window.customChoice = (message: string, choices: string[]): Promise<string | null> => {
      return new Promise((resolve) => {
        setDialog({
          show: true,
          message,
          type: 'choice',
          placeholder: '',
          inputValue: '',
          choices,
          resolve
        });
      });
    };
  }, []);

  const totalRecords = data.shifts.length + data.flights.length + data.batteries.length + data.detections.length;



  // ─── Determine active shift by date + status ───
  const activeLists = { ...lists };
  let activeShiftId: string | undefined;
  let activeShiftRecordUid: string | undefined;
  
  const todayDateStr = formatDateDMY(new Date());
  
  // Sort shifts chronologically before finding the latest
  const shiftsInOperationalContext = appRole === 'client'
    ? data.shifts.filter(shift => shift.sourceDeviceId === localDeviceId || shift.originDeviceId === localDeviceId)
    : data.shifts;
  const sortedShifts = [...shiftsInOperationalContext].sort((a, b) => getChronologicalTime(a.timestamp) - getChronologicalTime(b.timestamp));
  const latestShift = sortedShifts.length > 0 ? sortedShifts[sortedShifts.length - 1] : undefined;

  // Check if the latest shift is from today but closed (for "Reabrir" button)
  const hasTodayClosedShift = !!(latestShift 
    && latestShift.timestamp.split(' ')[0] === todayDateStr 
    && latestShift.status === 'closed');

  if (latestShift) {
    const shiftDate = latestShift.timestamp.split(' ')[0];
    const isToday = shiftDate === todayDateStr;
    const isNotClosed = latestShift.status !== 'closed';

    if (isToday && isNotClosed) {
      activeShiftId = latestShift.id;
      activeShiftRecordUid = latestShift.recordUid;
      const assistants = latestShift.assistants || (latestShift.assistant ? [latestShift.assistant] : []);
      const activeCrew = [latestShift.coordinator, ...assistants].filter(Boolean);
      activeLists.pilots = activeCrew;
    }
  }

  const effectiveShiftId = historicalShiftId || activeShiftId;
  const effectiveShiftRecordUid = historicalShiftRecordUid || activeShiftRecordUid;

  // ─── Determine active flight (must belong to active shift) ───
  let activeFlightId: string | undefined;
  let activeFlightRecordUid: string | undefined;
  let activeFlightName: string | undefined;
  let activeFlightData: import('./types').FlightData | undefined;
  let activeFlightType: 'KMS' | 'HS' | undefined;

  if (data.flights.length > 0 && activeShiftId) {
    // Filter flights belonging to current active shift that are still open
    const activeShiftFlights = data.flights.filter(f => (activeShiftRecordUid ? f.shiftRecordUid === activeShiftRecordUid : f.shiftId === activeShiftId) && f.status !== 'closed');
    if (activeShiftFlights.length > 0) {
      // Sort to get the latest in case there are multiple open flights
      const sortedFlights = [...activeShiftFlights].sort((a, b) => getChronologicalTime(a.timestamp) - getChronologicalTime(b.timestamp));
      const latestFlight = sortedFlights[sortedFlights.length - 1];
      activeFlightId = latestFlight.id;
      activeFlightRecordUid = latestFlight.recordUid;
      activeFlightType = latestFlight.flightType || 'KMS';
      activeFlightName = activeFlightType === 'HS' ? latestFlight.taskTypeAndLocation : latestFlight.lineName;
      activeFlightData = latestFlight;
    }
  }

  const effectiveFlightId = historicalFlightData?.id || activeFlightId;
  const effectiveFlightName = historicalFlightData 
    ? (historicalFlightData.flightType === 'HS' ? historicalFlightData.taskTypeAndLocation : historicalFlightData.lineName) 
    : activeFlightName;
  const effectiveFlightCategory = historicalFlightData?.category || activeFlightData?.category;

  const closeFlightWithPrompt = async (flight: import('./types').FlightData): Promise<boolean> => {
    let obs = '';
    const now = new Date();
    const closedTime = formatTimestamp(now);
    
    if (flight.flightType === 'HS') {
      const result = await window.customPrompt(
        `Cerrar Vuelo HS (${flight.taskTypeAndLocation || 'Sin nombre'})\n¿Deseas registrar alguna observación al finalizar el vuelo? (opcional):`,
        'Escriba observaciones de cierre aquí...'
      );
      if (result === null) {
        // User clicked cancel, abort closing
        return false;
      }
      obs = result;
    } else {
      // KMS flight
      const confirm = await window.customConfirm(`¿Deseas cerrar el vuelo KMS activo (${flight.lineName})?`);
      if (!confirm) return false;
    }
    
    await closeFlight(flight.recordUid!, closedTime, obs);
    return true;
  };

  const handleCloseFlight = async (recordUid: string) => {
    const flight = data.flights.find(f => f.recordUid === recordUid);
    if (flight) {
      await closeFlightWithPrompt(flight);
    }
  };

  const handleSaveFlight = async (flightData: import('./types').FlightData) => {
    if (activeShiftId) {
      // Close any active flights in the current shift
      const activeFlights = data.flights.filter(f => (activeShiftRecordUid ? f.shiftRecordUid === activeShiftRecordUid : f.shiftId === activeShiftId) && f.status !== 'closed');
      for (const f of activeFlights) {
        let obs = '';
        const now = new Date();
        const closedTime = formatTimestamp(now);
        if (f.flightType === 'HS') {
          const result = await window.customPrompt(
            `Se cerrará el vuelo HS anterior (${f.taskTypeAndLocation || 'Sin nombre'}) para iniciar este nuevo vuelo.\nIngrese observaciones finales (opcional):`,
            'Observaciones de cierre automático...'
          );
          obs = result !== null ? result : '';
        }
        await closeFlight(f.recordUid!, closedTime, obs);
      }
    }
    await saveFlight({ ...flightData, shiftRecordUid: effectiveShiftRecordUid, status: 'active' });
  };

  const handleNewFlight = (type: 'KMS' | 'HS') => {
    setNewFlightType(type);
    setIsNewFlightRequested(true);
    setCurrentPage('flight');
  };

  // ─── Handlers ───
  const handleCloseShift = async () => {
    if (activeShiftId && latestShift) {
      const ok = await window.customConfirm('¿Estás seguro de cerrar la jornada actual?');
      if (ok) {
        const activeFlights = data.flights.filter(f => (activeShiftRecordUid ? f.shiftRecordUid === activeShiftRecordUid : f.shiftId === activeShiftId) && f.status !== 'closed');
        const closureEventAt = Date.now();
        const closureEventId = `${latestShift.recordUid}-${closureEventAt}-${Math.random().toString(36).slice(2, 10)}`;
        const flightsToClose: Array<{ flight: import('./types').FlightData; closedTimestamp: string; closingObservations: string }> = [];
        for (const f of activeFlights) {
          let obs = '';
          const now = new Date();
          const closedTime = formatTimestamp(now);
          if (f.flightType === 'HS') {
            const result = await window.customPrompt(
              `Se cerrará el vuelo HS activo (${f.taskTypeAndLocation || 'Sin nombre'}) por cierre de jornada.\nIngrese observaciones finales (opcional):`,
              'Cierre por fin de jornada'
            );
            obs = result !== null ? result : '';
          }
          flightsToClose.push({ flight: f, closedTimestamp: closedTime, closingObservations: obs });
        }
        const result = await closeShiftClosure(latestShift, flightsToClose, closureEventId, closureEventAt);
        if (!result.ok) await window.customAlert(result.message || 'No se pudo completar el cierre de Jornada.');
      }
    }
  };

  const handleReopenShift = async () => {
    if (!latestShift || !hasTodayClosedShift) return;

    const shiftFlights = data.flights.filter(f => latestShift.recordUid
      ? f.shiftRecordUid === latestShift.recordUid
      : f.shiftId === latestShift.id);
    let flightsToReopen: import('./types').FlightData[] = [];
    let legacyEventId: string | undefined;

    const eventFlights = latestShift.lastClosureEventId
      ? shiftFlights.filter(f => f.shiftClosure?.eventId === latestShift.lastClosureEventId)
      : [];
    const expectedClosureUids = Array.isArray(latestShift.lastClosureFlightRecordUids)
      ? latestShift.lastClosureFlightRecordUids
      : undefined;
    const expectedClosureUidSet = new Set(expectedClosureUids || []);
    const foundEventUidSet = new Set(eventFlights.map(f => f.recordUid).filter((uid): uid is string => !!uid));
    const hasExactClosureFlightSet = !!expectedClosureUids
      && expectedClosureUidSet.size === expectedClosureUids.length
      && foundEventUidSet.size === eventFlights.length
      && expectedClosureUidSet.size === foundEventUidSet.size
      && [...expectedClosureUidSet].every(uid => foundEventUidSet.has(uid));
    const hasCurrentClosureMetadata = latestShift.status === 'closed'
      && !!latestShift.lastClosureEventId
      && typeof latestShift.lastClosureEventAt === 'number'
      && hasExactClosureFlightSet
      && latestShift.lastClosureEventAt <= (latestShift.lastModified || 0)
      && eventFlights.every(f => f.status === 'closed'
        && !f.shiftClosure?.undoneAt
        && !!f.closedTimestamp
        && f.closedTimestamp === f.shiftClosure?.closedTimestamp);

    if (hasCurrentClosureMetadata) {
      flightsToReopen = eventFlights;
    } else {
      const shiftClosedAt = latestShift.lastModified || 0;
      const plausible = shiftFlights
        .filter(f => f.status === 'closed' && !!f.closedTimestamp)
        .map(f => ({ flight: f, distance: shiftClosedAt && f.lastModified ? Math.abs(shiftClosedAt - f.lastModified) : Number.POSITIVE_INFINITY }))
        .filter(candidate => candidate.distance <= 5 * 60 * 1000)
        .sort((a, b) => a.distance - b.distance || getChronologicalTime(b.flight.timestamp) - getChronologicalTime(a.flight.timestamp));

      const describe = (flight: import('./types').FlightData) =>
        `${flight.flightType || 'Vuelo'} | ${flight.lineName || flight.taskTypeAndLocation || 'Sin nombre'} | inicio ${flight.timestamp} | cierre ${flight.closedTimestamp}`;

      if (plausible.length === 1) {
        const choice = await window.customChoice(
          `Se encontró un Vuelo legacy asociado razonablemente al cierre:\n${describe(plausible[0].flight)}`,
          ['REABRIR JORNADA Y VUELO', 'REABRIR SÓLO JORNADA']
        );
        if (choice === null) return;
        if (choice === 'REABRIR JORNADA Y VUELO') flightsToReopen = [plausible[0].flight];
      } else if (plausible.length > 1) {
        const choices = plausible.map(({ flight }, index) => `${index + 1}. ${describe(flight)}`);
        const choice = await window.customChoice(
          'Hay varios Vuelos legacy plausibles. Selecciona explícitamente cuál reabrir, o reabre sólo la Jornada.',
          [...choices, 'REABRIR SÓLO JORNADA']
        );
        if (choice === null) return;
        const selectedIndex = choices.indexOf(choice);
        if (selectedIndex >= 0) flightsToReopen = [plausible[selectedIndex].flight];
      } else {
        const choice = await window.customChoice(
          'No existe un Vuelo legacy razonablemente identificable para este cierre.',
          ['REABRIR SÓLO JORNADA']
        );
        if (choice === null) return;
      }
      if (flightsToReopen.length > 0) legacyEventId = `legacy-${latestShift.recordUid}-${Date.now()}`;
    }

    const result = await reopenShiftClosure(latestShift, flightsToReopen, legacyEventId);
    if (!result.ok) await window.customAlert(result.message || 'No se pudo completar la reapertura.');
  };

  const handleEditShift = () => {
    setCurrentPage('shift');
  };

  const handleEditFlight = () => {
    setCurrentPage('flight');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <Dashboard
            data={data}
            onNavigate={(page, deviceId) => {
              setIsNewFlightRequested(false);
              if (page === 'explorer') setExplorerInitialDeviceId(deviceId || null);
              setCurrentPage(page);
            }}
            onSettings={() => setShowSettings(true)}
            hasActiveShift={!!activeShiftId}
            hasActiveFlight={!!activeFlightId}
            activeFlightType={activeFlightType}
            onCloseShift={handleCloseShift}
            onReopenShift={handleReopenShift}
            hasTodayClosedShift={hasTodayClosedShift}
            activeShiftId={activeShiftId}
            activeFlightId={activeFlightId}
            activeShiftRecordUid={activeShiftRecordUid}
            activeFlightRecordUid={activeFlightRecordUid}
            activeFlightName={activeFlightName}
            onEditShift={handleEditShift}
            onEditFlight={handleEditFlight}
            onNewFlight={handleNewFlight}
            onCloseFlight={handleCloseFlight}
            deviceName={deviceName}
            syncStatus={syncStatus}
            appRole={appRole}
            currentTheme={themeMode}
            onChangeTheme={setThemeMode}
            onForceSync={forceSync}
            lastSyncTimestamp={lastSyncTimestamp}
            unitsStatus={unitsStatus}
            syncHistory={syncHistory}
            onExport={() => setShowExportModal(true)}
            onRequestFullBackup={handleRequestFullBackup}
          />
        );
      case 'shift':
        return (
          <ShiftForm 
            onSave={saveShift}
            onUpdate={updateShift}
            onBack={() => setCurrentPage('dashboard')} 
            lists={lists}
            editData={activeShiftId && latestShift ? latestShift : undefined}
          />
        );
      case 'flight':
        return (
          <FlightForm 
            key={isNewFlightRequested ? 'new-flight' : (effectiveFlightId || 'create-flight')}
            onSave={async (data) => { await handleSaveFlight(data); setIsNewFlightRequested(false); }}
            onUpdate={updateFlight}
            onBack={() => { setIsNewFlightRequested(false); setHistoricalShiftId(undefined); setHistoricalShiftRecordUid(undefined); setCurrentPage('dashboard'); }}
            lists={activeLists} 
            activeShiftId={effectiveShiftId}
            editData={effectiveFlightId && activeFlightData && !isNewFlightRequested ? activeFlightData : undefined}
            defaultFlightType={newFlightType}
            onRegisterNew={() => { setNewFlightType(activeFlightData?.flightType || 'KMS'); setIsNewFlightRequested(true); }}
            onChangeShift={() => setCurrentPage('shift')}
          />
        );
      case 'batteries':
        return (
          <BatteriesDetectionsForm
            onSaveBattery={(item) => saveBattery({ ...item, flightRecordUid: historicalFlightData?.recordUid || activeFlightData?.recordUid })}
            onSaveDetection={(item) => saveDetection({ ...item, flightRecordUid: historicalFlightData?.recordUid || activeFlightData?.recordUid })}
            onBack={() => { setHistoricalFlightData(undefined); setCurrentPage('dashboard'); }}
            lists={activeLists}
            activeFlightId={effectiveFlightId}
            activeFlightName={effectiveFlightName}
            activeFlightCategory={effectiveFlightCategory}
          />
        );
      case 'checklist':
        return (
          <ChecklistSelector
            onSelect={(type) => {
              if (type === 'vehicle') {
                setCurrentPage('checklist-vehicular');
              } else {
                setCurrentPage('checklist-dron');
              }
            }}
            onBack={() => setCurrentPage('dashboard')}
          />
        );
      case 'checklist-vehicular':
        return (
          <VehicleChecklistForm
            onSave={saveChecklist}
            onUpdate={updateChecklist}
            onBack={() => {
              if (editingChecklist) {
                setEditingChecklist(undefined);
                setCurrentPage('explorer');
              } else {
                setCurrentPage('checklist');
              }
            }}
            lists={lists}
            history={data.checklists || []}
            editData={editingChecklist}
          />
        );
      case 'checklist-dron':
        return (
          <DroneChecklistForm
            onSave={saveDroneChecklist}
            onUpdate={updateDroneChecklist}
            onBack={() => {
              if (editingChecklist) {
                setEditingChecklist(undefined);
                setCurrentPage('explorer');
              } else {
                setCurrentPage('checklist');
              }
            }}
            lists={lists}
            history={data.droneChecklists || []}
            editData={editingChecklist}
          />
        );
      case 'explorer':
        return (
          <RecordsExplorer 
            data={data} 
            lists={lists}
            isServer={appRole === 'server'}
            isFieldUnit={appRole === 'client'}
            ownDeviceId={appRole === 'client' ? localDeviceId : undefined}
            unitsStatus={unitsStatus}
            initialDeviceId={explorerInitialDeviceId}
            historicalView={historicalView}
            historicalState={historicalState}
            onRestoreHistorical={restoreHistoricalRecord}
            onPermanentlyRemoveHistorical={permanentlyRemoveHistoricalRecord}
            onResolveHistoricalConflict={resolveHistoricalConflict}
            onBack={() => setCurrentPage('dashboard')} 
            onUpdateShift={updateShift}
            onDeleteShift={deleteShift}
            onUpdateFlight={updateFlight}
            onDeleteFlight={deleteFlight}
            onUpdateBattery={updateBattery}
            onDeleteBattery={deleteBattery}
            onUpdateDetection={updateDetection}
            onDeleteDetection={deleteDetection}
            onUpdateChecklist={(item) => {
              if ('droneId' in item) {
                updateDroneChecklist(item);
              } else {
                updateChecklist(item);
              }
            }}
            onDeleteChecklist={(id) => {
              // Intenta borrar de ambos stores
              deleteChecklist(id);
              deleteDroneChecklist(id);
            }}
            onViewChecklist={(item) => {
              setEditingChecklist(item);
              if ('droneId' in item) {
                setCurrentPage('checklist-dron');
              } else {
                setCurrentPage('checklist-vehicular');
              }
            }}
            onAddNew={(action) => {
              setHistoricalShiftId(undefined);
              setHistoricalShiftRecordUid(undefined);
              setHistoricalFlightData(undefined);
              if (action === 'shifts') {
                setCurrentPage('shift');
              } else if (action === 'flights_KMS') {
                setNewFlightType('KMS');
                setIsNewFlightRequested(true);
                setCurrentPage('flight');
              } else if (action === 'flights_HS') {
                setNewFlightType('HS');
                setIsNewFlightRequested(true);
                setCurrentPage('flight');
              } else if (action === 'batteries_detections') {
                setCurrentPage('batteries');
              } else if (action === 'checklists') {
                setCurrentPage('checklist');
              }
            }}
            onAddChildRecord={async (table, parentData) => {
              if (table === 'shifts') {
                const type = await window.customChoice(`Nuevo vuelo para la jornada del coordinador ${parentData.coordinator}.\nSelecciona el tipo de vuelo:`, ['KMS', 'HS']);
                if (type === null) return; // cancelled
                const t = type.trim().toUpperCase() || 'KMS';
                if (t === 'KMS' || t === 'HS') {
                  setHistoricalShiftId(parentData.id);
                  setHistoricalShiftRecordUid(parentData.recordUid);
                  setNewFlightType(t as 'KMS'|'HS');
                  setIsNewFlightRequested(true);
                  setCurrentPage('flight');
                } else {
                  await window.customAlert('Tipo de vuelo inválido. Debe ser KMS o HS.');
                }
              } else if (table === 'flights') {
                setHistoricalFlightData(parentData);
                setCurrentPage('batteries');
              }
            }}
            onSyncReceived={syncIncomingData}
          />
        );
      case 'backup-viewer':
        return (
          <BackupViewer
            onBack={() => setCurrentPage('dashboard')}
          />
        );
      default:
        return (
          <Dashboard
            data={data}
            onNavigate={(page, deviceId) => {
              setIsNewFlightRequested(false);
              if (page === 'explorer') setExplorerInitialDeviceId(deviceId || null);
              setCurrentPage(page);
            }}
            onSettings={() => setShowSettings(true)}
            hasActiveShift={!!activeShiftId}
            hasActiveFlight={!!activeFlightId}
            activeFlightType={activeFlightType}
            onCloseShift={handleCloseShift}
            onReopenShift={handleReopenShift}
            hasTodayClosedShift={hasTodayClosedShift}
            activeShiftId={activeShiftId}
            activeFlightId={activeFlightId}
            activeFlightName={activeFlightName}
            onEditShift={handleEditShift}
            onEditFlight={handleEditFlight}
            onNewFlight={handleNewFlight}
            onCloseFlight={handleCloseFlight}
            deviceName={deviceName}
            syncStatus={syncStatus}
            appRole={appRole}
            currentTheme={themeMode}
            onChangeTheme={setThemeMode}
            onForceSync={forceSync}
            lastSyncTimestamp={lastSyncTimestamp}
            unitsStatus={unitsStatus}
            syncHistory={syncHistory}
            onExport={() => setShowExportModal(true)}
            onRequestFullBackup={handleRequestFullBackup}
          />
        );
    }
  };

  // Aesthetic wrapper glowing effect
  const appStyle: React.CSSProperties = {
    minHeight: '100vh',
    position: 'relative',
    transition: 'box-shadow 0.5s ease',
    boxShadow: !!activeShiftId 
      ? 'inset 0 0 50px rgba(0, 255, 136, 0.15)' // Glowing green
      : 'inset 0 0 50px rgba(255, 0, 0, 0.15)',  // Glowing red
  };

  if (!appRole) {
    return (
      <RoleSetup 
        onComplete={(role, newDeviceName, targetServerId, myServerId) => {
          localStorage.setItem('horus_sync_role', role);
          if (targetServerId) localStorage.setItem('horus_target_server_id', targetServerId);
          if (myServerId) localStorage.setItem('horus_my_server_id', myServerId);
          
          setAppRole(role);
          handleDeviceNameChange(newDeviceName);
        }} 
      />
    );
  }

  return (
    <div style={appStyle}>
      {/* Global Logo + App Name - Only shown on inner pages (forms, records, etc)
           Hidden on Dashboard which has its own full banner with logo */}
      {currentPage !== 'dashboard' && (
        <>
          <div className="no-print" style={{ position: 'absolute', top: '1.5rem', left: '2rem', zIndex: 1000, pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img src="/logo_horus_nuevo.png" alt="Horus Dron" style={{ height: '40px', filter: 'drop-shadow(0px 0px 10px rgba(0,0,0,0.8))' }} />
            <div style={{ lineHeight: 1.1 }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, letterSpacing: '2px', color: 'var(--primary)', textTransform: 'uppercase' }}>
                Hermes <em style={{ fontStyle: 'italic' }}>II</em>
              </div>
              <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                Horus Dron
              </div>
            </div>
          </div>
          <div className="no-print" style={{ position: 'fixed', top: '1.5rem', right: '2rem', zIndex: 1000, display: 'flex', gap: '0.4rem', alignItems: 'center', background: 'var(--card-bg)', border: '1px solid var(--glass-border)', borderRadius: '10px', padding: '4px', boxShadow: 'var(--shadow-glow)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
            {[
              { id: 'hud', label: '🌙 HUD', title: 'Modo Oscuro' },
              { id: 'boost', label: '⚡ BOOST', title: 'HUD Alto Brillo' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setThemeMode(t.id as any)}
                style={{
                  background: themeMode === t.id ? 'var(--primary)' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  color: themeMode === t.id ? '#FFFFFF' : 'var(--text-primary)',
                  padding: '0.5rem 0.8rem',
                  cursor: 'pointer',
                  fontWeight: 800,
                  fontSize: '0.75rem',
                  transition: 'all 0.2s ease',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
                title={t.title}
              >
                {t.label}
              </button>
            ))}
          </div>
        </>
      )}

      {renderPage()}

      {/* Settings Panel */}
      {showSettings && (
        <SettingsPanel
          lists={lists}
          onUpdate={updateLists}
          onClose={() => setShowSettings(false)}
          deviceName={deviceName}
          onDeviceNameChange={handleDeviceNameChange}
          onSyncReceived={syncIncomingData}
        />
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="global-modal-overlay export-modal-overlay" style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="glass global-modal-panel export-modal-panel" style={{ padding: '3rem', width: '90%', maxWidth: '500px', position: 'relative' }}>
            <button
              onClick={() => setShowExportModal(false)}
              className="export-modal-close"
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}
            >
              <X size={24} />
            </button>

            <h2 className="global-modal-title export-modal-title" style={{ textAlign: 'center', marginBottom: '0.5rem', fontSize: '1.8rem' }}>Exportar Reporte</h2>
            <p className="global-modal-copy" style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.85rem' }}>
              {totalRecords} registro{totalRecords !== 1 ? 's' : ''} disponible{totalRecords !== 1 ? 's' : ''}
            </p>

            <div className="export-modal-actions" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <button
                onClick={() => { exportToExcel(data); setShowExportModal(false); }}
                className="btn-3d global-modal-action"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', background: 'linear-gradient(135deg, #1D6F42, #217346)' }}
              >
                <Table size={24} /> Descargar Excel (.xlsx)
              </button>

              <button
                onClick={() => { exportToJSON(data); setShowExportModal(false); }}
                className="btn-3d global-modal-action"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', background: 'linear-gradient(135deg, #333, #111)' }}
              >
                <FileJson size={24} /> Descargar JSON (.json)
              </button>
            </div>

            <div className="export-modal-summary" style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.5rem', textAlign: 'center' }}>
              {[
                { label: 'Jornadas', count: data.shifts.length, color: 'var(--primary)' },
                { label: 'Vuelos', count: data.flights.length, color: 'var(--secondary)' },
                { label: 'Baterías', count: data.batteries.length, color: '#00c2ff' },
                { label: 'Detecciones', count: data.detections.length, color: 'var(--accent)' },
              ].map(({ label, count, color }) => (
                <div className="export-modal-metric" key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '0.75rem 0.5rem' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color }}>{count}</div>
                  <div className="export-modal-metric-label" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reusable Custom Tactical Modal for Alerts/Confirms */}
      {dialog.show && (
        <div className="global-modal-overlay tactical-dialog-overlay" style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1100,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div className="glass global-modal-panel tactical-dialog-panel" style={{
            padding: '2.5rem', 
            width: '90%', 
            maxWidth: '450px', 
            border: `2px solid ${dialog.type === 'confirm' || dialog.type === 'prompt' ? 'var(--primary)' : '#00ff88'}`,
            boxShadow: `0 0 40px ${dialog.type === 'confirm' || dialog.type === 'prompt' ? 'rgba(240,196,25,0.25)' : 'rgba(0,255,136,0.25)'}`,
            borderRadius: '12px',
            textAlign: 'center',
            background: 'rgba(5,5,5,0.95)'
          }}>
            {/* Title / Icon based on type */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <div style={{
                background: dialog.type === 'confirm' || dialog.type === 'prompt' ? 'rgba(240,196,25,0.1)' : 'rgba(0,255,136,0.1)',
                color: dialog.type === 'confirm' || dialog.type === 'prompt' ? 'var(--primary)' : '#00ff88',
                borderRadius: '50%',
                padding: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `inset 0 0 10px ${dialog.type === 'confirm' || dialog.type === 'prompt' ? 'rgba(240,196,25,0.2)' : 'rgba(0,255,136,0.2)'}`
              }}>
                {dialog.type === 'confirm' || dialog.type === 'prompt' ? (
                  <Power size={32} />
                ) : (
                  <CheckCircle size={32} />
                )}
              </div>
            </div>

            <h3 className="global-modal-title" style={{ color: 'white', fontSize: '1.4rem', fontWeight: 900, marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {dialog.type === 'confirm' ? 'Confirmación Requerida' : dialog.type === 'prompt' ? 'Registro de Observación' : dialog.type === 'choice' ? 'Selección Requerida' : 'Notificación'}
            </h3>
            
            <p className="global-modal-copy" style={{ color: '#E0E0E0', fontSize: '1.05rem', lineHeight: '1.6', marginBottom: '1.5rem', whiteSpace: 'pre-line', fontWeight: 500 }}>
              {dialog.message}
            </p>

            {dialog.type === 'prompt' && (
              <textarea
                className="global-modal-prompt"
                value={dialog.inputValue || ''}
                onChange={(e) => setDialog(d => ({ ...d, inputValue: e.target.value }))}
                placeholder={dialog.placeholder || 'Escriba aquí (opcional)...'}
                rows={3}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.5)',
                  border: '1px solid var(--primary)',
                  borderRadius: '8px',
                  color: 'white',
                  padding: '0.75rem',
                  fontSize: '1rem',
                  marginBottom: '1.5rem',
                  outline: 'none',
                  resize: 'none',
                  boxSizing: 'border-box'
                }}
              />
            )}

            {dialog.type === 'choice' && dialog.choices && (
              <div className="global-modal-choices" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                {dialog.choices.map(choice => (
                  <button
                    key={choice}
                    onClick={() => {
                      dialog.resolve?.(choice);
                      setDialog({ show: false, message: '', type: 'alert', placeholder: '', inputValue: '', choices: [], resolve: null });
                    }}
                    className="btn-3d global-modal-action global-modal-choice"
                    style={{
                      width: '100%',
                      background: choice === 'KMS' ? 'var(--neon-green)' : choice === 'HS' ? 'var(--neon-cyan)' : 'var(--primary)',
                      color: 'black',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      padding: '1.25rem',
                      fontSize: '1.2rem',
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    Vuelo {choice}
                  </button>
                ))}
              </div>
            )}

            <div className="global-modal-actions" style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              {dialog.type === 'confirm' || dialog.type === 'prompt' ? (
                <>
                  <button
                    onClick={() => {
                      dialog.resolve?.(dialog.type === 'prompt' ? (dialog.inputValue || '') : true);
                      setDialog({ show: false, message: '', type: 'alert', placeholder: '', inputValue: '', choices: [], resolve: null });
                    }}
                    className="btn-3d global-modal-action"
                    style={{
                      flex: 1,
                      background: 'var(--primary)',
                      color: 'black',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      padding: '1rem',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={() => {
                      dialog.resolve?.(dialog.type === 'prompt' ? null : false);
                      setDialog({ show: false, message: '', type: 'alert', placeholder: '', inputValue: '', choices: [], resolve: null });
                    }}
                    className="global-modal-action"
                    style={{
                      flex: 1,
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#AAA',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      padding: '1rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                      e.currentTarget.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                      e.currentTarget.style.color = '#AAA';
                    }}
                  >
                    Cancelar
                  </button>
                </>
              ) : dialog.type === 'choice' ? (
                  <button
                    onClick={() => {
                      dialog.resolve?.(null);
                      setDialog({ show: false, message: '', type: 'alert', placeholder: '', inputValue: '', choices: [], resolve: null });
                    }}
                    className="global-modal-action"
                    style={{
                      flex: 1,
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#AAA',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      padding: '1rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Cancelar
                  </button>
              ) : (
                <button
                  onClick={() => {
                    dialog.resolve?.(true);
                    setDialog({ show: false, message: '', type: 'alert', placeholder: '', inputValue: '', choices: [], resolve: null });
                  }}
                  className="btn-3d global-modal-action"
                  style={{
                    flex: 1,
                    background: '#00ff88',
                    color: 'black',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    padding: '1rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    boxShadow: '0 0 15px rgba(0,255,136,0.3)'
                  }}
                >
                  Entendido
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <style>{`
        .global-modal-overlay,
        .global-modal-overlay * {
          box-sizing: border-box;
        }
        .global-modal-overlay {
          padding: 1rem;
          align-items: flex-start !important;
          overflow-x: hidden;
          overflow-y: auto;
        }
        .global-modal-panel {
          min-width: 0;
          max-height: calc(100dvh - 2rem);
          margin: auto;
          overflow-x: hidden;
          overflow-y: auto;
        }
        .global-modal-title,
        .global-modal-copy,
        .export-modal-metric,
        .export-modal-metric-label {
          min-width: 0;
          max-width: 100%;
          overflow-wrap: anywhere;
        }
        .export-modal-title {
          padding-inline: 2.5rem;
        }
        .export-modal-close {
          width: 48px;
          min-width: 48px;
          height: 48px;
          min-height: 48px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .global-modal-action {
          min-width: 0;
          min-height: 48px;
          max-width: 100%;
          white-space: normal;
          overflow-wrap: anywhere;
        }
        .global-modal-actions {
          min-width: 0;
          max-width: 100%;
          flex-wrap: wrap;
        }
        .global-modal-actions > .global-modal-action {
          flex: 1 1 150px !important;
        }
        .global-modal-prompt {
          width: 100%;
          min-width: 0;
          max-width: 100%;
          box-sizing: border-box;
        }
        .global-modal-choices,
        .export-modal-actions {
          min-width: 0;
          max-width: 100%;
        }
        .export-modal-summary {
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          min-width: 0;
          max-width: 100%;
        }
        @media (max-width: 600px) {
          .global-modal-actions {
            flex-direction: column;
            align-items: stretch;
          }
          .global-modal-actions > .global-modal-action {
            width: 100% !important;
            flex-basis: auto !important;
          }
          .export-modal-summary {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
      `}</style>
    </div>
  );
}

export default App;
