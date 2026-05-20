import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, Search, Calendar, Edit2, Trash2, 
  Download, LayoutDashboard, Plane, Cpu, AlertTriangle, Save, X, ShieldCheck, Printer,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PrintableChecklistBatch from './PrintableChecklistBatch';
import type { 
  ShiftData, FlightData, BatteryData, DetectionData, AppData, ListsData 
} from '../types';
import { exportToExcel } from '../utils/exportUtils';

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
  onOpenSync?: () => void;
}

type RecordType = 'shifts' | 'flights' | 'batteries' | 'detections' | 'checklists';

const RecordsExplorer: React.FC<RecordsExplorerProps> = (props) => {
  const [activeTable, setActiveTable] = useState<RecordType>('flights');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [editingRecord, setEditingRecord] = useState<{ type: RecordType, data: any } | null>(null);

  // Converts "19/5/2026 11:21:04" to Date object for robust comparisons
  const parseLocalTimestampToDate = (timestamp: string): Date | null => {
    if (!timestamp) return null;
    const parts = timestamp.trim().split(/\s+/);
    const datePart = parts[0];
    if (!datePart) return null;
    const dateParts = datePart.split('/');
    if (dateParts.length !== 3) return null;
    
    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1; // 0-indexed month
    const year = parseInt(dateParts[2], 10);
    
    const timePart = parts[1] || '00:00:00';
    const timeParts = timePart.split(':');
    const hours = parseInt(timeParts[0] || '0', 10);
    const minutes = parseInt(timeParts[1] || '0', 10);
    const seconds = parseInt(timeParts[2] || '0', 10);
    
    const d = new Date(year, month, day, hours, minutes, seconds);
    return isNaN(d.getTime()) ? null : d;
  };

  // Helper maps for related entities lookup
  const flightMap = useMemo(() => new Map(props.data.flights.map(f => [f.id, f])), [props.data.flights]);
  const shiftMap = useMemo(() => new Map(props.data.shifts.map(s => [s.id, s])), [props.data.shifts]);

  const handleTableChange = (tabId: RecordType) => {
    setActiveTable(tabId);
    setSearchField('all');
    setSearchTerm('');
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
    const list = props.data[activeTable] as any[];
    
    // Convert boundary date strings ("YYYY-MM-DD") to Date objects
    const start = startDate ? new Date(startDate + 'T00:00:00') : null;
    const end = endDate ? new Date(endDate + 'T23:59:59') : null;

    return list.filter(item => {
      // 1. Date Range Filter
      if (start || end) {
        const itemDate = parseLocalTimestampToDate(item.timestamp);
        if (itemDate) {
          if (start && itemDate < start) return false;
          if (end && itemDate > end) return false;
        } else {
          return false;
        }
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
        const ownValues = Object.values(item).join(' ').toLowerCase();
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
      if (searchField === 'driver') return (item.driver || '').toLowerCase().includes(term);
      if (searchField === 'deviceName') return (item.deviceName || '').toLowerCase().includes(term);

      return false;
    }).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [props.data, activeTable, searchTerm, searchField, startDate, endDate, flightMap, shiftMap]);

  const handleExportFiltered = () => {
    if (activeTable === 'checklists') return;
    exportToExcel(props.data, {
      activeTable: activeTable as any,
      filteredData
    });
  };

  const handleDelete = async (id: string) => {
    const ok = await window.customConfirm('¿Estás seguro de eliminar este registro?');
    if (!ok) return;
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
          <button onClick={props.onOpenSync} className="btn-3d" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(0,255,136,0.1)', color: '#00ff88', border: '1px solid #00ff88', padding: '1rem 2rem' }}>
            <RefreshCw size={20} /> SINCRONIZAR
          </button>
        </div>
        <div style={{ textAlign: 'right' }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 900, margin: 0, color: 'white', textTransform: 'uppercase' }}>Historial Técnico</h2>
          <p style={{ color: 'var(--primary)', fontWeight: 900, margin: 0, letterSpacing: '4px', background: '#000', display: 'inline-block', padding: '2px 10px', fontSize: '0.8rem', border: '1px solid var(--primary)' }}>HORUS DRON</p>
        </div>
      </div>

      {/* Table Selector Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
        {[
          { id: 'shifts', label: 'Jornadas', icon: LayoutDashboard },
          { id: 'flights', label: 'Vuelos', icon: Plane },
          { id: 'batteries', label: 'Baterías', icon: Cpu },
          { id: 'detections', label: 'Detecciones', icon: AlertTriangle },
          { id: 'checklists', label: 'Inspecciones', icon: ShieldCheck },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTableChange(tab.id as RecordType)}
            style={{
              flex: 1, minWidth: '180px', padding: '1.2rem', borderRadius: '4px', border: '2px solid',
              borderColor: activeTable === tab.id ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
              background: activeTable === tab.id ? 'var(--primary)' : 'rgba(0,0,0,0.5)',
              color: activeTable === tab.id ? 'black' : '#AAA',
              cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', fontWeight: 900,
              textTransform: 'uppercase', letterSpacing: '1px',
              boxShadow: activeTable === tab.id ? '0 0 20px rgba(240,196,25,0.2)' : 'none'
            }}
          >
            <tab.icon size={20} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters Bar */}
      <div className="glass" style={{ padding: '2rem', marginBottom: '2.5rem', display: 'grid', gridTemplateColumns: '1.8fr 1fr 1fr 160px', gap: '1.5rem', alignItems: 'end', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--glass-border)' }}>
        <div>
          <label>Buscador Específico</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select
              value={searchField}
              onChange={e => setSearchField(e.target.value)}
              style={{
                width: '170px',
                background: 'rgba(0,0,0,0.8)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'white',
                padding: '0.8rem',
                borderRadius: '4px',
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
        <div>
          <label>Fecha Desde</label>
          <div style={{ position: 'relative' }}>
            <Calendar size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)', pointerEvents: 'none' }} />
            <input 
              type="date" 
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              style={{ 
                paddingLeft: '45px',
                color: 'white',
                background: 'rgba(0,0,0,0.6)',
                border: '1px solid rgba(255,255,255,0.15)',
                cursor: 'pointer'
              }}
            />
          </div>
        </div>
        <div>
          <label>Fecha Hasta</label>
          <div style={{ position: 'relative' }}>
            <Calendar size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)', pointerEvents: 'none' }} />
            <input 
              type="date" 
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              style={{ 
                paddingLeft: '45px',
                color: 'white',
                background: 'rgba(0,0,0,0.6)',
                border: '1px solid rgba(255,255,255,0.15)',
                cursor: 'pointer'
              }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column', height: '100%', justifyContent: 'flex-end' }}>
          {activeTable === 'checklists' && (
            <button onClick={() => window.print()} className="btn-3d" style={{ width: '100%', height: '58px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: '#ff6600', color: 'black', border: '1px solid #ff6600' }}>
              <Printer size={18} /> IMPRIMIR LOTES
            </button>
          )}
          {activeTable !== 'checklists' && (
            <button onClick={handleExportFiltered} className="btn-3d" style={{ width: '100%', height: '58px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
              <Download size={20} /> EXPORTAR
            </button>
          )}
        </div>
      </div>

      {/* Records Table */}
      <div className="glass" style={{ overflow: 'hidden', background: '#000', border: '1px solid var(--glass-border)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(240,196,25,0.1)', borderBottom: '2px solid var(--primary)' }}>
                <th style={{ padding: '1.5rem 1.2rem', color: 'var(--primary)', fontSize: '0.9rem', textTransform: 'uppercase', fontWeight: 900, letterSpacing: '1px' }}>Fecha/Hora</th>
                {activeTable === 'shifts' && <><th style={{ padding: '1.2rem', color: 'white' }}>Coordinador</th><th style={{ padding: '1.2rem', color: 'white' }}>Asistentes</th><th style={{ padding: '1.2rem', color: 'white' }}>Vehículo</th></>}
                {activeTable === 'flights' && <><th style={{ padding: '1.2rem', color: 'white' }}>Piloto</th><th style={{ padding: '1.2rem', color: 'white' }}>Línea</th><th style={{ padding: '1.2rem', color: 'white' }}>Obs.</th></>}
                {activeTable === 'batteries' && <><th style={{ padding: '1.2rem', color: 'white' }}>Piloto</th><th style={{ padding: '1.2rem', color: 'white' }}>ID Dron</th><th style={{ padding: '1.2rem', color: 'white' }}>Bat. Dron</th><th style={{ padding: '1.2rem', color: 'white' }}>ID RC</th><th style={{ padding: '1.2rem', color: 'white' }}>Bat. RC</th></>}
                {activeTable === 'detections' && <><th style={{ padding: '1.2rem', color: 'white' }}>Elemento</th><th style={{ padding: '1.2rem', color: 'white' }}>Anomalía</th><th style={{ padding: '1.2rem', color: 'white' }}>Criticidad</th></>}
                {activeTable === 'checklists' && <><th style={{ padding: '1.2rem', color: 'white' }}>Unidad</th><th style={{ padding: '1.2rem', color: 'white' }}>Responsable</th><th style={{ padding: '1.2rem', color: 'white' }}>Kilometraje</th></>}
                <th style={{ padding: '1.2rem', color: 'white' }}>Origen</th>
                <th style={{ padding: '1.2rem', textAlign: 'right', color: 'white' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s ease' }}>
                  <td style={{ padding: '1.2rem', fontSize: '0.95rem', color: 'var(--primary)', fontWeight: 700 }}>{item.timestamp}</td>
                  
                  {activeTable === 'shifts' && (
                    <>
                      <td style={{ padding: '1.2rem', color: 'white' }}>{item.coordinator}</td>
                      <td style={{ padding: '1.2rem', color: 'white', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.assistants ? item.assistants.join(', ') : item.assistant}
                      </td>
                      <td style={{ padding: '1.2rem', color: 'white' }}>{item.vehicle}</td>
                    </>
                  )}
                  {activeTable === 'flights' && (
                    <>
                      <td style={{ padding: '1.2rem', color: 'white' }}>{item.pilot}</td>
                      <td style={{ padding: '1.2rem', color: 'white' }}>{item.lineName}</td>
                      <td style={{ padding: '1.2rem', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#888', fontSize: '0.9rem' }}>{item.observations}</td>
                    </>
                  )}
                  {activeTable === 'batteries' && (
                    <>
                      <td style={{ padding: '1.2rem', color: 'white' }}>{item.pilot}</td>
                      <td style={{ padding: '1.2rem', color: '#00c2ff', fontWeight: 800 }}>{item.droneBatteryName || '—'}</td>
                      <td style={{ padding: '1.2rem', color: 'white', fontWeight: 800 }}>{item.droneBattery}%</td>
                      <td style={{ padding: '1.2rem', color: '#00c2ff', fontWeight: 800 }}>{item.controlBatteryName || '—'}</td>
                      <td style={{ padding: '1.2rem', color: 'white', fontWeight: 800 }}>{item.controlBattery}%</td>
                    </>
                  )}
                  {activeTable === 'detections' && (
                    <>
                      <td style={{ padding: '1.2rem', fontWeight: 800, color: 'white' }}>{item.element}</td>
                      <td style={{ padding: '1.2rem', color: 'white' }}>{item.anomaly}</td>
                      <td style={{ padding: '1.2rem' }}>
                        {(() => {
                          const cc: Record<string, string> = { 'Muy Baja': '#00F2D1', Baja: '#00E676', Media: '#FFD600', Alta: '#FF9100', Urgente: '#FF1744' };
                          const bg = cc[item.criticality] || 'rgba(255,255,255,0.1)';
                          const fc = item.criticality === 'Urgente' ? 'white' : 'black';
                          return (
                            <span style={{ padding: '4px 12px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 900, background: bg, color: fc, border: `1px solid ${bg}` }}>
                              {item.criticality}
                            </span>
                          );
                        })()}
                      </td>
                    </>
                  )}
                  {activeTable === 'checklists' && (
                    <>
                      <td style={{ padding: '1.2rem', color: 'white', fontWeight: 800 }}>{item.vehicleId}</td>
                      <td style={{ padding: '1.2rem', color: 'white' }}>{item.driver}</td>
                      <td style={{ padding: '1.2rem', color: '#ff6600', fontWeight: 800 }}>{item.mileage} km</td>
                    </>
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
                      <button 
                        onClick={() => handleDelete(item.id)}
                        style={{ background: 'rgba(255,0,0,0.1)', border: '1px solid #FF0000', borderRadius: '4px', color: '#FF0000', padding: '10px', cursor: 'pointer' }}
                        title="Eliminar"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No se encontraron registros con los filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="glass" 
        style={{ width: '100%', maxWidth: '600px', padding: '2rem', position: 'relative', border: '1px solid rgba(0,242,255,0.3)' }}
      >
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
          <X size={24} />
        </button>

        <h3 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Edit2 size={20} color="var(--primary)" /> Editar Registro
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div>
            <label>Fecha y Hora</label>
            <input type="text" value={formData.timestamp} onChange={e => setFormData({ ...formData, timestamp: e.target.value })} />
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
                  <label>Batería Dron %</label>
                  <input type="number" value={formData.droneBattery} onChange={e => setFormData({ ...formData, droneBattery: e.target.value })} />
                </div>
              </div>
              <div className="grid-cols-2">
                <div>
                  <label>ID Batería Control</label>
                  <input type="text" maxLength={3} value={formData.controlBatteryName || ''} onChange={e => setFormData({ ...formData, controlBatteryName: e.target.value.toUpperCase() })} />
                </div>
                <div>
                  <label>Batería RC %</label>
                  <input type="number" value={formData.controlBattery} onChange={e => setFormData({ ...formData, controlBattery: e.target.value })} />
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
            <button onClick={onClose} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', color: 'white', padding: '0.8rem 1.5rem', cursor: 'pointer' }}>
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
