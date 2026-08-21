import React, { useState } from 'react';
import {
  X, Plus, Trash2, ChevronDown, ChevronUp, Settings,
  ClipboardPaste, BookOpen, CheckCircle, AlertCircle, ChevronRight, Wifi, ShieldAlert,
  RefreshCcw, DownloadCloud, Edit2, Save
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Peer } from 'peerjs';
import type { ListsData, ElementEntry, AnomalyEntry, KnownClient } from '../types';
import { INSPECTION_CATEGORIES } from '../types';
import { HorusSyncManager } from '../utils/legacySync';
import { UpdateManager } from '../services/UpdateManager';
import { getKnownClients } from '../hooks/useAutoSync';

interface SettingsPanelProps {
  lists: ListsData;
  onUpdate: (lists: ListsData) => void;
  onClose: () => void;
  deviceName: string;
  onDeviceNameChange: (val: string) => void;
  onSyncReceived?: (incomingData: any) => Promise<void>;
}

/* ─── Flat list categories (no elements/anomalies) ─── */
type FlatKey = 'clients' | 'coordinators' | 'pilots' | 'assistants' | 'vehicles' | 'drones' | 'criticalities';
const flatCategories: { key: FlatKey; label: string; placeholder: string }[] = [
  { key: 'clients',      label: 'Clientes',             placeholder: 'Nombre del cliente...' },
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
function parsePaste(text: string, category: string): { entry: ElementEntry; warnings: string[] } | { error: string } {
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
  const seenAnomalies = new Map<string, string>();

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split('\t');
    const anomalyName = cells[0]?.trim();
    const recommendation = cells[1]?.trim() || '';

    if (!anomalyName) { warnings.push(`Fila ${i + 1} ignorada (nombre vacío).`); continue; }
    const normalizedName = anomalyName.toLowerCase();
    if (seenAnomalies.has(normalizedName)) {
      return { error: `Anomalía duplicada en el bloque: "${anomalyName}".` };
    }
    seenAnomalies.set(normalizedName, anomalyName);
    if (!recommendation) warnings.push(`Anomalía "${anomalyName}" sin recomendación.`);
    anomalies.push({ name: anomalyName, recommendation });
  }

  if (anomalies.length === 0) return { error: 'No se encontraron filas de anomalías válidas.' };
  return { entry: { name: elementName, category, anomalies }, warnings };
}

/* ═══════════════ COMPONENT ═══════════════ */
const SettingsPanel: React.FC<SettingsPanelProps> = ({ lists, onUpdate, onClose, deviceName, onDeviceNameChange, onSyncReceived }) => {

  /* ─── Flat lists state ─── */
  const [flatInputs, setFlatInputs] = useState<Record<FlatKey, string>>(
    Object.fromEntries(flatCategories.map(c => [c.key, ''])) as Record<FlatKey, string>
  );
  const [flatExpanded, setFlatExpanded] = useState<Record<string, boolean>>(
    Object.fromEntries(flatCategories.map(c => [c.key, false]))
  );

  /* ─── Legacy Sync state ─── */
  const [legacyActive, setLegacyActive] = useState(false);
  const [legacyCode, setLegacyCode] = useState('');
  const [legacyStatus, setLegacyStatus] = useState('');
  const [legacyIsError, setLegacyIsError] = useState(false);
  const [legacyIsSuccess, setLegacyIsSuccess] = useState(false);

  // Instanciar HorusSyncManager usando React.useMemo
  const legacySyncManager = React.useMemo(() => new HorusSyncManager(), []);

  // Asegurar la limpieza al desmontar o cerrar
  React.useEffect(() => {
    return () => {
      legacySyncManager.cleanup();
    };
  }, [legacySyncManager]);

  const handleStartLegacy = () => {
    setLegacyActive(true);
    setLegacyIsError(false);
    setLegacyIsSuccess(false);
    
    // Generar un código aleatorio de 4 dígitos
    const generatedCode = Math.floor(1000 + Math.random() * 9000).toString();
    setLegacyCode(generatedCode);

    const startWithCode = (codeToUse: string) => {
      setLegacyCode(codeToUse);
      legacySyncManager.startReceiver(
        codeToUse,
        (status, isErr) => {
          setLegacyStatus(status);
          if (isErr !== undefined) setLegacyIsError(isErr);
        },
        async (payload) => {
          if (onSyncReceived) {
            await onSyncReceived(payload);
            setLegacyIsSuccess(true);
          } else {
            setLegacyIsError(true);
            setLegacyStatus('Sincronización no configurada.');
          }
        },
        () => {
          // Colisión de ID: reintentar con otro código
          setTimeout(() => {
            const newCode = Math.floor(1000 + Math.random() * 9000).toString();
            startWithCode(newCode);
          }, 800);
        }
      );
    };

    startWithCode(generatedCode);
  };

  const handleStopLegacy = () => {
    legacySyncManager.cleanup();
    setLegacyActive(false);
    setLegacyCode('');
    setLegacyStatus('');
    setLegacyIsError(false);
    setLegacyIsSuccess(false);
  };

  /* ─── Knowledge base state ─── */
  const [pasteText, setPasteText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Otros');
  const [parseResult, setParseResult] = useState<{ type: 'success' | 'error' | 'warning'; msg: string } | null>(null);
  const [kbExpanded, setKbExpanded] = useState<Record<string, boolean>>({});
  const [editingElementIndex, setEditingElementIndex] = useState<number | null>(null);
  const [editingElementOriginalName, setEditingElementOriginalName] = useState('');
  const [elementDraft, setElementDraft] = useState<ElementEntry | null>(null);
  const [activeTab, setActiveTab] = useState<'lists' | 'knowledge' | 'connection' | 'updates'>('lists');

  /* ─── Updates state ─── */
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'error' | 'up-to-date'>('idle');
  const [availableVersion, setAvailableVersion] = useState('');
  const [updateUrl, setUpdateUrl] = useState('');
  const [updateMsg, setUpdateMsg] = useState('');

  /* ─── Connection state ─── */
  const appRole = localStorage.getItem('horus_sync_role');
  const isKnowledgeBaseReadOnly = appRole === 'client'
    && !!localStorage.getItem('horus_target_server_id')?.trim();
  const myServerId = localStorage.getItem('horus_my_server_id');
  const [knownClients, setKnownClients] = useState<KnownClient[]>(() => {
    return getKnownClients();
  });

  React.useEffect(() => {
    const handleUpdate = () => {
      setKnownClients(getKnownClients());
    };
    window.addEventListener('horus_known_clients_updated', handleUpdate);
    return () => window.removeEventListener('horus_known_clients_updated', handleUpdate);
  }, []);

  const removeKnownClient = async (client: KnownClient) => {
    const ok = await window.customConfirm(`¿Eliminar a la unidad "${client.deviceName}" de la red?\nNo podrá sincronizar hasta que sea retirada del bloqueo.`);
    if (!ok) return;
    // 1. Remove from known list (UI)
    const updatedKnown = knownClients.filter(c => c.deviceId !== client.deviceId);
    localStorage.setItem('horus_known_clients', JSON.stringify(updatedKnown));
    setKnownClients(updatedKnown);
    // 2. Add to blocked list so useAutoSync rejects future reconnections
    const currentBlocked: string[] = JSON.parse(localStorage.getItem('horus_blocked_clients') || '[]');
    if (!currentBlocked.includes(client.deviceId)) {
      currentBlocked.push(client.deviceId);
      localStorage.setItem('horus_blocked_clients', JSON.stringify(currentBlocked));
    }
  };

  const handleUnbindClient = async () => {
    const ok = await window.customConfirm('¿Estás seguro de desvincularte de Control? Deberás escanear un nuevo QR para volver a sincronizar.');
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
    if ((lists[key] as string[]).some(item => item.trim().toLowerCase() === value.toLowerCase())) { await window.customAlert(`"${value}" ya existe.`); return; }
    onUpdate({ ...lists, [key]: [...(lists[key] as string[]), value] });
    setFlatInputs(p => ({ ...p, [key]: '' }));
  };

  const removeFlatItem = (key: FlatKey, item: string) => {
    onUpdate({ ...lists, [key]: (lists[key] as string[]).filter(i => i !== item) });
  };

  /* ─── Knowledge base helpers ─── */
  const processPaste = () => {
    if (isKnowledgeBaseReadOnly) return;
    setParseResult(null);
    const result = parsePaste(pasteText, selectedCategory);
    if ('error' in result) { setParseResult({ type: 'error', msg: result.error }); return; }

    const { entry, warnings } = result;
    const existingIdx = lists.elements.findIndex(e => e.name.trim().toLowerCase() === entry.name.trim().toLowerCase());
    let updatedElements: ElementEntry[];

    if (existingIdx >= 0) {
      // Merge: update recommendations and add new anomalies without removing existing ones
      const existing = lists.elements[existingIdx];
      const incomingByName = new Map(entry.anomalies.map(a => [a.name.trim().toLowerCase(), a]));
      let updatedCount = 0;
      const mergedAnomalies = existing.anomalies.map(existingAnomaly => {
        const normalizedName = existingAnomaly.name.trim().toLowerCase();
        const incoming = incomingByName.get(normalizedName);
        if (!incoming) return existingAnomaly;

        incomingByName.delete(normalizedName);
        if (!incoming.recommendation) return existingAnomaly;

        updatedCount += 1;
        return { ...existingAnomaly, recommendation: incoming.recommendation };
      });
      const newAnomalies = Array.from(incomingByName.values());
      const merged: ElementEntry = { ...existing, category: selectedCategory, anomalies: [...mergedAnomalies, ...newAnomalies] };
      updatedElements = lists.elements.map((e, i) => i === existingIdx ? merged : e);
      setParseResult({
        type: warnings.length ? 'warning' : 'success',
        msg: `Elemento "${entry.name}" actualizado en categoría "${selectedCategory}". ${updatedCount} recomendaciones actualizadas y +${newAnomalies.length} anomalías nuevas. Las recomendaciones existentes no se eliminan por celdas vacías y las anomalías no incluidas se conservaron.${warnings.length ? ' Avisos: ' + warnings.join('; ') : ''}`
      });
    } else {
      updatedElements = [...lists.elements, entry];
      setParseResult({
        type: warnings.length ? 'warning' : 'success',
        msg: `Elemento "${entry.name}" cargado en categoría "${selectedCategory}" con ${entry.anomalies.length} anomalías.${warnings.length ? ' Avisos: ' + warnings.join('; ') : ''}`
      });
    }

    onUpdate({ ...lists, elements: updatedElements });
    setPasteText('');
    setKbExpanded(p => ({ ...p, [entry.name]: true }));
  };

  const removeElement = async (name: string) => {
    if (isKnowledgeBaseReadOnly) return;
    const ok = await window.customConfirm(`¿Eliminar el elemento "${name}" y todas sus anomalías?`);
    if (!ok) return;
    onUpdate({ ...lists, elements: lists.elements.filter(e => e.name !== name) });
  };

  const removeAnomaly = async (elementName: string, anomalyName: string) => {
    if (isKnowledgeBaseReadOnly) return;
    const ok = await window.customConfirm('¿Eliminar esta anomalía y su recomendación asociada?');
    if (!ok) return;
    onUpdate({
      ...lists,
      elements: lists.elements.map(e =>
        e.name === elementName
          ? { ...e, anomalies: e.anomalies.filter(a => a.name !== anomalyName) }
          : e
      )
    });
  };

  const startEditingElement = (element: ElementEntry, index: number) => {
    if (isKnowledgeBaseReadOnly) return;
    setEditingElementIndex(index);
    setEditingElementOriginalName(element.name);
    setElementDraft({
      ...element,
      anomalies: element.anomalies.map(anomaly => ({ ...anomaly }))
    });
    setKbExpanded(previous => ({ ...previous, [element.name]: true }));
  };

  const cancelEditingElement = () => {
    setEditingElementIndex(null);
    setEditingElementOriginalName('');
    setElementDraft(null);
  };

  const saveElementDraft = async () => {
    if (isKnowledgeBaseReadOnly) return;
    if (editingElementIndex === null || !elementDraft) return;

    const elementName = elementDraft.name.trim();
    if (!elementName) {
      await window.customAlert('El nombre del Elemento no puede quedar vacío.');
      return;
    }

    const duplicateElement = lists.elements.some((element, index) =>
      index !== editingElementIndex && element.name.trim().toLowerCase() === elementName.toLowerCase()
    );
    if (duplicateElement) {
      await window.customAlert(`Ya existe otro Elemento con el nombre "${elementName}".`);
      return;
    }

    const seenAnomalies = new Set<string>();
    const normalizedAnomalies: AnomalyEntry[] = [];
    for (const anomaly of elementDraft.anomalies) {
      const anomalyName = anomaly.name.trim();
      if (!anomalyName) {
        await window.customAlert('Ningún nombre de Anomalía puede quedar vacío.');
        return;
      }

      const normalizedName = anomalyName.toLowerCase();
      if (seenAnomalies.has(normalizedName)) {
        await window.customAlert(`Anomalía duplicada en el grupo: "${anomalyName}".`);
        return;
      }
      seenAnomalies.add(normalizedName);
      normalizedAnomalies.push({
        name: anomalyName,
        recommendation: anomaly.recommendation.trim()
      });
    }

    if (normalizedAnomalies.some(anomaly => !anomaly.recommendation)) {
      await window.customAlert('Advertencia: una o más Anomalías quedarán sin Recomendación.');
    }

    const updatedElement: ElementEntry = {
      ...elementDraft,
      name: elementName,
      category: elementDraft.category?.trim() || 'Otros',
      anomalies: normalizedAnomalies
    };

    onUpdate({
      ...lists,
      elements: lists.elements.map((element, index) => index === editingElementIndex ? updatedElement : element)
    });
    setKbExpanded(previous => {
      const next = { ...previous };
      if (editingElementOriginalName !== updatedElement.name) delete next[editingElementOriginalName];
      next[updatedElement.name] = true;
      return next;
    });
    cancelEditingElement();
  };

  /* ─── Styles ─── */
  const tabBtnStyle = (tab: 'lists' | 'knowledge' | 'connection' | 'updates'): React.CSSProperties => ({
    flex: 1, padding: '0.75rem', border: 'none', cursor: 'pointer',
    fontWeight: 700, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px',
    background: activeTab === tab ? 'rgba(0,242,255,0.1)' : 'transparent',
    color: activeTab === tab ? 'var(--primary)' : 'var(--text-secondary)',
    borderBottom: `2px solid ${activeTab === tab ? 'var(--primary)' : 'transparent'}`,
    transition: 'all 0.2s ease'
  });

  const handleCheckUpdate = async () => {
    setUpdateStatus('checking');
    setUpdateMsg('Conectando con GitHub para verificar actualizaciones...');
    try {
      const res = await UpdateManager.checkForUpdates();
      if (res.hasUpdate) {
        setUpdateStatus('available');
        setAvailableVersion(res.version);
        setUpdateUrl(res.url);
        setUpdateMsg(`¡Nueva versión ${res.version} disponible y lista para descargar!`);
      } else {
        setUpdateStatus('up-to-date');
        setUpdateMsg('Tu tablet ya cuenta con la versión más reciente.');
      }
    } catch (e: any) {
      setUpdateStatus('error');
      setUpdateMsg('No se pudo contactar al servidor. ¿Tienes la tablet conectada al WiFi o datos del celular?');
    }
  };

  const handleApplyUpdate = async () => {
    if (!updateUrl) return;
    setUpdateStatus('downloading');
    setUpdateMsg('Descargando parche de sistema... No cierres la aplicación. Se reiniciará sola al terminar.');
    try {
      await UpdateManager.performUpdate(updateUrl, availableVersion);
      // Si llega aquí en web (simulación)
      setUpdateStatus('up-to-date');
      setUpdateMsg(`¡Actualizado con éxito a la versión ${availableVersion}!`);
      // En nativo, la app ya se reinició en la línea de arriba.
    } catch (e: any) {
      setUpdateStatus('error');
      setUpdateMsg('Ocurrió un error al instalar. Inténtalo de nuevo más tarde.');
    }
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: '0.75rem',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '14px', overflow: 'visible'
  };

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 900 }} />

      {/* Panel */}
      <div className="settings-panel" style={{
        position: 'fixed', top: 0, right: 0, width: 'min(440px, 100vw)', maxWidth: '100vw', height: '100dvh',
        background: 'linear-gradient(160deg, #0d1528 0%, #0a0f1e 100%)',
        borderLeft: '1px solid rgba(0,242,255,0.2)', zIndex: 1000,
        display: 'flex', flexDirection: 'column',
        boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
        animation: 'slideInRight 0.3s ease', overflowX: 'hidden'
      }}>

        {/* Header */}
        <div className="settings-header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,242,255,0.03)' }}>
          <div className="settings-header-main" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'rgba(0,242,255,0.1)', padding: '0.5rem', borderRadius: '10px', color: 'var(--primary)' }}>
              <Settings size={20} />
            </div>
            <div className="settings-header-copy">
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Configuración</h2>
              <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Listas y Base de Conocimiento</p>
            </div>
          </div>
          <button className="settings-touch-icon" onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', cursor: 'pointer', padding: '0.4rem', display: 'flex' }}>
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="settings-tabs" style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <button className="settings-tab" onClick={() => setActiveTab('lists')} style={tabBtnStyle('lists')}>
            Listas
          </button>
          <button className="settings-tab" onClick={() => setActiveTab('knowledge')} style={tabBtnStyle('knowledge')}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
              <BookOpen size={14} /> Base C.
            </span>
          </button>
          <button className="settings-tab" onClick={() => setActiveTab('connection')} style={tabBtnStyle('connection')}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
              <Wifi size={14} /> Red
            </span>
          </button>
          <button className="settings-tab" onClick={() => setActiveTab('updates')} style={tabBtnStyle('updates')}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
              <RefreshCcw size={14} /> Sistema
            </span>
          </button>
        </div>

        {/* Content */}
        <div className="settings-content" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '1rem' }}>

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
                className="settings-section-header"
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
                  <div className="settings-flat-add-row" style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <input
                      type="text"
                      value={flatInputs[cat.key]}
                      onChange={e => setFlatInputs(p => ({ ...p, [cat.key]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && addFlatItem(cat.key)}
                      placeholder={cat.placeholder}
                      style={{ flex: 1, minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', fontSize: '0.88rem', padding: '8px 12px' }}
                    />
                    <button
                      onClick={() => addFlatItem(cat.key)}
                      className="settings-touch-icon settings-flat-add"
                      style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))', border: 'none', borderRadius: '10px', color: 'white', cursor: 'pointer', padding: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                    >
                      <Plus size={17} />
                    </button>
                  </div>
                  {(lists[cat.key] as string[]).length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', textAlign: 'center', margin: 0 }}>Sin elementos. Añade el primero ↑</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {(lists[cat.key] as string[]).map(item => (
                        <div className="settings-flat-item" key={item} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '0.45rem 0.75rem' }}>
                          <span className="settings-wrapping-value" style={{ fontSize: '0.88rem', color: cat.key === 'criticalities' ? (criticalityColors[item] || 'white') : 'white', fontWeight: cat.key === 'criticalities' ? 600 : 400 }}>
                            {item}
                          </span>
                          <button className="settings-touch-icon" onClick={() => removeFlatItem(cat.key, item)} style={{ background: 'rgba(255,60,60,0.1)', border: 'none', borderRadius: '6px', color: '#ff6060', cursor: 'pointer', padding: '3px 6px', display: 'flex' }}>
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
              {isKnowledgeBaseReadOnly ? (
                <div style={{ ...sectionStyle, padding: '1rem 1.2rem', border: '1px solid rgba(0,242,255,0.25)', color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.5 }}>
                  La Base de Conocimiento es administrada por Control Central. Puedes consultarla y utilizarla sin conexión.
                </div>
              ) : (
                <div className="settings-mass-upload" style={{ ...sectionStyle, padding: '1.25rem' }}>
                <div className="settings-block-heading" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.9rem' }}>
                  <ClipboardPaste size={18} color="var(--primary)" />
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '0.92rem' }}>Carga Masiva desde Excel</p>
                    <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      Copia la tabla (elemento + anomalías) y pégala aquí
                    </p>
                  </div>
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>
                    Categoría de esta planilla:
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={e => setSelectedCategory(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'black',
                      border: '1px solid rgba(0,242,255,0.3)',
                      color: 'white',
                      fontSize: '0.85rem',
                      padding: '8px 10px',
                      borderRadius: '8px'
                    }}
                  >
                    {INSPECTION_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <textarea
                  value={pasteText}
                  onChange={e => { setPasteText(e.target.value); setParseResult(null); }}
                  placeholder={'Pegar aquí...\n\nFormato esperado (copiado de Excel):\nATADURA\tRecomendaciones\nFaltante\tColocar elemento faltante\nOxidación\tReemplazar elemento\n...'}
                  rows={7}
                  className="settings-paste-area"
                  style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', fontSize: '0.82rem', fontFamily: 'monospace', resize: 'vertical', marginBottom: '0.75rem', overflowX: 'hidden', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                />

                <button
                  onClick={processPaste}
                  disabled={!pasteText.trim()}
                  className="btn-3d settings-primary-action"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.85rem', padding: '0.75rem', opacity: pasteText.trim() ? 1 : 0.4 }}
                >
                  <ClipboardPaste size={16} /> Procesar y Cargar
                </button>

                {/* Parse result feedback */}
                {parseResult && (
                  <div className="settings-parse-result" style={{
                    marginTop: '0.75rem', padding: '0.65rem 0.9rem', borderRadius: '10px',
                    background: parseResult.type === 'error' ? 'rgba(255,60,60,0.12)' : 'rgba(0,255,136,0.08)',
                    border: `1px solid ${parseResult.type === 'error' ? 'rgba(255,60,60,0.3)' : 'rgba(0,255,136,0.25)'}`,
                    display: 'flex', alignItems: 'flex-start', gap: '0.5rem'
                  }}>
                    {parseResult.type === 'error'
                      ? <AlertCircle size={16} color="#ff6060" style={{ flexShrink: 0, marginTop: 2 }} />
                      : <CheckCircle size={16} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
                    }
                    <p className="settings-wrapping-value" style={{ margin: 0, fontSize: '0.78rem', color: parseResult.type === 'error' ? '#ff9090' : '#a0ffc0', lineHeight: 1.4 }}>
                      {parseResult.msg}
                    </p>
                  </div>
                )}
                </div>
              )}

              {/* Loaded elements */}
              <div style={{ marginTop: '0.25rem' }}>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem 0.25rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {lists.elements.length} elemento{lists.elements.length !== 1 ? 's' : ''} cargado{lists.elements.length !== 1 ? 's' : ''}
                </p>

                {lists.elements.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)', fontSize: '0.85rem', background: 'rgba(255,255,255,0.02)', borderRadius: '14px', border: '1px dashed rgba(255,255,255,0.08)' }}>
                    <BookOpen size={32} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                    <p style={{ margin: 0 }}>
                      Sin elementos cargados.
                      {!isKnowledgeBaseReadOnly && <><br />Usa la carga masiva ↑ para importar desde Excel.</>}
                    </p>
                  </div>
                ) : (
                  lists.elements.map((el, elementIndex) => (
                    <div key={el.name} style={sectionStyle}>
                      <div
                        className="settings-kb-header"
                        onClick={() => {
                          if (editingElementIndex !== elementIndex) {
                            setKbExpanded(p => ({ ...p, [el.name]: !p[el.name] }));
                          }
                        }}
                        style={{ width: '100%', padding: '0.85rem 1.2rem', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'white' }}
                      >
                        <div className="settings-kb-heading" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <span className="settings-kb-name" style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--primary)' }}>{el.name}</span>
                          {el.category && (
                            <span style={{
                              background: 'rgba(255,255,255,0.06)',
                              color: '#ffcc00',
                              border: '1px solid rgba(255,200,0,0.3)',
                              borderRadius: '4px',
                              padding: '1px 6px',
                              fontSize: '0.68rem',
                              fontWeight: 700
                            }}>
                              {el.category}
                            </span>
                          )}
                          <span style={{ background: 'rgba(0,242,255,0.12)', color: 'var(--primary)', borderRadius: '20px', padding: '1px 8px', fontSize: '0.72rem', fontWeight: 700 }}>
                            {el.anomalies.length} anomalías
                          </span>
                        </div>
                        <div className="settings-kb-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {!isKnowledgeBaseReadOnly && editingElementIndex !== elementIndex && (
                            <button
                              onClick={e => { e.stopPropagation(); startEditingElement(el, elementIndex); }}
                              disabled={editingElementIndex !== null}
                              title="Editar"
                              className="settings-touch-icon"
                              style={{ background: 'rgba(0,242,255,0.1)', border: 'none', borderRadius: '6px', color: 'var(--primary)', cursor: editingElementIndex === null ? 'pointer' : 'not-allowed', padding: '3px 6px', display: 'flex', opacity: editingElementIndex === null ? 1 : 0.4 }}
                            >
                              <Edit2 size={13} />
                            </button>
                          )}
                          {!isKnowledgeBaseReadOnly && (
                            <button
                              onClick={e => { e.stopPropagation(); removeElement(el.name); }}
                              disabled={editingElementIndex !== null}
                              title="Eliminar Elemento"
                              aria-label="Eliminar Elemento"
                              className="settings-touch-icon"
                              style={{ background: 'rgba(255,60,60,0.1)', border: 'none', borderRadius: '6px', color: '#ff6060', cursor: editingElementIndex === null ? 'pointer' : 'not-allowed', padding: '3px 6px', display: 'flex', opacity: editingElementIndex === null ? 1 : 0.4 }}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                          {kbExpanded[el.name] ? <ChevronUp size={14} color="var(--text-secondary)" /> : <ChevronDown size={14} color="var(--text-secondary)" />}
                        </div>
                      </div>

                      {kbExpanded[el.name] && (
                        <div style={{ padding: '0 1rem 1rem' }}>
                          {!isKnowledgeBaseReadOnly && editingElementIndex === elementIndex && elementDraft ? (
                            <div className="settings-element-editor" style={{ background: 'rgba(0,242,255,0.035)', border: '1px solid rgba(0,242,255,0.16)', borderRadius: '10px', padding: '0.85rem' }}>
                              <div className="settings-element-fields" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(160px, 0.45fr)', gap: '0.65rem', marginBottom: '0.85rem' }}>
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>Elemento</label>
                                  <input
                                    value={elementDraft.name}
                                    onChange={e => setElementDraft({ ...elementDraft, name: e.target.value })}
                                    style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', fontSize: '0.82rem' }}
                                  />
                                </div>
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>Categoría</label>
                                  <select
                                    value={elementDraft.category || 'Otros'}
                                    onChange={e => setElementDraft({ ...elementDraft, category: e.target.value })}
                                    style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', background: 'black', border: '1px solid rgba(0,242,255,0.3)', color: 'white', fontSize: '0.82rem', padding: '8px 10px', borderRadius: '8px' }}
                                  >
                                    {INSPECTION_CATEGORIES.map(category => (
                                      <option key={category} value={category}>{category}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              {elementDraft.anomalies.map((anomaly, anomalyIndex) => (
                                <div className="settings-anomaly-row" key={anomalyIndex} style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 0.8fr) minmax(220px, 1.5fr) auto', gap: '0.5rem', alignItems: 'start', marginBottom: '0.5rem' }}>
                                  <input
                                    value={anomaly.name}
                                    onChange={e => setElementDraft({
                                      ...elementDraft,
                                      anomalies: elementDraft.anomalies.map((item, index) => index === anomalyIndex ? { ...item, name: e.target.value } : item)
                                    })}
                                    placeholder="Anomalía"
                                    style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', fontSize: '0.8rem' }}
                                  />
                                  <textarea
                                    value={anomaly.recommendation}
                                    onChange={e => setElementDraft({
                                      ...elementDraft,
                                      anomalies: elementDraft.anomalies.map((item, index) => index === anomalyIndex ? { ...item, recommendation: e.target.value } : item)
                                    })}
                                    placeholder="Recomendación (opcional)"
                                    rows={2}
                                    style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', fontSize: '0.8rem', resize: 'vertical' }}
                                  />
                                  <button
                                    onClick={() => setElementDraft({ ...elementDraft, anomalies: elementDraft.anomalies.filter((_, index) => index !== anomalyIndex) })}
                                    title="Eliminar anomalía"
                                    className="settings-touch-icon settings-anomaly-delete"
                                    style={{ background: 'rgba(255,60,60,0.08)', border: 'none', borderRadius: '6px', color: '#ff6060', cursor: 'pointer', padding: '7px', display: 'flex' }}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              ))}

                              <button
                                onClick={() => setElementDraft({ ...elementDraft, anomalies: [...elementDraft.anomalies, { name: '', recommendation: '' }] })}
                                className="settings-add-anomaly"
                                style={{ background: 'rgba(0,242,255,0.08)', border: '1px solid rgba(0,242,255,0.2)', borderRadius: '7px', color: 'var(--primary)', cursor: 'pointer', padding: '0.45rem 0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', fontSize: '0.76rem', fontWeight: 700 }}
                              >
                                <Plus size={13} /> Agregar Anomalía
                              </button>

                              <div className="settings-editor-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1rem' }}>
                                <button
                                  onClick={cancelEditingElement}
                                  className="settings-editor-action"
                                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', color: 'white', cursor: 'pointer', padding: '0.55rem 0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.78rem', fontWeight: 700 }}
                                >
                                  <X size={14} /> Cancelar
                                </button>
                                <button
                                  onClick={saveElementDraft}
                                  className="btn-3d settings-editor-action"
                                  style={{ padding: '0.55rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem' }}
                                >
                                  <Save size={14} /> Guardar
                                </button>
                              </div>
                            </div>
                          ) : el.anomalies.map(a => (
                            <div key={a.name} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '0.6rem 0.75rem', marginBottom: '0.4rem' }}>
                              <ChevronRight size={13} color="var(--text-secondary)" style={{ flexShrink: 0, marginTop: 3 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem', color: 'white' }}>{a.name}</p>
                                {a.recommendation && (
                                  <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.45 }}>
                                    → {a.recommendation}
                                  </p>
                                )}
                              </div>
                              {!isKnowledgeBaseReadOnly && (
                                <button
                                  onClick={() => removeAnomaly(el.name, a.name)}
                                  title="Eliminar Anomalía"
                                  aria-label="Eliminar Anomalía"
                                  className="settings-touch-icon"
                                  style={{ background: 'rgba(255,60,60,0.08)', border: 'none', borderRadius: '6px', color: '#ff6060', cursor: 'pointer', padding: '3px 6px', display: 'flex', flexShrink: 0 }}
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
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
                    <h3 style={{ color: 'white', marginTop: 0, marginBottom: '0.5rem' }}>Tu Código QR de Control</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                      Muestra este código a las Unidades de Campo para que se vinculen a tu red.
                    </p>
                    <div style={{ background: 'white', padding: '1rem', display: 'inline-block', borderRadius: '12px' }}>
                      {myServerId ? (
                        <QRCodeSVG value={myServerId} size={200} />
                      ) : (
                        <p style={{color: 'black'}}>Error: No hay ID generado.</p>
                      )}
                    </div>
                  </div>

                  {/* Tarjeta de Compatibilidad Legacy */}
                  <div style={{ 
                    ...sectionStyle, 
                    padding: '1.25rem', 
                    border: '1px dashed rgba(0, 242, 255, 0.4)', 
                    background: 'rgba(0, 242, 255, 0.02)',
                    marginTop: '1rem',
                    marginBottom: '1rem'
                  }}>
                    <h3 style={{ color: 'white', marginTop: 0, marginBottom: '0.5rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      🔌 Compatibilidad: Tablet Antigua
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '1.25rem', lineHeight: '1.4' }}>
                      Si tienes una tablet con una versión anterior que solicita un código de 4 dígitos para enviar reportes, puedes activar la recepción compatible aquí.
                    </p>

                    {legacyActive ? (
                      <div style={{ textAlign: 'center', background: 'rgba(0,0,0,0.5)', padding: '1.25rem', borderRadius: '10px', border: '1px solid #00f2d1' }}>
                        <p style={{ color: '#AAA', fontSize: '0.8rem', margin: '0 0 0.75rem 0' }}>Ingresa este código en la tablet antigua:</p>
                        
                        <div className="settings-legacy-code" style={{ display: 'flex', justifyContent: 'center', gap: '0.6rem', margin: '1rem 0' }}>
                          {legacyCode.split('').map((char, idx) => (
                            <span key={idx} style={{
                              background: 'rgba(0,242,255,0.08)',
                              border: '2px solid #00f2d1',
                              borderRadius: '8px',
                              width: '50px',
                              height: '60px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '2.2rem',
                              fontWeight: 900,
                              color: '#00f2d1',
                              textShadow: '0 0 15px rgba(0,242,255,0.5)'
                            }}>
                              {char}
                            </span>
                          ))}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', margin: '1rem 0 1.25rem 0' }}>
                          <span style={{
                            display: 'inline-block',
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: legacyIsError ? '#ff1744' : (legacyIsSuccess ? '#00ff88' : '#00f2d1'),
                            boxShadow: `0 0 12px ${legacyIsError ? '#ff1744' : (legacyIsSuccess ? '#00ff88' : '#00f2d1')}`,
                            animation: legacyIsSuccess || legacyIsError ? 'none' : 'pulse 1.5s infinite'
                          }} />
                          <span style={{ color: '#E0E0E0', fontSize: '0.85rem', fontWeight: 'bold' }}>{legacyStatus}</span>
                        </div>

                        <button
                          onClick={handleStopLegacy}
                          style={{
                            background: 'rgba(255,68,68,0.1)',
                            border: '1px solid #ff4444',
                            color: '#ff4444',
                            padding: '0.5rem 1rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: 'bold',
                            width: '100%',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,68,68,0.2)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,68,68,0.1)'}
                        >
                          Cancelar Recepción
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleStartLegacy}
                        className="btn-3d"
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          fontSize: '0.85rem',
                          background: 'linear-gradient(135deg, var(--primary), #b89010)',
                          color: 'black',
                          fontWeight: 'bold',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}
                      >
                        Activar Receptor de 4 Dígitos
                      </button>
                    )}
                  </div>

                  <div style={{ ...sectionStyle, padding: '1.25rem' }}>
                    <h3 style={{ color: 'white', marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <ShieldAlert size={18} color="var(--primary)" /> Unidades Conocidas
                    </h3>
                    {knownClients.length === 0 ? (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center' }}>Aún no se ha conectado ninguna Unidad.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {knownClients.map(client => (
                          <div className="settings-known-client" key={client.deviceId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,255,136,0.05)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(0,255,136,0.15)' }}>
                            <div className="settings-known-client-name" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 6px #00ff88' }} />
                              <span className="settings-wrapping-value" style={{ color: 'white', fontWeight: 'bold' }}>{client.deviceName}</span>
                            </div>
                            <button 
                              onClick={() => removeKnownClient(client)}
                              className="settings-known-client-action"
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
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                    Si cambiaste de operación, puedes desvincularte de la Central actual. Deberás escanear el QR de la nueva Central para volver a operar.
                  </p>
                  <p style={{ color: '#ff4444', fontSize: '0.85rem', marginBottom: '2rem', fontWeight: 'bold' }}>
                    ⚠️ ADVERTENCIA: Al desvincularte perderás toda la información registrada localmente. Se recomienda encarecidamente sincronizar y descargar toda tu información desde el Historial antes de continuar.
                  </p>
                  <button
                    onClick={handleUnbindClient}
                    className="btn-3d"
                    style={{ width: '100%', padding: '1rem', background: '#ff4444', color: 'black', fontWeight: 'bold' }}
                  >
                    Desvincular de Control
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ══════ TAB: UPDATES ══════ */}
          {activeTab === 'updates' && (
            <div style={{ padding: '0.5rem' }}>
              <div style={{ ...sectionStyle, padding: '1.5rem', textAlign: 'center', border: '1px solid rgba(0, 242, 255, 0.4)', background: 'rgba(0, 242, 255, 0.05)' }}>
                <h3 style={{ color: 'white', marginTop: 0, marginBottom: '0.5rem' }}>Gestión de Versiones</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                  Este panel permite descargar parches de interfaz y lógica táctica de forma aislada. Sus datos no serán afectados.
                </p>

                <div style={{ background: 'rgba(0,0,0,0.5)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>VERSIÓN ACTUAL INSTALADA</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--primary)', letterSpacing: '2px' }}>{UpdateManager.getCurrentVersion()}</span>
                </div>

                <button
                  onClick={handleCheckUpdate}
                  disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
                  className="btn-3d"
                  style={{
                    width: '100%',
                    padding: '0.8rem',
                    fontSize: '0.85rem',
                    background: 'linear-gradient(135deg, var(--primary), #b89010)',
                    color: 'black',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    marginBottom: '1rem',
                    opacity: (updateStatus === 'checking' || updateStatus === 'downloading') ? 0.6 : 1
                  }}
                >
                  <RefreshCcw size={16} className={updateStatus === 'checking' ? 'spinning' : ''} />
                  Buscar Actualizaciones OTA
                </button>

                {updateStatus === 'available' && (
                  <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(0, 255, 136, 0.1)', border: '1px solid rgba(0, 255, 136, 0.3)', borderRadius: '8px' }}>
                    <p style={{ color: '#00ff88', fontWeight: 'bold', margin: '0 0 1rem 0' }}>{updateMsg}</p>
                    <button
                      onClick={handleApplyUpdate}
                      className="btn-3d"
                      style={{
                        width: '100%',
                        padding: '0.8rem',
                        fontSize: '0.85rem',
                        background: '#00ff88',
                        color: 'black',
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                      }}
                    >
                      <DownloadCloud size={16} /> Descargar e Instalar
                    </button>
                  </div>
                )}

                {(updateStatus === 'up-to-date' || updateStatus === 'error' || updateStatus === 'downloading' || updateStatus === 'checking') && updateMsg && (
                  <div style={{ 
                    marginTop: '1rem', 
                    padding: '0.8rem', 
                    borderRadius: '8px',
                    background: updateStatus === 'error' ? 'rgba(255, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${updateStatus === 'error' ? 'rgba(255, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                    color: updateStatus === 'error' ? '#ff4444' : 'var(--text-secondary)',
                    fontSize: '0.85rem'
                  }}>
                    {updateMsg}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '0.85rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
          Los datos se guardan automáticamente en el dispositivo.
        </div>
      </div>

      <style>{`
        .settings-panel,
        .settings-content,
        .settings-panel * {
          box-sizing: border-box;
        }
        .settings-content {
          max-width: 100%;
          min-width: 0;
          overflow-x: hidden;
        }
        .settings-header {
          flex-wrap: wrap;
          gap: 0.75rem;
        }
        .settings-header-main,
        .settings-header-copy,
        .settings-block-heading > div,
        .settings-known-client-name {
          min-width: 0;
        }
        .settings-header-copy h2,
        .settings-header-copy p,
        .settings-block-heading p,
        .settings-wrapping-value,
        .settings-kb-name,
        .settings-known-client-name span {
          overflow-wrap: anywhere;
          white-space: normal;
        }
        .settings-tabs {
          display: grid !important;
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
        .settings-tab {
          min-width: 0;
          width: 100%;
          min-height: 48px;
          white-space: normal;
          overflow-wrap: anywhere;
        }
        .settings-tab > span {
          min-width: 0;
          flex-wrap: wrap;
        }
        .settings-section-header,
        .settings-kb-header,
        .settings-flat-item,
        .settings-parse-result,
        .settings-known-client {
          min-width: 0;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .settings-kb-heading {
          min-width: 0;
          flex: 1 1 220px;
        }
        .settings-kb-name {
          min-width: 0;
          max-width: 100%;
        }
        .settings-kb-actions {
          flex: 0 0 auto;
          flex-wrap: wrap;
        }
        .settings-touch-icon {
          min-width: 48px;
          min-height: 48px;
          align-items: center;
          justify-content: center;
        }
        .settings-flat-add-row > input,
        .settings-mass-upload select,
        .settings-paste-area,
        .settings-element-editor input,
        .settings-element-editor select,
        .settings-element-editor textarea {
          width: 100%;
          max-width: 100%;
          min-width: 0;
        }
        .settings-element-fields,
        .settings-anomaly-row {
          grid-template-columns: minmax(0, 1fr) !important;
        }
        .settings-anomaly-delete,
        .settings-add-anomaly,
        .settings-primary-action,
        .settings-editor-action,
        .settings-known-client-action {
          min-height: 48px;
        }
        .settings-anomaly-delete,
        .settings-add-anomaly {
          width: 100%;
          justify-content: center;
        }
        .settings-editor-actions {
          flex-wrap: wrap;
        }
        .settings-editor-action {
          flex: 1 1 140px;
          justify-content: center;
        }
        .settings-legacy-code,
        .settings-known-client {
          flex-wrap: wrap;
        }
        .settings-known-client-name {
          flex: 1 1 180px;
        }
        .settings-known-client-action {
          flex: 0 0 auto;
        }
        @media (max-width: 480px) {
          .settings-header {
            padding: 1rem !important;
          }
          .settings-tabs {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .settings-flat-add-row,
          .settings-editor-actions {
            flex-direction: column;
          }
          .settings-flat-add,
          .settings-editor-action,
          .settings-known-client-action {
            width: 100%;
            flex-basis: auto;
          }
          .settings-kb-heading,
          .settings-kb-actions,
          .settings-known-client-name {
            flex-basis: 100%;
          }
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes pulse {
          0% { transform: scale(0.95); opacity: 0.5; box-shadow: 0 0 0 0 rgba(0, 242, 255, 0.4); }
          70% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 8px rgba(0, 242, 255, 0); }
          100% { transform: scale(0.95); opacity: 0.5; box-shadow: 0 0 0 0 rgba(0, 242, 255, 0); }
        }
      `}</style>
    </>
  );
};

export default SettingsPanel;
