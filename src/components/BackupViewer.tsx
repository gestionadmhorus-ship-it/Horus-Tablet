import React, { useState, useRef } from 'react';
import { 
  ArrowLeft, FileJson, Table, AlertTriangle, 
  Battery, ShieldCheck, Calendar, ChevronRight, ChevronDown, Info 
} from 'lucide-react';
import type { AppData } from '../types';
import { exportToExcel } from '../utils/exportUtils';

interface BackupViewerProps {
  onBack: () => void;
}

type ViewerTab = 'shifts' | 'anomalies' | 'checklists';

const BackupViewer: React.FC<BackupViewerProps> = ({ onBack }) => {
  const [backupData, setBackupData] = useState<AppData | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [activeTab, setActiveTab] = useState<ViewerTab>('shifts');
  const [expandedShifts, setExpandedShifts] = useState<Record<string, boolean>>({});
  const [expandedFlights, setExpandedFlights] = useState<Record<string, boolean>>({});
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag and drop states
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processFile = (file: File) => {
    if (!file) return;
    setFileName(file.name);
    setErrorMsg('');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed = JSON.parse(text) as AppData;

        // Validation: Must look like AppData
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('El archivo no es un objeto JSON válido.');
        }

        const hasRequiredArrays = 
          Array.isArray(parsed.shifts) || 
          Array.isArray(parsed.flights) || 
          Array.isArray(parsed.batteries) || 
          Array.isArray(parsed.detections);

        if (!hasRequiredArrays) {
          throw new Error('Estructura de respaldo inválida. Falta el formato de datos de Hermes II.');
        }

        // Normalize lists to prevent map crashes
        const cleanData: AppData = {
          shifts: Array.isArray(parsed.shifts) ? parsed.shifts : [],
          flights: Array.isArray(parsed.flights) ? parsed.flights : [],
          batteries: Array.isArray(parsed.batteries) ? parsed.batteries : [],
          detections: Array.isArray(parsed.detections) ? parsed.detections : [],
          checklists: Array.isArray(parsed.checklists) ? parsed.checklists : [],
          droneChecklists: Array.isArray(parsed.droneChecklists) ? parsed.droneChecklists : []
        };

        setBackupData(cleanData);
      } catch (err: any) {
        setErrorMsg(err.message || 'Error al procesar el archivo de copia.');
        setBackupData(null);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleExport = async () => {
    if (!backupData || isExporting) return;
    setIsExporting(true);
    try {
      await exportToExcel(backupData);
    } catch (err: any) {
      alert(`Error al exportar: ${err.message || err}`);
    } finally {
      setIsExporting(false);
    }
  };

  const toggleShift = (id: string) => {
    setExpandedShifts(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleFlight = (id: string) => {
    setExpandedFlights(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Derived metadata from loaded data
  const deviceName = backupData?.shifts?.[0]?.deviceName 
    || backupData?.flights?.[0]?.deviceName 
    || backupData?.detections?.[0]?.deviceName 
    || 'Dispositivo';

  // Count totals
  const totalShifts = backupData?.shifts?.length || 0;
  const totalFlights = backupData?.flights?.length || 0;
  const totalBatteries = backupData?.batteries?.length || 0;
  const totalDetections = backupData?.detections?.length || 0;
  const totalChecklists = (backupData?.checklists?.length || 0) + (backupData?.droneChecklists?.length || 0);

  return (
    <div className="container" style={{ paddingBottom: '4rem' }}>
      {/* Volver */}
      <button 
        onClick={onBack} 
        className="btn-3d" 
        style={{ 
          marginBottom: '1rem', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.75rem', 
          background: '#000', 
          color: 'var(--primary)', 
          border: '1px solid var(--primary)' 
        }}
      >
        <ArrowLeft size={20} /> VOLVER AL MENÚ
      </button>

      {/* Título de la Sección */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '0.6rem', borderRadius: '10px', color: 'var(--primary)', border: '1px solid var(--glass-border)' }}>
          <FileJson size={28} />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 900 }}>Visualizador de Respaldos</h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Auditoría temporal de copias locales JSON</p>
        </div>
      </div>

      {/* Banner de Advertencia de Aislamiento */}
      {backupData && (
        <div style={{ 
          background: 'rgba(255, 159, 67, 0.1)', 
          border: '1px solid rgba(255, 159, 67, 0.4)', 
          color: '#ff9f43', 
          padding: '1rem 1.5rem', 
          borderRadius: '12px', 
          marginBottom: '1.5rem', 
          display: 'flex', 
          alignItems: 'flex-start', 
          gap: '0.75rem', 
          boxShadow: '0 0 15px rgba(255, 159, 67, 0.05)'
        }}>
          <Info size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <span style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.85rem', display: 'block', marginBottom: '3px' }}>MODO AUDITORÍA DE ARCHIVO</span>
            <span style={{ fontSize: '0.9rem', lineHeight: '1.4' }}>
              Estás visualizando datos en memoria RAM extraídos del archivo. Ninguno de estos registros se cargará ni sobrescribirá la base de datos de producción de tu Panel de Control.
            </span>
          </div>
        </div>
      )}

      {/* Drop Zone o Cargar Archivo */}
      {!backupData ? (
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: isDragging ? '2px dashed var(--primary)' : '2px dashed var(--glass-border)',
            background: isDragging ? 'rgba(240, 196, 25, 0.04)' : 'rgba(255, 255, 255, 0.01)',
            borderRadius: '16px',
            padding: '4rem 2rem',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: isDragging ? '0 0 25px rgba(240,196,25,0.05)' : 'none'
          }}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".json" 
            style={{ display: 'none' }} 
          />
          <FileJson size={48} color={isDragging ? 'var(--primary)' : 'var(--text-secondary)'} style={{ marginBottom: '1rem', opacity: 0.8 }} />
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', color: 'var(--text-primary)' }}>
            Arrastra el archivo de copia aquí
          </h3>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            o haz clic para buscar en tu computadora (ej: <code style={{ color: 'var(--primary)' }}>Recuperacion_*.json</code>)
          </p>
          {errorMsg && (
            <div style={{ marginTop: '1.5rem', color: 'var(--neon-red)', fontSize: '0.9rem', fontWeight: 'bold' }}>
              ⚠️ {errorMsg}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Ficha técnica de la copia cargada */}
          <div className="glass" style={{ padding: '1.5rem', borderLeft: '4px solid var(--primary)', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>
                Archivo Cargado
              </div>
              <h3 style={{ margin: '0.2rem 0', color: 'var(--text-primary)', fontSize: '1.3rem', fontWeight: 800 }}>
                {fileName}
              </h3>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Origen: <strong style={{ color: 'var(--primary)' }}>{deviceName}</strong>
              </span>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                onClick={handleExport}
                disabled={isExporting}
                className="btn-3d" 
                style={{ 
                  background: 'rgba(0, 255, 136, 0.05)', 
                  border: '1px solid rgba(0, 255, 136, 0.4)', 
                  color: '#00ff88', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  padding: '0.8rem 1.2rem'
                }}
              >
                <Table size={18} /> {isExporting ? 'EXPORTANDO...' : 'EXPORTAR COPIA A EXCEL'}
              </button>
              
              <button 
                onClick={() => {
                  setBackupData(null);
                  setFileName('');
                  setErrorMsg('');
                }}
                className="btn-3d" 
                style={{ 
                  background: 'rgba(255, 255, 255, 0.02)', 
                  border: '1px solid rgba(255, 255, 255, 0.1)', 
                  color: 'var(--text-secondary)',
                  padding: '0.8rem 1.2rem'
                }}
              >
                CARGAR OTRO ARCHIVO
              </button>
            </div>
          </div>

          {/* Tarjetas de Totales */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
            {[
              { label: 'Jornadas', count: totalShifts, color: 'var(--primary)' },
              { label: 'Vuelos', count: totalFlights, color: 'var(--secondary)' },
              { label: 'Baterías', count: totalBatteries, color: '#00c2ff' },
              { label: 'Detecciones', count: totalDetections, color: 'var(--accent)' },
              { label: 'Checklists', count: totalChecklists, color: 'var(--neon-green)' },
            ].map(item => (
              <div key={item.label} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '10px', padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: item.color }}>{item.count}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>{item.label}</div>
              </div>
            ))}
          </div>

          {/* Menú de Pestañas */}
          <div className="glass" style={{ padding: 0 }}>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.3)' }}>
              {[
                { id: 'shifts', label: 'Jornadas y Vuelos', icon: Calendar },
                { id: 'anomalies', label: 'Baterías y Anomalías', icon: AlertTriangle },
                { id: 'checklists', label: 'Checklists', icon: ShieldCheck },
              ].map(t => {
                const Icon = t.icon;
                const isSelected = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id as ViewerTab)}
                    style={{
                      flex: 1,
                      padding: '1.2rem 1rem',
                      border: 'none',
                      background: isSelected ? 'rgba(240, 196, 25, 0.06)' : 'transparent',
                      color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontWeight: 800,
                      fontSize: '0.9rem',
                      transition: 'all 0.2s ease',
                      borderBottom: isSelected ? '2px solid var(--primary)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <Icon size={16} /> {t.label}
                  </button>
                );
              })}
            </div>

            {/* CONTENIDO PESTAÑAS */}
            <div style={{ padding: '1.5rem', maxHeight: '550px', overflowY: 'auto' }}>
              
              {/* PESTAÑA: JORNADAS Y VUELOS */}
              {activeTab === 'shifts' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {totalShifts === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '2rem' }}>
                      No se encontraron jornadas en este respaldo.
                    </div>
                  ) : (
                    backupData.shifts.map((shift) => {
                      const isShiftOpen = expandedShifts[shift.id];
                      const shiftFlights = backupData.flights.filter(f => f.shiftId === shift.id);
                      return (
                        <div key={shift.id} style={{ border: '1px solid var(--glass-border)', borderRadius: '10px', overflow: 'hidden', background: 'rgba(255,255,255,0.01)' }}>
                          {/* Fila Encabezado de la Jornada */}
                          <div 
                            onClick={() => toggleShift(shift.id)}
                            style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.02)' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              {isShiftOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                              <div>
                                <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                                  Coordinador: {shift.coordinator}
                                </span>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.5rem', marginTop: '2px' }}>
                                  <span>🚗 {shift.vehicle}</span>
                                  <span>| 🚁 {shift.drone}</span>
                                </div>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: '0.82rem', fontFamily: 'monospace', color: 'var(--text-secondary)', display: 'block' }}>
                                {shift.timestamp}
                              </span>
                              <span style={{ 
                                fontSize: '0.7rem', 
                                padding: '2px 8px', 
                                borderRadius: '4px', 
                                background: shift.status === 'closed' ? 'rgba(255,255,255,0.05)' : 'rgba(16,185,129,0.1)',
                                color: shift.status === 'closed' ? 'var(--text-secondary)' : '#00ff88',
                                fontWeight: 'bold'
                              }}>
                                {shift.status === 'closed' ? 'CERRADA' : 'ACTIVA'}
                              </span>
                            </div>
                          </div>

                          {/* Cuerpo expandible de la Jornada (vuelos) */}
                          {isShiftOpen && (
                            <div style={{ padding: '1rem', borderTop: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                              <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Vuelos registrados ({shiftFlights.length})
                              </h4>
                              {shiftFlights.length === 0 ? (
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic', paddingLeft: '1.5rem' }}>
                                  Ningún vuelo registrado en esta jornada.
                                </div>
                              ) : (
                                shiftFlights.map(flight => {
                                  const isFlightOpen = expandedFlights[flight.id];
                                  const flightTitle = flight.flightType === 'HS' 
                                    ? `HS: ${flight.taskTypeAndLocation || 'Sin nombre'}`
                                    : `KMS: ${flight.lineName || 'Sin línea'}`;
                                  
                                  const flightBatteries = backupData.batteries.filter(b => b.flightId === flight.id);
                                  const flightDetections = backupData.detections.filter(d => d.flightId === flight.id);

                                  return (
                                    <div key={flight.id} style={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', overflow: 'hidden' }}>
                                      {/* Fila del vuelo */}
                                      <div 
                                        onClick={() => toggleFlight(flight.id)}
                                        style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.01)' }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                                          {isFlightOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                          <span style={{ fontWeight: 700, color: flight.flightType === 'HS' ? '#00e6ff' : 'var(--primary)' }}>
                                            {flightTitle}
                                          </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                            {flight.timestamp.split(' ')[1] || flight.timestamp}
                                          </span>
                                          <span style={{ 
                                            fontSize: '0.68rem', 
                                            padding: '1px 6px', 
                                            borderRadius: '4px',
                                            background: flight.status === 'closed' ? 'rgba(255,255,255,0.04)' : 'rgba(0,255,136,0.08)',
                                            color: flight.status === 'closed' ? 'var(--text-secondary)' : '#00ff88',
                                            fontWeight: 'bold'
                                          }}>
                                            {flight.status === 'closed' ? 'CERRADO' : 'EN VUELO'}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Expandible del vuelo (Detalle baterías y anomalías) */}
                                      {isFlightOpen && (
                                        <div style={{ padding: '0.75rem 1.25rem', background: 'rgba(0,0,0,0.25)', borderTop: '1px solid rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem' }}>
                                          <div>
                                            <span style={{ color: 'var(--text-secondary)' }}>Piloto: </span>
                                            <strong style={{ color: 'var(--text-primary)' }}>{flight.pilot}</strong>
                                            {flight.requestedBy && (
                                              <span style={{ marginLeft: '1rem', color: 'var(--text-secondary)' }}>
                                                Solicitado por: <strong style={{ color: 'var(--text-primary)' }}>{flight.requestedBy}</strong>
                                              </span>
                                            )}
                                          </div>
                                          
                                          {flight.observations && (
                                            <div>
                                              <span style={{ color: 'var(--text-secondary)' }}>Obs. Inicio: </span>
                                              <span style={{ color: 'var(--text-primary)' }}>{flight.observations}</span>
                                            </div>
                                          )}

                                          {flight.closingObservations && (
                                            <div>
                                              <span style={{ color: 'var(--text-secondary)' }}>Obs. Cierre: </span>
                                              <span style={{ color: 'var(--text-primary)' }}>{flight.closingObservations}</span>
                                            </div>
                                          )}

                                          {/* Mini resumen del vuelo */}
                                          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.2rem', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '0.5rem' }}>
                                            <span style={{ color: '#00c2ff', fontWeight: 600 }}>
                                              🔋 Baterías: {flightBatteries.map(b => `${b.droneBatteryName}/${b.controlBatteryName}`).join(', ') || 'Ninguna'}
                                            </span>
                                            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                                              ⚠️ Anomalías: {flightDetections.length} registradas
                                            </span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* PESTAÑA: BATERÍAS Y ANOMALÍAS */}
              {activeTab === 'anomalies' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  
                  {/* Sección Anomalías */}
                  <div>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <AlertTriangle size={18} /> Anomalías Registradas ({totalDetections})
                    </h3>
                    
                    {totalDetections === 0 ? (
                      <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '1rem', border: '1px solid var(--glass-border)', borderRadius: '8px' }}>
                        No hay anomalías registradas en esta copia de seguridad.
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid var(--glass-border)', color: 'var(--text-secondary)' }}>
                              <th style={{ padding: '0.6rem 0.5rem' }}>Fecha/Hora</th>
                              <th style={{ padding: '0.6rem 0.5rem' }}>Elemento</th>
                              <th style={{ padding: '0.6rem 0.5rem' }}>Anomalía</th>
                              <th style={{ padding: '0.6rem 0.5rem' }}>Criticidad</th>
                              <th style={{ padding: '0.6rem 0.5rem' }}>Foto/Video</th>
                              <th style={{ padding: '0.6rem 0.5rem' }}>Observaciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {backupData.detections.map((det) => {
                              const critColors: Record<string, string> = {
                                'Muy Baja': '#00F2D1', Baja: '#00E676', Media: '#FFD600', Alta: '#FF9100', Urgente: '#FF1744'
                              };
                              const color = critColors[det.criticality] || 'var(--text-secondary)';
                              
                              return (
                                <tr key={det.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                  <td style={{ padding: '0.8rem 0.5rem', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{det.timestamp}</td>
                                  <td style={{ padding: '0.8rem 0.5rem', fontWeight: 'bold' }}>{det.element}</td>
                                  <td style={{ padding: '0.8rem 0.5rem' }}>{det.anomaly}</td>
                                  <td style={{ padding: '0.8rem 0.5rem' }}>
                                    <span style={{ 
                                      color: det.criticality === 'Urgente' ? 'white' : color, 
                                      background: det.criticality === 'Urgente' ? color : 'transparent',
                                      padding: det.criticality === 'Urgente' ? '2px 6px' : '0',
                                      borderRadius: '4px',
                                      fontWeight: 'bold',
                                      fontSize: '0.78rem',
                                      textTransform: 'uppercase'
                                    }}>
                                      {det.criticality}
                                    </span>
                                  </td>
                                  <td style={{ padding: '0.8rem 0.5rem', fontFamily: 'monospace', color: 'var(--primary)' }}>{det.fileName || '—'}</td>
                                  <td style={{ padding: '0.8rem 0.5rem', color: 'var(--text-secondary)' }}>{det.observations || '—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: 0 }} />

                  {/* Sección Baterías */}
                  <div>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#00c2ff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Battery size={18} /> Ciclos de Baterías ({totalBatteries})
                    </h3>

                    {totalBatteries === 0 ? (
                      <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '1rem', border: '1px solid var(--glass-border)', borderRadius: '8px' }}>
                        No hay registros de batería en esta copia.
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid var(--glass-border)', color: 'var(--text-secondary)' }}>
                              <th style={{ padding: '0.6rem 0.5rem' }}>Fecha/Hora</th>
                              <th style={{ padding: '0.6rem 0.5rem' }}>Piloto</th>
                              <th style={{ padding: '0.6rem 0.5rem' }}>Batería Dron</th>
                              <th style={{ padding: '0.6rem 0.5rem' }}>Batería Control</th>
                            </tr>
                          </thead>
                          <tbody>
                            {backupData.batteries.map((bat) => (
                              <tr key={bat.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <td style={{ padding: '0.8rem 0.5rem', fontFamily: 'monospace' }}>{bat.timestamp}</td>
                                <td style={{ padding: '0.8rem 0.5rem', fontWeight: 600 }}>{bat.pilot}</td>
                                <td style={{ padding: '0.8rem 0.5rem', color: '#00ff88', fontWeight: 'bold' }}>{bat.droneBatteryName}</td>
                                <td style={{ padding: '0.8rem 0.5rem', color: 'var(--primary)', fontWeight: 'bold' }}>{bat.controlBatteryName}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* PESTAÑA: CHECKLISTS */}
              {activeTab === 'checklists' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  
                  {/* Checklist Vehículos */}
                  <div>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      Checklists Vehiculares ({backupData.checklists?.length || 0})
                    </h3>
                    {(!backupData.checklists || backupData.checklists.length === 0) ? (
                      <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '1rem', border: '1px solid var(--glass-border)', borderRadius: '8px' }}>
                        No hay checklist vehiculares en este respaldo.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {backupData.checklists.map((check) => (
                          <div key={check.id} style={{ padding: '1rem', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', background: 'rgba(255,255,255,0.01)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                              <span>Vehículo: <strong style={{ color: 'var(--primary)' }}>{check.vehicleId}</strong> | Conductor: <strong>{check.driver}</strong></span>
                              <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{check.timestamp}</span>
                            </div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem' }}>
                              <span>KM: <strong>{check.mileage}</strong></span>
                              <span>Fluidos: <strong>{check.checks.oil && check.checks.brakesFluid && check.checks.coolant ? 'OK' : 'OBS'}</strong></span>
                              <span>Neumáticos: <strong>{check.checks.tirePressure && check.checks.tireWear ? 'OK' : 'OBS'}</strong></span>
                              <span>Luces/Seguridad: <strong>{check.checks.lights && check.checks.seatbelts && check.checks.fireExtinguisher ? 'OK' : 'OBS'}</strong></span>
                            </div>
                            {check.observations && (
                              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.2)', padding: '0.4rem 0.6rem', borderRadius: '4px' }}>
                                <strong>Obs:</strong> {check.observations}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: 0 }} />

                  {/* Checklist Drones */}
                  <div>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#00ff88', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      Checklists de Dron ({backupData.droneChecklists?.length || 0})
                    </h3>
                    {(!backupData.droneChecklists || backupData.droneChecklists.length === 0) ? (
                      <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '1rem', border: '1px solid var(--glass-border)', borderRadius: '8px' }}>
                        No hay checklist de dron en este respaldo.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {backupData.droneChecklists.map((check) => (
                          <div key={check.id} style={{ padding: '1rem', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', background: 'rgba(255,255,255,0.01)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                              <span>Dron: <strong style={{ color: '#00ff88' }}>{check.droneId}</strong> | Piloto: <strong>{check.pilot}</strong></span>
                              <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{check.timestamp}</span>
                            </div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem' }}>
                              <span>Estructura/Hélices: <strong>{check.checks.frameSecured && check.checks.propellersIntact ? 'OK' : 'OBS'}</strong></span>
                              <span>Radio/Enlace: <strong>{check.checks.rcDroneLinked && check.checks.appStarted ? 'OK' : 'OBS'}</strong></span>
                              <span>GPS/Compás: <strong>{check.checks.gpsLockOptimal && check.checks.imuCompassCalibrated ? 'OK' : 'OBS'}</strong></span>
                            </div>
                            {check.observations && (
                              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.2)', padding: '0.4rem 0.6rem', borderRadius: '4px' }}>
                                <strong>Obs:</strong> {check.observations}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BackupViewer;
