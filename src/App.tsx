import { useState, useEffect } from 'react';
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
import type { AppRole } from './types';
import { useDatabase } from './hooks/useDatabase';
import { useAutoSync } from './hooks/useAutoSync';
import { exportToExcel, exportToJSON } from './utils/exportUtils';
import { formatDateDMY, formatTimestamp } from './utils/dateUtils';
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
  const { 
    fullData: data, 
    lists, 
    saveShift, updateShift, deleteShift,
    saveFlight, updateFlight, deleteFlight,
    saveBattery, updateBattery, deleteBattery,
    saveDetection, updateDetection, deleteDetection,
    saveChecklist, updateChecklist, deleteChecklist,
    saveDroneChecklist, updateDroneChecklist, deleteDroneChecklist,
    updateLists,
    syncIncomingData,
    getUnsyncedData,
    markDataAsSynced
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
    return name;
  });
  
  const [appRole, setAppRole] = useState<AppRole | null>(() => {
    return (localStorage.getItem('horus_sync_role') as AppRole) || null;
  });

  // Historical Overrides for adding child records from RecordsExplorer
  const [historicalShiftId, setHistoricalShiftId] = useState<string | undefined>(undefined);
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

  // Notifica al actualizador OTA que la app no crasheó
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      CapacitorUpdater.notifyAppReady();
    }
  }, []);

  const { syncStatus, forceSync } = useAutoSync(
    appRole,
    getUnsyncedData,
    markDataAsSynced,
    syncIncomingData
  );

  const handleDeviceNameChange = (val: string) => {
    setDeviceName(val);
    localStorage.setItem('horus_device_name', val);
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

  // Helper to chronologically parse locale timestamps like "20/5/2026 07:15:54" or ISO "2026-05-27T10:00:00.000Z"
  const getChronologicalTime = (timestamp: string): number => {
    if (!timestamp) return 0;
    
    // Check if it's already an ISO timestamp (e.g. from new data format)
    if (timestamp.includes('T') && timestamp.includes('Z')) {
      const parsed = new Date(timestamp).getTime();
      if (!isNaN(parsed)) return parsed;
    }

    const [datePart, timePart, period] = timestamp.split(' ');
    if (!datePart) return 0;
    
    const dateSplit = datePart.split(/[-/]/);
    if (dateSplit.length === 3) {
      // Legacy "DD/MM/YYYY" format heuristic
      let d = parseInt(dateSplit[0], 10);
      let m = parseInt(dateSplit[1], 10);
      let y = parseInt(dateSplit[2], 10);
      if (y < 100) y += 2000;
      
      // If it looks like American MM/DD/YYYY where month > 12 is impossible
      if (d <= 12 && m > 12) {
        // Swap them
        const temp = d; d = m; m = temp;
      }
      
      const timeStr = (timePart || '00:00:00') + (period ? ` ${period}` : '');
      // Force ISO parsing via YYYY-MM-DD
      const isoStr = `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')} ${timeStr}`;
      const parsed = new Date(isoStr).getTime();
      if (!isNaN(parsed)) return parsed;
    }
    // Final fallback
    const fallback = new Date(timestamp).getTime();
    return isNaN(fallback) ? 0 : fallback;
  };

  // ─── Determine active shift by date + status ───
  const activeLists = { ...lists };
  let activeShiftId: string | undefined;
  
  const todayDateStr = formatDateDMY(new Date());
  
  // Sort shifts chronologically before finding the latest
  const sortedShifts = [...data.shifts].sort((a, b) => getChronologicalTime(a.timestamp) - getChronologicalTime(b.timestamp));
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
      const assistants = latestShift.assistants || (latestShift.assistant ? [latestShift.assistant] : []);
      const activeCrew = [latestShift.coordinator, ...assistants].filter(Boolean);
      activeLists.pilots = activeCrew;
    }
  }

  const effectiveShiftId = historicalShiftId || activeShiftId;

  // ─── Determine active flight (must belong to active shift) ───
  let activeFlightId: string | undefined;
  let activeFlightName: string | undefined;
  let activeFlightData: import('./types').FlightData | undefined;
  let activeFlightType: 'KMS' | 'HS' | undefined;

  if (data.flights.length > 0 && activeShiftId) {
    // Filter flights belonging to current active shift that are still open
    const activeShiftFlights = data.flights.filter(f => f.shiftId === activeShiftId && f.status !== 'closed');
    if (activeShiftFlights.length > 0) {
      // Sort to get the latest in case there are multiple open flights
      const sortedFlights = [...activeShiftFlights].sort((a, b) => getChronologicalTime(a.timestamp) - getChronologicalTime(b.timestamp));
      const latestFlight = sortedFlights[sortedFlights.length - 1];
      activeFlightId = latestFlight.id;
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
    
    await updateFlight({
      ...flight,
      status: 'closed',
      closedTimestamp: closedTime,
      closingObservations: obs
    });
    return true;
  };

  const handleCloseFlight = async (id: string) => {
    const flight = data.flights.find(f => f.id === id);
    if (flight) {
      await closeFlightWithPrompt(flight);
    }
  };

  const handleSaveFlight = async (flightData: import('./types').FlightData) => {
    if (activeShiftId) {
      // Close any active flights in the current shift
      const activeFlights = data.flights.filter(f => f.shiftId === activeShiftId && f.status !== 'closed');
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
        await updateFlight({ 
          ...f, 
          status: 'closed',
          closedTimestamp: closedTime,
          closingObservations: obs
        });
      }
    }
    await saveFlight({ ...flightData, status: 'active' });
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
        const activeFlights = data.flights.filter(f => f.shiftId === activeShiftId && f.status !== 'closed');
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
          await updateFlight({
            ...f,
            status: 'closed',
            closedTimestamp: closedTime,
            closingObservations: obs
          });
        }
        updateShift({ ...latestShift, status: 'closed' });
      }
    }
  };

  const handleReopenShift = () => {
    if (latestShift && hasTodayClosedShift) {
      updateShift({ ...latestShift, status: 'active' });
    }
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
            onNavigate={(page) => {
              setIsNewFlightRequested(false);
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
            onSave={(data) => { handleSaveFlight(data); setIsNewFlightRequested(false); }}
            onUpdate={updateFlight}
            onBack={() => { setIsNewFlightRequested(false); setHistoricalShiftId(undefined); setCurrentPage('dashboard'); }} 
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
            onSaveBattery={saveBattery}
            onSaveDetection={saveDetection}
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
      default:
        return (
          <Dashboard
            data={data}
            onNavigate={(page) => {
              setIsNewFlightRequested(false);
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
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="glass" style={{ padding: '3rem', width: '90%', maxWidth: '500px', position: 'relative' }}>
            <button
              onClick={() => setShowExportModal(false)}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}
            >
              <X size={24} />
            </button>

            <h2 style={{ textAlign: 'center', marginBottom: '0.5rem', fontSize: '1.8rem' }}>Exportar Reporte</h2>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.85rem' }}>
              {totalRecords} registro{totalRecords !== 1 ? 's' : ''} disponible{totalRecords !== 1 ? 's' : ''}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <button
                onClick={() => { exportToExcel(data); setShowExportModal(false); }}
                className="btn-3d"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', background: 'linear-gradient(135deg, #1D6F42, #217346)' }}
              >
                <Table size={24} /> Descargar Excel (.xlsx)
              </button>

              <button
                onClick={() => { exportToJSON(data); setShowExportModal(false); }}
                className="btn-3d"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', background: 'linear-gradient(135deg, #333, #111)' }}
              >
                <FileJson size={24} /> Descargar JSON (.json)
              </button>
            </div>

            <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.5rem', textAlign: 'center' }}>
              {[
                { label: 'Jornadas', count: data.shifts.length, color: 'var(--primary)' },
                { label: 'Vuelos', count: data.flights.length, color: 'var(--secondary)' },
                { label: 'Baterías', count: data.batteries.length, color: '#00c2ff' },
                { label: 'Detecciones', count: data.detections.length, color: 'var(--accent)' },
              ].map(({ label, count, color }) => (
                <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '0.75rem 0.5rem' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color }}>{count}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reusable Custom Tactical Modal for Alerts/Confirms */}
      {dialog.show && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1100,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div className="glass" style={{ 
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

            <h3 style={{ color: 'white', fontSize: '1.4rem', fontWeight: 900, marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {dialog.type === 'confirm' ? 'Confirmación Requerida' : dialog.type === 'prompt' ? 'Registro de Observación' : dialog.type === 'choice' ? 'Selección Requerida' : 'Notificación'}
            </h3>
            
            <p style={{ color: '#E0E0E0', fontSize: '1.05rem', lineHeight: '1.6', marginBottom: '1.5rem', whiteSpace: 'pre-line', fontWeight: 500 }}>
              {dialog.message}
            </p>

            {dialog.type === 'prompt' && (
              <textarea
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                {dialog.choices.map(choice => (
                  <button
                    key={choice}
                    onClick={() => {
                      dialog.resolve?.(choice);
                      setDialog({ show: false, message: '', type: 'alert', placeholder: '', inputValue: '', choices: [], resolve: null });
                    }}
                    className="btn-3d"
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

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              {dialog.type === 'confirm' || dialog.type === 'prompt' ? (
                <>
                  <button
                    onClick={() => {
                      dialog.resolve?.(dialog.type === 'prompt' ? (dialog.inputValue || '') : true);
                      setDialog({ show: false, message: '', type: 'alert', placeholder: '', inputValue: '', choices: [], resolve: null });
                    }}
                    className="btn-3d"
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
                  className="btn-3d"
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
    </div>
  );
}

export default App;
