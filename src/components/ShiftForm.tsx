import React, { useState } from 'react';
import { Save, ArrowLeft } from 'lucide-react';
import type { ShiftData, ListsData } from '../types';
import { generateId } from '../utils/idGenerator';
import { SearchableSelect } from './SearchableSelect';

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
  <div>
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
    coordinator: editData?.coordinator || '',
    assistants: editData?.assistants?.length ? [...editData.assistants] : [''],
    vehicle: editData?.vehicle || '',
    drone: editData?.drone || ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date();
    
    // Filter out any empty assistants
    const finalAssistants = formData.assistants.filter(a => a.trim() !== '');

    if (isEditMode && editData && onUpdate) {
      // Update existing record, keep original ID and timestamp
      onUpdate({
        ...editData,
        coordinator: formData.coordinator,
        assistants: finalAssistants,
        vehicle: formData.vehicle,
        drone: formData.drone
      });
      await window.customAlert('✅ Jornada actualizada con éxito');
    } else {
      const newData: ShiftData = {
        id: generateId('JORN'),
        timestamp: `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`,
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
    <div className="container" style={{ paddingBottom: '4rem' }}>
      <button onClick={onBack} className="btn-3d" style={{ marginBottom: '2.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#000', color: 'var(--primary)', border: '1px solid var(--primary)' }}>
        <ArrowLeft size={20} /> VOLVER AL MENÚ
      </button>

      <div className="glass" style={{ padding: '3rem', borderTop: '4px solid var(--primary)' }}>
        <h2 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '2.5rem', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '2px' }}>{isEditMode ? 'Editar Jornada' : 'Inicio de Jornada'}</h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div>
            <SelectOrEmpty
              label="Coordinador de Cuadrillas"
              options={getAvailableCoordinators()}
              value={formData.coordinator}
              onChange={v => setFormData({ ...formData, coordinator: v })}
              required
            />
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <label style={{ display: 'block', marginBottom: '1rem', color: 'var(--primary)', fontWeight: 'bold' }}>Asistentes</label>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {formData.assistants.map((assistant, index) => (
                <div key={index} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <SelectOrEmpty
                      label={`Asistente ${index + 1}`}
                      options={getAvailableAssistants(index)}
                      value={assistant}
                      onChange={v => handleAssistantChange(index, v)}
                      required={index === 0} // Only first assistant is strictly required, rest are optional but can be removed
                    />
                  </div>
                  <button 
                    type="button" 
                    onClick={() => removeAssistant(index)}
                    style={{ background: 'rgba(255,0,0,0.1)', border: '1px solid #ff4444', color: '#ff4444', padding: '13px', borderRadius: '4px', cursor: 'pointer', height: '48px' }}
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
              style={{ marginTop: '1rem', background: 'transparent', border: '1px dashed var(--primary)', color: 'var(--primary)', padding: '0.75rem 1.5rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              + Agregar otro asistente
            </button>
          </div>

          <div className="grid-cols-2">
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

          <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn-3d" style={{ width: '100%', maxWidth: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '1.2rem' }}>
              <Save size={24} /> <span>{isEditMode ? 'ACTUALIZAR JORNADA' : 'GUARDAR JORNADA'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ShiftForm;
