import React, { useState } from 'react';
import { Save, ArrowLeft } from 'lucide-react';
import type { ShiftData, ListsData } from '../types';
import { generateId } from '../utils/idGenerator';
import { SearchableSelect } from './SearchableSelect';
import { formatTimestamp } from '../utils/dateUtils';

interface ShiftFormProps {
  onSave: (data: ShiftData) => void;
  onUpdate?: (data: ShiftData) => void;
  onBack: () => void;
  lists: ListsData;
  editData?: ShiftData;
}

const SelectOrEmpty: React.FC<{ label: string; options: string[]; value: string; onChange: (v: string) => void; required?: boolean }> = ({
  label, options, value, onChange, required
}) => (
  <div className="shift-form-field">
    {options.length > 0 ? (
      <SearchableSelect
        label={label}
        options={options}
        value={value}
        onChange={onChange}
        required={required}
        placeholder="-- Seleccionar --"
      />
    ) : (
      <>
        <label>{label}</label>
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={`Sin opciones — agrega en ⚙️`}
          required={required}
        />
      </>
    )}
  </div>
);

const ShiftForm: React.FC<ShiftFormProps> = ({ onSave, onUpdate, onBack, lists, editData }) => {
  const isEditMode = !!editData;
  
  const [formData, setFormData] = useState({
    client: editData?.client || '',
    coordinator: editData?.coordinator || '',
    assistants: editData?.assistants?.length ? [...editData.assistants] : [''],
    vehicle: editData?.vehicle || '',
    drone: editData?.drone || ''
  });

  const [expandedSection, setExpandedSection] = useState<string | null>('client');
  const [isSaving, setIsSaving] = useState(false);

  const toggleSection = (section: string) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    
    try {
      if (!isEditMode && !formData.client.trim()) {
        await window.customAlert('Selecciona un Cliente para iniciar una nueva Jornada.');
        return;
      }
      if (isEditMode && editData?.client && !formData.client.trim()) {
        await window.customAlert('Conserva el Cliente actual o selecciona otro Cliente activo.');
        return;
      }
      const now = new Date();
    
    // Filter out any empty assistants
    const finalAssistants = formData.assistants.filter(a => a.trim() !== '');

    if (isEditMode && editData && onUpdate) {
      // Update existing record, keep original ID and timestamp
      onUpdate({
        ...editData,
        client: formData.client.trim() || undefined,
        coordinator: formData.coordinator,
        assistants: finalAssistants,
        vehicle: formData.vehicle,
        drone: formData.drone
      });
      await window.customAlert('✅ Jornada actualizada con éxito');
    } else {
      const newData: ShiftData = {
        id: generateId('JORN'),
        client: formData.client.trim(),
        timestamp: formatTimestamp(now),
        coordinator: formData.coordinator,
        assistants: finalAssistants,
        vehicle: formData.vehicle,
        drone: formData.drone,
        status: 'active'
      };
      onSave(newData);
      await window.customAlert('✅ Datos de Jornada guardados con éxito');
    }
      onBack();
    } finally {
      setIsSaving(false);
    }
  };

  const handleAssistantChange = (index: number, value: string) => {
    const newAssistants = [...formData.assistants];
    newAssistants[index] = value;
    setFormData({ ...formData, assistants: newAssistants });
  };

  const addAssistant = () => {
    setFormData({ ...formData, assistants: [...formData.assistants, ''] });
  };

  const removeAssistant = (index: number) => {
    const newAssistants = formData.assistants.filter((_, i) => i !== index);
    if (newAssistants.length === 0) newAssistants.push(''); // Always keep at least one slot
    setFormData({ ...formData, assistants: newAssistants });
  };

  // ─ Validations (Anti-duplicates) ─
  const getAvailableCoordinators = () => {
    return lists.coordinators.filter(c => !formData.assistants.includes(c));
  };

  const getAvailableAssistants = (currentIndex: number) => {
    return lists.assistants.filter(a => {
      if (a === formData.coordinator) return false;
      // Also filter out if someone else is already using this name
      const isUsedByOther = formData.assistants.some((ast, i) => i !== currentIndex && ast === a);
      return !isUsedByOther;
    });
  };

  return (
    <div className="container shift-form" style={{ paddingBottom: '4rem' }}>
      <button onClick={onBack} className="btn-3d shift-form-back" style={{ marginBottom: '2.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#000', color: 'var(--primary)', border: '1px solid var(--primary)' }}>
        <ArrowLeft size={20} /> VOLVER AL MENÚ
      </button>

      <div className="glass shift-form-panel" style={{ padding: '2rem', borderTop: '4px solid var(--primary)' }}>
        <h2 className="shift-form-title" style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '2rem', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '2px' }}>{isEditMode ? 'Editar Jornada' : 'Inicio de Jornada'}</h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          <div className={`form-accordion-section ${expandedSection === 'client' ? 'active' : ''}`}>
            <button type="button" className="form-accordion-header shift-form-accordion-header" onClick={() => toggleSection('client')}>
              <span className="shift-form-accordion-title">Cliente *</span>
              <span className="shift-form-accordion-indicator">{expandedSection === 'client' ? '▲' : '▼'}</span>
            </button>
            {expandedSection === 'client' && (
              <div className="form-accordion-content">
                <SearchableSelect
                  label="Cliente"
                  options={lists.clients}
                  value={formData.client}
                  onChange={client => setFormData({ ...formData, client })}
                  required={!isEditMode}
                  placeholder={lists.clients.length ? '-- Seleccionar --' : 'Sin clientes activos en Configuración'}
                />
                {isEditMode && !editData?.client && !formData.client && <p style={{ color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}>Sin cliente histórico. Puedes asignar uno de la lista activa.</p>}
              </div>
            )}
          </div>
          <div className={`form-accordion-section ${expandedSection === 'coordinator' ? 'active' : ''}`}>
            <button type="button" className="form-accordion-header shift-form-accordion-header" onClick={() => toggleSection('coordinator')}>
              <span className="shift-form-accordion-title">👤 Coordinador a Cargo</span>
              <span className="shift-form-accordion-indicator">{expandedSection === 'coordinator' ? '▲' : '▼'}</span>
            </button>
            {expandedSection === 'coordinator' && (
              <div className="form-accordion-content">
                <SelectOrEmpty
                  label="Coordinador de Cuadrillas"
                  options={getAvailableCoordinators()}
                  value={formData.coordinator}
                  onChange={v => setFormData({ ...formData, coordinator: v })}
                  required
                />
              </div>
            )}
          </div>

          {/* Section 2: Crew / Assistants */}
          <div className={`form-accordion-section ${expandedSection === 'assistants' ? 'active' : ''}`}>
            <button type="button" className="form-accordion-header shift-form-accordion-header" onClick={() => toggleSection('assistants')}>
              <span className="shift-form-accordion-title">👥 Asistentes de Vuelo</span>
              <span className="shift-form-accordion-indicator">{expandedSection === 'assistants' ? '▲' : '▼'}</span>
            </button>
            {expandedSection === 'assistants' && (
              <div className="form-accordion-content">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {formData.assistants.map((assistant, index) => (
                    <div key={index} className="shift-form-assistant-row">
                      <div className="shift-form-assistant-select">
                        <SelectOrEmpty
                          label={`Asistente ${index + 1}`}
                          options={getAvailableAssistants(index)}
                          value={assistant}
                          onChange={v => handleAssistantChange(index, v)}
                          required={index === 0}
                        />
                      </div>
                      <button 
                        type="button" 
                        onClick={() => removeAssistant(index)}
                        className="shift-form-remove-assistant"
                        style={{ background: 'rgba(255,0,0,0.1)', border: '1px solid #ff4444', color: '#ff4444', padding: '13px', borderRadius: '4px', cursor: 'pointer', minHeight: '48px', flexShrink: 0 }}
                        title="Remover asistente"
                      >
                        X
                      </button>
                    </div>
                  ))}
                </div>

                <button 
                  type="button" 
                  onClick={addAssistant}
                  className="shift-form-add-assistant"
                  style={{ marginTop: '0.5rem', background: 'transparent', border: '1px dashed var(--primary)', color: 'var(--primary)', padding: '0.75rem 1.5rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.5rem', width: 'fit-content', minHeight: '48px' }}
                >
                  + Agregar otro asistente
                </button>
              </div>
            )}
          </div>

          {/* Section 3: Vehicles / Logistics */}
          <div className={`form-accordion-section ${expandedSection === 'logistics' ? 'active' : ''}`}>
            <button type="button" className="form-accordion-header shift-form-accordion-header" onClick={() => toggleSection('logistics')}>
              <span className="shift-form-accordion-title">🚙 Logística y Movilidad</span>
              <span className="shift-form-accordion-indicator">{expandedSection === 'logistics' ? '▲' : '▼'}</span>
            </button>
            {expandedSection === 'logistics' && (
              <div className="form-accordion-content">
                <div className="shift-form-logistics-grid">
                  <SelectOrEmpty
                    label="Vehículo"
                    options={lists.vehicles}
                    value={formData.vehicle}
                    onChange={v => setFormData({ ...formData, vehicle: v })}
                    required
                  />
                  <SelectOrEmpty
                    label="Dron"
                    options={lists.drones}
                    value={formData.drone}
                    onChange={v => setFormData({ ...formData, drone: v })}
                    required
                  />
                </div>
              </div>
            )}
          </div>
          </div>

          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }} className="form-actions-container shift-form-actions">
            <button 
              type="submit" 
              disabled={isSaving}
              className="btn-3d shift-form-submit"
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
              <Save size={24} /> <span>{isSaving ? 'GUARDANDO...' : (isEditMode ? 'ACTUALIZAR JORNADA' : 'GUARDAR JORNADA')}</span>
            </button>
          </div>
        </form>
      </div>
      <style>{`
        .shift-form,
        .shift-form * {
          box-sizing: border-box;
        }
        .shift-form-panel,
        .shift-form-panel form,
        .shift-form-panel .form-accordion-section,
        .shift-form-panel .form-accordion-content,
        .shift-form-field {
          min-width: 0;
          max-width: 100%;
        }
        .shift-form-back {
          min-height: 48px;
          max-width: 100%;
          white-space: normal;
        }
        .shift-form-panel.glass {
          padding: 2rem !important;
        }
        .shift-form-title {
          min-width: 0;
          max-width: 100%;
          font-size: 2rem !important;
          overflow-wrap: anywhere;
        }
        .shift-form-accordion-header {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          max-width: 100%;
        }
        .shift-form-accordion-title {
          flex: 1 1 auto;
          min-width: 0;
          overflow-wrap: anywhere;
        }
        .shift-form-accordion-indicator {
          flex: 0 0 auto;
        }
        .shift-form-assistant-row {
          display: flex;
          gap: 0.75rem;
          align-items: flex-end;
          flex-wrap: nowrap;
          min-width: 0;
          max-width: 100%;
        }
        .shift-form-assistant-select {
          flex: 1 1 auto;
          min-width: 0;
          max-width: 100%;
        }
        .shift-form-remove-assistant {
          flex: 0 0 auto;
          min-width: 0;
        }
        .shift-form-logistics-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1.5rem;
          min-width: 0;
          max-width: 100%;
        }
        .shift-form-logistics-grid > * {
          min-width: 0;
          max-width: 100%;
        }
        .shift-form-submit {
          min-height: 48px;
        }
        @media (min-width: 601px) and (max-width: 899px) {
          .shift-form-assistant-row {
            flex-wrap: wrap;
          }
        }
        @media (max-width: 600px) {
          .shift-form-assistant-row {
            flex-direction: column;
            align-items: stretch;
            flex-wrap: nowrap;
          }
          .shift-form-assistant-select,
          .shift-form-remove-assistant,
          .shift-form-add-assistant,
          .shift-form-submit {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0;
          }
          .shift-form-logistics-grid {
            grid-template-columns: minmax(0, 1fr);
            gap: 1rem;
          }
          .shift-form-actions.form-actions-container {
            justify-content: stretch !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ShiftForm;
