import React, { useState, useEffect } from 'react';
import {
  Save, ArrowLeft,
  Battery, AlertTriangle, ChevronRight, ChevronLeft, Info,
  Clock, Lock, Unlock, Plus, Minus
} from 'lucide-react';
import type { BatteryData, DetectionData, ListsData } from '../types';
import { generateId } from '../utils/idGenerator';
import { SearchableSelect } from './SearchableSelect';
import { formatTime24h, formatDateDMY, formatTimestamp } from '../utils/dateUtils';

interface BatteriesDetectionsFormProps {
  onSaveBattery: (data: BatteryData) => void;
  onSaveDetection: (data: DetectionData) => void;
  onBack: () => void;
  lists: ListsData;
  activeFlightId?: string;
  activeFlightName?: string;
  activeFlightCategory?: string;
}

type ActivePanel = 'batteries' | 'detections';

/* ─── Helper: select or text fallback ─── */
const SmartSelect: React.FC<{
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  emptyMsg?: string;
  style?: React.CSSProperties;
}> = ({ label, options, value, onChange, required, emptyMsg, style }) => (
  <div>
    {options.length > 0 ? (
      <SearchableSelect
        label={label}
        options={options}
        value={value}
        onChange={onChange}
        required={required}
        placeholder="-- Seleccionar --"
        style={style}
      />
    ) : (
      <>
        <label>{label}</label>
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={emptyMsg || 'Configura opciones en ⚙️'}
          required={required}
        />
      </>
    )}
  </div>
);



/* ═══════════════ COMPONENT ═══════════════ */
const BatteriesDetectionsForm: React.FC<BatteriesDetectionsFormProps> = ({
  onSaveBattery, onSaveDetection, onBack, lists, activeFlightId, activeFlightName, activeFlightCategory
}) => {
  const [activePanel, setActivePanel] = useState<ActivePanel>('batteries');
  const [isSaving, setIsSaving] = useState(false);

  /* ─── Detection Time Sync state ─── */
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [fixedTime, setFixedTime] = useState<Date | null>(null);

  /* ─── Battery state ─── */
  const [batteryData, setBatteryData] = useState({ pilot: '', droneBatteryName: '', controlBatteryName: '' });

  /* ─── Detection state (cascading) ─── */
  const [selectedElement, setSelectedElement] = useState('');
  const [selectedAnomaly, setSelectedAnomaly] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [criticality, setCriticality] = useState('');
  const [observations, setObservations] = useState('');

  /* ─── Time Sync logic ─── */
  useEffect(() => {
    if (activePanel !== 'detections' || fixedTime !== null) return;
    
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(interval);
  }, [activePanel, fixedTime]);

  const handleToggleFixTime = () => {
    if (fixedTime === null) {
      setFixedTime(new Date());
    } else {
      setFixedTime(null);
      setCurrentTime(new Date());
    }
  };

  const handleAdjustTime = (seconds: number) => {
    let baseTime = fixedTime;
    if (baseTime === null) {
      baseTime = new Date();
    }
    const newTime = new Date(baseTime.getTime() + seconds * 1000);
    setFixedTime(newTime);
  };


  /* ─── Cascading logic ─── */
  // Filter elements by the active flight's category (or show all if flight or element lacks a category)
  const filteredElementsList = lists.elements.filter(el => {
    if (!activeFlightCategory || !el.category) return true;
    return el.category === activeFlightCategory;
  });

  const elementNames = filteredElementsList.map(e => e.name);

  const filteredAnomalies = filteredElementsList
    .find(e => e.name === selectedElement)
    ?.anomalies.map(a => a.name) ?? [];

  const handleElementChange = (name: string) => {
    setSelectedElement(name);
    setSelectedAnomaly('');
    setRecommendation('');
  };

  const handleAnomalyChange = (name: string) => {
    setSelectedAnomaly(name);
    const el = filteredElementsList.find(e => e.name === selectedElement);
    const anom = el?.anomalies.find(a => a.name === name);
    setRecommendation(anom?.recommendation || '');
  };

  /* ─── Criticality color ─── */
  const critColors: Record<string, string> = {
    'Muy Baja': '#00F2D1', Baja: '#00E676', Media: '#FFD600', Alta: '#FF9100', Urgente: '#FF1744'
  };



  /* ─── Save handlers ─── */
  const handleSaveBattery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    
    try {
      const now = new Date();
      onSaveBattery({ id: generateId('BAT'), flightId: activeFlightId, timestamp: formatTimestamp(now), ...batteryData });
      await window.customAlert('✅ Baterías guardadas con éxito');
      setBatteryData({ pilot: '', droneBatteryName: '', controlBatteryName: '' });
      setActivePanel('detections');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDetection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    
    if (!criticality) {
      await window.customAlert('⚠️ Por favor selecciona un nivel de criticidad antes de guardar.');
      return;
    }
    
    setIsSaving(true);
    try {
      const saveTime = fixedTime || new Date();
      const generatedFileName = formatTime24h(saveTime).replace(/:/g, '');
      onSaveDetection({
        id: generateId('DET'),
        flightId: activeFlightId,
        timestamp: formatTimestamp(saveTime),
        element: selectedElement,
        anomaly: selectedAnomaly,
        recommendation,
        criticality,
        fileName: generatedFileName,
        observations
      });
      await window.customAlert('✅ Detección guardada con éxito');
      setSelectedElement(''); setSelectedAnomaly(''); setRecommendation('');
      setCriticality(''); setObservations('');
      setFixedTime(null); // Reset fixed time back to real-time clock
    } finally {
      setIsSaving(false);
    }
  };



  return (
    <div className="container" style={{ paddingBottom: '4rem' }}>
      {/* Back */}
      <button onClick={onBack} className="btn-3d" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#000', color: 'var(--primary)', border: '1px solid var(--primary)' }}>
        <ArrowLeft size={20} /> VOLVER AL MENÚ
      </button>

      {activeFlightName && (
        <div style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid #00ff88', color: '#00ff88', padding: '0.8rem 1.5rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', fontWeight: 'bold', boxShadow: '0 0 10px rgba(0,255,136,0.2)' }}>
          🚁 VUELO ACTIVO: {activeFlightName}
        </div>
      )}

      <div className="glass" style={{ borderTop: '4px solid #00ff88', padding: '0', overflow: 'visible', boxShadow: '0 -5px 20px rgba(0,255,136,0.1)' }}>
        {/* Tab Bar */}
        <div style={{ display: 'flex', borderBottom: '2px solid #333', background: '#000' }}>
          <button 
            onClick={() => setActivePanel('batteries')} 
            style={{
              flex: 1, padding: 'clamp(0.75rem, 3vw, 1.5rem)', border: 'none', cursor: 'pointer',
              fontWeight: 900, fontSize: 'clamp(0.75rem, 2vw, 1rem)', textTransform: 'uppercase', letterSpacing: '1px',
              transition: 'all 0.2s ease',
              background: activePanel === 'batteries' ? 'var(--primary)' : 'transparent',
              color: activePanel === 'batteries' ? 'black' : '#666',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}><Battery size={20} /> Baterías</span>
          </button>
          <button 
            onClick={() => setActivePanel('detections')} 
            style={{
              flex: 1, padding: 'clamp(0.75rem, 3vw, 1.5rem)', border: 'none', cursor: 'pointer',
              fontWeight: 900, fontSize: 'clamp(0.75rem, 2vw, 1rem)', textTransform: 'uppercase', letterSpacing: '1px',
              transition: 'all 0.2s ease',
              background: activePanel === 'detections' ? 'var(--primary)' : 'transparent',
              color: activePanel === 'detections' ? 'black' : '#666',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}><AlertTriangle size={20} /> Detecciones</span>
          </button>
        </div>

        {/* ────── BATTERIES PANEL ────── */}
        {activePanel === 'batteries' && (
          <form onSubmit={handleSaveBattery} className="form-scroll-container" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <div style={{ background: 'rgba(0,194,255,0.12)', padding: '0.6rem', borderRadius: '10px', color: '#00c2ff' }}><Battery size={24} /></div>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.3rem', color: '#00c2ff' }}>Estado de Baterías</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Registro de carga por vuelo</p>
              </div>
            </div>

            {activeFlightName && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(0,194,255,0.1) 0%, rgba(0,194,255,0.2) 100%)',
                border: '1px solid rgba(0,194,255,0.5)', 
                borderRadius: '12px',
                padding: '1.2rem', 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                justifyContent: 'center',
                boxShadow: '0 0 20px rgba(0,194,255,0.2)',
              }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '0.2rem' }}>📍 LÍNEA ACTIVA</span>
                <span style={{ fontSize: '1.6rem', fontWeight: 900, color: '#00c2ff', textShadow: '0 0 10px rgba(0,194,255,0.4)', textTransform: 'uppercase' }}>
                  {activeFlightName}
                </span>
              </div>
            )}

            <SmartSelect
              label="Piloto"
              options={lists.pilots}
              value={batteryData.pilot}
              onChange={v => setBatteryData({ ...batteryData, pilot: v })}
              required
              emptyMsg="Sin pilotos — agrega en ⚙️ → Listas → Pilotos"
            />

            <div className="grid-cols-2">
              <div>
                <label>ID Batería Dron</label>
                <input type="text" required maxLength={3} placeholder="Ej: B01"
                  value={batteryData.droneBatteryName}
                  onChange={e => setBatteryData({ ...batteryData, droneBatteryName: e.target.value.toUpperCase() })}
                  style={{ marginBottom: '0.75rem' }}
                />
              </div>
              <div>
                <label>ID Batería Control</label>
                <input type="text" required maxLength={3} placeholder="Ej: C02"
                  value={batteryData.controlBatteryName}
                  onChange={e => setBatteryData({ ...batteryData, controlBatteryName: e.target.value.toUpperCase() })}
                  style={{ marginBottom: '0.75rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button type="button" onClick={() => setActivePanel('detections')}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                Ir a Detecciones <ChevronRight size={16} />
              </button>
              <button 
                type="submit" 
                disabled={isSaving}
                className="btn-3d" 
                style={{ 
                  width: '100%', 
                  maxWidth: '350px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '0.75rem', 
                  padding: '1.2rem',
                  opacity: isSaving ? 0.6 : 1,
                  cursor: isSaving ? 'not-allowed' : 'pointer'
                }}
              >
                <Save size={24} /> <span>{isSaving ? 'GUARDANDO...' : 'GUARDAR BATERÍAS'}</span>
              </button>
            </div>
          </form>
        )}

        {/* ────── DETECTIONS PANEL ────── */}
        {activePanel === 'detections' && (
          <form onSubmit={handleSaveDetection} className="form-scroll-container" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <div style={{ background: 'rgba(0,255,136,0.1)', padding: '0.6rem', borderRadius: '10px', color: 'var(--accent)' }}><AlertTriangle size={24} /></div>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.3rem', color: 'var(--accent)' }}>Registro de Detecciones</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Elemento → Anomalía → Recomendación</p>
              </div>
            </div>

            {activeFlightName && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(0,255,136,0.05) 0%, rgba(0,255,136,0.15) 100%)',
                border: '1px solid rgba(0,255,136,0.4)', 
                borderRadius: '12px',
                padding: '1.2rem', 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                justifyContent: 'center',
                boxShadow: '0 0 20px rgba(0,255,136,0.15)',
              }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '0.2rem' }}>📍 LÍNEA ACTIVA</span>
                <span style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--accent)', textShadow: '0 0 10px rgba(0,255,136,0.4)', textTransform: 'uppercase' }}>
                  {activeFlightName}
                </span>
              </div>
            )}

            {/* ─ Sincronización de Hora / Ajustes ─ */}
            <div style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--glass-border)',
              borderRadius: '12px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              boxShadow: 'var(--shadow-glow)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Clock size={18} color="var(--text-secondary)" />
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 800, letterSpacing: '1px' }}>HORA REGISTRO DETECCIÓN</span>
                </div>
                {fixedTime !== null ? (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontSize: '0.75rem',
                    color: '#FFD600',
                    fontWeight: 'bold',
                    background: 'rgba(255,214,0,0.1)',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,214,0,0.3)'
                  }}>
                    <Lock size={12} /> HORA FIJADA
                  </span>
                ) : (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontSize: '0.75rem',
                    color: '#00ff88',
                    fontWeight: 'bold',
                    background: 'rgba(0,255,136,0.1)',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    border: '1px solid rgba(0,255,136,0.3)'
                  }}>
                    <span style={{
                      width: '6px',
                      height: '6px',
                      background: '#00ff88',
                      borderRadius: '50%',
                      display: 'inline-block'
                    }}></span>
                    TIEMPO REAL
                  </span>
                )}
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                padding: '0.5rem 1rem'
              }}>
                <span style={{
                  fontSize: '1.5rem',
                  fontFamily: 'monospace',
                  fontWeight: 900,
                  color: fixedTime !== null ? '#FFD600' : 'white',
                  textShadow: fixedTime !== null ? '0 0 10px rgba(255,214,0,0.3)' : 'none'
                }}>
                  {formatTime24h(fixedTime || currentTime)}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                  {formatDateDMY(fixedTime || currentTime)}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.25rem' }}>
                <button
                  type="button"
                  onClick={handleToggleFixTime}
                  className="btn-3d"
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '0.85rem',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    background: fixedTime !== null ? '#FF1744' : 'var(--primary)',
                    color: fixedTime !== null ? 'white' : 'black',
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: fixedTime !== null ? '0 4px 12px rgba(255,23,68,0.2)' : '0 4px 12px rgba(16,185,129,0.2)'
                  }}
                >
                  {fixedTime !== null ? (
                    <>
                      <Unlock size={16} /> LIBERAR RELOJ
                    </>
                  ) : (
                    <>
                      <Lock size={16} /> FIJAR HORA
                    </>
                  )}
                </button>

                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(3, 1fr)', 
                  gap: '0.75rem',
                  marginTop: '0.25rem'
                }}>
                  {/* Horas */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'bold', letterSpacing: '0.5px' }}>HORAS</span>
                    <div style={{ display: 'flex', width: '100%', gap: '0.35rem' }}>
                      <button
                        type="button"
                        onClick={() => handleAdjustTime(-3600)}
                        className="btn-3d"
                        style={{
                          flex: 1,
                          padding: '10px 5px',
                          fontSize: '0.85rem',
                          fontWeight: 900,
                          background: 'black',
                          color: 'var(--primary)',
                          border: '1px solid var(--primary)',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '2px',
                          boxShadow: 'none'
                        }}
                        title="Restar 1 hora"
                      >
                        <Minus size={14} />1h
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdjustTime(3600)}
                        className="btn-3d"
                        style={{
                          flex: 1,
                          padding: '10px 5px',
                          fontSize: '0.85rem',
                          fontWeight: 900,
                          background: 'black',
                          color: 'var(--primary)',
                          border: '1px solid var(--primary)',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '2px',
                          boxShadow: 'none'
                        }}
                        title="Sumar 1 hora"
                      >
                        <Plus size={14} />1h
                      </button>
                    </div>
                  </div>

                  {/* Minutos */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'bold', letterSpacing: '0.5px' }}>MINUTOS</span>
                    <div style={{ display: 'flex', width: '100%', gap: '0.35rem' }}>
                      <button
                        type="button"
                        onClick={() => handleAdjustTime(-60)}
                        className="btn-3d"
                        style={{
                          flex: 1,
                          padding: '10px 5px',
                          fontSize: '0.85rem',
                          fontWeight: 900,
                          background: 'black',
                          color: 'var(--primary)',
                          border: '1px solid var(--primary)',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '2px',
                          boxShadow: 'none'
                        }}
                        title="Restar 1 minuto"
                      >
                        <Minus size={14} />1m
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdjustTime(60)}
                        className="btn-3d"
                        style={{
                          flex: 1,
                          padding: '10px 5px',
                          fontSize: '0.85rem',
                          fontWeight: 900,
                          background: 'black',
                          color: 'var(--primary)',
                          border: '1px solid var(--primary)',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '2px',
                          boxShadow: 'none'
                        }}
                        title="Sumar 1 minuto"
                      >
                        <Plus size={14} />1m
                      </button>
                    </div>
                  </div>

                  {/* Segundos */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'bold', letterSpacing: '0.5px' }}>SEGUNDOS</span>
                    <div style={{ display: 'flex', width: '100%', gap: '0.35rem' }}>
                      <button
                        type="button"
                        onClick={() => handleAdjustTime(-1)}
                        className="btn-3d"
                        style={{
                          flex: 1,
                          padding: '10px 5px',
                          fontSize: '0.85rem',
                          fontWeight: 900,
                          background: 'black',
                          color: 'var(--primary)',
                          border: '1px solid var(--primary)',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '2px',
                          boxShadow: 'none'
                        }}
                        title="Restar 1 segundo"
                      >
                        <Minus size={14} />1s
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdjustTime(1)}
                        className="btn-3d"
                        style={{
                          flex: 1,
                          padding: '10px 5px',
                          fontSize: '0.85rem',
                          fontWeight: 900,
                          background: 'black',
                          color: 'var(--primary)',
                          border: '1px solid var(--primary)',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '2px',
                          boxShadow: 'none'
                        }}
                        title="Sumar 1 segundo"
                      >
                        <Plus size={14} />1s
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ─ Elemento ─ */}
            <div>
              {elementNames.length > 0 ? (
                <SearchableSelect
                  label="Elemento"
                  options={elementNames}
                  value={selectedElement}
                  onChange={handleElementChange}
                  required
                  placeholder="-- Seleccionar Elemento --"
                />
              ) : (
                <>
                  <label>Elemento</label>
                  <div style={{ background: 'rgba(255,200,0,0.06)', border: '1px solid rgba(255,200,0,0.2)', borderRadius: '12px', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Info size={16} color="#ffcc00" />
                    <span style={{ fontSize: '0.85rem', color: '#ffcc00' }}>
                      Sin elementos cargados. Ve a <strong>⚙️ → Base de Conocimiento</strong> para importar desde Excel.
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* ─ Anomalía (filtrada por elemento) ─ */}
            <div>
              {!selectedElement ? (
                <>
                  <label>Anomalía / Detección</label>
                  <input
                    type="text"
                    disabled
                    value=""
                    placeholder="Selecciona un elemento primero..."
                    style={{ opacity: 0.4, cursor: 'not-allowed' }}
                  />
                </>
              ) : filteredAnomalies.length > 0 ? (
                <SearchableSelect
                  label="Anomalía / Detección"
                  options={filteredAnomalies}
                  value={selectedAnomaly}
                  onChange={handleAnomalyChange}
                  required
                  placeholder="-- Seleccionar Anomalía --"
                />
              ) : (
                <>
                  <label>Anomalía / Detección</label>
                  <input type="text" value={selectedAnomaly} onChange={e => { setSelectedAnomaly(e.target.value); setRecommendation(''); }} placeholder="No hay anomalías para este elemento" required />
                </>
              )}
            </div>

            {/* ─ Recomendación (auto-populated, read-only) ─ */}
            {recommendation && (
              <div style={{
                background: 'rgba(0,242,255,0.05)', border: '1px solid rgba(0,242,255,0.2)',
                borderRadius: '12px', padding: '0.85rem 1rem',
                display: 'flex', alignItems: 'flex-start', gap: '0.6rem'
              }}>
                <Info size={16} color="var(--primary)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, marginBottom: '2px' }}>
                    Recomendación
                  </p>
                  <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--primary)', fontWeight: 500 }}>
                    {recommendation}
                  </p>
                </div>
              </div>
            )}

            {/* ─ Criticidad (Botones directos táctiles) ─ */}
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Criticidad</label>
              {lists.criticalities.length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  Sin criticidades — agrega en ⚙️ → Listas
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  marginTop: '0.5rem',
                  width: '100%'
                }}>
                  {lists.criticalities.map(crit => {
                    const isSelected = criticality === crit;
                    const baseColor = critColors[crit] || '#94A3B8';
                    return (
                      <button
                        key={crit}
                        type="button"
                        onClick={() => setCriticality(crit)}
                        style={{
                          flex: '1 1 calc(20% - 0.75rem)',
                          minWidth: '90px',
                          padding: '12px 10px',
                          borderRadius: '8px',
                          border: `2px solid ${baseColor}`,
                          background: isSelected ? baseColor : 'rgba(0,0,0,0.85)',
                          color: isSelected ? '#000000' : baseColor,
                          fontWeight: 900,
                          fontSize: '0.85rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          cursor: 'pointer',
                          textAlign: 'center',
                          boxShadow: isSelected
                            ? `0 0 15px ${baseColor}`
                            : 'none',
                          transition: 'all 0.2s ease',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        {crit}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>



            {/* ─ Observaciones ─ */}
            <div>
              <label>Observaciones</label>
              <textarea rows={3} placeholder="Detalles adicionales..." value={observations} onChange={e => setObservations(e.target.value)} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button type="button" onClick={() => setActivePanel('batteries')}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                <ChevronLeft size={16} /> Ir a Baterías
              </button>
              <button 
                type="submit" 
                disabled={isSaving}
                className="btn-3d" 
                style={{ 
                  width: '100%', 
                  maxWidth: '350px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '0.75rem', 
                  padding: '1.2rem',
                  opacity: isSaving ? 0.6 : 1,
                  cursor: isSaving ? 'not-allowed' : 'pointer'
                }}
              >
                <Save size={24} /> <span>{isSaving ? 'GUARDANDO...' : 'GUARDAR DETECCIÓN'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default BatteriesDetectionsForm;
