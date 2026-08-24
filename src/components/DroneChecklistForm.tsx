import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Check, ShieldAlert, Wifi, Cpu, Play } from 'lucide-react';
import type { DroneChecklistData, ListsData } from '../types';
import { SearchableSelect } from './SearchableSelect';
import { formatTimestamp } from '../utils/dateUtils';

interface DroneChecklistFormProps {
  onSave: (data: DroneChecklistData) => void | Promise<void>;
  onUpdate?: (data: DroneChecklistData) => void | Promise<void>;
  onBack: () => void;
  lists: ListsData;
  history: DroneChecklistData[];
  editData?: DroneChecklistData;
}

export const DroneChecklistForm: React.FC<DroneChecklistFormProps> = ({
  onSave,
  onUpdate,
  onBack,
  lists,
  editData
}) => {
  const [pilot, setPilot] = useState(editData?.pilot || '');
  const [droneId, setDroneId] = useState(editData?.droneId || '');
  const [observations, setObservations] = useState(editData?.observations || '');

  // Paso / Fase activa en la vista
  const [activeStep, setActiveStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const saveLockRef = useRef(false);

  // Estado inicial de casillas
  const [checks, setChecks] = useState({
    // Fase 1: Inspección Física (Dron y Control APAGADOS)
    frameSecured: editData?.checks.frameSecured || false,
    landingGearLocked: editData?.checks.landingGearLocked || false,
    propellersIntact: editData?.checks.propellersIntact || false,
    motorsFreeSpinning: editData?.checks.motorsFreeSpinning || false,
    batterySecured: editData?.checks.batterySecured || false,
    cameraProtectorRemoved: editData?.checks.cameraProtectorRemoved || false,
    sdCardInsertedPhysically: editData?.checks.sdCardInsertedPhysically || false,
    areaSecured: editData?.checks.areaSecured || false,

    // Fase 2: Puesta en Marcha y Enlace (Encendido)
    rcAntennasDeployed: editData?.checks.rcAntennasDeployed || false,
    rcSticksCentered: editData?.checks.rcSticksCentered || false,
    appStarted: editData?.checks.appStarted || false,
    dronePoweredOn: editData?.checks.dronePoweredOn || false,
    rcDroneLinked: editData?.checks.rcDroneLinked || false,

    // Fase 3: Verificación Sistémica (Sistema Conectado)
    systemBatteriesChecked: editData?.checks.systemBatteriesChecked || false,
    imuCompassCalibrated: editData?.checks.imuCompassCalibrated || false,
    gpsLockOptimal: editData?.checks.gpsLockOptimal || false,
    rthParamsConfigured: editData?.checks.rthParamsConfigured || false,
    obstacleAvoidanceActive: editData?.checks.obstacleAvoidanceActive || false,
    cameraFeedFluid: editData?.checks.cameraFeedFluid || false,

    // Fase 4: Vuelo y Prueba Inmediata (Despegue)
    casesClosedAndStored: editData?.checks.casesClosedAndStored || false,
    takeoffAreaClear: editData?.checks.takeoffAreaClear || false,
    hoverTestPassed: editData?.checks.hoverTestPassed || false,
  });

  // Validaciones de fases completas
  const isFase1Complete = checks.frameSecured && checks.landingGearLocked && checks.propellersIntact &&
    checks.motorsFreeSpinning && checks.batterySecured && checks.cameraProtectorRemoved &&
    checks.sdCardInsertedPhysically && checks.areaSecured;

  const isFase2Complete = checks.rcAntennasDeployed && checks.rcSticksCentered && checks.appStarted &&
    checks.dronePoweredOn && checks.rcDroneLinked;

  const isFase3Complete = checks.systemBatteriesChecked && checks.imuCompassCalibrated && checks.gpsLockOptimal &&
    checks.rthParamsConfigured && checks.obstacleAvoidanceActive && checks.cameraFeedFluid;

  const isFase4Complete = checks.casesClosedAndStored && checks.takeoffAreaClear && checks.hoverTestPassed;

  // Si no está enlazado el control y el dron (Fase 2 final), bloqueamos Fase 3 y 4
  const isSystemLinked = checks.rcDroneLinked;

  // Rellenar automáticamente con el piloto a cargo actual
  useEffect(() => {
    if (!pilot && lists.pilots && lists.pilots.length > 0) {
      setPilot(lists.pilots[0]);
    }
    if (!droneId && lists.drones && lists.drones.length > 0) {
      setDroneId(lists.drones[0]);
    }
  }, [lists]);

  const handleCheckboxChange = (name: keyof typeof checks) => {
    setChecks(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  const handleSave = async () => {
    if (!pilot) {
      window.customAlert('Por favor, selecciona el piloto a cargo.');
      return;
    }
    if (!droneId) {
      window.customAlert('Por favor, ingresa o selecciona el dron a utilizar.');
      return;
    }

    if (saveLockRef.current) return;
    saveLockRef.current = true;
    setIsSaving(true);
    try {

    const payload: DroneChecklistData = {
      id: editData?.id || `D-${Date.now()}`,
      timestamp: editData?.timestamp || formatTimestamp(new Date()),
      pilot,
      droneId,
      checks,
      observations,
      deviceName: editData?.deviceName,
      isSynced: false
    };

      if (editData && onUpdate) {
        await onUpdate(payload);
      } else {
        await onSave(payload);
      }
      onBack();
    } finally {
      saveLockRef.current = false;
      setIsSaving(false);
    }
  };

  const renderCheckItems = (items: { key: keyof typeof checks; label: string }[]) => {
    return (
      <div className="drone-checklist-checks" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {items.map(item => {
          const isChecked = checks[item.key];
          return (
            <div
              key={item.key}
              className="drone-checklist-item"
              onClick={() => handleCheckboxChange(item.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '0.85rem 1rem',
                background: isChecked ? 'rgba(0, 255, 136, 0.05)' : 'rgba(255, 255, 255, 0.01)',
                border: `1.5px solid ${isChecked ? 'var(--neon-green)' : 'rgba(255, 255, 255, 0.08)'}`,
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                minHeight: '54px',
                userSelect: 'none'
              }}
              onMouseEnter={(e) => {
                if (!isChecked) {
                  e.currentTarget.style.border = '1.5px solid rgba(240, 196, 25, 0.4)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isChecked) {
                  e.currentTarget.style.border = '1.5px solid rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.01)';
                }
              }}
            >
              <div style={{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                border: `2px solid ${isChecked ? 'var(--neon-green)' : 'var(--primary)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isChecked ? 'var(--neon-green)' : 'transparent',
                flexShrink: 0,
                boxShadow: isChecked ? '0 0 8px rgba(0, 255, 138, 0.4)' : 'none',
                transition: 'all 0.2s ease'
              }}>
                {isChecked && <div style={{ width: '8px', height: '8px', background: 'black', borderRadius: '50%' }} />}
              </div>
              <span className="drone-checklist-item-label" style={{
                fontSize: '0.85rem', 
                fontWeight: 600, 
                color: isChecked ? '#fff' : 'var(--text-secondary)',
                transition: 'color 0.2s ease'
              }}>
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="container drone-checklist-container" style={{ maxWidth: '900px', marginTop: '1rem', paddingBottom: '5rem' }}>
      <button onClick={onBack} className="btn-3d drone-checklist-back" style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        color: 'var(--text-secondary)',
        marginBottom: '2rem',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.6rem 1.2rem'
      }}>
        <ArrowLeft size={16} /> Volver
      </button>

      <div className="glass drone-checklist-card" style={{ padding: '2rem', borderRadius: '16px', marginBottom: '2rem' }}>
        <h2 className="drone-checklist-title" style={{
          fontSize: '1.8rem', 
          fontWeight: 900, 
          margin: '0 0 0.5rem 0',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: 'var(--primary)'
        }}>
          {editData ? 'Editar Inspección de Dron' : 'Checklist Pre-Vuelo Dron'}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 2rem 0' }}>
          Realiza la revisión sistémica de la unidad antes del despegue. El flujo es secuencial y requiere el enlace de radio activo para avanzar.
        </p>

        {/* Datos Básicos */}
        <div className="drone-checklist-basic-data" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
          <SearchableSelect
            label="Piloto a cargo *"
            options={lists.pilots}
            value={pilot}
            onChange={setPilot}
            placeholder="Seleccionar piloto..."
            required
          />

          <SearchableSelect
            label="Dron a utilizar *"
            options={lists.drones}
            value={droneId}
            onChange={setDroneId}
            placeholder="Seleccionar dron..."
            required
          />
        </div>

        {/* Indicador de pasos */}
        <div className="drone-checklist-steps" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '1rem' }}>
          {[
            { step: 1, label: '1. Física', active: isFase1Complete },
            { step: 2, label: '2. Enlace', active: isFase2Complete },
            { step: 3, label: '3. Sistema', active: isFase3Complete },
            { step: 4, label: '4. Prueba', active: isFase4Complete }
          ].map(s => (
            <button
              key={s.step}
              className="drone-checklist-step"
              onClick={() => {
                // Permitimos saltar a fase 3 y 4 solo si el control está enlazado (Fase 2 rcDroneLinked marcado)
                if (s.step > 2 && !isSystemLinked) {
                  window.customAlert('No se puede revisar la telemetría/sensores sin establecer el enlace de radio en la Fase 2.');
                  return;
                }
                setActiveStep(s.step);
              }}
              style={{
                background: activeStep === s.step ? 'rgba(240, 196, 25, 0.1)' : 'transparent',
                border: 'none',
                borderBottom: activeStep === s.step ? '2px solid var(--primary)' : '2px solid transparent',
                color: activeStep === s.step ? 'var(--primary)' : (s.active ? 'var(--neon-green)' : 'var(--text-secondary)'),
                padding: '0.5rem 1rem',
                fontWeight: 800,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              {s.active && <Check size={14} style={{ color: 'var(--neon-green)' }} />}
              {s.label}
            </button>
          ))}
        </div>

        {/* Contenido de Pasos */}
        <div style={{ minHeight: '260px' }}>
          {/* Fase 1 */}
          {activeStep === 1 && (
            <div>
              <h4 className="drone-checklist-phase-title" style={{ color: '#fff', fontSize: '1rem', textTransform: 'uppercase', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldAlert size={18} style={{ color: 'var(--neon-orange)' }} /> Fase 1: Inspección Física (Dron Apagado)
              </h4>
              {renderCheckItems([
                { key: 'frameSecured', label: 'Brazos y bastidor asegurados' },
                { key: 'landingGearLocked', label: 'Tren de aterrizaje trabado' },
                { key: 'propellersIntact', label: 'Hélices sin fisuras ni daños' },
                { key: 'motorsFreeSpinning', label: 'Motores giran libremente' },
                { key: 'batterySecured', label: 'Batería insertada y trabada' },
                { key: 'cameraProtectorRemoved', label: 'Protector de Gimbal retirado' },
                { key: 'sdCardInsertedPhysically', label: 'Tarjeta SD colocada físicamente' },
                { key: 'areaSecured', label: 'Zona de despegue y seguridad OK' },
              ])}
            </div>
          )}

          {/* Fase 2 */}
          {activeStep === 2 && (
            <div>
              <h4 className="drone-checklist-phase-title" style={{ color: '#fff', fontSize: '1rem', textTransform: 'uppercase', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Wifi size={18} style={{ color: 'var(--neon-green)' }} /> Fase 2: Puesta en Marcha y Enlace
              </h4>
              {renderCheckItems([
                { key: 'rcAntennasDeployed', label: 'Antenas de Control desplegadas' },
                { key: 'rcSticksCentered', label: 'Sticks centrados y funcionales' },
                { key: 'appStarted', label: 'App de vuelo (DJI Pilot) abierta' },
                { key: 'dronePoweredOn', label: 'Dron encendido (Inicio normal)' },
                { key: 'rcDroneLinked', label: 'Enlace óptimo establecido en pantalla' },
              ])}
            </div>
          )}

          {/* Fase 3 */}
          {activeStep === 3 && (
            <div>
              <h4 className="drone-checklist-phase-title" style={{ color: '#fff', fontSize: '1rem', textTransform: 'uppercase', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Cpu size={18} style={{ color: 'var(--primary)' }} /> Fase 3: Telemetría y Sistemas (Conectado)
              </h4>
              {renderCheckItems([
                { key: 'systemBatteriesChecked', label: 'Carga de Baterías Dron y RC OK' },
                { key: 'imuCompassCalibrated', label: 'Sensores IMU y Brújula normales' },
                { key: 'gpsLockOptimal', label: 'Señal GPS suficiente para Homepoint' },
                { key: 'rthParamsConfigured', label: 'Altura RTH de emergencia seteada' },
                { key: 'obstacleAvoidanceActive', label: 'Sensor anticolisión activado' },
                { key: 'cameraFeedFluid', label: 'Transmisión de Cámara y SD formateada' },
              ])}
            </div>
          )}

          {/* Fase 4 */}
          {activeStep === 4 && (
            <div>
              <h4 className="drone-checklist-phase-title" style={{ color: '#fff', fontSize: '1rem', textTransform: 'uppercase', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Play size={18} style={{ color: 'var(--neon-green)' }} /> Fase 4: Despegue e Hover Test
              </h4>
              {renderCheckItems([
                { key: 'casesClosedAndStored', label: 'Valijas y herramientas guardadas' },
                { key: 'takeoffAreaClear', label: 'Área libre de personas ajenas' },
                { key: 'hoverTestPassed', label: 'Prueba de vuelo estable a 2 metros OK' },
              ])}
            </div>
          )}
        </div>

        {/* Observaciones */}
        <div style={{ marginTop: '2.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
            Observaciones (Justificar cualquier ítem no verificado aquí)
          </label>
          <textarea
            className="drone-checklist-observations"
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            placeholder="Escribe alguna observación o justificación..."
            style={{
              width: '100%',
              minHeight: '100px',
              padding: '0.75rem',
              borderRadius: '8px',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff',
              fontSize: '0.9rem',
              lineHeight: 1.4,
              resize: 'vertical'
            }}
          />
        </div>

        {/* Botón de Guardado */}
        <div className="drone-checklist-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.5rem' }}>
          <button 
            onClick={onBack}
            className="btn-3d" 
            style={{ 
              background: 'transparent', 
              color: 'var(--text-secondary)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '0.75rem 1.5rem'
            }}
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="btn-3d" 
            style={{ 
              background: 'var(--primary)', 
              color: '#000',
              padding: '0.75rem 2rem',
              opacity: isSaving ? 0.6 : 1,
              cursor: isSaving ? 'not-allowed' : 'pointer'
            }}
          >
            {isSaving ? 'GUARDANDO...' : (editData ? 'Actualizar Checklist' : 'Guardar y Registrar')}
          </button>
        </div>
      </div>
      <style>{`
        .drone-checklist-container,
        .drone-checklist-card,
        .drone-checklist-card * {
          min-width: 0;
          box-sizing: border-box;
        }
        .drone-checklist-card.glass {
          padding: 2rem !important;
        }
        .drone-checklist-title {
          font-size: 1.8rem !important;
          overflow-wrap: anywhere;
        }
        .drone-checklist-basic-data,
        .drone-checklist-checks {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }
        .drone-checklist-steps {
          gap: 0.5rem;
        }
        .drone-checklist-step {
          width: 100%;
          min-height: 48px;
          justify-content: center;
          flex-wrap: wrap;
          white-space: normal;
          overflow-wrap: anywhere;
          text-align: center;
        }
        .drone-checklist-item {
          min-width: 0;
        }
        .drone-checklist-item-label,
        .drone-checklist-phase-title {
          min-width: 0;
          white-space: normal;
          overflow-wrap: anywhere;
        }
        .drone-checklist-phase-title {
          flex-wrap: wrap;
        }
        .drone-checklist-observations {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          box-sizing: border-box;
          overflow-x: hidden;
        }
        .drone-checklist-actions {
          flex-wrap: wrap;
        }
        .drone-checklist-actions > .btn-3d,
        .drone-checklist-back.btn-3d {
          width: auto !important;
          min-height: 48px;
        }
        @media (max-width: 600px) {
          .drone-checklist-basic-data,
          .drone-checklist-checks {
            grid-template-columns: minmax(0, 1fr) !important;
          }
          .drone-checklist-steps {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          .drone-checklist-actions {
            flex-direction: column;
          }
          .drone-checklist-actions > .btn-3d {
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
};
