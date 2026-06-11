import React from 'react';
import { LayoutDashboard, Plane, Cpu, Download, Clock, Settings, Pencil, RotateCcw, Power, ShieldCheck, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { UpdateManager } from '../services/UpdateManager';
import { formatTime24h, formatDateDMY } from '../utils/dateUtils';

interface DashboardProps {
  data?: any;
  onNavigate: (page: string) => void;
  onSettings: () => void;
  hasActiveShift: boolean;
  hasActiveFlight: boolean;
  activeFlightType?: 'KMS' | 'HS';
  onCloseShift: () => void;
  onReopenShift: () => void;
  hasTodayClosedShift: boolean;
  activeShiftId?: string;
  activeFlightId?: string;
  activeFlightName?: string;
  onEditShift: () => void;
  onEditFlight: () => void;
  onNewFlight: (type: 'KMS' | 'HS') => void;
  onCloseFlight?: (id: string) => void;
  deviceName?: string;
  syncStatus?: string;
  appRole?: string | null;
  currentTheme?: 'hud' | 'boost';
  onChangeTheme?: (theme: 'hud' | 'boost') => void;
  onForceSync?: () => Promise<{ success: boolean; message: string }>;
  lastSyncTimestamp?: string | null;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  data, onNavigate, onSettings, hasActiveShift, hasActiveFlight, activeFlightType, onCloseShift, 
  onReopenShift, hasTodayClosedShift, activeShiftId, activeFlightId,
  onEditShift, onEditFlight, onNewFlight, onCloseFlight, deviceName, syncStatus, appRole,
  currentTheme = 'hud', onChangeTheme, onForceSync, lastSyncTimestamp
}) => {
  const [currentTime, setCurrentTime] = React.useState(new Date());
  const [actionMenu, setActionMenu] = React.useState<'KMS' | 'HS' | null>(null);
  const [isSyncingForced, setIsSyncingForced] = React.useState(false);
  const isKMSActive = hasActiveFlight && activeFlightType === 'KMS';
  const isHSActive = hasActiveFlight && activeFlightType === 'HS';
  const isBatteryEnabled = hasActiveFlight && activeFlightType === 'KMS';

  const handleForceSyncClick = async () => {
    if (isSyncingForced || !onForceSync) return;
    setIsSyncingForced(true);
    try {
      const res = await onForceSync();
      await window.customAlert(res.message);
    } catch (err: any) {
      await window.customAlert(`❌ Error durante la sincronización: ${err.message || err}`);
    } finally {
      setIsSyncingForced(false);
    }
  };

  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ─── Live Metrics & Database Stats Calculation ───
  const activeShift = data?.shifts?.find((s: any) => s.id === activeShiftId);
  const shiftText = activeShift 
    ? `Coord: ${activeShift.coordinator}` 
    : 'Sin jornada activa';
  const shiftSubText = activeShift 
    ? `Móvil: ${activeShift.vehicle || '—'}` 
    : 'Registre base e integrantes';

  // KMS Flights
  const kmsFlightsToday = data?.flights?.filter((f: any) => f.shiftId === activeShiftId && f.flightType === 'KMS') || [];
  const kmsCount = kmsFlightsToday.length;
  const lastKms = kmsFlightsToday[kmsFlightsToday.length - 1];
  const kmsText = kmsCount > 0 ? `${kmsCount} vuelo${kmsCount > 1 ? 's' : ''} registrado${kmsCount > 1 ? 's' : ''}` : 'Sin vuelos cargados';
  const kmsSubText = lastKms ? `Último: ${lastKms.lineName} (${lastKms.timestamp.split(' ')[1] || ''})` : 'Inicie inspección de líneas';

  // HS Tasks
  const hsFlightsToday = data?.flights?.filter((f: any) => f.shiftId === activeShiftId && f.flightType === 'HS') || [];
  const hsCount = hsFlightsToday.length;
  const lastHs = hsFlightsToday[hsFlightsToday.length - 1];
  const hsText = hsCount > 0 ? `${hsCount} tarea${hsCount > 1 ? 's' : ''} registrada${hsCount > 1 ? 's' : ''}` : 'Sin tareas cargadas';
  const hsSubText = lastHs ? `Última: ${lastHs.pilot} (${lastHs.timestamp.split(' ')[1] || ''})` : 'Inicie control por horas';

  // Batteries & Detections (only KMS flight ids)
  const activeFlightIds = (data?.flights?.filter((f: any) => f.shiftId === activeShiftId) || []).map((f: any) => f.id);
  const activeDetections = data?.detections?.filter((d: any) => activeFlightIds.includes(d.flightId)) || [];
  const urgentCount = activeDetections.filter((d: any) => d.criticality === 'Urgente').length;
  const highCount = activeDetections.filter((d: any) => d.criticality === 'Alta').length;
  const detectionsText = activeDetections.length > 0 
    ? `${activeDetections.length} anomalía${activeDetections.length > 1 ? 's' : ''} detectada${activeDetections.length > 1 ? 's' : ''}` 
    : 'Sin novedades';
  const detectionsSubText = urgentCount > 0 
    ? `⚠️ ${urgentCount} Urgente${urgentCount > 1 ? 's' : ''} / ${highCount} Alta${highCount > 1 ? 's' : ''}`
    : activeDetections.length > 0
      ? 'Telemetría y fallas registradas'
      : 'Telemetría y registros de fallas';

  // Checklists (Shift specific)
  const vehicleChecklists = data?.checklists?.filter((c: any) => c.shiftId === activeShiftId) || [];
  const droneChecklists = data?.droneChecklists?.filter((c: any) => c.shiftId === activeShiftId) || [];
  const checklistText = `Vehículo: ${vehicleChecklists.length > 0 ? 'COMPLETO' : 'PENDIENTE'}`;
  const checklistSubText = `Aeronave: ${droneChecklists.length > 0 ? 'COMPLETA' : 'PENDIENTE'}`;

  // History count
  const totalRecords = (data?.shifts?.length || 0) + (data?.flights?.length || 0) + (data?.detections?.length || 0);
  const historyText = `${totalRecords} registro${totalRecords !== 1 ? 's' : ''} en memoria`;

  // ─── SVG High-Tech Telemetry Sine Wave Generator ───
  const renderTelemetryWave = (color: string = 'var(--primary)', dur: string = '4s') => (
    <div className="telemetry-wave" style={{ position: 'absolute', top: '15px', right: '15px', height: '24px', width: '60px', opacity: 0.15, pointerEvents: 'none', overflow: 'hidden' }}>
      <svg viewBox="0 0 60 24" style={{ width: '100%', height: '100%' }}>
        <path
          d="M0 12 C15 3, 15 21, 30 12 C45 3, 45 21, 60 12"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
        >
          <animate
            attributeName="d"
            values="M0 12 C15 3, 15 21, 30 12 C45 3, 45 21, 60 12; M0 12 C15 21, 15 3, 30 12 C45 21, 45 3, 60 12; M0 12 C15 3, 15 21, 30 12 C45 3, 45 21, 60 12"
            dur={dur}
            repeatCount="indefinite"
          />
        </path>
      </svg>
    </div>
  );

  return (
    <div className={`dashboard-container ${currentTheme === 'boost' ? 'boost-mode' : ''}`}>
      <style dangerouslySetInnerHTML={{__html: `
        .dashboard-container {
          width: 95vw;
          max-width: 1100px;
          height: 90vh;
          max-height: 850px;
          margin: 5vh auto;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 2.2rem;
          box-sizing: border-box;
          overflow: hidden;
          background: var(--card-bg);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid var(--glass-border);
          border-radius: 24px;
          box-shadow: 
            var(--shadow-glow),
            0 30px 60px -15px rgba(0, 0, 0, 0.3);
        }
        
        .dashboard-banner {
          width: 100%;
          padding: 1.6rem 2.2rem;
          border-radius: 18px;
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(14, 165, 233, 0.03) 100%);
          border: 1px solid var(--glass-border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
          position: relative;
          overflow: hidden;
        }

        .sunlight-mode .dashboard-banner {
          background: #FFFFFF;
          border: 1.5px solid rgba(15, 23, 42, 0.16);
          box-shadow: 
            0 12px 30px rgba(15, 23, 42, 0.06),
            0 4px 10px rgba(15, 23, 42, 0.03);
        }
        
        .dashboard-banner-title {
          font-size: 2.2rem;
          font-weight: 800;
          margin: 0;
          letter-spacing: -0.5px;
          color: var(--text-primary);
        }
        
        .dashboard-banner-subtitle {
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 3px;
          font-size: 0.72rem;
          margin-bottom: 0.2rem;
          color: var(--primary);
        }

        .dashboard-reopen-banner {
          background: rgba(16, 185, 129, 0.03);
          border: 1px solid rgba(16, 185, 129, 0.15);
          color: var(--primary); 
          padding: 0.6rem 1.2rem;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
          font-size: 0.9rem;
          font-weight: 600;
        }

        .dashboard-clock-section {
          text-align: center;
          margin: 0.5rem 0;
          flex-shrink: 0;
        }
        
        .dashboard-clock-text {
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--text-secondary);
          letter-spacing: 0.5px;
        }
 
        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 1.5rem;
          flex-grow: 1;
          align-content: center;
          margin: 0.75rem 0;
        }
        
        .dashboard-card {
          position: relative;
          background: var(--bg-input);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid var(--border-input);
          border-radius: 18px;
          padding: 1.6rem 1.4rem;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: space-between;
          text-align: left;
          height: 100%;
          min-height: 155px;
          transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: var(--shadow-glow);
          overflow: visible;
        }

        /* Ambient Aura Behind Card */
        .dashboard-card::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 18px;
          background: radial-gradient(circle at 50% 50%, var(--primary-glow) 0%, transparent 70%);
          z-index: -1;
          opacity: 0.15;
          transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .dashboard-card:hover {
          transform: translateY(-4px);
          border-color: rgba(16, 185, 129, 0.25);
          box-shadow: 
            0 20px 40px rgba(0, 0, 0, 0.45),
            0 0 25px rgba(16, 185, 129, 0.05);
        }

        .sunlight-mode .dashboard-card:hover {
          border-color: var(--primary);
          box-shadow: 
            0 20px 40px rgba(15, 23, 42, 0.14),
            0 0 25px rgba(5, 150, 105, 0.05);
        }

        .dashboard-card:hover::before {
          opacity: 0.45;
          inset: -6px;
        }

        .dashboard-card.card-vuelo-activo {
          background: rgba(16, 185, 129, 0.04);
          border-color: var(--primary);
        }

        .dashboard-card.card-vuelo-activo::before {
          background: radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.2) 0%, transparent 70%);
        }

        .dashboard-card.card-vuelo-activo:hover {
          background: rgba(16, 185, 129, 0.08);
          border-color: var(--primary);
          box-shadow: 
            0 20px 40px rgba(0, 0, 0, 0.45),
            0 0 25px rgba(16, 185, 129, 0.15);
        }
        
        .dashboard-card-title {
          font-size: 1.15rem !important;
          font-weight: 800;
          margin: 0;
          color: var(--text-primary);
          letter-spacing: -0.2px;
        }
        
        .dashboard-card-desc {
          color: var(--text-secondary);
          font-size: 0.8rem !important;
          font-weight: 500;
          margin: 0.25rem 0;
          line-height: 1.4;
        }

        .card-icon-wrapper {
          padding: 0.65rem;
          background: var(--primary-glow);
          border-radius: 12px;
          color: var(--primary);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.3s ease;
        }

        .dashboard-card:hover .card-icon-wrapper {
          transform: scale(1.08);
        }

        .card-live-metric {
          align-self: stretch;
          padding: 0.45rem 0.65rem;
          font-size: 0.72rem;
          font-weight: 700;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.02);
          color: var(--text-primary);
          border: 1px solid var(--border-input);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          margin-top: 0.5rem;
        }

        .sunlight-mode .card-live-metric {
          background: #F1F5F9;
          border-color: #CBD5E1;
          color: #0F172A;
        }

        .dashboard-edit-badge {
          position: absolute;
          top: 12px;
          right: 12px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-input);
          border-radius: 8px;
          width: 32px;
          height: 32px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
          transition: all 0.2s ease;
          z-index: 10;
        }

        .dashboard-edit-badge:hover {
          background: var(--primary);
          color: var(--bg-dark);
          border-color: var(--primary);
        }

        .dashboard-req-badge {
          position: absolute; 
          top: 10px; 
          right: 10px; 
          background: rgba(239, 68, 68, 0.1); 
          color: var(--neon-red); 
          padding: 3px 8px; 
          border-radius: 6px; 
          font-size: 0.68rem; 
          font-weight: 800; 
          border: 1px solid rgba(239, 68, 68, 0.15);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          z-index: 5;
        }
        
        .dashboard-footer {
          padding-top: 1rem;
          text-align: center;
          flex-shrink: 0;
        }

        .col-span-2 { grid-column: span 2; }
        .col-span-3 { grid-column: span 3; }

        @media (max-width: 1024px) {
          .dashboard-container {
            width: 100vw;
            height: 100vh;
            max-height: 100vh;
            margin: 0;
            border-radius: 0;
            border: none;
            padding: 1.25rem;
            background: transparent;
            box-shadow: none;
          }
        }

        @media (max-width: 768px) {
          .dashboard-container {
            padding: 0.5rem;
            padding-top: 0.5rem;
          }
          .dashboard-banner {
            padding: 0.75rem;
          }
          .dashboard-banner-title {
            font-size: 1.15rem;
          }
          .dashboard-banner-subtitle {
            font-size: 0.6rem;
          }
          .dashboard-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 0.5rem;
            padding-bottom: 0.5rem;
          }
          .col-span-2 { grid-column: span 1 !important; }
          .col-span-3 { grid-column: span 1 !important; }
          .mobile-full-width { grid-column: span 2 !important; }

          .dashboard-banner {
            border: 1px solid rgba(255, 255, 255, 0.12) !important;
            border-bottom: 3px solid rgba(255, 255, 255, 0.25) !important;
            border-right: 3px solid rgba(255, 255, 255, 0.25) !important;
            box-shadow: 4px 4px 15px rgba(0, 0, 0, 0.5) !important;
          }
          
          .dashboard-top-actions > div, .dashboard-top-actions > button {
            border: 1px solid rgba(255, 255, 255, 0.12) !important;
            border-bottom: 3px solid rgba(255, 255, 255, 0.25) !important;
            border-right: 3px solid rgba(255, 255, 255, 0.25) !important;
            box-shadow: 4px 4px 15px rgba(0, 0, 0, 0.5) !important;
          }

          .dashboard-card {
            padding: 0.6rem;
            min-height: 95px;
            justify-content: space-around;
            border: 1px solid rgba(255, 255, 255, 0.12) !important;
            border-bottom: 3px solid rgba(255, 255, 255, 0.25) !important;
            border-right: 3px solid rgba(255, 255, 255, 0.25) !important;
            box-shadow: 4px 4px 15px rgba(0, 0, 0, 0.5) !important;
            background: var(--bg-dark) !important;
          }
          .dashboard-card-title {
            font-size: 0.85rem !important;
            line-height: 1.1;
          }
          .dashboard-card-desc {
            display: none !important;
          }
          .card-live-metric {
            font-size: 0.6rem;
            padding: 0.3rem 0.4rem;
            margin-top: 0.3rem;
          }
          .card-icon-wrapper {
            padding: 0.4rem;
            width: fit-content;
            margin-bottom: 0.2rem;
          }
          .card-icon-wrapper svg {
            width: 18px;
            height: 18px;
          }
          .dashboard-top-actions {
            position: relative !important;
            top: auto !important;
            right: auto !important;
            width: 100%;
            justify-content: flex-end;
            margin-bottom: 0.5rem;
            flex-wrap: wrap;
          }
          .telemetry-wave {
            display: none !important;
          }
          .flight-actions {
            flex-direction: row !important;
            gap: 0.25rem !important;
            margin-top: 0.25rem;
          }
          .flight-actions > div {
            gap: 0.25rem !important;
            width: auto !important;
            flex: 2;
          }
          .flight-actions button {
            padding: 0.35rem !important;
            flex: 1;
          }
          .action-text {
            display: none !important;
          }
          .dashboard-edit-badge {
            width: 24px !important;
            height: 24px !important;
            top: 6px !important;
            right: 6px !important;
          }
        }
      `}} />

      {/* Modern Banner */}
      <div className="dashboard-banner">
        <div>
          <div className="dashboard-banner-subtitle">
            Sistema de Control Operativo {deviceName ? `| Terminal: ${deviceName}` : ''}
          </div>
          <h1 className="dashboard-banner-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            Hermes II 
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600, border: '1px solid var(--border-input)', padding: '2px 8px', borderRadius: '6px', background: 'var(--bg-dark)' }}>
              {UpdateManager.getCurrentVersion()}
            </span>
          </h1>
        </div>

        {/* Brand identity area */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
          <img src="/logo_horus_nuevo.png" alt="Horus Dron" style={{ height: '36px', opacity: 0.9 }} />
          {appRole && (
            <span style={{
              background: appRole === 'server' ? 'rgba(217, 119, 6, 0.08)' : 'rgba(16, 185, 129, 0.08)',
              color: appRole === 'server' ? 'var(--primary)' : 'var(--neon-green)',
              border: `1px solid ${appRole === 'server' ? 'rgba(217, 119, 6, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '0.68rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}>
              {appRole === 'server' ? '★ CONTROL' : '▲ UNIDAD'}
            </span>
          )}
        </div>
      </div>

      {/* Top-right settings and status */}
      <div className="dashboard-top-actions" style={{ position: 'fixed', top: '1.5rem', right: '1.5rem', display: 'flex', gap: '0.75rem', zIndex: 1000, alignItems: 'center' }}>
        {syncStatus && (
          <div style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-input)',
            borderRadius: '6px',
            color: 'var(--text-primary)',
            padding: '0.6rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: 'var(--shadow-glow)',
            fontWeight: 'bold',
            fontSize: '0.78rem',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)'
          }}>
            <RefreshCw size={14} className={syncStatus.includes('✅') || syncStatus.includes('⚠️') || syncStatus.includes('❌') ? '' : 'spinning'} />
            <span className="sync-label">{syncStatus}</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.3rem', background: 'var(--card-bg)', border: '1px solid var(--border-input)', borderRadius: '8px', padding: '3px', boxShadow: 'var(--shadow-glow)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
          {[
            { id: 'hud', label: '🌙 HUD', title: 'Modo Oscuro' },
            { id: 'boost', label: '⚡ BOOST', title: 'HUD Alto Brillo' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => onChangeTheme && onChangeTheme(t.id as any)}
              style={{
                background: currentTheme === t.id ? 'var(--primary)' : 'transparent',
                border: 'none',
                borderRadius: '5px',
                color: currentTheme === t.id ? '#FFFFFF' : 'var(--text-primary)',
                padding: '0.5rem 0.8rem',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.72rem',
                transition: 'all 0.2s ease',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
              title={t.title}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleForceSyncClick}
          disabled={isSyncingForced}
          style={{
            background: 'rgba(0, 255, 136, 0.1)',
            border: '1px solid rgba(0, 255, 136, 0.5)',
            borderRight: '3px solid rgba(200, 200, 200, 0.5)',
            borderBottom: '3px solid rgba(200, 200, 200, 0.5)',
            borderRadius: '8px',
            color: '#00ff88',
            cursor: isSyncingForced ? 'not-allowed' : 'pointer',
            padding: '0.5rem 0.7rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 15px rgba(0, 255, 136, 0.15)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            opacity: isSyncingForced ? 0.7 : 1,
            minWidth: '54px'
          }}
          title={lastSyncTimestamp ? `ÚLTIMO ENVÍO: ${lastSyncTimestamp}` : 'Forzar Sincronización Directa'}
        >
          <RefreshCw size={20} className={isSyncingForced ? 'spinning' : ''} />
          <span style={{ fontSize: '0.5rem', fontWeight: 800, letterSpacing: '0.3px', textTransform: 'uppercase', lineHeight: 1, opacity: 0.85, whiteSpace: 'nowrap' }}>
            {lastSyncTimestamp ? lastSyncTimestamp : 'SYNC'}
          </span>
        </button>
        <button
          onClick={onSettings}
          style={{
            background: 'rgba(0, 150, 255, 0.1)',
            border: '1px solid rgba(0, 150, 255, 0.5)',
            borderRight: '3px solid rgba(200, 200, 200, 0.5)',
            borderBottom: '3px solid rgba(200, 200, 200, 0.5)',
            borderRadius: '8px',
            color: '#0096ff',
            cursor: 'pointer',
            padding: '0.7rem',
            display: 'flex',
            alignItems: 'center',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 15px rgba(200, 200, 200, 0.25)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)'
          }}
          title="Configuración"
        >
          <Settings size={22} />
        </button>
      </div>

      {/* Reopen shift banner */}
      {!hasActiveShift && hasTodayClosedShift && (
        <div className="dashboard-reopen-banner">
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>⚠️ La jornada de hoy fue cerrada</span>
          <button
            onClick={onReopenShift}
            style={{ 
              background: 'rgba(217, 119, 6, 0.1)', 
              border: '1px solid var(--primary)', 
              color: 'var(--primary)', 
              padding: '0.4rem 0.8rem', 
              borderRadius: '6px', 
              cursor: 'pointer', 
              fontWeight: 'bold',
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              fontSize: '0.8rem'
            }}
          >
            <RotateCcw size={13} /> Reabrir Jornada
          </button>
        </div>
      )}

      {/* Clock & Close Shift section */}
      <div className="dashboard-clock-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
          <Clock size={16} color="var(--text-secondary)" />
          <span className="dashboard-clock-text">
            {formatDateDMY(currentTime)} | {formatTime24h(currentTime)}
          </span>
          {hasActiveShift && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onCloseShift}
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid var(--neon-red)',
                borderRadius: '6px',
                color: 'var(--neon-red)',
                cursor: 'pointer',
                padding: '0.4rem 1rem',
                fontSize: '0.78rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                marginLeft: '1.5rem',
                transition: 'all 0.2s ease'
              }}
            >
              <Power size={13} />
              Cerrar Jornada
            </motion.button>
          )}
        </div>
      </div>

      {/* Cards Grid */}
      <div className="dashboard-grid">
        {/* ─── Inicio de Jornada ─── */}
        <div style={{ position: 'relative' }} className="col-span-2">
          <motion.div
            whileTap={{ scale: 0.98 }}
            onClick={() => hasActiveShift ? onEditShift() : onNavigate('shift')}
            className="dashboard-card"
            style={{ width: '100%', cursor: 'pointer' }}
          >
            {renderTelemetryWave('var(--neon-cyan)', '5s')}
            <div className="card-icon-wrapper">
              <LayoutDashboard size={26} />
            </div>
            <div style={{ width: '100%' }}>
              <h2 className="dashboard-card-title">Inicio de Jornada</h2>
              <p className="dashboard-card-desc">Logística y personal de base.</p>
              {hasActiveShift && (
                <p className="dashboard-card-desc" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0', fontWeight: 600 }}>
                  {shiftSubText}
                </p>
              )}
            </div>
            
            <div className="card-live-metric" style={{
              color: hasActiveShift ? 'var(--neon-green)' : 'var(--text-secondary)',
              borderColor: hasActiveShift ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              background: hasActiveShift ? 'rgba(16, 185, 129, 0.02)' : 'rgba(255, 255, 255, 0.02)'
            }}>
              {shiftText}
            </div>
          </motion.div>
          
          {hasActiveShift && (
            <button
              onClick={(e) => { e.stopPropagation(); onEditShift(); }}
              className="dashboard-edit-badge"
              title="Editar Jornada Activa"
            >
              <Pencil size={14} />
            </button>
          )}
        </div>
 
        {/* ─── Registro Vuelos KMS ─── */}
        <div style={{ position: 'relative' }} className="col-span-2">
          <motion.div
            className={`dashboard-card ${isKMSActive ? 'card-vuelo-activo' : ''}`}
            onClick={() => hasActiveShift ? (isKMSActive ? setActionMenu('KMS') : onNewFlight('KMS')) : undefined}
            style={{ 
              width: '100%', 
              cursor: hasActiveShift ? 'pointer' : 'default',
              opacity: hasActiveShift ? 1 : 0.5
            }}
          >
            {renderTelemetryWave(isKMSActive ? 'var(--neon-green)' : 'var(--primary)', '3s')}
            <div className="card-icon-wrapper" style={{ color: isKMSActive ? 'var(--neon-green)' : 'var(--primary)' }}>
              <Plane size={26} />
            </div>
            <div style={{ width: '100%' }}>
              <h2 className="dashboard-card-title">Vuelos KMS</h2>
              <p className="dashboard-card-desc">Inspección de líneas críticas.</p>
              {hasActiveShift && (
                <p className="dashboard-card-desc" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {kmsSubText}
                </p>
              )}
            </div>

            <div className="card-live-metric">
              {hasActiveShift ? (isKMSActive ? 'VUELO EN CURSO' : kmsText) : 'Jornada Requerida'}
            </div>
          </motion.div>
          
          {!hasActiveShift && (
            <div className="dashboard-req-badge">Requerido</div>
          )}
        </div>

        {/* ─── Registro Vuelos HS ─── */}
        <div style={{ position: 'relative' }} className="col-span-2">
          <motion.div
            className={`dashboard-card ${isHSActive ? 'card-vuelo-activo' : ''}`}
            onClick={() => hasActiveShift ? (isHSActive ? setActionMenu('HS') : onNewFlight('HS')) : undefined}
            style={{ 
              width: '100%', 
              cursor: hasActiveShift ? 'pointer' : 'default',
              opacity: hasActiveShift ? 1 : 0.5
            }}
          >
            {renderTelemetryWave(isHSActive ? 'var(--neon-green)' : 'var(--primary)', '4.5s')}
            <div className="card-icon-wrapper" style={{ color: isHSActive ? 'var(--neon-green)' : 'var(--primary)' }}>
              <Clock size={26} />
            </div>
            <div style={{ width: '100%' }}>
              <h2 className="dashboard-card-title">Vuelos HS</h2>
              <p className="dashboard-card-desc">Registro de tareas por horas.</p>
              {hasActiveShift && (
                <p className="dashboard-card-desc" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {hsSubText}
                </p>
              )}
            </div>

            <div className="card-live-metric">
              {hasActiveShift ? (isHSActive ? 'VUELO EN CURSO' : hsText) : 'Jornada Requerida'}
            </div>
          </motion.div>
          
          {!hasActiveShift && (
            <div className="dashboard-req-badge">Requerido</div>
          )}
        </div>

        {/* ─── Baterías & Detecciones ─── */}
        <div style={{ position: 'relative' }} className="col-span-2">
          <motion.div
            whileTap={isBatteryEnabled ? { scale: 0.98 } : {}}
            onClick={() => isBatteryEnabled && onNavigate('batteries')}
            className="dashboard-card"
            style={{ 
              width: '100%', 
              cursor: isBatteryEnabled ? 'pointer' : 'default',
              opacity: isBatteryEnabled ? 1 : 0.5
            }}
          >
            {isBatteryEnabled && renderTelemetryWave('var(--neon-orange)', '6s')}
            <div className="card-icon-wrapper" style={{ color: isBatteryEnabled ? 'var(--primary)' : 'var(--text-secondary)' }}>
              <Cpu size={26} />
            </div>
            <div style={{ width: '100%' }}>
              <h2 className="dashboard-card-title">Baterías & Anomalías</h2>
              <p className="dashboard-card-desc">Telemetría y fallas detectadas.</p>
              {isBatteryEnabled && (
                <p className="dashboard-card-desc" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0', fontWeight: 600 }}>
                  {detectionsSubText}
                </p>
              )}
            </div>
            
            <div className="card-live-metric" style={{
              color: isBatteryEnabled && activeDetections.length > 0 ? (urgentCount > 0 ? 'var(--neon-red)' : 'var(--primary)') : 'var(--text-secondary)'
            }}>
              {isBatteryEnabled ? detectionsText : 'Vuelo KMS Requerido'}
            </div>
          </motion.div>
          
          {!isBatteryEnabled && (
            <div className="dashboard-req-badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--neon-red)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
              {hasActiveFlight && activeFlightType === 'HS' ? 'SOLO KMS' : 'REQ: VUELO'}
            </div>
          )}
        </div>

        {/* ─── Explorar Historial ─── */}
        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={() => onNavigate('explorer')}
          className="dashboard-card col-span-2"
          style={{ cursor: 'pointer' }}
        >
          {renderTelemetryWave('var(--neon-cyan)', '8s')}
          <div className="card-icon-wrapper">
            <Download size={26} />
          </div>
          <div style={{ width: '100%' }}>
            <h2 className="dashboard-card-title">Explorar Historial</h2>
            <p className="dashboard-card-desc">Auditoría, filtros y exportación.</p>
          </div>
          
          <div className="card-live-metric">
            {historyText}
          </div>
        </motion.div>
 
        {/* ─── Checklist Diario ─── */}
        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={() => onNavigate('checklist')}
          className="dashboard-card col-span-2"
          style={{ cursor: 'pointer' }}
        >
          {renderTelemetryWave('var(--primary)', '7s')}
          <div className="card-icon-wrapper">
            <ShieldCheck size={26} />
          </div>
          <div style={{ width: '100%' }}>
            <h2 className="dashboard-card-title">Checklist Diario</h2>
            <p className="dashboard-card-desc">Inspecciones del vehículo y dron.</p>
          </div>
          
          <div className="card-live-metric" style={{ fontSize: '0.68rem' }}>
            {hasActiveShift ? `${checklistText} | ${checklistSubText}` : 'Jornada Requerida'}
          </div>
        </motion.div>
      </div>
 
      <footer className="dashboard-footer">
        <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '1px', margin: 0 }}>HORUS DRON | INTERFACE</p>
      </footer>

      {actionMenu && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }} onClick={() => setActionMenu(null)}>
          <div style={{ background: 'var(--bg-dark)', padding: '1.5rem', borderRadius: '16px', border: '1.5px solid var(--border-input)', display: 'flex', flexDirection: 'column', gap: '1rem', width: '85%', maxWidth: '350px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: 0, textAlign: 'center', color: 'var(--text-primary)', marginBottom: '0.5rem', fontSize: '1.1rem' }}>Opciones de Vuelo {actionMenu}</h3>
            
            <button onClick={() => { onEditFlight(); setActionMenu(null); }} style={{ padding: '1rem', background: 'rgba(217,119,6,0.1)', color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
              <Pencil size={16} /> Editar vuelo actual
            </button>
            
            <button onClick={() => { onNewFlight(actionMenu); setActionMenu(null); }} style={{ padding: '1rem', background: 'rgba(16,185,129,0.1)', color: 'var(--neon-green)', border: '1px solid var(--neon-green)', borderRadius: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
              {actionMenu === 'KMS' ? <Plane size={16} /> : <Clock size={16} />} Agregar un vuelo nuevo
            </button>
            
            <button onClick={() => { onCloseFlight && activeFlightId && onCloseFlight(activeFlightId); setActionMenu(null); }} style={{ padding: '1rem', background: 'rgba(239,68,68,0.1)', color: 'var(--neon-red)', border: '1px solid var(--neon-red)', borderRadius: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
              <Power size={16} /> Cerrar el vuelo
            </button>
            
            <button onClick={() => setActionMenu(null)} style={{ padding: '1rem', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontWeight: 'bold', marginTop: '0.5rem', fontSize: '0.9rem' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
