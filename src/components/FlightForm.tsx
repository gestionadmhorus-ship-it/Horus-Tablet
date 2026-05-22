import React, { useState } from 'react';
import { Save, ArrowLeft } from 'lucide-react';
import type { FlightData, ListsData } from '../types';
import { INSPECTION_CATEGORIES } from '../types';
import { generateId } from '../utils/idGenerator';
import { SearchableSelect } from './SearchableSelect';

interface FlightFormProps {
  onSave: (data: FlightData) => void;
  onUpdate?: (data: FlightData) => void;
  onBack: () => void;
  lists: ListsData;
  activeShiftId?: string;
  editData?: FlightData;
  onRegisterNew?: () => void;
  onChangeShift?: () => void;
}

const FlightForm: React.FC<FlightFormProps> = ({ onSave, onUpdate, onBack, lists, activeShiftId, editData, onRegisterNew, onChangeShift }) => {
  const isEditMode = !!editData;
  
  const [formData, setFormData] = useState({
    pilot: editData?.pilot || '',
    lineName: editData?.lineName || '',
    authCode: editData?.authCode || '',
    observations: editData?.observations || '',
    category: editData?.category || 'Otros'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date();
    
    if (isEditMode && editData && onUpdate) {
      onUpdate({
        ...editData,
        ...formData
      });
      await window.customAlert('✅ Vuelo actualizado con éxito');
    } else {
      const newData: FlightData = {
        id: generateId('VUEL'),
        shiftId: activeShiftId,
        timestamp: `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`,
        ...formData
      };
      onSave(newData);
      await window.customAlert('✅ Datos de Vuelo guardados con éxito');
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
          border: '1px solid #00ff88', 
          color: '#00ff88', 
          padding: '0.8rem 1.5rem', 
          borderRadius: '8px', 
          marginBottom: '1.5rem', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          fontWeight: 'bold', 
          boxShadow: '0 0 10px rgba(0,255,136,0.2)' 
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

      <div className="glass" style={{ padding: '3rem', borderTop: '4px solid #00ff88', boxShadow: '0 -5px 20px rgba(0,255,136,0.1)' }}>
        <h2 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '2.5rem', color: 'white', textTransform: 'uppercase', letterSpacing: '2px' }}>{isEditMode ? 'Editar Vuelo' : 'Registro de Vuelos'}</h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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
                background: 'black',
                border: '1px solid rgba(0,255,136,0.3)',
                color: 'white',
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

          <div>
            <label>Observaciones</label>
            <textarea
              rows={4}
              placeholder="Notas adicionales sobre el vuelo..."
              value={formData.observations}
              onChange={e => setFormData({ ...formData, observations: e.target.value })}
            />
          </div>

          <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn-3d" style={{ width: '100%', maxWidth: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '1.2rem' }}>
              <Save size={24} /> <span>{isEditMode ? 'ACTUALIZAR VUELO' : 'GUARDAR VUELO'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FlightForm;
