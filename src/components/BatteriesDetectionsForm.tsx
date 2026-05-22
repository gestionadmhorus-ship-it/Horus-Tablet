import React, { useState } from 'react';
import {
  Save, ArrowLeft,
  Battery, AlertTriangle, ChevronRight, ChevronLeft, FileText, Info
} from 'lucide-react';
import type { BatteryData, DetectionData, ListsData } from '../types';
import { generateId } from '../utils/idGenerator';
import { SearchableSelect } from './SearchableSelect';

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

/* ─── Battery level bar ─── */
const BatteryBar: React.FC<{ value: string }> = ({ value }) => {
  const pct = Math.min(Math.max(Number(value) || 0, 0), 100);
  const color = pct > 50 ? 'var(--accent)' : pct > 20 ? '#ffcc00' : '#ff4444';
  return value ? (
    <div style={{ position: 'absolute', bottom: '-5px', left: 0, width: `${pct}%`, height: '3px', background: color, borderRadius: '0 0 4px 4px', transition: 'width 0.4s ease' }} />
  ) : null;
};

/* ═══════════════ COMPONENT ═══════════════ */
const BatteriesDetectionsForm: React.FC<BatteriesDetectionsFormProps> = ({
  onSaveBattery, onSaveDetection, onBack, lists, activeFlightId, activeFlightName, activeFlightCategory
}) => {
  const [activePanel, setActivePanel] = useState<ActivePanel>('batteries');

  /* ─── Battery state ─── */
  const [batteryData, setBatteryData] = useState({ pilot: '', droneBatteryName: '', droneBattery: '', controlBatteryName: '', controlBattery: '' });

  /* ─── Detection state (cascading) ─── */
  const [selectedElement, setSelectedElement] = useState('');
  const [selectedAnomaly, setSelectedAnomaly] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [criticality, setCriticality] = useState('');
  const [fileName, setFileName] = useState('');
  const [observations, setObservations] = useState('');


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
    const now = new Date();
    onSaveBattery({ id: generateId('BAT'), flightId: activeFlightId, timestamp: `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`, ...batteryData });
    await window.customAlert('✅ Baterías guardadas con éxito');
    setBatteryData({ pilot: '', droneBatteryName: '', droneBattery: '', controlBatteryName: '', controlBattery: '' });
  };

  const handleSaveDetection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!criticality) {
      await window.customAlert('⚠️ Por favor selecciona un nivel de criticidad antes de guardar.');
      return;
    }
    const now = new Date();
    onSaveDetection({
      id: generateId('DET'),
      flightId: activeFlightId,
      timestamp: `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`,
      element: selectedElement,
      anomaly: selectedAnomaly,
      recommendation,
      criticality,
      fileName,
      observations
    });
    await window.customAlert('✅ Detección guardada con éxito');
    setSelectedElement(''); setSelectedAnomaly(''); setRecommendation('');
    setCriticality(''); setFileName(''); setObservations('');
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

      <div className="glass" style={{ borderTop: '4px solid #00ff88', padding: '0', overflow: 'hidden', boxShadow: '0 -5px 20px rgba(0,255,136,0.1)' }}>
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
                <label>Carga Dron (%)</label>
                <div style={{ position: 'relative' }}>
                  <input type="number" required min={0} max={100} placeholder="Ej: 85"
                    value={batteryData.droneBattery}
                    onChange={e => setBatteryData({ ...batteryData, droneBattery: e.target.value })}
                  />
                  <BatteryBar value={batteryData.droneBattery} />
                </div>
              </div>
              <div>
                <label>ID Batería Control</label>
                <input type="text" required maxLength={3} placeholder="Ej: C02"
                  value={batteryData.controlBatteryName}
                  onChange={e => setBatteryData({ ...batteryData, controlBatteryName: e.target.value.toUpperCase() })}
                  style={{ marginBottom: '0.75rem' }}
                />
                <label>Carga Control (%)</label>
                <div style={{ position: 'relative' }}>
                  <input type="number" required min={0} max={100} placeholder="Ej: 92"
                    value={batteryData.controlBattery}
                    onChange={e => setBatteryData({ ...batteryData, controlBattery: e.target.value })}
                  />
                  <BatteryBar value={batteryData.controlBattery} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button type="button" onClick={() => setActivePanel('detections')}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                Ir a Detecciones <ChevronRight size={16} />
              </button>
              <button type="submit" className="btn-3d" style={{ width: '100%', maxWidth: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '1.2rem' }}>
                <Save size={24} /> <span>GUARDAR BATERÍAS</span>
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

            {/* ─ Archivo del Dron ─ */}
            <div>
              <label>Archivo del Dron</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={16} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
                <input type="text" value={fileName} onChange={e => setFileName(e.target.value)} placeholder="Ej: DJI_0014.JPG" style={{ flex: 1 }} />
              </div>
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
              <button type="submit" className="btn-3d" style={{ width: '100%', maxWidth: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '1.2rem' }}>
                <Save size={24} /> <span>GUARDAR DETECCIÓN</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default BatteriesDetectionsForm;
