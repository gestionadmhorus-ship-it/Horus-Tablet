import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import {
  Save, ArrowLeft,
  Battery, AlertTriangle, ChevronRight, ChevronLeft, Info,
  Clock
} from 'lucide-react';
import type { BatteryData, DetectionData, ListsData } from '../types';
import { generateId } from '../utils/idGenerator';
import { SearchableSelect } from './SearchableSelect';
import { formatTime24h, formatTimestamp } from '../utils/dateUtils';

interface BatteriesDetectionsFormProps {
  onSaveBattery: (data: BatteryData) => void | Promise<void>;
  onSaveDetection: (data: DetectionData) => void | Promise<void>;
  onBack: () => void;
  lists: ListsData;
  activeFlightId?: string;
  activeFlightName?: string;
  activeFlightCategory?: string;
}

type ActivePanel = 'batteries' | 'detections';
type DetectionStep = 'element' | 'anomaly' | 'criticality' | 'access' | 'observations';

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

const TIME_WHEEL_ITEM_HEIGHT = 48;
const TIME_WHEEL_REPETITIONS = 5;
const TIME_WHEEL_CENTER_COPY = Math.floor(TIME_WHEEL_REPETITIONS / 2);

interface TimeWheelProps {
  label: string;
  value: number;
  range: number;
  onDelta: (steps: number) => void;
  onInteractionStart: () => void;
}

const TimeWheel: React.FC<TimeWheelProps> = ({
  label,
  value,
  range,
  onDelta,
  onInteractionStart
}) => {
  const wheelRef = useRef<HTMLDivElement>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const committedIndexRef = useRef(TIME_WHEEL_CENTER_COPY * range + value);
  const isInteractingRef = useRef(false);
  const isRecenteringRef = useRef(false);
  const latestValueRef = useRef(value);
  const needsPostInteractionSyncRef = useRef(false);
  const postInteractionFrameRef = useRef<number | null>(null);

  latestValueRef.current = value;

  const setScrollIndex = (index: number) => {
    const wheel = wheelRef.current;
    if (!wheel) return;

    isRecenteringRef.current = true;
    wheel.scrollTop = index * TIME_WHEEL_ITEM_HEIGHT;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isRecenteringRef.current = false;
      });
    });
  };

  const syncToLatestValue = () => {
    const centeredIndex = TIME_WHEEL_CENTER_COPY * range + latestValueRef.current;
    committedIndexRef.current = centeredIndex;
    setScrollIndex(centeredIndex);
  };

  useLayoutEffect(() => {
    if (isInteractingRef.current) return;
    const centeredIndex = TIME_WHEEL_CENTER_COPY * range + value;
    committedIndexRef.current = centeredIndex;
    setScrollIndex(centeredIndex);
    needsPostInteractionSyncRef.current = false;
  }, [range, value]);

  useEffect(() => () => {
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    if (postInteractionFrameRef.current !== null) cancelAnimationFrame(postInteractionFrameRef.current);
  }, []);

  const beginInteraction = () => {
    if (isRecenteringRef.current || isInteractingRef.current) return;
    isInteractingRef.current = true;
    onInteractionStart();
  };

  const settleSelection = () => {
    const wheel = wheelRef.current;
    if (!wheel || isRecenteringRef.current) return;

    const rawIndex = Math.round(wheel.scrollTop / TIME_WHEEL_ITEM_HEIGHT);
    const boundedIndex = Math.max(0, Math.min(range * TIME_WHEEL_REPETITIONS - 1, rawIndex));
    const delta = boundedIndex - committedIndexRef.current;

    isInteractingRef.current = false;
    needsPostInteractionSyncRef.current = true;
    if (delta !== 0) onDelta(delta);
    if (postInteractionFrameRef.current !== null) cancelAnimationFrame(postInteractionFrameRef.current);
    postInteractionFrameRef.current = requestAnimationFrame(() => {
      postInteractionFrameRef.current = null;
      if (!needsPostInteractionSyncRef.current) return;
      needsPostInteractionSyncRef.current = false;
      syncToLatestValue();
    });
  };

  const scheduleSettle = () => {
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(settleSelection, 120);
  };

  const handleScroll = () => {
    if (isRecenteringRef.current) return;
    beginInteraction();
    scheduleSettle();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    beginInteraction();
    wheelRef.current?.scrollBy({
      top: event.key === 'ArrowDown' ? TIME_WHEEL_ITEM_HEIGHT : -TIME_WHEEL_ITEM_HEIGHT,
      behavior: 'smooth'
    });
    scheduleSettle();
  };

  const values = Array.from(
    { length: range * TIME_WHEEL_REPETITIONS },
    (_, index) => index % range
  );

  return (
    <div className="time-wheel-column">
      <span className="time-wheel-label">{label}</span>
      <div className="time-wheel-frame">
        <div
          ref={wheelRef}
          className="time-wheel"
          role="spinbutton"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={range - 1}
          aria-valuenow={value}
          onPointerDown={beginInteraction}
          onPointerUp={scheduleSettle}
          onPointerCancel={scheduleSettle}
          onWheel={beginInteraction}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
        >
          {values.map((option, index) => (
            <div className="time-wheel-option" aria-hidden="true" key={`${label}-${index}`}>
              {String(option).padStart(2, '0')}
            </div>
          ))}
        </div>
        <div className="time-wheel-selection" aria-hidden="true" />
      </div>
    </div>
  );
};



/* ═══════════════ COMPONENT ═══════════════ */
const BatteriesDetectionsForm: React.FC<BatteriesDetectionsFormProps> = ({
  onSaveBattery, onSaveDetection, onBack, lists, activeFlightId, activeFlightName, activeFlightCategory
}) => {
  const [activePanel, setActivePanel] = useState<ActivePanel>('batteries');
  const [isSaving, setIsSaving] = useState(false);
  const saveLockRef = useRef(false);
  const isLinkedTablet = localStorage.getItem('horus_sync_role') === 'client'
    && !!localStorage.getItem('horus_target_server_id')?.trim();

  /* ─── Detection Time Sync state ─── */
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [fixedTime, setFixedTime] = useState<Date | null>(null);
  const [adjustmentTime, setAdjustmentTime] = useState<Date | null>(null);

  /* ─── Battery state ─── */
  const [batteryData, setBatteryData] = useState({ pilot: '', droneBatteryName: '', controlBatteryName: '' });

  /* ─── Detection state (cascading) ─── */
  const [selectedElement, setSelectedElement] = useState('');
  const [selectedAnomaly, setSelectedAnomaly] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [criticality, setCriticality] = useState('');
  const [accessStatus, setAccessStatus] = useState('Buena');
  const [observations, setObservations] = useState('');

  /* Presentation-only state for the progressive detection flow. */
  const [detectionStep, setDetectionStep] = useState<DetectionStep>('element');
  const [isClockExpanded, setIsClockExpanded] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const detectionStepRefs = useRef<Partial<Record<DetectionStep, HTMLDivElement | null>>>({});

  const moveToDetectionStep = (step: DetectionStep) => {
    setDetectionStep(step);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        detectionStepRefs.current[step]?.scrollIntoView({
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'start'
        });
      });
    });
  };

  useEffect(() => {
    if (activePanel !== 'detections' || !window.visualViewport) {
      setKeyboardInset(0);
      return;
    }
    const viewport = window.visualViewport;
    const updateKeyboardInset = () => {
      setKeyboardInset(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop));
    };
    updateKeyboardInset();
    viewport.addEventListener('resize', updateKeyboardInset);
    viewport.addEventListener('scroll', updateKeyboardInset);
    return () => {
      viewport.removeEventListener('resize', updateKeyboardInset);
      viewport.removeEventListener('scroll', updateKeyboardInset);
    };
  }, [activePanel]);

  /* ─── Time Sync logic ─── */
  useEffect(() => {
    if (activePanel !== 'detections' || fixedTime !== null) return;

    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, [activePanel, fixedTime]);

  const handleBeginTimeAdjustment = () => {
    const baseTime = fixedTime ?? new Date();
    setAdjustmentTime(new Date(baseTime.getTime()));
    setIsClockExpanded(true);
  };

  const handleAdjustTime = (seconds: number) => {
    setAdjustmentTime(previousTime => {
      if (!previousTime) return previousTime;
      return new Date(previousTime.getTime() + seconds * 1000);
    });
  };

  const handleTimeWheelInteractionStart = () => {
    setAdjustmentTime(previousTime => previousTime ?? new Date());
  };

  const handleConfirmFixedTime = () => {
    if (!adjustmentTime) return;
    setFixedTime(new Date(adjustmentTime.getTime()));
    setIsClockExpanded(false);
    setAdjustmentTime(null);
    moveToDetectionStep('element');
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
    if (saveLockRef.current) return;
    saveLockRef.current = true;
    setIsSaving(true);

    try {
      const now = new Date();
      await onSaveBattery({ id: generateId('BAT'), flightId: activeFlightId, timestamp: formatTimestamp(now), ...batteryData });
      await window.customAlert('✅ Baterías guardadas con éxito');
      setBatteryData({ pilot: '', droneBatteryName: '', controlBatteryName: '' });
      setActivePanel('detections');
    } finally {
      saveLockRef.current = false;
      setIsSaving(false);
    }
  };

  const handleSaveDetection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saveLockRef.current) return;

    if (!criticality) {
      await window.customAlert('⚠️ Por favor selecciona un nivel de criticidad antes de guardar.');
      return;
    }

    saveLockRef.current = true;
    setIsSaving(true);
    try {
      const saveTime = fixedTime || new Date();
      const generatedFileName = formatTime24h(saveTime).replace(/:/g, '');
      await onSaveDetection({
        id: generateId('DET'),
        flightId: activeFlightId,
        timestamp: formatTimestamp(saveTime),
        element: selectedElement,
        anomaly: selectedAnomaly,
        recommendation,
        criticality,
        accessStatus: accessStatus || 'Buena',
        fileName: generatedFileName,
        observations
      });
      await window.customAlert('✅ Detección guardada con éxito');
      setSelectedElement(''); setSelectedAnomaly(''); setRecommendation('');
      setCriticality(''); setAccessStatus('Buena'); setObservations('');
      setDetectionStep('element'); setIsClockExpanded(false);
      setAdjustmentTime(null);
      setFixedTime(null); // Reset fixed time back to real-time clock
    } finally {
      saveLockRef.current = false;
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
        <div className="battery-flight-banner" style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid #00ff88', color: '#00ff88', padding: '0.8rem 1.5rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', fontWeight: 'bold', boxShadow: '0 0 10px rgba(0,255,136,0.2)' }}>
          <span>🚁 VUELO ACTIVO: {activeFlightName}</span>
        </div>
      )}

      <div className="glass" style={{ borderTop: '4px solid #00ff88', padding: '0', overflow: 'visible', boxShadow: '0 -5px 20px rgba(0,255,136,0.1)' }}>
        {/* Tab Bar */}
        <div className="battery-detections-tabs" style={{ display: 'flex', borderBottom: '2px solid #333', background: '#000' }}>
          <button
            className="battery-detections-tab"
            onClick={() => setActivePanel('batteries')}
            style={{
              flex: 1, padding: '1rem 1.5rem', border: 'none', cursor: 'pointer',
              fontWeight: 900, fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '1px',
              transition: 'all 0.2s ease',
              background: activePanel === 'batteries' ? 'var(--primary)' : 'transparent',
              color: activePanel === 'batteries' ? 'black' : '#666',
            }}
          >
            <span className="battery-detections-tab-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}><Battery size={20} /> Baterías</span>
          </button>
          <button
            className="battery-detections-tab"
            onClick={() => setActivePanel('detections')}
            style={{
              flex: 1, padding: '1rem 1.5rem', border: 'none', cursor: 'pointer',
              fontWeight: 900, fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '1px',
              transition: 'all 0.2s ease',
              background: activePanel === 'detections' ? 'var(--primary)' : 'transparent',
              color: activePanel === 'detections' ? 'black' : '#666',
            }}
          >
            <span className="battery-detections-tab-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}><AlertTriangle size={20} /> Detecciones</span>
          </button>
        </div>

        {/* ────── BATTERIES PANEL ────── */}
        {activePanel === 'batteries' && (
          <form onSubmit={handleSaveBattery} className="form-scroll-container battery-form" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="battery-heading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
              <div style={{ background: 'rgba(0,194,255,0.12)', padding: '0.6rem', borderRadius: '10px', color: '#00c2ff' }}><Battery size={24} /></div>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#00c2ff' }}>Estado de Baterías</h3>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Registro de carga por vuelo</p>
              </div>
            </div>

            <div className="battery-pilot">
              <SmartSelect
                label="Piloto"
                options={lists.pilots}
                value={batteryData.pilot}
                onChange={v => setBatteryData({ ...batteryData, pilot: v })}
                required
                emptyMsg="Sin pilotos — agrega en ⚙️ → Listas → Pilotos"
              />
            </div>

            <div className="grid-cols-2 battery-id-grid">
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

            <div className="battery-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="battery-footer-navigation" type="button" onClick={() => setActivePanel('detections')}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                Ir a Detecciones <ChevronRight size={16} />
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="btn-3d battery-save"
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
          <form
            onSubmit={handleSaveDetection}
            className="form-scroll-container detections-form detections-progressive-flow"
            style={{ padding: '1.2rem', paddingBottom: `calc(1.2rem + ${keyboardInset}px)`, display: 'flex', flexDirection: 'column', gap: '1rem' }}
          >
            <div className="detections-heading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
              <div style={{ background: 'rgba(0,255,136,0.1)', padding: '0.6rem', borderRadius: '10px', color: 'var(--accent)' }}><AlertTriangle size={24} /></div>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--accent)' }}>Registro de Detecciones</h3>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Elemento → Anomalía → Recomendación</p>
              </div>
            </div>

            {/* ─ Sincronización de Hora / Ajustes ─ */}
            <div className={`detections-clock ${isClockExpanded ? 'expanded' : 'compact'}`}>
              <div className="detections-clock-compact-row">
                {fixedTime && !isClockExpanded ? (
                  <div className="detections-clock-fixed-indicator">
                    ✓ FIJADO · {formatTime24h(fixedTime)}
                  </div>
                ) : (
                  <>
                    <Clock size={18} color="var(--text-secondary)" />
                    <span className="detections-clock-label">Hora</span>
                    <strong>{formatTime24h(isClockExpanded && adjustmentTime ? adjustmentTime : currentTime)}</strong>
                  </>
                )}
                {!isClockExpanded && (
                  <button type="button" onClick={handleBeginTimeAdjustment}>AJUSTAR</button>
                )}
              </div>
              {isClockExpanded && (
              <div className="detections-clock-controls">
                <button
                  type="button"
                  onClick={handleConfirmFixedTime}
                  className="btn-3d detections-clock-toggle"
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
                    background: 'var(--primary)',
                    color: 'black',
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(16,185,129,0.2)'
                  }}
                >
                  FIJAR
                </button>

                <div className="detections-time-adjustments" style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: '0.75rem',
                  marginTop: '0.25rem'
                }}>
                  <TimeWheel
                    label="HORAS"
                    value={(adjustmentTime || currentTime).getHours()}
                    range={24}
                    onInteractionStart={handleTimeWheelInteractionStart}
                    onDelta={steps => handleAdjustTime(steps * 3600)}
                  />
                  <TimeWheel
                    label="MINUTOS"
                    value={(adjustmentTime || currentTime).getMinutes()}
                    range={60}
                    onInteractionStart={handleTimeWheelInteractionStart}
                    onDelta={steps => handleAdjustTime(steps * 60)}
                  />
                  <TimeWheel
                    label="SEGUNDOS"
                    value={(adjustmentTime || currentTime).getSeconds()}
                    range={60}
                    onInteractionStart={handleTimeWheelInteractionStart}
                    onDelta={steps => handleAdjustTime(steps)}
                  />
                </div>
              </div>
              )}
            </div>

            <div className="detections-knowledge-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div ref={node => { detectionStepRefs.current.element = node; }} className={`detections-progressive-step ${detectionStep === 'element' ? 'active' : ''}`} onFocus={() => setDetectionStep('element')}>
                {elementNames.length > 0 ? (
                  <SearchableSelect
                    label="Elemento"
                    options={elementNames}
                    value={selectedElement}
                    onChange={value => {
                      handleElementChange(value);
                      moveToDetectionStep('anomaly');
                    }}
                    required
                    deferSearch
                    placeholder="-- Seleccionar Elemento --"
                  />
                ) : (
                  <>
                    <label>Elemento</label>
                    <div className="detections-empty-knowledge" style={{ background: 'rgba(255,200,0,0.06)', border: '1px solid rgba(255,200,0,0.2)', borderRadius: '12px', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Info className="detections-nonshrinking-icon" size={16} color="#ffcc00" />
                      <span className="detections-wrapping-text" style={{ fontSize: '0.85rem', color: '#ffcc00' }}>
                        {isLinkedTablet
                          ? 'La Base de Conocimiento está vacía. Debe ser actualizada desde Control Central.'
                          : <>Sin elementos cargados. Ve a <strong>⚙️ → Base de Conocimiento</strong> para importar desde Excel.</>}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div ref={node => { detectionStepRefs.current.anomaly = node; }} className={`detections-progressive-step ${detectionStep === 'anomaly' ? 'active' : ''}`} onFocus={() => setDetectionStep('anomaly')}>
                {!selectedElement ? (
                  <>
                    <label>Anomalía / Detección</label>
                    <input type="text" disabled value="" placeholder="Selecciona un elemento primero..." style={{ opacity: 0.4, cursor: 'not-allowed' }} />
                  </>
                ) : filteredAnomalies.length > 0 ? (
                  <SearchableSelect
                    label="Anomalía / Detección"
                    options={filteredAnomalies}
                    value={selectedAnomaly}
                    onChange={value => {
                      handleAnomalyChange(value);
                      moveToDetectionStep('criticality');
                    }}
                    required
                    deferSearch
                    placeholder="-- Seleccionar Anomalía --"
                  />
                ) : (
                  <>
                    <label>Anomalía / Detección</label>
                    <input type="text" value={selectedAnomaly} onChange={e => { setSelectedAnomaly(e.target.value); setRecommendation(''); }} placeholder="No hay anomalías para este elemento" required />
                  </>
                )}
              </div>
            </div>

            {/* ─ Recomendación (auto-populated, read-only) ─ */}
            {recommendation && (
              <div className="detections-recommendation" style={{
                background: 'rgba(0,242,255,0.05)', border: '1px solid rgba(0,242,255,0.2)',
                borderRadius: '12px', padding: '0.85rem 1rem',
                display: 'flex', alignItems: 'flex-start', gap: '0.6rem'
              }}>
                <Info className="detections-nonshrinking-icon" size={16} color="var(--primary)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div className="detections-recommendation-copy">
                  <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, marginBottom: '2px' }}>
                    Recomendación
                  </p>
                  <p className="detections-wrapping-text" style={{ margin: 0, fontSize: '0.92rem', color: 'var(--primary)', fontWeight: 500 }}>
                    {recommendation}
                  </p>
                </div>
              </div>
            )}

            <div className="detections-options-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem', width: '100%' }}>
              <div ref={node => { detectionStepRefs.current.criticality = node; }} className={`detections-progressive-step ${detectionStep === 'criticality' ? 'active' : ''}`} onFocus={() => setDetectionStep('criticality')}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#E2E8F0', fontSize: '0.85rem' }}>
                  Criticidad (Falla de Equipo)
                </label>
                {lists.criticalities.length === 0 ? (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Sin criticidades — agrega en ⚙️ → Listas
                  </div>
                ) : (
                  <div className="detections-criticality-options" style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    width: '100%'
                  }}>
                    {lists.criticalities.map(crit => {
                      const isSelected = criticality === crit;
                      const baseColor = critColors[crit] || '#94A3B8';
                      return (
                        <button
                          key={crit}
                          type="button"
                          onClick={() => { setCriticality(crit); moveToDetectionStep('access'); }}
                          className="detections-option-button"
                          style={{
                            flex: '1 1 calc(33.33% - 0.5rem)',
                            minWidth: '70px',
                            padding: '10px 6px',
                            borderRadius: '8px',
                            border: `2px solid ${baseColor}`,
                            background: isSelected ? baseColor : 'rgba(0,0,0,0.85)',
                            color: isSelected ? '#000000' : baseColor,
                            fontWeight: 900,
                            fontSize: '0.8rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            cursor: 'pointer',
                            textAlign: 'center',
                            boxShadow: isSelected ? `0 0 12px ${baseColor}` : 'none',
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

              <div ref={node => { detectionStepRefs.current.access = node; }} className={`detections-progressive-step ${detectionStep === 'access' ? 'active' : ''}`} onFocus={() => setDetectionStep('access')}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#38BDF8', fontSize: '0.85rem' }}>
                  🗺️ Estado de Acceso a Traza
                </label>
                <div className="detections-access-options" style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                  {[
                    { value: 'Buena', label: 'Buena', color: '#10B981', bg: 'rgba(16, 185, 129, 0.2)' },
                    { value: 'Regular', label: 'Regular', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.2)' },
                    { value: 'Mala', label: 'Mala', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.2)' }
                  ].map(status => {
                    const isSelected = accessStatus === status.value;
                    return (
                      <button
                        key={status.value}
                        type="button"
                        onClick={() => { setAccessStatus(status.value); moveToDetectionStep('observations'); }}
                        className="detections-option-button"
                        style={{
                          flex: 1,
                          padding: '10px 6px',
                          borderRadius: '8px',
                          border: `2px solid ${isSelected ? status.color : '#334155'}`,
                          background: isSelected ? status.bg : 'rgba(15, 23, 42, 0.85)',
                          color: isSelected ? status.color : '#94A3B8',
                          fontWeight: 900,
                          fontSize: '0.82rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          cursor: 'pointer',
                          textAlign: 'center',
                          boxShadow: isSelected ? `0 0 10px ${status.color}40` : 'none',
                          transition: 'all 0.2s ease',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        {status.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div ref={node => { detectionStepRefs.current.observations = node; }} className={`detections-progressive-step ${detectionStep === 'observations' ? 'active' : ''}`} onFocus={() => setDetectionStep('observations')}>
              <label>Observaciones</label>
              <textarea
                className="detections-observations"
                rows={3}
                placeholder="Detalles adicionales..."
                value={observations}
                onChange={e => setObservations(e.target.value)}
                onFocus={() => setTimeout(() => detectionStepRefs.current.observations?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }), 180)}
              />
            </div>

            <div className="detections-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="detections-footer-navigation" type="button" onClick={() => setActivePanel('batteries')}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                <ChevronLeft size={16} /> Ir a Baterías
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="btn-3d detections-save"
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
      <style>{`
        .battery-flight-banner,
        .battery-flight-banner span,
        .battery-form,
        .battery-form * {
          min-width: 0;
          box-sizing: border-box;
        }
        .battery-flight-banner {
          max-width: 100%;
          flex-wrap: wrap;
        }
        .battery-flight-banner span {
          white-space: normal;
          overflow-wrap: anywhere;
        }
        .battery-detections-tabs {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          width: 100%;
        }
        .battery-detections-tab {
          width: 100%;
          min-width: 0;
          min-height: 48px;
          font-size: 1rem !important;
          padding: 1rem 1.5rem !important;
          white-space: normal;
          overflow-wrap: anywhere;
        }
        .battery-detections-tab-label {
          min-width: 0;
          flex-wrap: wrap;
          white-space: normal;
          overflow-wrap: anywhere;
        }
        .battery-detections-tab-label svg,
        .battery-heading > div:first-child {
          flex-shrink: 0;
        }
        .battery-form {
          width: 100%;
          max-width: 100%;
          overflow-x: hidden;
        }
        .battery-heading {
          min-width: 0;
          flex-wrap: wrap;
        }
        .battery-heading > div:last-child {
          min-width: 0;
        }
        .battery-pilot {
          min-width: 0;
          width: 100%;
          max-width: 100%;
        }
        .battery-heading h3 {
          font-size: 1.2rem !important;
        }
        .battery-heading h3,
        .battery-heading p,
        .battery-form label,
        .battery-footer-navigation,
        .battery-save span {
          white-space: normal;
          overflow-wrap: anywhere;
        }
        .battery-pilot input,
        .battery-id-grid input {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          box-sizing: border-box;
        }
        .battery-id-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }
        .battery-id-grid > * {
          min-width: 0;
          max-width: 100%;
        }
        .battery-footer {
          min-width: 0;
          flex-wrap: wrap;
          gap: 0.75rem;
        }
        .battery-footer-navigation {
          min-height: 48px;
          justify-content: center;
        }
        .battery-save.btn-3d {
          width: 100% !important;
          max-width: 350px !important;
          min-height: 48px;
          padding: 1.2rem !important;
        }
        @media (max-width: 600px) {
          .battery-detections-tabs,
          .battery-id-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }
          .battery-footer {
            flex-direction: column;
            align-items: stretch !important;
          }
          .battery-footer-navigation,
          .battery-save.btn-3d {
            width: 100% !important;
            max-width: 100% !important;
          }
        }
        .detections-form,
        .detections-form * {
          min-width: 0;
          box-sizing: border-box;
        }
        .detections-form {
          width: 100%;
          max-width: 100%;
          overflow-x: hidden;
        }
        .detections-progressive-flow {
          scroll-padding-top: max(0.75rem, env(safe-area-inset-top));
          transition: padding-bottom 0.15s ease;
        }
        .detections-progressive-step {
          width: 100%;
          scroll-margin-top: max(0.75rem, env(safe-area-inset-top));
        }
        .detections-progressive-step.active {
          padding: clamp(0.8rem, 2.5vw, 1.1rem);
          border: 1px solid rgba(0, 242, 255, 0.28);
          border-radius: 12px;
          background: rgba(0, 242, 255, 0.045);
          box-shadow: 0 0 18px rgba(0, 242, 255, 0.06);
        }
        .detections-clock-compact-row > button {
          min-height: 48px;
          padding: 0.65rem 0.9rem;
          border: 1px solid var(--primary);
          border-radius: 8px;
          background: rgba(0, 242, 255, 0.08);
          color: var(--primary);
          font-weight: 800;
          cursor: pointer;
        }
        .detections-clock {
          padding: 0.65rem 0.8rem;
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          background: var(--card-bg);
          box-shadow: var(--shadow-glow);
        }
        .detections-clock-compact-row {
          display: grid;
          grid-template-columns: auto auto minmax(88px, auto) minmax(0, 1fr) auto;
          align-items: center;
          gap: 0.65rem;
        }
        .detections-clock-compact-row strong {
          color: white;
          font-family: monospace;
          font-size: 1.15rem;
        }
        .detections-clock-compact-row > span:not(.detections-clock-label) {
          color: var(--text-secondary);
          font-family: monospace;
          font-size: 0.78rem;
        }
        .detections-clock-label {
          color: var(--text-secondary);
          font-size: 0.75rem;
          font-weight: 800;
          text-transform: uppercase;
        }
        .detections-clock-controls {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-top: 0.75rem;
          padding-top: 0.75rem;
          border-top: 1px solid var(--glass-border);
        }
        .detections-clock-fixed-indicator {
          width: fit-content;
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.25rem 0.5rem;
          border-radius: 6px;
          font-size: 0.72rem;
          font-weight: 800;
          color: #00ff88;
          background: rgba(0,255,136,0.1);
        }
        .detections-heading,
        .detections-clock-header,
        .detections-clock-title,
        .detections-clock-value,
        .detections-footer {
          flex-wrap: wrap;
        }
        .detections-heading > div:last-child,
        .detections-clock-title,
        .detections-recommendation-copy {
          min-width: 0;
        }
        .detections-heading h3,
        .detections-heading p,
        .detections-clock-title span,
        .detections-clock-fixed-indicator,
        .detections-wrapping-text {
          white-space: normal;
          overflow-wrap: anywhere;
        }
        .detections-clock-header,
        .detections-clock-value,
        .detections-footer {
          gap: 0.75rem;
        }
        .detections-clock-fixed-indicator {
          flex-wrap: wrap;
        }
        .detections-clock-toggle.btn-3d {
          min-height: 48px;
          padding: 12px !important;
        }
        .detections-time-adjustments {
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          width: 100%;
          max-width: 480px;
          min-width: 0;
          margin-inline: auto;
        }
        .time-wheel-column,
        .time-wheel-frame,
        .time-wheel {
          width: 100%;
          min-width: 0;
          max-width: 100%;
          box-sizing: border-box;
        }
        .time-wheel-column {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 0.4rem;
        }
        .time-wheel-label {
          min-width: 0;
          max-width: 100%;
          color: var(--text-secondary);
          font-size: 0.75rem;
          font-weight: 800;
          letter-spacing: 0.5px;
          text-align: center;
          white-space: normal;
          overflow-wrap: anywhere;
        }
        .time-wheel-frame {
          position: relative;
          height: 144px;
          overflow: hidden;
          border: 1px solid var(--glass-border);
          border-radius: 10px;
          background: rgba(0, 0, 0, 0.45);
        }
        .time-wheel {
          height: 144px;
          padding-block: 48px;
          overflow-x: hidden;
          overflow-y: auto;
          overscroll-behavior-y: contain;
          touch-action: pan-y;
          scroll-snap-type: y mandatory;
          scrollbar-width: none;
          outline: none;
        }
        .time-wheel::-webkit-scrollbar {
          display: none;
        }
        .time-wheel:focus-visible {
          outline: 2px solid var(--primary);
          outline-offset: -2px;
          border-radius: 10px;
        }
        .time-wheel-option {
          height: 48px;
          min-height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
          font-family: monospace;
          font-size: 1.15rem;
          font-weight: 800;
          line-height: 1;
          scroll-snap-align: center;
          user-select: none;
        }
        .time-wheel-selection {
          position: absolute;
          z-index: 2;
          top: 48px;
          left: 4px;
          right: 4px;
          height: 48px;
          border-block: 1px solid var(--primary);
          border-radius: 6px;
          background: rgba(16, 185, 129, 0.1);
          box-shadow: 0 0 12px rgba(16, 185, 129, 0.12);
          pointer-events: none;
        }
        .detections-knowledge-grid,
        .detections-options-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }
        .detections-knowledge-grid > *,
        .detections-options-grid > * {
          min-width: 0;
          max-width: 100%;
        }
        .detections-empty-knowledge,
        .detections-recommendation {
          min-width: 0;
          max-width: 100%;
        }
        .detections-nonshrinking-icon {
          flex-shrink: 0;
        }
        .detections-criticality-options {
          display: grid !important;
          grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
        }
        .detections-access-options {
          display: grid !important;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .detections-option-button {
          width: 100%;
          min-width: 0 !important;
          min-height: 48px;
          white-space: normal;
          overflow-wrap: anywhere;
        }
        .detections-observations {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          box-sizing: border-box;
          resize: vertical;
          overflow-x: hidden;
        }
        .detections-footer-navigation {
          min-height: 48px;
          justify-content: center;
          white-space: normal;
          overflow-wrap: anywhere;
        }
        .detections-save.btn-3d {
          width: 100% !important;
          max-width: 350px !important;
          min-height: 48px;
          padding: 1.2rem !important;
        }
        @media (max-width: 600px) {
          .detections-progressive-flow {
            padding-inline: 0.75rem !important;
          }
          .detections-clock-compact-row {
            grid-template-columns: auto minmax(0, 1fr) auto;
          }
          .detections-clock-label,
          .detections-clock-compact-row > span:not(.detections-clock-label) {
            display: none;
          }
          .detections-clock-header,
          .detections-clock-value,
          .detections-footer {
            flex-direction: column;
            align-items: stretch !important;
          }
          .detections-clock-fixed-indicator {
            align-self: flex-start;
          }
          .detections-knowledge-grid,
          .detections-options-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }
          .detections-time-adjustments {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 0.4rem !important;
          }
          .detections-access-options {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .detections-access-options > :last-child {
            grid-column: 1 / -1;
          }
          .detections-footer-navigation,
          .detections-save.btn-3d {
            width: 100% !important;
            max-width: 100% !important;
          }
        }
        @media (orientation: landscape) and (max-height: 520px) {
          .detections-heading p { display: none; }
          .detections-progressive-step.active { padding: 0.65rem; }
        }
        @media (prefers-reduced-motion: reduce) {
          .detections-progressive-flow,
          .detections-progressive-flow * {
            scroll-behavior: auto !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
};

export default BatteriesDetectionsForm;
