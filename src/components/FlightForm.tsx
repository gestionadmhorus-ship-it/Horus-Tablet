import React, { useState } from 'react';
import { Save, ArrowLeft } from 'lucide-react';
import type { FlightData, ListsData } from '../types';
import { INSPECTION_CATEGORIES } from '../types';
import { SearchableSelect } from './SearchableSelect';

interface FlightFormProps {
  onSave: (data: FlightData) => void;
  onUpdate?: (data: FlightData) => void;
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
    authCode: editData?.authCode || '',
    observations: editData?.observations || '',
    category: editData?.category || 'Otros',
    
    // HS specific fields
    taskTypeAndLocation: editData?.taskTypeAndLocation || '',
    details: editData?.details || '',
    requestedBy: editData?.requestedBy || ''
  });

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    sec1: true,
    sec2: true,
    sec3: true
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date();
    
    if (isEditMode && editData && onUpdate) {
      onUpdate({
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
        timestamp: `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`,
        flightType,
        ...formData
      };
      onSave(newData);
      await window.customAlert('✅ Registro de Vuelo guardado con éxito');
    }
    onBack();
  };

  return (
    <div className="container" style={{ paddingBottom: '4rem' }}>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button onClick={onBack} className="btn-3d" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#000', color: 'var(--primary)', border: '1px solid var(--primary)', flexShrink: 0 }}>
          <ArrowLeft size={20} /> VOLVER AL MENÚ
        </button>
        {isEditMode && onRegisterNew && (
          <button onClick={onRegisterNew} className="btn-3d" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#000', color: '#00ff88', border: '1px solid #00ff88', flexShrink: 0 }}>
            + REGISTRAR NUEVO VUELO
          </button>
        )}
      </div>

      {activeShiftId && (
        <div style={{ 
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
          <span>📍 JORNADA ACTIVA: {activeShiftId}</span>
          {onChangeShift && (
            <button 
              type="button" 
              onClick={onChangeShift}
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

      <div className="glass" style={{ padding: '2rem', borderTop: '4px solid #00ff88', boxShadow: '0 -5px 20px rgba(0,255,136,0.1)' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '2rem', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '2px' }}>
          {isEditMode ? `Editar Registro ${flightType}` : flightType === 'KMS' ? 'Registro Vuelos KMS' : 'Registro de Vuelos HS.'}
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {flightType === 'KMS' ? (
            <>
              {/* Section 1: Pilot & Category */}
              <div className={`form-accordion-section ${expandedSections.sec1 ? 'active' : ''}`}>
                <button type="button" onClick={() => toggleSection('sec1')} className="form-accordion-header">
                  <span>👤 Personal y Categoría</span>
                  <span>{expandedSections.sec1 ? '▲' : '▼'}</span>
                </button>
                {expandedSections.sec1 && (
                  <div className="form-accordion-content">
                    <div>
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
                    <div>
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
              <div className={`form-accordion-section ${expandedSections.sec2 ? 'active' : ''}`}>
                <button type="button" onClick={() => toggleSection('sec2')} className="form-accordion-header">
                  <span>⚡ Línea y Habilitación</span>
                  <span>{expandedSections.sec2 ? '▲' : '▼'}</span>
                </button>
                {expandedSections.sec2 && (
                  <div className="form-accordion-content">
                    <div className="grid-cols-2">
                      <div>
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
                      <div>
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
              <div className={`form-accordion-section ${expandedSections.sec3 ? 'active' : ''}`}>
                <button type="button" onClick={() => toggleSection('sec3')} className="form-accordion-header">
                  <span>📝 Observaciones</span>
                  <span>{expandedSections.sec3 ? '▲' : '▼'}</span>
                </button>
                {expandedSections.sec3 && (
                  <div className="form-accordion-content">
                    <div>
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
              <div className={`form-accordion-section ${expandedSections.sec1 ? 'active' : ''}`}>
                <button type="button" onClick={() => toggleSection('sec1')} className="form-accordion-header">
                  <span>👤 Solicitante</span>
                  <span>{expandedSections.sec1 ? '▲' : '▼'}</span>
                </button>
                {expandedSections.sec1 && (
                  <div className="form-accordion-content">
                    <div>
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
              <div className={`form-accordion-section ${expandedSections.sec2 ? 'active' : ''}`}>
                <button type="button" onClick={() => toggleSection('sec2')} className="form-accordion-header">
                  <span>📍 Tarea y Ubicación</span>
                  <span>{expandedSections.sec2 ? '▲' : '▼'}</span>
                </button>
                {expandedSections.sec2 && (
                  <div className="form-accordion-content">
                    <div>
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
              <div className={`form-accordion-section ${expandedSections.sec3 ? 'active' : ''}`}>
                <button type="button" onClick={() => toggleSection('sec3')} className="form-accordion-header">
                  <span>📋 Detalles y Notas</span>
                  <span>{expandedSections.sec3 ? '▲' : '▼'}</span>
                </button>
                {expandedSections.sec3 && (
                  <div className="form-accordion-content">
                    <div>
                      <label>Detalles</label>
                      <textarea
                        rows={4}
                        required
                        placeholder="Detalles sobre las tareas realizadas..."
                        value={formData.details}
                        onChange={e => setFormData({ ...formData, details: e.target.value })}
                      />
                    </div>
                    <div>
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

          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }} className="form-actions-container">
            <button type="submit" className="btn-3d" style={{ width: '100%', maxWidth: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '1.2rem' }}>
              <Save size={24} /> <span>{isEditMode ? 'ACTUALIZAR REGISTRO' : 'GUARDAR REGISTRO'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FlightForm;

