import React, { useRef, useState } from 'react';
import { Save, ArrowLeft } from 'lucide-react';
import type { FlightData, ListsData } from '../types';
import { INSPECTION_CATEGORIES } from '../types';
import { SearchableSelect } from './SearchableSelect';

import { formatTimestamp } from '../utils/dateUtils';

interface FlightFormProps {
  onSave: (data: FlightData) => void | Promise<void>;
  onUpdate?: (data: FlightData) => void | Promise<void>;
  onBack: () => void;
  lists: ListsData;
  activeShiftId?: string;
  editData?: FlightData;
  defaultFlightType?: 'KMS' | 'HS';
  onRegisterNew?: () => void;
  onChangeShift?: () => void;
}

const FlightForm: React.FC<FlightFormProps> = ({ 
  onSave, onUpdate, onBack, lists, activeShiftId, editData, defaultFlightType, onRegisterNew, onChangeShift 
}) => {
  const isEditMode = !!editData;
  const flightType = editData?.flightType || defaultFlightType || 'KMS';
  
  const [formData, setFormData] = useState({
    pilot: editData?.pilot || '',
    lineName: editData?.lineName || '',
    stage: editData?.stage || '',
    authCode: editData?.authCode || '',
    observations: editData?.observations || '',
    category: editData?.category || 'Otros',
    
    // HS specific fields
    taskTypeAndLocation: editData?.taskTypeAndLocation || '',
    details: editData?.details || '',
    requestedBy: editData?.requestedBy || ''
  });

  const [expandedSection, setExpandedSection] = useState<string | null>('sec1');
  const [isSaving, setIsSaving] = useState(false);
  const saveLockRef = useRef(false);

  const toggleSection = (section: string) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saveLockRef.current) return;
    saveLockRef.current = true;
    setIsSaving(true);
    
    try {
      const now = new Date();
    
    if (isEditMode && editData && onUpdate) {
      await onUpdate({
        ...editData,
        ...formData
      });
      await window.customAlert('✅ Registro actualizado con éxito');
    } else {
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      const prefix = activeShiftId ? activeShiftId : 'SINJORN';
      const flightId = `${prefix}-VUEL-${flightType}-${hh}${min}${ss}`;

      const newData: FlightData = {
        id: flightId,
        shiftId: activeShiftId,
        timestamp: formatTimestamp(now),
        flightType,
        ...formData
      };
      await onSave(newData);
      await window.customAlert('✅ Registro de Vuelo guardado con éxito');
    }
      onBack();
    } finally {
      saveLockRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <div className="container flight-form" style={{ paddingBottom: '4rem' }}>
      <div className="flight-form-header-actions" style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button onClick={onBack} className="btn-3d flight-form-header-action" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#000', color: 'var(--primary)', border: '1px solid var(--primary)', flexShrink: 0 }}>
          <ArrowLeft size={20} /> VOLVER AL MENÚ
        </button>
        {isEditMode && onRegisterNew && (
          <button onClick={onRegisterNew} className="btn-3d flight-form-header-action" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#000', color: '#00ff88', border: '1px solid #00ff88', flexShrink: 0 }}>
            + REGISTRAR NUEVO VUELO
          </button>
        )}
      </div>

      {activeShiftId && (
        <div className="flight-form-active-shift" style={{
          background: 'rgba(0,255,136,0.1)', 
          border: '1.5px solid var(--neon-green)', 
          color: '#00ff88', 
          padding: '0.8rem 1.5rem', 
          borderRadius: '8px', 
          marginBottom: '1.5rem', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          fontWeight: 'bold', 
          boxShadow: 'none' 
        }}>
          <span className="flight-form-active-shift-text">📍 JORNADA ACTIVA: {activeShiftId}</span>
          {onChangeShift && (
            <button 
              type="button" 
              onClick={onChangeShift}
              className="flight-form-change-shift"
              style={{ 
                background: 'rgba(0,255,136,0.2)', 
                border: '1px solid #00ff88', 
                color: '#00ff88', 
                padding: '0.4rem 0.8rem', 
                borderRadius: '4px', 
                cursor: 'pointer', 
                fontSize: '0.8rem',
                fontWeight: 'bold',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,255,136,0.3)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0,255,136,0.2)'}
            >
              ✏️ CAMBIAR JORNADA
            </button>
          )}
        </div>
      )}

      <div className="glass flight-form-panel" style={{ padding: '2rem', borderTop: '4px solid #00ff88', boxShadow: '0 -5px 20px rgba(0,255,136,0.1)' }}>
        <h2 className="flight-form-title" style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '2rem', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '2px' }}>
          {isEditMode ? `Editar Registro ${flightType}` : flightType === 'KMS' ? 'Registro Vuelos KMS' : 'Registro de Vuelos HS.'}
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {flightType === 'KMS' ? (
            <>
              {/* Section 1: Pilot & Category */}
              <div className={`form-accordion-section ${expandedSection === 'sec1' ? 'active' : ''}`}>
                <button type="button" onClick={() => toggleSection('sec1')} className="form-accordion-header flight-form-accordion-header">
                  <span className="flight-form-accordion-title">👤 Personal y Categoría</span>
                  <span className="flight-form-accordion-indicator">{expandedSection === 'sec1' ? '▲' : '▼'}</span>
                </button>
                {expandedSection === 'sec1' && (
                  <div className="form-accordion-content">
                    <div className="flight-form-field">
                      {lists.pilots.length > 0 ? (
                        <SearchableSelect
                          label="Piloto"
                          options={lists.pilots}
                          value={formData.pilot}
                          onChange={v => setFormData({ ...formData, pilot: v })}
                          required
                          placeholder="-- Seleccionar Piloto --"
                        />
                      ) : (
                        <>
                          <label>Piloto</label>
                          <input
                            type="text"
                            value={formData.pilot}
                            onChange={e => setFormData({ ...formData, pilot: e.target.value })}
                            placeholder="Sin opciones — agrega pilotos en ⚙️"
                            required
                          />
                        </>
                      )}
                    </div>
                    <div className="flight-form-field">
                      <label style={{ display: 'block', marginBottom: '6px' }}>Categoría de Inspección</label>
                      <select
                        value={formData.category}
                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                        style={{
                          width: '100%',
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border-input)',
                          color: 'var(--text-primary)',
                          fontSize: '0.95rem',
                          padding: '12px',
                          borderRadius: '10px'
                        }}
                        required
                      >
                        {INSPECTION_CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 2: Line & Auth Code */}
              <div className={`form-accordion-section ${expandedSection === 'sec2' ? 'active' : ''}`}>
                <button type="button" onClick={() => toggleSection('sec2')} className="form-accordion-header flight-form-accordion-header">
                  <span className="flight-form-accordion-title">⚡ Línea y Habilitación</span>
                  <span className="flight-form-accordion-indicator">{expandedSection === 'sec2' ? '▲' : '▼'}</span>
                </button>
                {expandedSection === 'sec2' && (
                  <div className="form-accordion-content">
                    <div className="flight-form-kms-grid">
                      <div className="flight-form-field">
                        <label>Nombre de Línea</label>
                        <input
                          type="text"
                          required
                          maxLength={12}
                          placeholder="Ej: Línea 132kV"
                          value={formData.lineName}
                          onChange={e => setFormData({ ...formData, lineName: e.target.value })}
                        />
                      </div>
                      <div className="flight-form-field">
                        <label>Etapa (Opcional)</label>
                        <input
                          type="text"
                          maxLength={20}
                          placeholder="Ej: Etapa 1"
                          value={formData.stage}
                          onChange={e => setFormData({ ...formData, stage: e.target.value })}
                        />
                      </div>
                      <div className="flight-form-field">
                        <label>Código de Habilitación / Otros</label>
                        <input
                          type="text"
                          required
                          maxLength={12}
                          placeholder="Código auth"
                          value={formData.authCode}
                          onChange={e => setFormData({ ...formData, authCode: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 3: Observations */}
              <div className={`form-accordion-section ${expandedSection === 'sec3' ? 'active' : ''}`}>
                <button type="button" onClick={() => toggleSection('sec3')} className="form-accordion-header flight-form-accordion-header">
                  <span className="flight-form-accordion-title">📝 Observaciones</span>
                  <span className="flight-form-accordion-indicator">{expandedSection === 'sec3' ? '▲' : '▼'}</span>
                </button>
                {expandedSection === 'sec3' && (
                  <div className="form-accordion-content">
                    <div className="flight-form-field flight-form-full-field">
                      <textarea
                        rows={4}
                        placeholder="Notas adicionales sobre el vuelo..."
                        value={formData.observations}
                        onChange={e => setFormData({ ...formData, observations: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Section 1: Solicitor */}
              <div className={`form-accordion-section ${expandedSection === 'sec1' ? 'active' : ''}`}>
                <button type="button" onClick={() => toggleSection('sec1')} className="form-accordion-header flight-form-accordion-header">
                  <span className="flight-form-accordion-title">👤 Solicitante</span>
                  <span className="flight-form-accordion-indicator">{expandedSection === 'sec1' ? '▲' : '▼'}</span>
                </button>
                {expandedSection === 'sec1' && (
                  <div className="form-accordion-content">
                    <div className="flight-form-field flight-form-full-field">
                      <label>Solicitado por</label>
                      <input
                        type="text"
                        required
                        placeholder="Ej: Juan Pérez"
                        value={formData.requestedBy}
                        onChange={e => setFormData({ ...formData, requestedBy: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Section 2: Task Type & Location */}
              <div className={`form-accordion-section ${expandedSection === 'sec2' ? 'active' : ''}`}>
                <button type="button" onClick={() => toggleSection('sec2')} className="form-accordion-header flight-form-accordion-header">
                  <span className="flight-form-accordion-title">📍 Tarea y Ubicación</span>
                  <span className="flight-form-accordion-indicator">{expandedSection === 'sec2' ? '▲' : '▼'}</span>
                </button>
                {expandedSection === 'sec2' && (
                  <div className="form-accordion-content">
                    <div className="flight-form-field flight-form-full-field">
                      <label>Tipo de tarea y Locación</label>
                      <input
                        type="text"
                        required
                        placeholder="Ej: Mantenimiento Preventivo - Celda A"
                        value={formData.taskTypeAndLocation}
                        onChange={e => setFormData({ ...formData, taskTypeAndLocation: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Section 3: Details */}
              <div className={`form-accordion-section ${expandedSection === 'sec3' ? 'active' : ''}`}>
                <button type="button" onClick={() => toggleSection('sec3')} className="form-accordion-header flight-form-accordion-header">
                  <span className="flight-form-accordion-title">📋 Detalles y Notas</span>
                  <span className="flight-form-accordion-indicator">{expandedSection === 'sec3' ? '▲' : '▼'}</span>
                </button>
                {expandedSection === 'sec3' && (
                  <div className="form-accordion-content">
                    <div className="flight-form-field flight-form-full-field">
                      <label>Detalles</label>
                      <textarea
                        rows={4}
                        required
                        placeholder="Detalles sobre las tareas realizadas..."
                        value={formData.details}
                        onChange={e => setFormData({ ...formData, details: e.target.value })}
                      />
                    </div>
                    <div className="flight-form-field flight-form-full-field">
                      <label>Observaciones de Cierre (Opcional)</label>
                      <textarea
                        rows={3}
                        placeholder="Notas de cierre adicionales..."
                        value={formData.observations}
                        onChange={e => setFormData({ ...formData, observations: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }} className="form-actions-container flight-form-actions">
            <button 
              type="submit" 
              disabled={isSaving}
              className="btn-3d flight-form-submit"
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
              <Save size={24} /> <span>{isSaving ? 'GUARDANDO...' : (isEditMode ? 'ACTUALIZAR REGISTRO' : 'GUARDAR REGISTRO')}</span>
            </button>
          </div>
        </form>
      </div>
      <style>{`
        .flight-form,
        .flight-form * {
          box-sizing: border-box;
        }
        .flight-form-header-actions,
        .flight-form-active-shift,
        .flight-form-panel,
        .flight-form-panel form,
        .flight-form-panel .form-accordion-section,
        .flight-form-panel .form-accordion-content,
        .flight-form-field {
          min-width: 0;
          max-width: 100%;
        }
        .flight-form-header-actions {
          align-items: stretch;
        }
        .flight-form-header-action {
          min-width: 0;
          max-width: 100%;
          min-height: 48px;
          white-space: normal;
        }
        .flight-form-active-shift {
          gap: 1rem;
        }
        .flight-form-active-shift-text {
          flex: 1 1 auto;
          min-width: 0;
          max-width: 100%;
          overflow-wrap: anywhere;
        }
        .flight-form-change-shift {
          flex: 0 0 auto;
          min-width: 0;
          max-width: 100%;
          min-height: 48px;
          white-space: normal;
        }
        .flight-form-panel.glass {
          padding: 2rem !important;
        }
        .flight-form-title {
          min-width: 0;
          max-width: 100%;
          font-size: 2rem !important;
          overflow-wrap: anywhere;
        }
        .flight-form-accordion-header {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          max-width: 100%;
        }
        .flight-form-accordion-title {
          flex: 1 1 auto;
          min-width: 0;
          overflow-wrap: anywhere;
        }
        .flight-form-accordion-indicator {
          flex: 0 0 auto;
        }
        .flight-form-field,
        .flight-form-field input,
        .flight-form-field select,
        .flight-form-field textarea {
          width: 100%;
          min-width: 0;
          max-width: 100%;
        }
        .flight-form-full-field {
          box-sizing: border-box;
        }
        .flight-form-kms-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1rem;
          min-width: 0;
          max-width: 100%;
        }
        .flight-form-kms-grid > * {
          min-width: 0;
          max-width: 100%;
        }
        .flight-form-submit {
          min-height: 48px;
        }
        @media (max-width: 1099px) {
          .flight-form-active-shift {
            flex-wrap: wrap;
          }
          .flight-form-kms-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (min-width: 601px) and (max-width: 768px) {
          .flight-form-header-action {
            width: auto !important;
            max-width: 100% !important;
          }
          .flight-form-actions.form-actions-container {
            justify-content: flex-end !important;
          }
          .flight-form-submit {
            max-width: 350px !important;
          }
        }
        @media (max-width: 600px) {
          .flight-form-header-actions,
          .flight-form-active-shift {
            flex-direction: column;
            align-items: stretch !important;
          }
          .flight-form-header-action,
          .flight-form-change-shift,
          .flight-form-submit {
            width: 100% !important;
            max-width: 100% !important;
          }
          .flight-form-kms-grid {
            grid-template-columns: minmax(0, 1fr);
          }
          .flight-form-actions.form-actions-container {
            justify-content: stretch !important;
          }
        }
      `}</style>
    </div>
  );
};

export default FlightForm;

