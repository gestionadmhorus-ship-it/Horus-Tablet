import React, { useState, useEffect } from 'react';
import { Save, ArrowLeft, Printer, ShieldCheck } from 'lucide-react';
import type { VehicleChecklistData, ListsData } from '../types';
import { generateId } from '../utils/idGenerator';
import { SearchableSelect } from './SearchableSelect';
import { formatDateDMY, formatTimestamp, getChronologicalTime } from '../utils/dateUtils';

interface VehicleChecklistFormProps {
  onSave: (data: VehicleChecklistData) => void;
  onUpdate?: (data: VehicleChecklistData) => void;
  onBack: () => void;
  lists: ListsData;
  history: VehicleChecklistData[];
  editData?: VehicleChecklistData;
}

const VehicleChecklistForm: React.FC<VehicleChecklistFormProps> = ({ onSave, onUpdate, onBack, lists, history, editData }) => {
  const isEditMode = !!editData;

  const [formData, setFormData] = useState({
    vehicleId: editData?.vehicleId || '',
    driver: editData?.driver || '',
    mileage: editData?.mileage ? String(editData.mileage) : '',
    checks: editData?.checks ? { ...editData.checks } : {
      oil: false,
      brakesFluid: false,
      coolant: false,
      steeringFluid: false,
      washerFluid: false,
      tirePressure: false,
      tireWear: false,
      spareWheel: false,
      handbrake: false,
      lights: false,
      mirrors: false,
      horn: false,
      wipers: false,
      seatbelts: false,
      greenCard: false,
      drivingLicense: false,
      fireExtinguisher: false,
      firstAidKit: false,
    },
    expirations: editData?.expirations ? { ...editData.expirations } : {
      fireExtinguisher: '',
      vtv: '',
      insurance: '',
    },
    observations: editData?.observations || ''
  });

  const [currentTime, setCurrentTime] = useState(new Date());
  const [isSaving, setIsSaving] = useState(false);

  // Update clock every second for accurate timestamp
  useEffect(() => {
    if (isEditMode) return;
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [isEditMode]);

  // Smart Auto-population: When vehicle changes, find its last record (disable in edit mode)
  useEffect(() => {
    if (isEditMode) return;
    if (formData.vehicleId) {
      // Assuming history is ordered chronologically or we can find the most recent
      // Because Dexie might return UUID sorted, we should do a chronological find


      const vehicleHistory = history.filter(h => h.vehicleId === formData.vehicleId);
      const sorted = vehicleHistory.sort((a, b) => getChronologicalTime(a.timestamp) - getChronologicalTime(b.timestamp));
      
      if (sorted.length > 0) {
        const lastRecord = sorted[sorted.length - 1];
        setFormData(prev => ({
          ...prev,
          expirations: {
            fireExtinguisher: lastRecord.expirations.fireExtinguisher || '',
            vtv: lastRecord.expirations.vtv || '',
            insurance: lastRecord.expirations.insurance || ''
          }
        }));
      } else {
        // Reset if no history
        setFormData(prev => ({
          ...prev,
          expirations: { fireExtinguisher: '', vtv: '', insurance: '' }
        }));
      }
    }
  }, [formData.vehicleId, history]);

  const handleCheckToggle = (key: keyof typeof formData.checks) => {
    setFormData(prev => ({
      ...prev,
      checks: {
        ...prev.checks,
        [key]: !prev.checks[key]
      }
    }));
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    
    // Dynamic mapping of keys to human-readable labels from checkGroups
    const checkLabels: Record<string, string> = {};
    checkGroups.forEach(group => {
      group.items.forEach(item => {
        checkLabels[item.key] = item.label;
      });
    });

    // Find all unchecked item keys
    const uncheckedKeys = Object.keys(formData.checks).filter(
      key => !formData.checks[key as keyof typeof formData.checks]
    );

    // If there are unchecked items, require observations
    if (uncheckedKeys.length > 0) {
      const missingLabels = uncheckedKeys.map(key => `• ${checkLabels[key] || key}`).join('\n');
      if (!formData.observations.trim()) {
        await window.customAlert(
          `📋 REGISTRO CON NOVEDADES REQUERIDO\n\n` +
          `Se ha detectado que los siguientes ítems de control de la unidad no se encuentran en estado conforme:\n\n` +
          `${missingLabels}\n\n` +
          `Para proceder con el guardado de la inspección con estas observaciones, es un requerimiento operativo mandatorio justificar el motivo o anomalía en el campo "Observaciones". Por favor, detalle las novedades antes de confirmar.`
        );
        return;
      }
    }

    if (!formData.vehicleId || !formData.driver || !formData.mileage) {
      await window.customAlert('⚠️ Por favor completa Unidad, Kilometraje y Responsable.');
      return;
    }

    let confirmMessage = isEditMode 
      ? `¿Estás seguro de actualizar la inspección para la Unidad ${formData.vehicleId}?` 
      : `¿Estás seguro de registrar la inspección para la Unidad ${formData.vehicleId} con ${formData.mileage} km?`;

    if (uncheckedKeys.length > 0) {
      confirmMessage = isEditMode
        ? `⚠️ UNIDAD CON NOVEDADES\n\n¿Confirmas actualizar la inspección manteniendo los ítems desmarcados?`
        : `⚠️ UNIDAD CON NOVEDADES\n\n¿Confirmas registrar la inspección con novedades en los ítems desmarcados?`;
    }

    const confirmed = await window.customConfirm(confirmMessage);
    if (confirmed) {
      setIsSaving(true);
      try {
        if (isEditMode && editData && onUpdate) {
          const updatedData: VehicleChecklistData = {
          ...editData,
          vehicleId: formData.vehicleId,
          driver: formData.driver,
          mileage: parseInt(formData.mileage, 10),
          checks: formData.checks,
          expirations: formData.expirations,
          observations: formData.observations
        };
        onUpdate(updatedData);
        await window.customAlert('✅ Checklist Vehicular actualizado con éxito');
      } else {
        const newData: VehicleChecklistData = {
          id: generateId('CHK'),
          timestamp: formatTimestamp(currentTime),
          vehicleId: formData.vehicleId,
          driver: formData.driver,
          mileage: parseInt(formData.mileage, 10),
          checks: formData.checks,
          expirations: formData.expirations,
          observations: formData.observations
        };
        onSave(newData);
        await window.customAlert('✅ Checklist Vehicular guardado con éxito');
        }
        onBack();
      } finally {
        setIsSaving(false);
      }
    }
  };

  // Grouped checks for UI
  const checkGroups = [
    {
      title: "Fluidos y Lubricantes",
      items: [
        { key: 'oil', label: 'Aceite de Motor' },
        { key: 'brakesFluid', label: 'Líquido de Frenos' },
        { key: 'coolant', label: 'Líquido Refrigerante' },
        { key: 'steeringFluid', label: 'Líquido de Dirección' },
        { key: 'washerFluid', label: 'Líquido Limpiaparabrisas' },
      ]
    },
    {
      title: "Seguridad y Visibilidad",
      items: [
        { key: 'lights', label: 'Luces (Altas, Bajas, Posición, Giro, Balizas, Reversa, Freno)' },
        { key: 'mirrors', label: 'Espejos Retrovisores (Interno y Externos)' },
        { key: 'horn', label: 'Bocina' },
        { key: 'wipers', label: 'Limpia Parabrisas (Escobillas y Funcionamiento)' },
        { key: 'seatbelts', label: 'Cinturones de Seguridad' },
      ]
    },
    {
      title: "Neumáticos y Frenos",
      items: [
        { key: 'tirePressure', label: 'Presión de Neumáticos' },
        { key: 'tireWear', label: 'Desgaste de Neumáticos' },
        { key: 'spareWheel', label: 'Rueda de Auxilio y Herramientas' },
        { key: 'handbrake', label: 'Freno de Mano' },
      ]
    },
    {
      title: "Documentación y Equipamiento",
      items: [
        { key: 'greenCard', label: 'Cédula Verde / Azul' },
        { key: 'drivingLicense', label: 'Registro de Conducir' },
        { key: 'fireExtinguisher', label: 'Matafuego (Carga y Vigencia)' },
        { key: 'firstAidKit', label: 'Botiquín de Primeros Auxilios' },
      ]
    }
  ];

  return (
    <div className="container checklist-container" style={{ paddingBottom: '4rem' }}>
      
      {/* Non-printable Back Button */}
      <div className="no-print vehicle-checklist-toolbar" style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', justifyContent: 'space-between' }}>
        <button onClick={onBack} className="btn-3d" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#000', color: '#ff6600', border: '1px solid #ff6600' }}>
          <ArrowLeft size={20} /> VOLVER AL MENÚ
        </button>
        <button onClick={handlePrint} className="btn-3d" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(255,102,0,0.1)', color: '#ff6600', border: '1px solid #ff6600' }}>
          <Printer size={20} /> IMPRIMIR PLANILLA
        </button>
      </div>

      <div className="glass print-area vehicle-checklist-card" style={{ padding: '3rem', borderTop: '4px solid #ff6600', boxShadow: '0 -5px 20px rgba(255,102,0,0.1)' }}>
        
        {/* Header Section */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }} className="print-header">
          {/* Print Only Logo */}
          <div className="print-only" style={{ display: 'none', justifyContent: 'center', marginBottom: '0.5rem' }}>
            <img src="/logo_horus_nuevo.png" alt="Horus Logo" style={{ height: '40px' }} />
          </div>
          <h1 className="vehicle-checklist-title" style={{ fontSize: '2.5rem', fontWeight: 900, color: '#ff6600', textTransform: 'uppercase', letterSpacing: '2px', margin: 0 }}>
            CHECKLIST DIARIO DE VEHÍCULOS
          </h1>
          <p className="print-desc vehicle-checklist-contact" style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={18} color="#ff6600" /> gestionadm.horus@gmail.com
          </p>
          <p className="vehicle-checklist-date" style={{ color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 600, marginTop: '1rem' }}>
            {isEditMode ? 'Fecha y hora registrada:' : 'Fecha y hora actual:'} <span style={{ color: '#ff6600', fontWeight: 'bold' }}>{isEditMode && editData ? editData.timestamp : formatTimestamp(currentTime)}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="print-form" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Section 1: General Info */}
          <div className="print-section" style={{ background: 'rgba(255,255,255,0.03)', padding: '2rem', borderRadius: '12px', border: '1px solid rgba(255,102,0,0.2)' }}>
            <h3 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', marginBottom: '0.5rem', fontWeight: 800 }}>Información General de la Unidad</h3>
            <p className="print-desc" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Completa los datos principales del vehículo y el chequeo.</p>
            
            <div className="grid-cols-2 print-grid-3 vehicle-checklist-basic-grid" style={{ gap: '1.5rem' }}>
              <div>
                <label style={{ color: '#ff6600' }}>Fecha del Chequeo *</label>
                <input type="text" value={isEditMode && editData ? editData.timestamp.split(' ')[0] : formatDateDMY(currentTime)} disabled style={{ background: 'rgba(0,0,0,0.5)', color: '#888', cursor: 'not-allowed' }} />
              </div>
              <div>
                <SearchableSelect
                  label="Unidad *"
                  options={lists.vehicles}
                  value={formData.vehicleId}
                  onChange={v => setFormData({...formData, vehicleId: v})}
                  placeholder="Seleccionar unidad"
                  required
                />
              </div>
              <div>
                <label style={{ color: '#ff6600' }}>Kilometraje Actual *</label>
                <input type="number" placeholder="Ej: 154000" value={formData.mileage} onChange={e => setFormData({...formData, mileage: e.target.value})} required style={{ borderColor: 'rgba(255,102,0,0.5)' }} />
              </div>
            </div>
          </div>

          {/* Section 2: Verification Items */}
          <div className="print-section" style={{ background: 'rgba(255,255,255,0.03)', padding: '2rem', borderRadius: '12px', border: '1px solid rgba(255,102,0,0.2)' }}>
            <h3 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', marginBottom: '0.5rem', fontWeight: 800 }}>Ítems de Verificación</h3>
            <p className="print-desc" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '2rem' }}>Toca las casillas para confirmar el estado ÓPTIMO de cada ítem.</p>
            
            <div className="grid-cols-2 print-grid-4 vehicle-checklist-check-groups" style={{ gap: '3rem' }}>
              {checkGroups.map((group) => (
                <div key={group.title}>
                  <h4 style={{ color: '#ff6600', borderBottom: '1px solid rgba(255,102,0,0.3)', paddingBottom: '0.5rem', marginBottom: '1rem', fontSize: '1.1rem' }}>
                    {group.title}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {group.items.map((item) => {
                      const isChecked = formData.checks[item.key as keyof typeof formData.checks];
                      return (
                        <div 
                          key={item.key}
                          onClick={() => handleCheckToggle(item.key as keyof typeof formData.checks)}
                          className="check-item no-print-bg vehicle-checklist-check-item"
                          style={{
                            display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer',
                            padding: '0.8rem 1rem', borderRadius: '8px',
                            background: isChecked ? 'var(--primary-glow)' : 'var(--bg-input)',
                            border: `1px solid ${isChecked ? 'var(--primary)' : 'var(--border-input)'}`,
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <div className="vehicle-checklist-check-control" style={{
                            width: '24px', height: '24px', borderRadius: '50%',
                            border: `2px solid ${isChecked ? 'var(--primary)' : 'var(--text-secondary)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: isChecked ? 'var(--primary)' : 'transparent'
                          }}>
                            {isChecked && <div style={{ width: '10px', height: '10px', background: 'var(--bg-dark)', borderRadius: '50%' }} />}
                          </div>
                          <span className="vehicle-checklist-check-label" style={{ color: 'var(--text-primary)', fontWeight: isChecked ? 600 : 400, fontSize: '0.95rem' }}>
                            {item.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Expirations and Observations */}
          <div className="print-section" style={{ background: 'rgba(255,255,255,0.03)', padding: '2rem', borderRadius: '12px', border: '1px solid rgba(255,102,0,0.2)' }}>
            <h3 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', marginBottom: '1.5rem', fontWeight: 800 }}>Vencimientos y Observaciones</h3>
            
            <div className="grid-cols-2 print-grid-4 vehicle-checklist-expirations-grid" style={{ gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ color: '#ff6600' }}>Vencimiento Matafuego</label>
                <input type="date" value={formData.expirations.fireExtinguisher} onChange={e => setFormData({...formData, expirations: {...formData.expirations, fireExtinguisher: e.target.value}})} style={{ borderColor: 'rgba(255,102,0,0.5)' }} />
              </div>
              <div>
                <label style={{ color: '#ff6600' }}>Vencimiento VTV</label>
                <input type="date" value={formData.expirations.vtv} onChange={e => setFormData({...formData, expirations: {...formData.expirations, vtv: e.target.value}})} style={{ borderColor: 'rgba(255,102,0,0.5)' }} />
              </div>
              <div>
                <label style={{ color: '#ff6600' }}>Vencimiento Seguro</label>
                <input type="date" value={formData.expirations.insurance} onChange={e => setFormData({...formData, expirations: {...formData.expirations, insurance: e.target.value}})} style={{ borderColor: 'rgba(255,102,0,0.5)' }} />
              </div>
              <div>
                <SearchableSelect
                  label="Realizado por *"
                  options={[...lists.pilots, ...lists.assistants]}
                  value={formData.driver}
                  onChange={v => setFormData({...formData, driver: v})}
                  placeholder="Seleccionar responsable"
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ color: '#ff6600' }}>Observaciones</label>
              <textarea 
                className="vehicle-checklist-observations"
                rows={4} 
                placeholder="Añade cualquier observación relevante aquí..."
                value={formData.observations}
                onChange={e => setFormData({...formData, observations: e.target.value})}
                style={{ borderColor: 'rgba(255,102,0,0.5)' }}
              />
            </div>
            
            {/* Print Only Signature Lines */}
            <div className="print-only signature-area" style={{ display: 'none', marginTop: '4rem', justifyContent: 'space-around' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: '250px', borderBottom: '1px solid black', marginBottom: '10px' }}></div>
                <p>Firma del Responsable</p>
                <p><strong>{formData.driver}</strong></p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: '250px', borderBottom: '1px solid black', marginBottom: '10px' }}></div>
                <p>Sello de Recepción / Aprobación</p>
              </div>
            </div>

          </div>

          <div className="no-print vehicle-checklist-final-actions" style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              type="submit" 
              disabled={isSaving}
              className="btn-3d vehicle-checklist-submit"
              style={{ 
                width: '100%', 
                maxWidth: '350px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '0.75rem', 
                padding: '1.2rem', 
                background: '#ff6600', 
                color: 'black',
                opacity: isSaving ? 0.6 : 1,
                cursor: isSaving ? 'not-allowed' : 'pointer'
              }}
            >
              <Save size={24} /> <span>{isSaving ? 'GUARDANDO...' : (isEditMode ? 'ACTUALIZAR CHECKLIST' : 'GUARDAR CHECKLIST')}</span>
            </button>
          </div>
        </form>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media screen {
          .checklist-container,
          .vehicle-checklist-card,
          .vehicle-checklist-card * {
            min-width: 0;
            box-sizing: border-box;
          }
          .vehicle-checklist-card.glass {
            padding: 3rem !important;
          }
          .vehicle-checklist-toolbar {
            flex-wrap: wrap;
          }
          .vehicle-checklist-toolbar > .btn-3d {
            width: auto !important;
            min-height: 48px;
            padding: 1rem 2rem !important;
            justify-content: center;
            white-space: normal;
            overflow-wrap: anywhere;
          }
          .vehicle-checklist-title {
            font-size: 2.5rem !important;
            white-space: normal;
            overflow-wrap: anywhere;
          }
          .vehicle-checklist-card h3 {
            font-size: 1.4rem !important;
          }
          .vehicle-checklist-contact {
            flex-wrap: wrap;
            min-width: 0;
            overflow-wrap: anywhere;
          }
          .vehicle-checklist-date,
          .vehicle-checklist-card h3,
          .vehicle-checklist-card h4,
          .vehicle-checklist-card p,
          .vehicle-checklist-card label {
            white-space: normal;
            overflow-wrap: anywhere;
          }
          .vehicle-checklist-basic-grid,
          .vehicle-checklist-check-groups,
          .vehicle-checklist-expirations-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          .vehicle-checklist-basic-grid > *,
          .vehicle-checklist-check-groups > *,
          .vehicle-checklist-expirations-grid > * {
            min-width: 0;
            max-width: 100%;
          }
          .vehicle-checklist-basic-grid input,
          .vehicle-checklist-basic-grid select,
          .vehicle-checklist-expirations-grid input,
          .vehicle-checklist-expirations-grid select,
          .vehicle-checklist-observations {
            width: 100%;
            max-width: 100%;
            min-width: 0;
            box-sizing: border-box;
          }
          .vehicle-checklist-check-item {
            min-width: 0;
            min-height: 48px;
          }
          .vehicle-checklist-check-control {
            flex-shrink: 0;
          }
          .vehicle-checklist-check-label {
            min-width: 0;
            white-space: normal;
            overflow-wrap: anywhere;
          }
          .vehicle-checklist-observations {
            overflow-x: hidden;
          }
          .vehicle-checklist-final-actions {
            flex-wrap: wrap;
          }
          .vehicle-checklist-submit {
            min-height: 48px;
            padding: 1.2rem !important;
          }
        }
        @media screen and (max-width: 600px) {
          .vehicle-checklist-toolbar {
            flex-direction: column;
          }
          .vehicle-checklist-toolbar > .btn-3d {
            width: 100% !important;
          }
          .vehicle-checklist-basic-grid,
          .vehicle-checklist-check-groups,
          .vehicle-checklist-expirations-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }
          .vehicle-checklist-final-actions,
          .vehicle-checklist-submit {
            width: 100% !important;
            max-width: 100% !important;
          }
        }
        @media print {
          @page {
            margin: 0.5cm;
            size: A4 portrait;
          }
          body {
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
          .checklist-container {
            padding: 0 !important;
          }
          .glass.print-area {
            background: white !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            backdrop-filter: none !important;
          }
          .print-header {
            margin-bottom: 10px !important;
          }
          h1 { font-size: 20px !important; margin-bottom: 5px !important; color: black !important; }
          h3 { font-size: 14px !important; margin-bottom: 5px !important; color: black !important; }
          h4 { font-size: 12px !important; margin-bottom: 2px !important; padding-bottom: 2px !important; color: black !important; border-bottom: 1px solid #CCC !important; }
          p { font-size: 10px !important; margin-bottom: 2px !important; color: #333 !important; }
          label { color: black !important; font-size: 10px !important; font-weight: bold; margin-bottom: 2px !important; display: block; }
          input, select, textarea {
            background: white !important;
            color: black !important;
            border: 1px solid #CCC !important;
            padding: 4px !important;
            font-size: 10px !important;
            margin-bottom: 5px !important;
            border-radius: 4px !important;
          }
          textarea { height: 40px !important; min-height: 40px !important; }
          .check-item {
            background: white !important;
            border: none !important;
            padding: 0 !important;
            margin-bottom: 2px !important;
            gap: 5px !important;
          }
          .check-item span {
            color: black !important;
            font-size: 10px !important;
          }
          .check-item div {
            width: 14px !important;
            height: 14px !important;
            border-color: black !important;
          }
          .print-section {
            padding: 5px !important;
            margin-bottom: 5px !important;
            border: 1px solid #EEE !important;
            border-radius: 0 !important;
          }
          .grid-cols-2 {
            gap: 5px !important;
            margin-bottom: 2px !important;
          }
          .print-area {
            width: 100% !important;
          }
          .print-only {
            display: flex !important;
          }
          .print-form {
            gap: 2px !important;
          }
          .signature-area {
            margin-top: 10px !important;
          }
          .print-desc {
            display: none !important;
          }
          .print-grid-3 {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 5px !important;
          }
          .print-grid-4 {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 5px !important;
          }
          /* Reduce textarea height further */
          textarea { height: 25px !important; min-height: 25px !important; }
        }
      `}} />
    </div>
  );
};

export default VehicleChecklistForm;
