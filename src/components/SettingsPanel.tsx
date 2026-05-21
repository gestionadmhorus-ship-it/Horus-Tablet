import React, { useState } from 'react';
import {
  X, Plus, Trash2, ChevronDown, ChevronUp, Settings,
  ClipboardPaste, BookOpen, CheckCircle, AlertCircle, ChevronRight, Wifi, ShieldAlert
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Peer } from 'peerjs';
import type { ListsData, ElementEntry, AnomalyEntry } from '../types';

interface SettingsPanelProps {
  lists: ListsData;
  onUpdate: (lists: ListsData) => void;
  onClose: () => void;
  deviceName: string;
  onDeviceNameChange: (val: string) => void;
}

/* ─── Flat list categories (no elements/anomalies) ─── */
type FlatKey = 'coordinators' | 'pilots' | 'assistants' | 'vehicles' | 'drones' | 'criticalities';
const flatCategories: { key: FlatKey; label: string; placeholder: string }[] = [
  { key: 'coordinators', label: 'Coordinadores',        placeholder: 'Nombre del coordinador...' },
  { key: 'pilots',       label: 'Pilotos',              placeholder: 'Nombre del piloto...' },
  { key: 'assistants',   label: 'Asistentes',           placeholder: 'Nombre del asistente...' },
  { key: 'vehicles',     label: 'Vehículos',            placeholder: 'Patente o modelo...' },
  { key: 'drones',       label: 'Drones',               placeholder: 'ID o modelo del dron...' },
  { key: 'criticalities',label: 'Niveles de Criticidad',placeholder: 'Ej: Baja, Alta...' },
];

const criticalityColors: Record<string, string> = {
  Baja: '#00ff88', Media: '#ffcc00', Alta: '#ff6600', Crítica: '#ff0000',
};

/* ─── Excel paste parser ─── */
function parsePaste(text: string): { entry: ElementEntry; warnings: string[] } | { error: string } {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l !== '');

  if (lines.length === 0) return { error: 'El texto pegado está vacío.' };

  // First row: first cell = element name
  const firstCells = lines[0].split('\t');
  const elementName = firstCells[0].trim();
  if (!elementName) return { error: 'No se pudo detectar el nombre del elemento (primera celda vacía).' };

  const anomalies: AnomalyEntry[] = [];
  const warnings: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split('\t');
    const anomalyName = cells[0]?.trim();
    const recommendation = cells[1]?.trim() || '';

    if (!anomalyName) { warnings.push(`Fila ${i + 1} ignorada (nombre vacío).`); continue; }
    if (!recommendation) warnings.push(`Anomalía "${anomalyName}" sin recomendación.`);
    anomalies.push({ name: anomalyName, recommendation });
  }

  if (anomalies.length === 0) return { error: 'No se encontraron filas de anomalías válidas.' };
  return { entry: { name: elementName, anomalies }, warnings };
}

/* ═══════════════ COMPONENT ═══════════════ */
const SettingsPanel: React.FC<SettingsPanelProps> = ({ lists, onUpdate, onClose, deviceName, onDeviceNameChange }) => {

  /* ─── Flat lists state ─── */
  const [flatInputs, setFlatInputs] = useState<Record<FlatKey, string>>(
    Object.fromEntries(flatCategories.map(c => [c.key, ''])) as Record<FlatKey, string>
  );
  const [flatExpanded, setFlatExpanded] = useState<Record<string, boolean>>(
    Object.fromEntries(flatCategories.map(c => [c.key, false]))
  );

  /* ─── Knowledge base state ─── */
  const [pasteText, setPasteText] = useState('');
  const [parseResult, setParseResult] = useState<{ type: 'success' | 'error' | 'warning'; msg: string } | null>(null);
  const [kbExpanded, setKbExpanded] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'lists' | 'knowledge' | 'connection'>('lists');

  /* ─── Connection state ─── */
  const appRole = localStorage.getItem('horus_sync_role');
  const myServerId = localStorage.getItem('horus_my_server_id');
  const [knownClients, setKnownClients] = useState<string[]>(() => {
    return JSON.parse(localStorage.getItem('horus_known_clients') || '[]');
  });

  React.useEffect(() => {
    const handleUpdate = () => {
      setKnownClients(JSON.parse(localStorage.getItem('horus_known_clients') || '[]'));
    };
    window.addEventListener('horus_known_clients_updated', handleUpdate);
    return () => window.removeEventListener('horus_known_clients_updated', handleUpdate);
  }, []);

  const removeKnownClient = async (client: string) => {
    const ok = await window.customConfirm(`¿Eliminar al explorador "${client}" de la red?\nNo podrá sincronizar hasta que sea retirado del bloqueo.`);
    if (!ok) return;
    // 1. Remove from known list (UI)
    const updatedKnown = knownClients.filter(c => c !== client);
    localStorage.setItem('horus_known_clients', JSON.stringify(updatedKnown));
    setKnownClients(updatedKnown);
    // 2. Add to blocked list so useAutoSync rejects future reconnections
    const currentBlocked: string[] = JSON.parse(localStorage.getItem('horus_blocked_clients') || '[]');
    if (!currentBlocked.includes(client)) {
      currentBlocked.push(client);
      localStorage.setItem('horus_blocked_clients', JSON.stringify(currentBlocked));
    }
  };

  const handleUnbindClient = async () => {
    const ok = await window.customConfirm('¿Estás seguro de desvincularte del Jefe actual? Deberás escanear un nuevo QR para volver a sincronizar.');
    if (!ok) return;

    const doUnbind = () => {
      localStorage.removeItem('horus_target_server_id');
      localStorage.removeItem('horus_sync_role');
      window.location.reload();
    };

    const targetServerId = localStorage.getItem('horus_target_server_id');
    if (!targetServerId) { doUnbind(); return; }

    // Try to notify server before disconnecting (3s timeout)
    try {
      const tempPeer = new Peer({ debug: 0 });
      const giveUp = setTimeout(() => { tempPeer.destroy(); doUnbind(); }, 3000);

      tempPeer.on('open', () => {
        const conn = tempPeer.connect(targetServerId);
        conn.on('open', () => {
          conn.send({ type: 'DISCONNECT', deviceName });
          setTimeout(() => { clearTimeout(giveUp); tempPeer.destroy(); doUnbind(); }, 600);
        });
        conn.on('error', () => { clearTimeout(giveUp); tempPeer.destroy(); doUnbind(); });
      });
      tempPeer.on('error', () => { clearTimeout(giveUp); doUnbind(); });
    } catch { doUnbind(); }
  };

  /* ─── Flat list helpers ─── */
  const toggleFlat = (key: string) => setFlatExpanded(p => ({ ...p, [key]: !p[key] }));

  const addFlatItem = async (key: FlatKey) => {
    const value = flatInputs[key].trim();
    if (!value) return;
    if (lists[key].includes(value as never)) { await window.customAlert(`"${value}" ya existe.`); return; }
    onUpdate({ ...lists, [key]: [...(lists[key] as string[]), value] });
    setFlatInputs(p => ({ ...p, [key]: '' }));
  };

  const removeFlatItem = (key: FlatKey, item: string) => {
    onUpdate({ ...lists, [key]: (lists[key] as string[]).filter(i => i !== item) });
  };

  /* ─── Knowledge base helpers ─── */
  const processPaste = () => {
    setParseResult(null);
    const result = parsePaste(pasteText);
    if ('error' in result) { setParseResult({ type: 'error', msg: result.error }); return; }

    const { entry, warnings } = result;
    const existingIdx = lists.elements.findIndex(e => e.name.toLowerCase() === entry.name.toLowerCase());
    let updatedElements: ElementEntry[];

    if (existingIdx >= 0) {
      // Merge: add new anomalies, skip duplicates
      const existing = lists.elements[existingIdx];
      const existingNames = existing.anomalies.map(a => a.name.toLowerCase());
      const newAnomalies = entry.anomalies.filter(a => !existingNames.includes(a.name.toLowerCase()));
      const merged: ElementEntry = { ...existing, anomalies: [...existing.anomalies, ...newAnomalies] };
      updatedElements = lists.elements.map((e, i) => i === existingIdx ? merged : e);
      setParseResult({
        type: warnings.length ? 'warning' : 'success',
        msg: `Elemento "${entry.name}" actualizado. +${newAnomalies.length} anomalías nuevas.${warnings.length ? ' Avisos: ' + warnings.join('; ') : ''}`
      });
    } else {
      updatedElements = [...lists.elements, entry];
      setParseResult({
        type: warnings.length ? 'warning' : 'success',
        msg: `Elemento "${entry.name}" cargado con ${entry.anomalies.length} anomalías.${warnings.length ? ' Avisos: ' + warnings.join('; ') : ''}`
      });
    }

    onUpdate({ ...lists, elements: updatedElements });
    setPasteText('');
    setKbExpanded(p => ({ ...p, [entry.name]: true }));
  };

  const removeElement = async (name: string) => {
    const ok = await window.customConfirm(`¿Eliminar el elemento "${name}" y todas sus anomalías?`);
    if (!ok) return;
    onUpdate({ ...lists, elements: lists.elements.filter(e => e.name !== name) });
  };

  const removeAnomaly = (elementName: string, anomalyName: string) => {
    onUpdate({
      ...lists,
      elements: lists.elements.map(e =>
        e.name === elementName
          ? { ...e, anomalies: e.anomalies.filter(a => a.name !== anomalyName) }
          : e
      )
    });
  };

  /* ─── Styles ─── */
  const tabBtnStyle = (tab: 'lists' | 'knowledge' | 'connection'): React.CSSProperties => ({
    flex: 1, padding: '0.75rem', border: 'none', cursor: 'pointer',
    fontWeight: 700, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px',
    background: activeTab === tab ? 'rgba(0,242,255,0.1)' : 'transparent',
    color: activeTab === tab ? 'var(--primary)' : 'var(--text-secondary)',
    borderBottom: `2px solid ${activeTab === tab ? 'var(--primary)' : 'transparent'}`,
    transition: 'all 0.2s ease'
  });

  const sectionStyle: React.CSSProperties = {
    marginBottom: '0.75rem',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '14px', overflow: 'hidden'
  };

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 900 }} />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, width: 'min(440px, 100vw)', height: '100vh',
        background: 'linear-gradient(160deg, #0d1528 0%, #0a0f1e 100%)',
        borderLeft: '1px solid rgba(0,242,255,0.2)', zIndex: 1000,
        display: 'flex', flexDirection: 'column',
        boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
        animation: 'slideInRight 0.3s ease'
      }}>

        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,242,255,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'rgba(0,242,255,0.1)', padding: '0.5rem', borderRadius: '10px', color: 'var(--primary)' }}>
              <Settings size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Configuración</h2>
              <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Listas y Base de Conocimiento</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', cursor: 'pointer', padding: '0.4rem', display: 'flex' }}>
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={() => setActiveTab('lists')} style={tabBtnStyle('lists')}>
            Listas
          </button>
          <button onClick={() => setActiveTab('knowledge')} style={tabBtnStyle('knowledge')}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
              <BookOpen size={14} /> Base C.
            </span>
          </button>
          <button onClick={() => setActiveTab('connection')} style={tabBtnStyle('connection')}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
              <Wifi size={14} /> Red
            </span>
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>

          {/* ══════ TAB: FLAT LISTS ══════ */}
          {activeTab === 'lists' && (
            <div style={{ ...sectionStyle, padding: '1.25rem', border: '1px solid rgba(0,242,255,0.25)', boxShadow: '0 0 15px rgba(0,242,255,0.05)', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.9rem' }}>
                <span style={{ fontSize: '1.2rem' }}>🏷️</span>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '0.92rem', color: 'white' }}>Nombre del Dispositivo</p>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    Identifica de qué tablet proviene cada registro.
                  </p>
                </div>
              </div>
              <input
                type="text"
                value={deviceName}
                onChange={e => onDeviceNameChange(e.target.value)}
                placeholder="Ej: Tablet Alfa, Tablet Beta..."
                maxLength={30}
                style={{ width: '100%', fontSize: '0.88rem', padding: '10px 12px' }}
              />
              {deviceName.trim() !== '' && (
                <div style={{
                  marginTop: '0.6rem',
                  fontSize: '0.78rem',
                  color: '#00f2ff',
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  textShadow: '0 0 10px rgba(0, 242, 255, 0.4)',
                  letterSpacing: '0.5px'
                }}>
                  ✓ IDENTIDAD ACTIVA GUARDADA Y PERSISTIDA
                </div>
              )}
            </div>
          )}
          {activeTab === 'lists' && flatCategories.map(cat => (
            <div key={cat.key} style={sectionStyle}>
              <button
                onClick={() => toggleFlat(cat.key)}
                style={{ width: '100%', padding: '0.85rem 1.2rem', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'white' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>{cat.label}</span>
                  <span style={{ background: 'rgba(0,242,255,0.15)', color: 'var(--primary)', borderRadius: '20px', padding: '1px 8px', fontSize: '0.72rem', fontWeight: 700 }}>
                    {(lists[cat.key] as string[]).length}
                  </span>
                </div>
                {flatExpanded[cat.key] ? <ChevronUp size={15} color="var(--text-secondary)" /> : <ChevronDown size={15} color="var(--text-secondary)" />}
              </button>

              {flatExpanded[cat.key] && (
                <div style={{ padding: '0 1.2rem 1.2rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <input
                      type="text"
                      value={flatInputs[cat.key]}
                      onChange={e => setFlatInputs(p => ({ ...p, [cat.key]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && addFlatItem(cat.key)}
                      placeholder={cat.placeholder}
                      style={{ flex: 1, fontSize: '0.88rem', padding: '8px 12px' }}
                    />
                    <button
                      onClick={() => addFlatItem(cat.key)}
                      style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))', border: 'none', borderRadius: '10px', color: 'white', cursor: 'pointer', padding: '0 14px', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                    >
                      <Plus size={17} />
                    </button>
                  </div>
                  {(lists[cat.key] as string[]).length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', textAlign: 'center', margin: 0 }}>Sin elementos. Añade el primero ↑</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {(lists[cat.key] as string[]).map(item => (
                        <div key={item} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '0.45rem 0.75rem' }}>
                          <span style={{ fontSize: '0.88rem', color: cat.key === 'criticalities' ? (criticalityColors[item] || 'white') : 'white', fontWeight: cat.key === 'criticalities' ? 600 : 400 }}>
                            {item}
                          </span>
                          <button onClick={() => removeFlatItem(cat.key, item)} style={{ background: 'rgba(255,60,60,0.1)', border: 'none', borderRadius: '6px', color: '#ff6060', cursor: 'pointer', padding: '3px 6px', display: 'flex' }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* ══════ TAB: KNOWLEDGE BASE ══════ */}
          {activeTab === 'knowledge' && (
            <>
              {/* Paste zone */}
              <div style={{ ...sectionStyle, padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.9rem' }}>
                  <ClipboardPaste size={18} color="var(--primary)" />
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '0.92rem' }}>Carga Masiva desde Excel</p>
                    <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      Copia la tabla (elemento + anomalías) y pégala aquí
                    </p>
                  </div>
                </div>

                <textarea
                  value={pasteText}
                  onChange={e => { setPasteText(e.target.value); setParseResult(null); }}
                  placeholder={'Pegar aquí...\n\nFormato esperado (copiado de Excel):\nATADURA\tRecomendaciones\nFaltante\tColocar elemento faltante\nOxidación\tReemplazar elemento\n...'}
                  rows={7}
                  style={{ width: '100%', fontSize: '0.82rem', fontFamily: 'monospace', resize: 'vertical', marginBottom: '0.75rem' }}
                />

                <button
                  onClick={processPaste}
                  disabled={!pasteText.trim()}
                  className="btn-3d"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.85rem', padding: '0.75rem', opacity: pasteText.trim() ? 1 : 0.4 }}
                >
                  <ClipboardPaste size={16} /> Procesar y Cargar
                </button>

                {/* Parse result feedback */}
                {parseResult && (
                  <div style={{
                    marginTop: '0.75rem', padding: '0.65rem 0.9rem', borderRadius: '10px',
                    background: parseResult.type === 'error' ? 'rgba(255,60,60,0.12)' : 'rgba(0,255,136,0.08)',
                    border: `1px solid ${parseResult.type === 'error' ? 'rgba(255,60,60,0.3)' : 'rgba(0,255,136,0.25)'}`,
                    display: 'flex', alignItems: 'flex-start', gap: '0.5rem'
                  }}>
                    {parseResult.type === 'error'
                      ? <AlertCircle size={16} color="#ff6060" style={{ flexShrink: 0, marginTop: 2 }} />
                      : <CheckCircle size={16} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
                    }
                    <p style={{ margin: 0, fontSize: '0.78rem', color: parseResult.type === 'error' ? '#ff9090' : '#a0ffc0', lineHeight: 1.4 }}>
                      {parseResult.msg}
                    </p>
                  </div>
                )}
              </div>

              {/* Loaded elements */}
              <div style={{ marginTop: '0.25rem' }}>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem 0.25rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {lists.elements.length} elemento{lists.elements.length !== 1 ? 's' : ''} cargado{lists.elements.length !== 1 ? 's' : ''}
                </p>

                {lists.elements.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)', fontSize: '0.85rem', background: 'rgba(255,255,255,0.02)', borderRadius: '14px', border: '1px dashed rgba(255,255,255,0.08)' }}>
                    <BookOpen size={32} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                    <p style={{ margin: 0 }}>Sin elementos cargados.<br />Usa la carga masiva ↑ para importar desde Excel.</p>
                  </div>
                ) : (
                  lists.elements.map(el => (
                    <div key={el.name} style={sectionStyle}>
                      <button
                        onClick={() => setKbExpanded(p => ({ ...p, [el.name]: !p[el.name] }))}
                        style={{ width: '100%', padding: '0.85rem 1.2rem', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'white' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--primary)' }}>{el.name}</span>
                          <span style={{ background: 'rgba(0,242,255,0.12)', color: 'var(--primary)', borderRadius: '20px', padding: '1px 8px', fontSize: '0.72rem', fontWeight: 700 }}>
                            {el.anomalies.length} anomalías
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button
                            onClick={e => { e.stopPropagation(); removeElement(el.name); }}
                            style={{ background: 'rgba(255,60,60,0.1)', border: 'none', borderRadius: '6px', color: '#ff6060', cursor: 'pointer', padding: '3px 6px', display: 'flex' }}
                          >
                            <Trash2 size={13} />
                          </button>
                          {kbExpanded[el.name] ? <ChevronUp size={14} color="var(--text-secondary)" /> : <ChevronDown size={14} color="var(--text-secondary)" />}
                        </div>
                      </button>

                      {kbExpanded[el.name] && (
                        <div style={{ padding: '0 1rem 1rem' }}>
                          {el.anomalies.map(a => (
                            <div key={a.name} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '0.6rem 0.75rem', marginBottom: '0.4rem' }}>
                              <ChevronRight size={13} color="var(--text-secondary)" style={{ flexShrink: 0, marginTop: 3 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem', color: 'white' }}>{a.name}</p>
                                {a.recommendation && (
                                  <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    → {a.recommendation}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => removeAnomaly(el.name, a.name)}
                                style={{ background: 'rgba(255,60,60,0.08)', border: 'none', borderRadius: '6px', color: '#ff6060', cursor: 'pointer', padding: '3px 6px', display: 'flex', flexShrink: 0 }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {/* ══════ TAB: CONNECTION ══════ */}
          {activeTab === 'connection' && (
            <div style={{ padding: '0.5rem' }}>
              {appRole === 'server' ? (
                <>
                  <div style={{ ...sectionStyle, padding: '1.5rem', textAlign: 'center', border: '1px solid var(--primary)', background: 'rgba(240,196,25,0.05)' }}>
                    <h3 style={{ color: 'white', marginTop: 0, marginBottom: '0.5rem' }}>Tu Código QR de Jefe</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                      Muestra este código a los exploradores para que se vinculen a tu red.
                    </p>
                    <div style={{ background: 'white', padding: '1rem', display: 'inline-block', borderRadius: '12px' }}>
                      {myServerId ? (
                        <QRCodeSVG value={myServerId} size={200} />
                      ) : (
                        <p style={{color: 'black'}}>Error: No hay ID generado.</p>
                      )}
                    </div>
                  </div>

                  <div style={{ ...sectionStyle, padding: '1.25rem' }}>
                    <h3 style={{ color: 'white', marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <ShieldAlert size={18} color="var(--primary)" /> Exploradores Conocidos
                    </h3>
                    {knownClients.length === 0 ? (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center' }}>Aún no se ha conectado ningún explorador.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {knownClients.map(client => (
                          <div key={client} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,255,136,0.05)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(0,255,136,0.15)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 6px #00ff88' }} />
                              <span style={{ color: 'white', fontWeight: 'bold' }}>{client}</span>
                            </div>
                            <button 
                              onClick={() => removeKnownClient(client)}
                              style={{ 
                                background: 'rgba(255,68,68,0.12)', 
                                color: '#ff6060', 
                                border: '1px solid rgba(255,68,68,0.4)',
                                padding: '0.35rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 'bold',
                                display: 'flex', alignItems: 'center', gap: '0.4rem'
                              }}
                            >
                              <Trash2 size={13} /> Eliminar
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ ...sectionStyle, padding: '1.5rem', textAlign: 'center', border: '1px solid #ff4444', background: 'rgba(255,68,68,0.05)' }}>
                  <h3 style={{ color: '#ff4444', marginTop: 0, marginBottom: '0.5rem' }}>Zona de Peligro</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '2rem' }}>
                    Si cambiaste de escuadrón, puedes desvincularte del Jefe actual. Deberás escanear el QR del nuevo Jefe para volver a operar.
                  </p>
                  <button
                    onClick={handleUnbindClient}
                    className="btn-3d"
                    style={{ width: '100%', padding: '1rem', background: '#ff4444', color: 'black', fontWeight: 'bold' }}
                  >
                    Desvincular Jefe Actual
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '0.85rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
          Los datos se guardan automáticamente en el dispositivo.
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
};

export default SettingsPanel;
