import { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import ShiftForm from './components/ShiftForm';
import FlightForm from './components/FlightForm';
import BatteriesDetectionsForm from './components/BatteriesDetectionsForm';
import VehicleChecklistForm from './components/VehicleChecklistForm';
import SettingsPanel from './components/SettingsPanel';
import RecordsExplorer from './components/RecordsExplorer';
import { RoleSetup } from './components/RoleSetup';
import type { AppRole } from './types';
import { useDatabase } from './hooks/useDatabase';
import { useAutoSync } from './hooks/useAutoSync';
import { exportToExcel, exportToJSON } from './utils/exportUtils';
import { FileJson, Table, X, CheckCircle, Power } from 'lucide-react';

declare global {
  interface Window {
    customConfirm: (message: string) => Promise<boolean>;
    customAlert: (message: string) => Promise<void>;
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
    updateLists,
    syncIncomingData,
    getUnsyncedData,
    markDataAsSynced
  } = useDatabase();
  
  const [showExportModal, setShowExportModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isNewFlightRequested, setIsNewFlightRequested] = useState<boolean>(false);
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

  const { syncStatus } = useAutoSync(
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
    type: 'alert' | 'confirm';
    resolve: ((val: any) => void) | null;
  }>({
    show: false,
    message: '',
    type: 'alert',
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
          resolve: () => resolve()
        });
      });
    };
  }, []);

  const totalRecords = data.shifts.length + data.flights.length + data.batteries.length + data.detections.length;

  // Helper to chronologically parse locale timestamps like "20/5/2026 07:15:54"
  const getChronologicalTime = (timestamp: string): number => {
    if (!timestamp) return 0;
    const [datePart, timePart, period] = timestamp.split(' ');
    if (!datePart) return 0;
    
    const dateSplit = datePart.split(/[-/]/);
    if (dateSplit.length === 3) {
      let d = parseInt(dateSplit[0], 10);
      let m = parseInt(dateSplit[1], 10);
      let y = parseInt(dateSplit[2], 10);
      if (y < 100) y += 2000;
      // Heuristic: if d > 12, format is dd/mm/yyyy. Otherwise assume dd/mm/yyyy for Argentina context.
      if (d > 12 || m <= 12) {
        const timeStr = (timePart || '00:00:00') + (period ? ` ${period}` : '');
        const isoStr = `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')} ${timeStr}`;
        const parsed = new Date(isoStr).getTime();
        if (!isNaN(parsed)) return parsed;
      }
    }
    // Fallback
    const fallback = new Date(timestamp).getTime();
    return isNaN(fallback) ? 0 : fallback;
  };

  // ─── Determine active shift by date + status ───
  const activeLists = { ...lists };
  let activeShiftId: string | undefined;
  
  const todayDateStr = new Date().toLocaleDateString();
  
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

  // ─── Determine active flight (must belong to active shift) ───
  let activeFlightId: string | undefined;
  let activeFlightName: string | undefined;
  let activeFlightData: import('./types').FlightData | undefined;

  if (data.flights.length > 0) {
    // Sort flights chronologically before finding the latest
    const sortedFlights = [...data.flights].sort((a, b) => getChronologicalTime(a.timestamp) - getChronologicalTime(b.timestamp));
    const latestFlight = sortedFlights[sortedFlights.length - 1];
    if (activeShiftId && latestFlight && latestFlight.shiftId === activeShiftId) {
      activeFlightId = latestFlight.id;
      activeFlightName = latestFlight.lineName;
      activeFlightData = latestFlight;
    }
  }

  // ─── Handlers ───
  const handleCloseShift = async () => {
    if (activeShiftId && latestShift) {
      const ok = await window.customConfirm('¿Estás seguro de cerrar la jornada actual?');
      if (ok) {
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
            onCloseShift={handleCloseShift}
            onReopenShift={handleReopenShift}
            hasTodayClosedShift={hasTodayClosedShift}
            activeShiftId={activeShiftId}
            activeFlightName={activeFlightName}
            onEditShift={handleEditShift}
            onEditFlight={handleEditFlight}
            onNewFlight={() => {
              setIsNewFlightRequested(true);
              setCurrentPage('flight');
            }}
            deviceName={deviceName}
            syncStatus={syncStatus}
            appRole={appRole}
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
            key={isNewFlightRequested ? 'new-flight' : (activeFlightId || 'create-flight')}
            onSave={(data) => { saveFlight(data); setIsNewFlightRequested(false); }}
            onUpdate={updateFlight}
            onBack={() => { setIsNewFlightRequested(false); setCurrentPage('dashboard'); }} 
            lists={activeLists} 
            activeShiftId={activeShiftId}
            editData={activeFlightId && activeFlightData && !isNewFlightRequested ? activeFlightData : undefined}
            onRegisterNew={() => setIsNewFlightRequested(true)}
            onChangeShift={() => setCurrentPage('shift')}
          />
        );
      case 'batteries':
        return (
          <BatteriesDetectionsForm
            onSaveBattery={saveBattery}
            onSaveDetection={saveDetection}
            onBack={() => setCurrentPage('dashboard')}
            lists={activeLists}
            activeFlightId={activeFlightId}
            activeFlightName={activeFlightName}
          />
        );
      case 'checklist':
        return (
          <VehicleChecklistForm
            onSave={saveChecklist}
            onUpdate={updateChecklist}
            onBack={() => {
              if (editingChecklist) {
                setEditingChecklist(undefined);
                setCurrentPage('explorer');
              } else {
                setCurrentPage('dashboard');
              }
            }}
            lists={lists}
            history={data.checklists || []}
            editData={editingChecklist}
          />
        );
      case 'explorer':
        return (
          <RecordsExplorer 
            data={data} 
            lists={lists}
            onBack={() => setCurrentPage('dashboard')} 
            onUpdateShift={updateShift}
            onDeleteShift={deleteShift}
            onUpdateFlight={updateFlight}
            onDeleteFlight={deleteFlight}
            onUpdateBattery={updateBattery}
            onDeleteBattery={deleteBattery}
            onUpdateDetection={updateDetection}
            onDeleteDetection={deleteDetection}
            onUpdateChecklist={updateChecklist}
            onDeleteChecklist={deleteChecklist}
            onViewChecklist={(item) => {
              setEditingChecklist(item);
              setCurrentPage('checklist');
            }}
            onSyncReceived={syncIncomingData}
          />
        );
      default:
        return (
          <Dashboard
            onNavigate={(page) => {
              setIsNewFlightRequested(false);
              setCurrentPage(page);
            }}
            onSettings={() => setShowSettings(true)}
            hasActiveShift={!!activeShiftId}
            hasActiveFlight={!!activeFlightId}
            onCloseShift={handleCloseShift}
            onReopenShift={handleReopenShift}
            hasTodayClosedShift={hasTodayClosedShift}
            activeShiftId={activeShiftId}
            activeFlightName={activeFlightName}
            onEditShift={handleEditShift}
            onEditFlight={handleEditFlight}
            onNewFlight={() => {
              setIsNewFlightRequested(true);
              setCurrentPage('flight');
            }}
            deviceName={deviceName}
            syncStatus={syncStatus}
            appRole={appRole}
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
      {/* Global Logo - Visible on all screens, hidden in print */}
      <div className="no-print" style={{ position: 'absolute', top: '1.5rem', left: '2rem', zIndex: 1000, pointerEvents: 'none' }}>
        <img src="/logo_horus_nuevo.png" alt="Horus Logo" style={{ height: '45px', filter: 'drop-shadow(0px 0px 10px rgba(0,0,0,0.8))' }} />
      </div>

      {renderPage()}

      {/* Settings Panel */}
      {showSettings && (
        <SettingsPanel
          lists={lists}
          onUpdate={updateLists}
          onClose={() => setShowSettings(false)}
          deviceName={deviceName}
          onDeviceNameChange={handleDeviceNameChange}
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
            border: `2px solid ${dialog.type === 'confirm' ? 'var(--primary)' : '#00ff88'}`,
            boxShadow: `0 0 40px ${dialog.type === 'confirm' ? 'rgba(240,196,25,0.25)' : 'rgba(0,255,136,0.25)'}`,
            borderRadius: '12px',
            textAlign: 'center',
            background: 'rgba(5,5,5,0.95)'
          }}>
            {/* Title / Icon based on type */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <div style={{
                background: dialog.type === 'confirm' ? 'rgba(240,196,25,0.1)' : 'rgba(0,255,136,0.1)',
                color: dialog.type === 'confirm' ? 'var(--primary)' : '#00ff88',
                borderRadius: '50%',
                padding: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `inset 0 0 10px ${dialog.type === 'confirm' ? 'rgba(240,196,25,0.2)' : 'rgba(0,255,136,0.2)'}`
              }}>
                {dialog.type === 'confirm' ? (
                  <Power size={32} />
                ) : (
                  <CheckCircle size={32} />
                )}
              </div>
            </div>

            <h3 style={{ color: 'white', fontSize: '1.4rem', fontWeight: 900, marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {dialog.type === 'confirm' ? 'Confirmación Requerida' : 'Notificación'}
            </h3>
            
            <p style={{ color: '#E0E0E0', fontSize: '1.05rem', lineHeight: '1.6', marginBottom: '2rem', whiteSpace: 'pre-line', fontWeight: 500 }}>
              {dialog.message}
            </p>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              {dialog.type === 'confirm' ? (
                <>
                  <button
                    onClick={() => {
                      dialog.resolve?.(true);
                      setDialog({ show: false, message: '', type: 'alert', resolve: null });
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
                      dialog.resolve?.(false);
                      setDialog({ show: false, message: '', type: 'alert', resolve: null });
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
              ) : (
                <button
                  onClick={() => {
                    dialog.resolve?.(true);
                    setDialog({ show: false, message: '', type: 'alert', resolve: null });
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
