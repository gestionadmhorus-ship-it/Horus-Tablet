import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, Search, Calendar, Edit2, Trash2, 
  Download, LayoutDashboard, Plane, Cpu, AlertTriangle, Save, X, ShieldCheck, Printer, Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PrintableChecklistBatch from './PrintableChecklistBatch';
import type { 
  ShiftData, FlightData, BatteryData, DetectionData, AppData, ListsData 
} from '../types';
import { exportToExcel } from '../utils/exportUtils';
import { parseLocalTimestampToDate } from '../utils/dateUtils';

interface RecordsExplorerProps {
  data: AppData;
  lists: ListsData;
  onBack: () => void;
  onUpdateShift: (item: ShiftData) => void;
  onDeleteShift: (id: string) => void;
  onUpdateFlight: (item: FlightData) => void;
  onDeleteFlight: (id: string) => void;
  onUpdateBattery: (item: BatteryData) => void;
  onDeleteBattery: (id: string) => void;
  onUpdateDetection: (item: DetectionData) => void;
  onDeleteDetection: (id: string) => void;
  onUpdateChecklist?: (item: any) => void;
  onDeleteChecklist?: (id: string) => void;
  onViewChecklist?: (item: any) => void;
  onSyncReceived?: (incomingData: AppData) => Promise<void>;
  isServer?: boolean;
  onAddNew?: (action: string) => void;
  onAddChildRecord?: (table: string, parentData: any) => void;
}

type RecordType = 'shifts' | 'flights' | 'batteries' | 'detections' | 'checklists';

const RecordsExplorer: React.FC<RecordsExplorerProps> = (props) => {
  const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [activeTable, setActiveTable] = useState<RecordType>('flights');
  const [checklistSubtype, setChecklistSubtype] = useState<'vehicle' | 'drone'>('vehicle');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('all');
  const [dateMode, setDateMode] = useState<'specific' | 'range'>('specific');
  const [specificDate, setSpecificDate] = useState(getTodayDateString());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [editingRecord, setEditingRecord] = useState<{ type: RecordType, data: any } | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);


  // Helper maps for related entities lookup
  const flightMap = useMemo(() => new Map(props.data.flights.map(f => [f.id, f])), [props.data.flights]);
  const shiftMap = useMemo(() => new Map(props.data.shifts.map(s => [s.id, s])), [props.data.shifts]);

  const handleTableChange = (tabId: RecordType) => {
    setActiveTable(tabId);
    setSearchField('all');
    setSearchTerm('');
    setDateMode('specific');
    setSpecificDate(getTodayDateString());
    setStartDate('');
    setEndDate('');
  };

  const getSearchFieldOptions = () => {
    switch (activeTable) {
      case 'shifts':
        return [
          { value: 'all', label: 'Todos los campos' },
          { value: 'coordinator', label: 'Coordinador' },
          { value: 'vehicle', label: 'Vehículo' },
          { value: 'drone', label: 'Dron' },
          { value: 'assistants', label: 'Asistentes' },
          { value: 'deviceName', label: 'Dispositivo Origen' }
        ];
      case 'flights':
        return [
          { value: 'all', label: 'Todos los campos' },
          { value: 'flightType', label: 'Tipo (KMS/HS)' },
          { value: 'pilot', label: 'Piloto' },
          { value: 'lineName', label: 'Línea' },
          { value: 'authCode', label: 'Código Auth' },
          { value: 'coordinator', label: 'Coordinador' },
          { value: 'vehicle', label: 'Vehículo' },
          { value: 'drone', label: 'Dron' },
          { value: 'deviceName', label: 'Dispositivo Origen' }
        ];
      case 'batteries':
        return [
          { value: 'all', label: 'Todos los campos' },
          { value: 'pilot', label: 'Piloto' },
          { value: 'lineName', label: 'Línea' },
          { value: 'droneBattery', label: 'Batería Dron' },
          { value: 'controlBattery', label: 'Batería RC' },
          { value: 'coordinator', label: 'Coordinador' },
          { value: 'vehicle', label: 'Vehículo' },
          { value: 'drone', label: 'Dron' },
          { value: 'deviceName', label: 'Dispositivo Origen' }
        ];
      case 'detections':
        return [
          { value: 'all', label: 'Todos los campos' },
          { value: 'element', label: 'Elemento' },
          { value: 'anomaly', label: 'Anomalía' },
          { value: 'criticality', label: 'Criticidad' },
          { value: 'lineName', label: 'Línea' },
          { value: 'pilot', label: 'Piloto' },
          { value: 'fileName', label: 'Nombre de Archivo' },
          { value: 'observations', label: 'Observaciones' },
          { value: 'coordinator', label: 'Coordinador' },
          { value: 'vehicle', label: 'Vehículo' },
          { value: 'drone', label: 'Dron' },
          { value: 'deviceName', label: 'Dispositivo Origen' }
        ];
      case 'checklists':
        if (checklistSubtype === 'drone') {
          return [
            { value: 'all', label: 'Todos los campos' },
            { value: 'droneId', label: 'Dron' },
            { value: 'pilot', label: 'Piloto' },
            { value: 'observations', label: 'Observaciones' },
            { value: 'deviceName', label: 'Dispositivo Origen' }
          ];
        }
        return [
          { value: 'all', label: 'Todos los campos' },
          { value: 'vehicleId', label: 'Unidad' },
          { value: 'driver', label: 'Responsable' },
          { value: 'observations', label: 'Observaciones' },
          { value: 'deviceName', label: 'Dispositivo Origen' }
        ];
      default:
        return [{ value: 'all', label: 'Todos los campos' }];
    }
  };

  // Filter Logic
  const filteredData = useMemo(() => {
    const isFilterActive = dateMode === 'specific' ? !!specificDate : (!!startDate && !!endDate);
    if (!isFilterActive) return [];

    let list: any[] = [];
    if (activeTable === 'checklists') {
      list = checklistSubtype === 'drone' 
        ? (props.data.droneChecklists || []) 
        : (props.data.checklists || []);
    } else {
      list = props.data[activeTable] as any[];
    }
    
    const specDateObj = specificDate ? new Date(specificDate + 'T00:00:00') : null;
    const start = startDate ? new Date(startDate + 'T00:00:00') : null;
    const end = endDate ? new Date(endDate + 'T23:59:59') : null;

    return list.filter(item => {
      // 1. Date Filter
      const itemDate = parseLocalTimestampToDate(item.timestamp);
      if (!itemDate) return false;

      if (dateMode === 'specific') {
        if (!specDateObj) return false;
        const sameYear = itemDate.getFullYear() === specDateObj.getFullYear();
        const sameMonth = itemDate.getMonth() === specDateObj.getMonth();
        const sameDay = itemDate.getDate() === specDateObj.getDate();
        if (!sameYear || !sameMonth || !sameDay) return false;
      } else {
        if (!start || !end) return false;
        if (itemDate < start || itemDate > end) return false;
      }

      // 2. Search Term Filter
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();

      // Retrieve related records if any
      let flight: FlightData | undefined;
      let shift: ShiftData | undefined;

      if (activeTable === 'flights') {
        shift = shiftMap.get(item.shiftId || '');
      } else if (activeTable === 'batteries') {
        flight = flightMap.get(item.flightId || '');
        if (flight) shift = shiftMap.get(flight.shiftId || '');
      } else if (activeTable === 'detections') {
        flight = flightMap.get(item.flightId || '');
        if (flight) shift = shiftMap.get(flight.shiftId || '');
      }

      // Specific field search logic
      if (searchField === 'all') {
        const ownValues = Object.values(item).map(v => typeof v === 'object' ? '' : String(v)).join(' ').toLowerCase();
        const relatedValues = [
          flight?.pilot,
          flight?.lineName,
          shift?.coordinator,
          shift?.vehicle,
          shift?.drone,
          shift?.assistants?.join(' '),
          shift?.assistant
        ].filter(Boolean).join(' ').toLowerCase();

        return ownValues.includes(term) || relatedValues.includes(term);
      }

      if (searchField === 'coordinator') return (shift?.coordinator || '').toLowerCase().includes(term);
      if (searchField === 'vehicle') return (shift?.vehicle || '').toLowerCase().includes(term);
      if (searchField === 'drone') return (shift?.drone || '').toLowerCase().includes(term);
      if (searchField === 'assistants') {
        const assistList = shift?.assistants || (shift?.assistant ? [shift.assistant] : []);
        return assistList.join(' ').toLowerCase().includes(term);
      }
      if (searchField === 'flightType') {
        const type = activeTable === 'flights' ? (item.flightType || 'KMS') : '';
        return type.toLowerCase().includes(term);
      }
      if (searchField === 'pilot') return (flight?.pilot || item.pilot || '').toLowerCase().includes(term);
      if (searchField === 'lineName') return (flight?.lineName || item.lineName || '').toLowerCase().includes(term);
      if (searchField === 'authCode') return (item.authCode || '').toLowerCase().includes(term);
      if (searchField === 'observations') return (item.observations || '').toLowerCase().includes(term);
      if (searchField === 'element') return (item.element || '').toLowerCase().includes(term);
      if (searchField === 'anomaly') return (item.anomaly || '').toLowerCase().includes(term);
      if (searchField === 'criticality') return (item.criticality || '').toLowerCase().includes(term);
      if (searchField === 'fileName') return (item.fileName || '').toLowerCase().includes(term);
      if (searchField === 'droneBattery') return String(item.droneBattery || '').includes(term);
      if (searchField === 'controlBattery') return String(item.controlBattery || '').includes(term);
      if (searchField === 'vehicleId') return (item.vehicleId || '').toLowerCase().includes(term);
      if (searchField === 'droneId') return (item.droneId || '').toLowerCase().includes(term);
      if (searchField === 'driver') return (item.driver || '').toLowerCase().includes(term);
      if (searchField === 'deviceName') return (item.deviceName || '').toLowerCase().includes(term);

      return false;
    }).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [props.data, activeTable, checklistSubtype, searchTerm, searchField, dateMode, specificDate, startDate, endDate, flightMap, shiftMap]);

  const handleExportFiltered = () => {
    exportToExcel(props.data, {
      dateMode,
      specificDate,
      startDate,
      endDate
    });
  };

  const handleDelete = async (id: string) => {
    const ok1 = await window.customConfirm('¿Estás seguro de eliminar este registro? (Paso 1 de 2)');
    if (!ok1) return;
    const ok2 = await window.customConfirm('⚠️ ATENCIÓN: Esta acción es irreversible y borrará los datos permanentemente. ¿Realmente deseas eliminar el registro? (Paso 2 de 2)');
    if (!ok2) return;
    if (activeTable === 'shifts') props.onDeleteShift(id);
    if (activeTable === 'flights') props.onDeleteFlight(id);
    if (activeTable === 'batteries') props.onDeleteBattery(id);
    if (activeTable === 'detections') props.onDeleteDetection(id);
    if (activeTable === 'checklists' && props.onDeleteChecklist) props.onDeleteChecklist(id);
  };

  const handleSaveEdit = (updatedData: any) => {
    if (activeTable === 'shifts') props.onUpdateShift(updatedData);
    if (activeTable === 'flights') props.onUpdateFlight(updatedData);
    if (activeTable === 'batteries') props.onUpdateBattery(updatedData);
    if (activeTable === 'detections') props.onUpdateDetection(updatedData);
    if (activeTable === 'checklists' && props.onUpdateChecklist) props.onUpdateChecklist(updatedData);
    setEditingRecord(null);
  };

  const isFilterActive = dateMode === 'specific' ? !!specificDate : (!!startDate && !!endDate);

  return (
    <div className="container" style={{ maxWidth: '1300px', paddingBottom: '5rem' }}>
      {/* Hide UI when printing bulk checklists */}
      <div className="records-explorer-ui">
      {/* Header Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3rem', borderBottom: '2px solid rgba(255,255,255,0.1)', paddingBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={props.onBack} className="btn-3d" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#000', color: 'var(--primary)', border: '1px solid var(--primary)', padding: '1rem 2rem' }}>
            <ArrowLeft size={20} /> VOLVER AL MENÚ
          </button>
        </div>
        <div style={{ textAlign: 'right' }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)', textTransform: 'uppercase' }}>Historial Técnico</h2>
          <p style={{ color: 'var(--primary)', fontWeight: 900, margin: 0, letterSpacing: '4px', background: '#000', display: 'inline-block', padding: '2px 10px', fontSize: '0.8rem', border: '1px solid var(--primary)' }}>HORUS DRON</p>
        </div>
      </div>

      {/* Table Selector Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
        {[
          { id: 'shifts', label: 'Jornadas', icon: LayoutDashboard },
          { id: 'flights', label: 'Vuelos', icon: Plane },
          { id: 'batteries', label: 'Baterías', icon: Cpu },
          { id: 'detections', label: 'Detecciones', icon: AlertTriangle },
          { id: 'checklists', label: 'Checklist Diario', icon: ShieldCheck },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTableChange(tab.id as RecordType)}
            style={{
              flex: 1, minWidth: '180px', padding: '1.2rem', borderRadius: '8px', border: '2px solid',
              borderColor: activeTable === tab.id ? 'var(--primary)' : 'var(--border-input)',
              background: activeTable === tab.id ? 'var(--primary)' : 'var(--bg-input)',
              color: activeTable === tab.id ? 'var(--bg-dark)' : 'var(--text-secondary)',
              cursor: 'pointer', transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', fontWeight: 900,
              textTransform: 'uppercase', letterSpacing: '1px',
              boxShadow: activeTable === tab.id ? 'var(--shadow-glow)' : 'none'
            }}
          >
            <tab.icon size={20} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Subtype selector for checklists */}
      {activeTable === 'checklists' && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2.5rem', justifyContent: 'center' }}>
          <button
            onClick={() => { setChecklistSubtype('vehicle'); setSearchField('all'); setSearchTerm(''); }}
            className="btn-3d"
            style={{
              padding: '0.8rem 1.5rem',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: checklistSubtype === 'vehicle' ? 'var(--neon-orange)' : 'var(--border-input)',
              background: checklistSubtype === 'vehicle' ? 'rgba(251, 146, 60, 0.08)' : 'var(--bg-input)',
              color: checklistSubtype === 'vehicle' ? 'var(--neon-orange)' : 'var(--text-secondary)',
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: 'pointer',
              boxShadow: checklistSubtype === 'vehicle' ? '0 0 15px rgba(251, 146, 60, 0.15)' : 'none'
            }}
          >
            🚜 CHECKLIST VEHICULAR
          </button>
          <button
            onClick={() => { setChecklistSubtype('drone'); setSearchField('all'); setSearchTerm(''); }}
            className="btn-3d"
            style={{
              padding: '0.8rem 1.5rem',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: checklistSubtype === 'drone' ? 'var(--neon-green)' : 'var(--border-input)',
              background: checklistSubtype === 'drone' ? 'rgba(52, 211, 153, 0.08)' : 'var(--bg-input)',
              color: checklistSubtype === 'drone' ? 'var(--neon-green)' : 'var(--text-secondary)',
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: 'pointer',
              boxShadow: checklistSubtype === 'drone' ? '0 0 15px rgba(52, 211, 153, 0.15)' : 'none'
            }}
          >
            🚁 CHECKLIST DE DRON
          </button>
        </div>
      )}

      {/* Mobile Filters Toggle Button */}
      <div className="mobile-only-filters-btn" style={{ marginBottom: '1rem', display: 'none' }}>
        <button 
          type="button" 
          onClick={() => setShowMobileFilters(!showMobileFilters)} 
          className="btn-3d" 
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'var(--bg-input)', border: '1px solid var(--primary)', color: 'var(--primary)', padding: '1rem' }}
        >
          <Filter size={18} /> {showMobileFilters ? 'OCULTAR FILTROS Y BÚSQUEDA' : 'MOSTRAR FILTROS Y BÚSQUEDA'}
        </button>
      </div>

      {/* Filters Bar */}
      <div className={`glass filters-bar-desktop ${showMobileFilters ? 'show-mobile' : ''}`} style={{ 
        padding: '2rem', 
        marginBottom: '2.5rem', 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: '1.5rem', 
        alignItems: 'end', 
        background: 'var(--card-bg)', 
        border: '1px solid var(--glass-border)',
        borderRadius: '16px',
        boxShadow: 'var(--shadow-glow)'
      }}>
        <div style={{ flex: '2 1 300px' }}>
          <label>Buscador Específico</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select
              value={searchField}
              onChange={e => setSearchField(e.target.value)}
              style={{
                width: '170px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-input)',
                color: 'var(--text-primary)',
                padding: '0.8rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              {getSearchFieldOptions().map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)' }} />
              <input 
                type="text" 
                placeholder="Escribe para buscar..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '45px' }}
              />
            </div>
          </div>
        </div>

        {/* Date Mode Toggle */}
        <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label>Filtro de Fecha</label>
          <div style={{ display: 'flex', background: 'var(--bg-input)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-input)' }}>
            <button
              onClick={() => setDateMode('specific')}
              style={{
                flex: 1,
                padding: '0.8rem',
                borderRadius: '6px',
                border: 'none',
                background: dateMode === 'specific' ? 'var(--primary)' : 'transparent',
                color: dateMode === 'specific' ? 'var(--bg-dark)' : 'var(--text-secondary)',
                fontWeight: 900,
                fontSize: '0.78rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                textTransform: 'uppercase'
              }}
            >
              Día Específico
            </button>
            <button
              onClick={() => setDateMode('range')}
              style={{
                flex: 1,
                padding: '0.8rem',
                borderRadius: '6px',
                border: 'none',
                background: dateMode === 'range' ? 'var(--primary)' : 'transparent',
                color: dateMode === 'range' ? 'var(--bg-dark)' : 'var(--text-secondary)',
                fontWeight: 900,
                fontSize: '0.78rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                textTransform: 'uppercase'
              }}
            >
              Rango
            </button>
          </div>
        </div>

        {/* Specific Date Input */}
        {dateMode === 'specific' && (
          <div style={{ flex: '1 1 200px' }}>
            <label>Fecha Seleccionada</label>
            <div style={{ position: 'relative' }}>
              <Calendar size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)', pointerEvents: 'none' }} />
              <input 
                type="date" 
                value={specificDate}
                onChange={e => setSpecificDate(e.target.value)}
                style={{ 
                  paddingLeft: '45px',
                  color: 'var(--text-primary)',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-input)',
                  cursor: 'pointer'
                }}
              />
            </div>
          </div>
        )}

        {/* Range Date Inputs */}
        {dateMode === 'range' && (
          <>
            <div style={{ flex: '1 1 180px' }}>
              <label>Fecha Desde</label>
              <div style={{ position: 'relative' }}>
                <Calendar size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)', pointerEvents: 'none' }} />
                <input 
                  type="date" 
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  style={{ 
                    paddingLeft: '45px',
                    color: 'var(--text-primary)',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-input)',
                    cursor: 'pointer'
                  }}
                />
              </div>
            </div>
            <div style={{ flex: '1 1 180px' }}>
              <label>Fecha Hasta</label>
              <div style={{ position: 'relative' }}>
                <Calendar size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)', pointerEvents: 'none' }} />
                <input 
                  type="date" 
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  style={{ 
                    paddingLeft: '45px',
                    color: 'var(--text-primary)',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-input)',
                    cursor: 'pointer'
                  }}
                />
              </div>
            </div>
          </>
        )}

        {/* Action Button */}
        <div style={{ flex: '0 0 160px', display: 'flex', gap: '0.5rem', flexDirection: 'column', justifyContent: 'flex-end' }}>
          {activeTable === 'checklists' && (
            <button onClick={() => window.print()} className="btn-3d" style={{ width: '100%', height: '58px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: '#ff6600', color: 'black', border: '1px solid #ff6600' }}>
              <Printer size={18} /> IMPRIMIR LOTES
            </button>
          )}
          {activeTable !== 'checklists' && (
            <button 
              onClick={handleExportFiltered} 
              disabled={filteredData.length === 0}
              className="btn-3d" 
              style={{ 
                width: '100%', 
                height: '40px', 
                padding: 0, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '0.75rem',
                opacity: filteredData.length === 0 ? 0.5 : 1,
                cursor: filteredData.length === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              <Download size={16} /> EXPORTAR
            </button>
          )}
          
          <button 
            onClick={async () => {
              if (!props.onAddNew) return;
              if (activeTable === 'shifts') {
                props.onAddNew('shifts');
              } else if (activeTable === 'flights') {
                const rawType = await window.customChoice('Selecciona el tipo de vuelo', ['KMS', 'HS']);
                if (rawType === null) return; // cancelled
                const type = rawType.trim() || 'KMS';
                if (type.toUpperCase() === 'KMS' || type.toUpperCase() === 'HS') {
                  props.onAddNew(`flights_${type.toUpperCase()}`);
                } else {
                  await window.customAlert('Tipo de vuelo inválido. Debe ser KMS o HS.');
                }
              } else if (activeTable === 'batteries' || activeTable === 'detections') {
                props.onAddNew('batteries_detections');
              } else if (activeTable === 'checklists') {
                props.onAddNew('checklists');
              }
            }}
            className="btn-3d" 
            style={{ 
              width: '100%', 
              height: '40px', 
              padding: 0, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '0.5rem',
              background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
              border: '1px solid #0ea5e9'
            }}
          >
            <span style={{ fontSize: '1.2rem', fontWeight: 900 }}>+</span> AGREGAR
          </button>
        </div>
      </div>

      {/* Records Table */}
      <div className="glass" style={{ overflow: 'hidden', background: 'var(--card-bg)', border: '1px solid var(--glass-border)' }}>
        <div className="table-responsive-wrapper">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--primary-glow)', borderBottom: '2px solid var(--primary)' }}>
                <th style={{ padding: '1.5rem 1.2rem', color: 'var(--primary)', fontSize: '0.9rem', textTransform: 'uppercase', fontWeight: 900, letterSpacing: '1px' }}>Fecha/Hora</th>
                {activeTable === 'shifts' && <><th style={{ padding: '1.2rem', color: 'var(--text-primary)' }}>Coordinador</th><th style={{ padding: '1.2rem', color: 'var(--text-primary)' }}>Asistentes</th><th style={{ padding: '1.2rem', color: 'var(--text-primary)' }}>Vehículo</th></>}
                {activeTable === 'flights' && <><th style={{ padding: '1.2rem', color: 'var(--text-primary)' }}>Piloto</th><th style={{ padding: '1.2rem', color: 'var(--text-primary)' }}>Línea</th><th style={{ padding: '1.2rem', color: 'var(--text-primary)' }}>Obs.</th></>}
                {activeTable === 'batteries' && <><th style={{ padding: '1.2rem', color: 'var(--text-primary)' }}>Piloto</th><th style={{ padding: '1.2rem', color: 'var(--text-primary)' }}>ID Dron</th><th style={{ padding: '1.2rem', color: 'var(--text-primary)' }}>ID RC</th></>}
                {activeTable === 'detections' && <><th style={{ padding: '1.2rem', color: 'var(--text-primary)' }}>Elemento</th><th style={{ padding: '1.2rem', color: 'var(--text-primary)' }}>Anomalía</th><th style={{ padding: '1.2rem', color: 'var(--text-primary)' }}>Criticidad</th><th style={{ padding: '1.2rem', color: 'var(--text-primary)' }}>Acceso Traza</th></>}
                {activeTable === 'checklists' && (
                  checklistSubtype === 'drone' ? (
                    <>
                      <th style={{ padding: '1.2rem', color: 'var(--text-primary)' }}>Dron</th>
                      <th style={{ padding: '1.2rem', color: 'var(--text-primary)' }}>Piloto</th>
                      <th style={{ padding: '1.2rem', color: 'var(--text-primary)' }}>Estado General</th>
                    </>
                  ) : (
                    <>
                      <th style={{ padding: '1.2rem', color: 'var(--text-primary)' }}>Unidad</th>
                      <th style={{ padding: '1.2rem', color: 'var(--text-primary)' }}>Responsable</th>
                      <th style={{ padding: '1.2rem', color: 'var(--text-primary)' }}>Kilometraje</th>
                    </>
                  )
                )}
                <th style={{ padding: '1.2rem', color: 'var(--text-primary)' }}>Origen</th>
                <th style={{ padding: '1.2rem', textAlign: 'right', color: 'var(--text-primary)' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {!isFilterActive ? (
                <tr>
                  <td colSpan={10} style={{ padding: '5rem 2rem', textAlign: 'center', color: 'var(--primary)', fontWeight: 'bold', background: 'transparent' }}>
                    🔍 Seleccione una fecha o rango de fechas para visualizar los registros.
                  </td>
                </tr>
              ) : (
                <>
                  {filteredData.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-input)', transition: 'background 0.2s ease' }}>
                  <td style={{ padding: '1.2rem', fontSize: '0.95rem', color: 'var(--primary)', fontWeight: 700 }}>
                    {item.timestamp}
                    {item.isEdited && (
                      <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--primary)', marginTop: '4px', fontWeight: 600 }}>
                        ✍️ Editado: {item.editedTimestamp}
                      </span>
                    )}
                  </td>
                  
                  {activeTable === 'shifts' && (
                    <>
                      <td style={{ padding: '1.2rem', color: 'var(--text-primary)' }}>{item.coordinator}</td>
                      <td style={{ padding: '1.2rem', color: 'var(--text-primary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.assistants ? item.assistants.join(', ') : item.assistant}
                      </td>
                      <td style={{ padding: '1.2rem', color: 'var(--text-primary)' }}>{item.vehicle}</td>
                    </>
                  )}
                  {activeTable === 'flights' && (
                    <>
                      <td style={{ padding: '1.2rem', color: 'var(--text-primary)' }}>{item.pilot}</td>
                      <td style={{ padding: '1.2rem', color: 'var(--text-primary)' }}>{item.lineName}</td>
                      <td style={{ padding: '1.2rem', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{item.observations}</td>
                    </>
                  )}
                  {activeTable === 'batteries' && (
                    <>
                      <td style={{ padding: '1.2rem', color: 'var(--text-primary)' }}>{item.pilot}</td>
                      <td style={{ padding: '1.2rem', color: 'var(--neon-cyan)', fontWeight: 800 }}>{item.droneBatteryName || '—'}</td>
                      <td style={{ padding: '1.2rem', color: 'var(--neon-cyan)', fontWeight: 800 }}>{item.controlBatteryName || '—'}</td>
                    </>
                  )}
                  {activeTable === 'detections' && (
                    <>
                      <td style={{ padding: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{item.element}</td>
                      <td style={{ padding: '1.2rem', color: 'var(--text-primary)' }}>{item.anomaly}</td>
                      <td style={{ padding: '1.2rem' }}>
                        {(() => {
                          const cc: Record<string, string> = { 'Muy Baja': 'var(--neon-cyan)', Baja: 'var(--neon-green)', Media: 'var(--primary)', Alta: 'var(--neon-orange)', Urgente: 'var(--neon-red)' };
                          const bg = cc[item.criticality] || 'rgba(255,255,255,0.1)';
                          const fc = item.criticality === 'Urgente' ? 'white' : 'black';
                          return (
                            <span style={{ padding: '4px 12px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 900, background: bg, color: fc, border: `1px solid ${bg}` }}>
                              {item.criticality}
                            </span>
                          );
                        })()}
                      </td>
                      <td style={{ padding: '1.2rem' }}>
                        {(() => {
                          const accColors: Record<string, { color: string; bg: string }> = {
                            'Buena': { color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' },
                            'Regular': { color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' },
                            'Mala': { color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' }
                          };
                          const status = item.accessStatus || 'Buena';
                          const styleInfo = accColors[status] || { color: '#94A3B8', bg: 'rgba(148, 163, 184, 0.15)' };
                          return (
                            <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 800, background: styleInfo.bg, color: styleInfo.color, border: `1px solid ${styleInfo.color}40` }}>
                              {status}
                            </span>
                          );
                        })()}
                      </td>
                    </>
                  )}
                  {activeTable === 'checklists' && (
                    checklistSubtype === 'drone' ? (
                      <>
                        <td style={{ padding: '1.2rem', color: 'var(--text-primary)', fontWeight: 800 }}>{item.droneId}</td>
                        <td style={{ padding: '1.2rem', color: 'var(--text-primary)' }}>{item.pilot}</td>
                        <td style={{ padding: '1.2rem', color: 'var(--neon-green)', fontWeight: 800 }}>✓ COMPLETO</td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: '1.2rem', color: 'var(--text-primary)', fontWeight: 800 }}>{item.vehicleId}</td>
                        <td style={{ padding: '1.2rem', color: 'var(--text-primary)' }}>{item.driver}</td>
                        <td style={{ padding: '1.2rem', color: 'var(--neon-orange)', fontWeight: 800 }}>{item.mileage} km</td>
                      </>
                    )
                  )}

                  <td style={{ padding: '1.2rem', color: '#a0aec0', fontSize: '0.85rem', fontWeight: 600 }}>
                    {item.deviceName ? (
                      <span style={{ color: '#00f2ff', border: '1px solid rgba(0,242,255,0.2)', padding: '2px 8px', borderRadius: '4px', background: 'rgba(0,242,255,0.05)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                        {item.deviceName}
                      </span>
                    ) : (
                      <span style={{ opacity: 0.5 }}>Local</span>
                    )}
                  </td>

                  <td style={{ padding: '1.2rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                      <button 
                        onClick={() => {
                          if (activeTable === 'checklists' && props.onViewChecklist) {
                            props.onViewChecklist(item);
                          } else {
                            setEditingRecord({ type: activeTable, data: item });
                          }
                        }}
                        style={{ 
                          background: activeTable === 'checklists' ? 'rgba(255,102,0,0.1)' : 'rgba(240,196,25,0.1)', 
                          border: activeTable === 'checklists' ? '1px solid #ff6600' : '1px solid var(--primary)', 
                          borderRadius: '4px', 
                          color: activeTable === 'checklists' ? '#ff6600' : 'var(--primary)', 
                          padding: '10px', 
                          cursor: 'pointer' 
                        }}
                        title={activeTable === 'checklists' ? "Ver Planilla Completa / Imprimir" : "Editar"}
                      >
                        <Edit2 size={18} />
                      </button>
                      {props.isServer && (
                        <button 
                          onClick={() => handleDelete(item.id)}
                          style={{ background: 'rgba(255,0,0,0.1)', border: '1px solid #FF0000', borderRadius: '4px', color: '#FF0000', padding: '10px', cursor: 'pointer' }}
                          title="Eliminar"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                  ))}
                  {filteredData.length === 0 && (
                    <tr>
                      <td colSpan={10} style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        No se encontraron registros con los filtros aplicados.
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View */}
        <div className="history-cards-container" style={{ padding: '1rem' }}>
          {!isFilterActive ? (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--primary)', fontWeight: 'bold' }}>
              🔍 Seleccione una fecha o rango de fechas para visualizar los registros.
            </div>
          ) : filteredData.length === 0 ? (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No se encontraron registros con los filtros aplicados.
            </div>
          ) : (
            filteredData.map(item => (
              <div key={item.id} className="history-card" style={{ borderLeft: `4px solid ${
                activeTable === 'detections'
                  ? (() => {
                      const cc: Record<string, string> = { 'Muy Baja': 'var(--neon-cyan)', Baja: 'var(--neon-green)', Media: 'var(--primary)', Alta: 'var(--neon-orange)', Urgente: 'var(--neon-red)' };
                      return cc[item.criticality] || 'var(--primary)';
                    })()
                  : 'var(--primary)'
              }` }}>
                <div className="history-card-header">
                  <div>
                    <div className="history-card-title">
                      {activeTable === 'shifts' && `Jornada: ${item.id.slice(-8)}`}
                      {activeTable === 'flights' && `Vuelo: ${item.flightType || 'KMS'} (${item.lineName || item.taskTypeAndLocation || 'HS'})`}
                      {activeTable === 'batteries' && `Registro Batería`}
                      {activeTable === 'detections' && `Detección: ${item.element}`}
                      {activeTable === 'checklists' && `Checklist ${checklistSubtype === 'drone' ? 'Dron' : 'Vehicular'}`}
                    </div>
                    <div className="history-card-subtitle">
                      {item.timestamp}
                      {item.isEdited && <span style={{ display: 'block', color: 'var(--primary)', fontSize: '0.7rem' }}>✍️ Editado: {item.editedTimestamp}</span>}
                    </div>
                  </div>
                  {item.deviceName && (
                    <span className="history-card-badge" style={{ color: '#00f2ff', border: '1px solid rgba(0,242,255,0.2)', background: 'rgba(0,242,255,0.05)', display: 'inline-block' }}>
                      {item.deviceName}
                    </span>
                  )}
                </div>

                <div className="history-card-body">
                  {activeTable === 'shifts' && (
                    <>
                      <div className="history-card-item">
                        <span className="history-card-label">Coordinador:</span>
                        <span className="history-card-value">{item.coordinator}</span>
                      </div>
                      <div className="history-card-item">
                        <span className="history-card-label">Asistentes:</span>
                        <span className="history-card-value">{item.assistants ? item.assistants.join(', ') : item.assistant}</span>
                      </div>
                      <div className="history-card-item">
                        <span className="history-card-label">Vehículo:</span>
                        <span className="history-card-value">{item.vehicle}</span>
                      </div>
                      <div className="history-card-item">
                        <span className="history-card-label">Dron:</span>
                        <span className="history-card-value">{item.drone}</span>
                      </div>
                    </>
                  )}

                  {activeTable === 'flights' && (
                    <>
                      <div className="history-card-item">
                        <span className="history-card-label">Piloto:</span>
                        <span className="history-card-value">{item.pilot}</span>
                      </div>
                      {item.flightType === 'KMS' ? (
                        <>
                          <div className="history-card-item">
                            <span className="history-card-label">Línea:</span>
                            <span className="history-card-value">{item.lineName}</span>
                          </div>
                          <div className="history-card-item">
                            <span className="history-card-label">Código Habilitación:</span>
                            <span className="history-card-value">{item.authCode}</span>
                          </div>
                          <div className="history-card-item">
                            <span className="history-card-label">Categoría:</span>
                            <span className="history-card-value">{item.category || 'Otros'}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="history-card-item">
                            <span className="history-card-label">Locación/Tarea:</span>
                            <span className="history-card-value">{item.taskTypeAndLocation}</span>
                          </div>
                          <div className="history-card-item">
                            <span className="history-card-label">Solicitado por:</span>
                            <span className="history-card-value">{item.requestedBy}</span>
                          </div>
                          <div className="history-card-item">
                            <span className="history-card-label">Detalles:</span>
                            <span className="history-card-value">{item.details}</span>
                          </div>
                        </>
                      )}
                      <div className="history-card-item">
                        <span className="history-card-label">Observaciones:</span>
                        <span className="history-card-value">{item.observations || 'Sin observaciones'}</span>
                      </div>
                      {item.closedTimestamp && (
                        <div className="history-card-item" style={{ background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '4px', marginTop: '4px' }}>
                          <span className="history-card-label">Cerrado:</span>
                          <span className="history-card-value" style={{ color: 'var(--neon-green)', fontWeight: 'bold' }}>{item.closedTimestamp}</span>
                        </div>
                      )}
                      {item.closingObservations && (
                        <div className="history-card-item">
                          <span className="history-card-label">Obs. Cierre:</span>
                          <span className="history-card-value">{item.closingObservations}</span>
                        </div>
                      )}
                    </>
                  )}

                  {activeTable === 'batteries' && (
                    <>
                      <div className="history-card-item">
                        <span className="history-card-label">Piloto:</span>
                        <span className="history-card-value">{item.pilot}</span>
                      </div>
                      <div className="history-card-item">
                        <span className="history-card-label">Batería Dron:</span>
                        <span className="history-card-value" style={{ color: 'var(--neon-cyan)', fontWeight: 'bold' }}>
                          {item.droneBatteryName || 'Dron'}
                        </span>
                      </div>
                      <div className="history-card-item">
                        <span className="history-card-label">Batería RC:</span>
                        <span className="history-card-value" style={{ color: 'var(--neon-cyan)', fontWeight: 'bold' }}>
                          {item.controlBatteryName || 'RC'}
                        </span>
                      </div>
                    </>
                  )}

                  {activeTable === 'detections' && (
                    <>
                      <div className="history-card-item">
                        <span className="history-card-label">Anomalía:</span>
                        <span className="history-card-value">{item.anomaly}</span>
                      </div>
                      <div className="history-card-item">
                        <span className="history-card-label">Criticidad:</span>
                        <span className="history-card-value" style={{ fontWeight: 'bold' }}>
                          {item.criticality}
                        </span>
                      </div>
                      <div className="history-card-item">
                        <span className="history-card-label">Recomendación:</span>
                        <span className="history-card-value">{item.recommendation}</span>
                      </div>
                      <div className="history-card-item">
                        <span className="history-card-label">Archivo:</span>
                        <span className="history-card-value" style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>{item.fileName}</span>
                      </div>
                    </>
                  )}

                  {activeTable === 'checklists' && (
                    <>
                      {checklistSubtype === 'drone' ? (
                        <>
                          <div className="history-card-item">
                            <span className="history-card-label">Identificador Dron:</span>
                            <span className="history-card-value">{item.droneId}</span>
                          </div>
                          <div className="history-card-item">
                            <span className="history-card-label">Piloto:</span>
                            <span className="history-card-value">{item.pilot}</span>
                          </div>
                          <div className="history-card-item">
                            <span className="history-card-label">Estado:</span>
                            <span className="history-card-value" style={{ color: 'var(--neon-green)', fontWeight: 'bold' }}>✓ COMPLETO</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="history-card-item">
                            <span className="history-card-label">Identificador Vehículo:</span>
                            <span className="history-card-value">{item.vehicleId}</span>
                          </div>
                          <div className="history-card-item">
                            <span className="history-card-label">Responsable:</span>
                            <span className="history-card-value">{item.driver}</span>
                          </div>
                          <div className="history-card-item">
                            <span className="history-card-label">Kilometraje:</span>
                            <span className="history-card-value" style={{ color: 'var(--neon-orange)', fontWeight: 'bold' }}>{item.mileage} km</span>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>

                <div className="history-card-footer">
                  <button 
                    onClick={() => {
                      if (activeTable === 'checklists' && props.onViewChecklist) {
                        props.onViewChecklist(item);
                      } else {
                        setEditingRecord({ type: activeTable, data: item });
                      }
                    }}
                    style={{ 
                      flex: 1,
                      background: activeTable === 'checklists' ? 'rgba(255,102,0,0.1)' : 'rgba(240,196,25,0.1)', 
                      border: activeTable === 'checklists' ? '1px solid #ff6600' : '1px solid var(--primary)', 
                      borderRadius: '8px', 
                      color: activeTable === 'checklists' ? '#ff6600' : 'var(--primary)', 
                      padding: '12px', 
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      fontWeight: 'bold',
                      fontSize: '0.85rem'
                    }}
                  >
                    <Edit2 size={16} /> <span>{activeTable === 'checklists' ? "Ver Planilla" : "Editar"}</span>
                  </button>

                  {/* Botones de Agregar Registros Hijos para histórico */}
                  {activeTable === 'shifts' && props.onAddChildRecord && (
                    <button 
                      onClick={() => props.onAddChildRecord?.('shifts', item)}
                      style={{ 
                        flex: 1,
                        background: 'rgba(0,255,136,0.1)', 
                        border: '1px solid var(--neon-green)', 
                        borderRadius: '8px', 
                        color: 'var(--neon-green)', 
                        padding: '12px', 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        fontWeight: 'bold',
                        fontSize: '0.85rem'
                      }}
                    >
                      <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>+</span> <span>Vuelo</span>
                    </button>
                  )}

                  {activeTable === 'flights' && props.onAddChildRecord && (
                    <button 
                      onClick={() => props.onAddChildRecord?.('flights', item)}
                      style={{ 
                        flex: 1,
                        background: 'rgba(0,255,136,0.1)', 
                        border: '1px solid var(--neon-green)', 
                        borderRadius: '8px', 
                        color: 'var(--neon-green)', 
                        padding: '12px', 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        fontWeight: 'bold',
                        fontSize: '0.85rem'
                      }}
                    >
                      <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>+</span> <span>Datos</span>
                    </button>
                  )}
                  {props.isServer && (
                    <button 
                      onClick={() => handleDelete(item.id)}
                      style={{ 
                        background: 'rgba(255,0,0,0.1)', 
                        border: '1px solid #FF0000', 
                        borderRadius: '8px', 
                        color: '#FF0000', 
                        padding: '12px', 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        fontWeight: 'bold',
                        fontSize: '0.85rem'
                      }}
                    >
                      <Trash2 size={16} /> <span>Eliminar</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingRecord && (
          <EditModal 
            type={editingRecord.type} 
            data={editingRecord.data} 
            lists={props.lists}
            onClose={() => setEditingRecord(null)} 
            onSave={handleSaveEdit}
          />
        )}
      </AnimatePresence>
      </div> {/* end records-explorer-ui */}

      {/* Render the printable batch strictly for checklists, hidden from screen via CSS */}
      {activeTable === 'checklists' && (
        <PrintableChecklistBatch data={filteredData as any} />
      )}


    </div>
  );
};

/* ═══════════════ EDIT MODAL COMPONENT ═══════════════ */
const EditModal: React.FC<{ 
  type: RecordType, data: any, lists: ListsData, onClose: () => void, onSave: (data: any) => void 
}> = ({ type, data, lists, onClose, onSave }) => {
  const [formData, setFormData] = useState({ ...data });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="glass" 
        style={{ width: '100%', maxWidth: '600px', padding: '2rem', position: 'relative', border: '1px solid var(--glass-border)' }}
      >
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>
          <X size={24} />
        </button>

        <h3 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Edit2 size={20} color="var(--primary)" /> Editar Registro
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div>
            <label>Fecha y Hora de Creación (No editable)</label>
            <input 
              type="text" 
              value={formData.timestamp} 
              disabled 
              style={{ opacity: 0.6, cursor: 'not-allowed', background: 'rgba(255,255,255,0.03)', color: '#888' }} 
            />
          </div>

          {type === 'shifts' && (
            <>
              <div className="grid-cols-2">
                <div>
                  <label>Coordinador</label>
                  <select value={formData.coordinator} onChange={e => setFormData({ ...formData, coordinator: e.target.value })}>
                    <option value="">-- Seleccionar --</option>
                    {lists.coordinators.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label>Vehículo</label>
                  <select value={formData.vehicle} onChange={e => setFormData({ ...formData, vehicle: e.target.value })}>
                    <option value="">-- Seleccionar --</option>
                    {lists.vehicles.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label>Asistentes (separados por coma)</label>
                <input 
                  type="text" 
                  value={formData.assistants ? formData.assistants.join(', ') : formData.assistant || ''} 
                  onChange={e => setFormData({ ...formData, assistants: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} 
                  placeholder="Juan, Pedro, Maria"
                />
              </div>
            </>
          )}

          {type === 'flights' && (
            <>
              <div className="grid-cols-2">
                <div>
                  <label>Piloto</label>
                  <select value={formData.pilot} onChange={e => setFormData({ ...formData, pilot: e.target.value })}>
                    {lists.pilots.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label>Nombre de Línea</label>
                  <input type="text" maxLength={12} value={formData.lineName} onChange={e => setFormData({ ...formData, lineName: e.target.value })} />
                </div>
              </div>
              <div>
                <label>Código de Habilitación</label>
                <input type="text" maxLength={12} value={formData.authCode || ''} onChange={e => setFormData({ ...formData, authCode: e.target.value })} />
              </div>
              <div>
                <label>Observaciones</label>
                <textarea value={formData.observations} onChange={e => setFormData({ ...formData, observations: e.target.value })} rows={3} />
              </div>
            </>
          )}

          {type === 'batteries' && (
            <>
              <div className="grid-cols-2">
                <div>
                  <label>ID Batería Dron</label>
                  <input type="text" maxLength={3} value={formData.droneBatteryName || ''} onChange={e => setFormData({ ...formData, droneBatteryName: e.target.value.toUpperCase() })} />
                </div>
                <div>
                  <label>ID Batería Control</label>
                  <input type="text" maxLength={3} value={formData.controlBatteryName || ''} onChange={e => setFormData({ ...formData, controlBatteryName: e.target.value.toUpperCase() })} />
                </div>
              </div>
            </>
          )}

          {type === 'detections' && (
            <>
              <div className="grid-cols-2">
                <div>
                  <label>Criticidad</label>
                  <select value={formData.criticality} onChange={e => setFormData({ ...formData, criticality: e.target.value })}>
                    {lists.criticalities.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label>Nombre de Archivo</label>
                  <input type="text" value={formData.fileName} onChange={e => setFormData({ ...formData, fileName: e.target.value })} />
                </div>
              </div>
              <div>
                <label>Observaciones</label>
                <textarea value={formData.observations} onChange={e => setFormData({ ...formData, observations: e.target.value })} rows={3} />
              </div>
            </>
          )}

          {type === 'checklists' && (
            <>
              <div className="grid-cols-2">
                <div>
                  <label>Unidad</label>
                  <input type="text" value={formData.vehicleId || ''} onChange={e => setFormData({ ...formData, vehicleId: e.target.value })} />
                </div>
                <div>
                  <label>Responsable</label>
                  <input type="text" value={formData.driver || ''} onChange={e => setFormData({ ...formData, driver: e.target.value })} />
                </div>
              </div>
              <div className="grid-cols-2">
                <div>
                  <label>Kilometraje</label>
                  <input type="number" value={formData.mileage || ''} onChange={e => setFormData({ ...formData, mileage: e.target.value })} />
                </div>
              </div>
              <div>
                <label>Observaciones</label>
                <textarea value={formData.observations || ''} onChange={e => setFormData({ ...formData, observations: e.target.value })} rows={3} />
              </div>
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
            <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border-input)', borderRadius: '12px', color: 'var(--text-primary)', padding: '0.8rem 1.5rem', cursor: 'pointer' }}>
              Cancelar
            </button>
            <button onClick={() => onSave(formData)} className="btn-3d" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Save size={18} /> Guardar Cambios
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default RecordsExplorer;
