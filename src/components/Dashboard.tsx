import React from 'react';
import { LayoutDashboard, Plane, Cpu, Download, Clock, Settings, Pencil, RotateCcw, Power, ShieldCheck, RefreshCw, Radio, Wifi, WifiOff, CheckCircle, Table, FileJson } from 'lucide-react';
import { UpdateManager } from '../services/UpdateManager';
import { formatTime24h, formatDateDMY } from '../utils/dateUtils';
import type { UnitStatus } from '../types';

interface DashboardProps {
  data?: any;
  onNavigate: (page: string, deviceId?: string) => void;
  onSettings: () => void;
  hasActiveShift: boolean;
  hasActiveFlight: boolean;
  activeFlightType?: 'KMS' | 'HS';
  onCloseShift: () => void;
  onReopenShift: () => void;
  hasTodayClosedShift: boolean;
  activeShiftId?: string;
  activeShiftRecordUid?: string;
  activeFlightId?: string;
  activeFlightRecordUid?: string;
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
  unitsStatus?: Map<string, UnitStatus>;
  syncHistory?: { deviceName: string; timestamp: number; kmsCount: number; hsCount: number }[];
  onExport?: () => void;
  onRequestFullBackup?: (deviceName: string, peerId: string) => Promise<void>;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  data, onNavigate, onSettings, hasActiveShift, hasActiveFlight, activeFlightType, onCloseShift, 
  onReopenShift, hasTodayClosedShift, activeShiftId, activeShiftRecordUid, activeFlightRecordUid,
  activeFlightName, onEditShift, onEditFlight, onNewFlight, onCloseFlight, deviceName, syncStatus, appRole,
  currentTheme = 'hud', onChangeTheme, onForceSync, lastSyncTimestamp, unitsStatus,
  syncHistory = [], onExport, onRequestFullBackup
}) => {
  const [currentTime, setCurrentTime] = React.useState(new Date());
  const [actionMenu, setActionMenu] = React.useState<'KMS' | 'HS' | null>(null);
  const [showRecoveryModal, setShowRecoveryModal] = React.useState(false);
  const [isSyncingForced, setIsSyncingForced] = React.useState(false);
  const [loadingBackup, setLoadingBackup] = React.useState<string | null>(null);
  const isKMSActive = hasActiveFlight && activeFlightType === 'KMS';
  const isHSActive = hasActiveFlight && activeFlightType === 'HS';

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
  const activeShift = data?.shifts?.find((s: any) => activeShiftRecordUid ? s.recordUid === activeShiftRecordUid : s.id === activeShiftId);
  const shiftText = activeShift 
    ? `Coord: ${activeShift.coordinator}` 
    : 'Sin jornada activa';
  const shiftSubText = activeShift 
    ? `Móvil: ${activeShift.vehicle || '—'}` 
    : 'Registre base e integrantes';
  const isReopenedShift = hasActiveShift && !!activeShift?.lastClosureEventId;

  // Batteries & Detections (only KMS flight ids)
  const activeFlightUids = (data?.flights?.filter((f: any) => activeShiftRecordUid ? f.shiftRecordUid === activeShiftRecordUid : f.shiftId === activeShiftId) || []).map((f: any) => f.recordUid).filter(Boolean);
  const activeDetections = data?.detections?.filter((d: any) => d.flightRecordUid ? activeFlightUids.includes(d.flightRecordUid) : false) || [];
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

  const todayText = formatDateDMY(currentTime);
  const hasVehicleChecklistToday = !!activeShift?.vehicle && (data?.checklists || []).some((checklist: { vehicleId?: string; timestamp?: string }) =>
    checklist.vehicleId === activeShift.vehicle && checklist.timestamp?.split(' ')[0] === todayText
  );
  const hasDroneChecklistToday = !!activeShift?.drone && (data?.droneChecklists || []).some((checklist: { droneId?: string; timestamp?: string }) =>
    checklist.droneId === activeShift.drone && checklist.timestamp?.split(' ')[0] === todayText
  );

  return (
    <div className={`dashboard-container ${currentTheme === 'boost' ? 'boost-mode' : ''} ${appRole === 'server' ? 'server-mode' : ''}`}>
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
        
        .dashboard-container.server-mode {
          width: 96vw;
          max-width: 1450px;
          height: 94vh;
          max-height: 980px;
          margin: 3vh auto;
          padding: 2.5rem;
        }

        .dashboard-container:not(.server-mode) {
          height: auto;
          min-height: 90vh;
          max-height: none;
          overflow: visible;
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

        @media (max-width: 1024px) and (orientation: portrait), (max-width: 700px) {
          .dashboard-container:not(.server-mode) {
            width: 100vw;
            height: auto;
            min-height: 100dvh;
            max-height: none;
            margin: 0;
            border-radius: 0;
            border: none;
            padding: 1.25rem;
            background: transparent;
            box-shadow: none;
            overflow: visible;
            justify-content: flex-start;
            gap: 1rem;
          }
          .dashboard-container:not(.server-mode) .dashboard-banner {
            flex-wrap: wrap;
            gap: 1rem;
          }
          .dashboard-container:not(.server-mode) .dashboard-banner > * {
            min-width: 0;
          }
          .dashboard-container:not(.server-mode) .dashboard-top-actions {
            position: relative !important;
            top: auto !important;
            right: auto !important;
            width: 100%;
            max-width: 100%;
            flex-wrap: wrap;
            align-items: stretch !important;
            justify-content: flex-end;
          }
          .dashboard-container:not(.server-mode) .dashboard-top-actions > * {
            max-width: 100%;
          }
          .dashboard-container:not(.server-mode) .dashboard-top-actions > div:first-child {
            flex: 1 1 100%;
          }
          .dashboard-container:not(.server-mode) .sync-label,
          .dashboard-container:not(.server-mode) .dashboard-banner-subtitle,
          .dashboard-container:not(.server-mode) .dashboard-card-desc,
          .dashboard-container:not(.server-mode) .card-live-metric {
            white-space: normal !important;
            overflow: visible !important;
            text-overflow: clip !important;
            overflow-wrap: anywhere;
          }
          .dashboard-container:not(.server-mode) .dashboard-reopen-banner {
            flex-wrap: wrap;
            gap: 1rem;
          }
          .dashboard-container:not(.server-mode) .dashboard-clock-row {
            flex-wrap: wrap;
          }
          .dashboard-container:not(.server-mode) .dashboard-close-shift {
            margin-left: 0 !important;
          }
          .dashboard-container:not(.server-mode) .dashboard-grid {
            width: 100%;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            align-content: start;
            flex-grow: 0;
          }
          .dashboard-container:not(.server-mode) .col-span-2,
          .dashboard-container:not(.server-mode) .col-span-3 {
            grid-column: span 1;
          }
          .dashboard-container:not(.server-mode) .dashboard-card-shell {
            min-width: 0;
          }
          .dashboard-container:not(.server-mode) .dashboard-card-shell .dashboard-card {
            padding-right: 4rem;
          }
          .dashboard-container:not(.server-mode) .dashboard-action-overlay {
            padding: 1rem;
            overflow-y: auto;
          }
          .dashboard-container:not(.server-mode) .dashboard-action-dialog {
            max-height: calc(100dvh - 2rem);
            overflow-y: auto;
          }
        }

        @media (max-width: 600px) {
          .dashboard-container:not(.server-mode) {
            padding: 1.25rem;
          }
          .dashboard-container:not(.server-mode) .dashboard-banner {
            flex-direction: column;
            align-items: stretch;
          }
          .dashboard-container:not(.server-mode) .dashboard-brand-area {
            align-items: flex-start !important;
          }
          .dashboard-container:not(.server-mode) .dashboard-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }
          .dashboard-container:not(.server-mode) .col-span-2 { grid-column: span 1 !important; }
          .dashboard-container:not(.server-mode) .col-span-3 { grid-column: span 1 !important; }
          .dashboard-container:not(.server-mode) .mobile-full-width { grid-column: span 1 !important; }

          .dashboard-container:not(.server-mode) .dashboard-banner {
            border: 1px solid rgba(255, 255, 255, 0.12) !important;
            border-bottom: 3px solid rgba(255, 255, 255, 0.25) !important;
            border-right: 3px solid rgba(255, 255, 255, 0.25) !important;
            box-shadow: 4px 4px 15px rgba(0, 0, 0, 0.5) !important;
          }
          
          .dashboard-container:not(.server-mode) .dashboard-top-actions > div,
          .dashboard-container:not(.server-mode) .dashboard-top-actions > button {
            border: 1px solid rgba(255, 255, 255, 0.12) !important;
            border-bottom: 3px solid rgba(255, 255, 255, 0.25) !important;
            border-right: 3px solid rgba(255, 255, 255, 0.25) !important;
            box-shadow: 4px 4px 15px rgba(0, 0, 0, 0.5) !important;
          }

          .dashboard-container:not(.server-mode) .dashboard-card {
            border: 1px solid rgba(255, 255, 255, 0.12) !important;
            border-bottom: 3px solid rgba(255, 255, 255, 0.25) !important;
            border-right: 3px solid rgba(255, 255, 255, 0.25) !important;
            box-shadow: 4px 4px 15px rgba(0, 0, 0, 0.5) !important;
            background: var(--bg-dark) !important;
          }
          .dashboard-container:not(.server-mode) .dashboard-top-actions {
            flex-direction: column;
          }
          .dashboard-container:not(.server-mode) .dashboard-top-actions > * {
            width: 100%;
          }
          .dashboard-container:not(.server-mode) .dashboard-theme-actions {
            justify-content: center;
          }
          .dashboard-container:not(.server-mode) .dashboard-reopen-banner,
          .dashboard-container:not(.server-mode) .dashboard-clock-row {
            flex-direction: column;
            align-items: stretch !important;
          }
          .dashboard-container:not(.server-mode) .dashboard-reopen-banner button,
          .dashboard-container:not(.server-mode) .dashboard-close-shift {
            width: 100%;
            justify-content: center;
          }
          .dashboard-container:not(.server-mode) .telemetry-wave {
            display: none !important;
          }
          .dashboard-container:not(.server-mode) .flight-actions {
            flex-direction: column !important;
          }
          .dashboard-container:not(.server-mode) .flight-actions > div {
            width: 100% !important;
            flex-wrap: wrap;
          }
          .dashboard-container:not(.server-mode) .flight-actions button {
            min-width: 100%;
          }
        }
        @media (min-width: 701px) and (orientation: landscape) and (max-height: 700px) {
          .dashboard-container:not(.server-mode) {
            height: auto;
            min-height: 100dvh;
            max-height: none;
            overflow: visible;
          }
        }
        /* ─── Units Telemetry Panel (server only) ─── */
        .units-panel {
          width: 100%;
          background: rgba(0, 242, 255, 0.02);
          border: 1px solid rgba(0, 242, 255, 0.12);
          border-radius: 16px;
          padding: 1rem 1.25rem;
          flex-shrink: 0;
          box-sizing: border-box;
        }
        .units-panel-header {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          margin-bottom: 0.75rem;
        }
        .units-panel-title {
          font-size: 0.7rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 2px;
          color: var(--primary);
        }
        .units-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
          gap: 0.6rem;
        }
        .unit-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 0.75rem 0.9rem;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          transition: border-color 0.3s ease, background 0.3s ease;
          position: relative;
          overflow: hidden;
        }
        .unit-card.unit-online {
          border-color: rgba(0, 255, 136, 0.2);
          background: rgba(0, 255, 136, 0.03);
        }
        .unit-card.unit-offline {
          border-color: rgba(255, 60, 60, 0.15);
          opacity: 0.65;
        }
        .unit-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
        }
        .unit-name {
          font-size: 0.85rem;
          font-weight: 800;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .unit-status-badge {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          font-size: 0.62rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 2px 7px;
          border-radius: 4px;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .unit-status-badge.online {
          background: rgba(0, 255, 136, 0.1);
          color: #00ff88;
          border: 1px solid rgba(0, 255, 136, 0.3);
        }
        .unit-status-badge.offline {
          background: rgba(255, 60, 60, 0.1);
          color: #ff6060;
          border: 1px solid rgba(255, 60, 60, 0.25);
        }
        .unit-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .unit-dot.online {
          background: #00ff88;
          box-shadow: 0 0 6px #00ff88;
          animation: pulse 1.5s infinite;
        }
        .unit-dot.offline {
          background: #ff6060;
        }
        .unit-meta-row {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.7rem;
          color: var(--text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .unit-meta-row.active-value {
          color: var(--neon-green);
          font-weight: 700;
        }
        .unit-stats-row {
          display: flex;
          gap: 0.4rem;
          margin-top: 0.2rem;
          flex-wrap: wrap;
        }
        .unit-stat-chip {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.62rem;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .unit-stat-chip.has-value {
          background: rgba(0, 242, 255, 0.06);
          border-color: rgba(0, 242, 255, 0.2);
          color: var(--primary);
        }
        .unit-stat-chip.flight-active {
          background: rgba(0, 255, 136, 0.08);
          border-color: rgba(0, 255, 136, 0.25);
          color: #00ff88;
          animation: pulse-border 2s infinite;
        }
        @keyframes pulse-border {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0,255,136,0.3); }
          50% { box-shadow: 0 0 0 3px rgba(0,255,136,0.0); }
        }
        .unit-no-shift {
          font-size: 0.7rem;
          color: var(--text-secondary);
          font-style: italic;
          opacity: 0.7;
        }
        .units-empty {
          text-align: center;
          padding: 0.9rem;
          color: var(--text-secondary);
          font-size: 0.78rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          opacity: 0.6;
        }
        @media (max-width: 768px) {
          .units-panel {
            display: none;
          }
        }

        .field-operation-panel {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          flex: 1 1 auto;
          min-height: 0;
          margin: 0.75rem 0;
        }
        .field-situation {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 1rem 1.2rem;
          border: 1px solid var(--border-input);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.025);
        }
        .field-situation-main {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .field-situation-label,
        .field-actions-label {
          color: var(--text-secondary);
          font-size: 0.68rem;
          font-weight: 900;
          letter-spacing: 1.4px;
          text-transform: uppercase;
        }
        .field-situation-title {
          margin: 0;
          color: var(--text-primary);
          font-size: 1.18rem;
          font-weight: 900;
          overflow-wrap: anywhere;
        }
        .field-situation-detail {
          margin: 0;
          color: var(--text-secondary);
          font-size: 0.82rem;
          font-weight: 600;
          overflow-wrap: anywhere;
        }
        .field-situation-status {
          flex: 0 0 auto;
          padding: 0.45rem 0.7rem;
          border: 1px solid rgba(16, 185, 129, 0.3);
          border-radius: 999px;
          color: var(--neon-green);
          background: rgba(16, 185, 129, 0.07);
          font-size: 0.7rem;
          font-weight: 900;
          letter-spacing: 0.7px;
          text-transform: uppercase;
        }
        .field-situation-status.closed {
          color: var(--primary);
          border-color: rgba(217, 119, 6, 0.35);
          background: rgba(217, 119, 6, 0.08);
        }
        .field-next-actions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1rem;
        }
        .field-next-actions.single {
          grid-template-columns: minmax(0, 1fr);
        }
        .field-primary-action,
        .field-secondary-action {
          min-width: 0;
          min-height: 56px;
          border-radius: 12px;
          cursor: pointer;
          font: inherit;
          font-weight: 900;
          transition: transform 0.15s ease, border-color 0.2s ease, background 0.2s ease;
        }
        .field-primary-action {
          display: flex;
          align-items: center;
          gap: 0.9rem;
          padding: 1.15rem 1.25rem;
          border: 1.5px solid var(--primary);
          background: rgba(16, 185, 129, 0.08);
          color: var(--text-primary);
          text-align: left;
          box-shadow: 0 8px 24px rgba(16, 185, 129, 0.08);
        }
        .field-primary-action strong,
        .field-primary-action span {
          display: block;
          min-width: 0;
          overflow-wrap: anywhere;
        }
        .field-secondary-action.checklist-summary {
          align-items: flex-start;
          flex-direction: column;
          gap: 0.25rem;
          text-align: left;
        }
        .field-secondary-action-title {
          display: flex;
          align-items: center;
          gap: 0.45rem;
        }
        .field-checklist-status {
          color: var(--text-secondary);
          font-size: 0.68rem;
          font-weight: 700;
          line-height: 1.35;
        }
        .field-checklist-status .complete {
          color: var(--neon-green);
        }
        .field-primary-action span {
          margin-top: 0.2rem;
          color: var(--text-secondary);
          font-size: 0.76rem;
          font-weight: 600;
        }
        .field-primary-action svg,
        .field-secondary-action svg {
          flex: 0 0 auto;
        }
        .field-primary-action:active,
        .field-secondary-action:active {
          transform: scale(0.98);
        }
        .field-secondary-section {
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
        }
        .field-secondary-actions {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: 0.65rem;
        }
        .field-secondary-action {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;
          padding: 0.75rem;
          border: 1px solid var(--border-input);
          background: var(--bg-input);
          color: var(--text-primary);
          font-size: 0.76rem;
          white-space: normal;
          overflow-wrap: anywhere;
        }
        .field-secondary-action.danger {
          color: var(--neon-red);
          border-color: rgba(239, 68, 68, 0.35);
          background: rgba(239, 68, 68, 0.06);
        }
        @media (max-width: 1024px) and (orientation: portrait), (max-width: 700px) {
          .field-operation-panel {
            flex: 0 0 auto;
            margin: 0;
          }
          .field-secondary-actions {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .field-secondary-action:last-child:nth-child(odd) {
            grid-column: 1 / -1;
          }
        }
        @media (max-width: 600px) {
          .field-situation {
            align-items: flex-start;
            flex-direction: column;
          }
          .field-next-actions {
            grid-template-columns: minmax(0, 1fr);
          }
          .field-primary-action {
            width: 100%;
          }
          .field-secondary-actions {
            grid-template-columns: minmax(0, 1fr);
          }
          .field-secondary-action,
          .field-secondary-action:last-child:nth-child(odd) {
            grid-column: auto;
            width: 100%;
          }
        }
        @media (min-width: 701px) and (orientation: landscape) and (max-height: 700px) {
          .field-operation-panel {
            flex: 0 0 auto;
          }
          .field-situation {
            padding: 0.75rem 1rem;
          }
          .field-primary-action {
            padding: 0.85rem 1rem;
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
        <div className="dashboard-brand-area" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
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
        <div className="dashboard-theme-actions" style={{ display: 'flex', gap: '0.3rem', background: 'var(--card-bg)', border: '1px solid var(--border-input)', borderRadius: '8px', padding: '3px', boxShadow: 'var(--shadow-glow)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
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

      {/* Clock */}
      {appRole !== 'server' && (
        <div className="dashboard-clock-section">
        <div className="dashboard-clock-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
          <Clock size={16} color="var(--text-secondary)" />
          <span className="dashboard-clock-text">
            {formatDateDMY(currentTime)} | {formatTime24h(currentTime)}
          </span>
        </div>
      </div>
      )}

      {/* Field: current situation, next action and secondary actions */}
      {appRole !== 'server' && (
        <main className="field-operation-panel">
          <section className="field-situation" aria-label="Situación actual">
            <div className="field-situation-main">
              <span className="field-situation-label">Situación actual</span>
              <h2 className="field-situation-title">
                {hasTodayClosedShift && !hasActiveShift
                  ? 'Jornada finalizada'
                  : isKMSActive
                    ? `KMS activo${activeFlightName ? ` · ${activeFlightName}` : ''}`
                    : isHSActive
                      ? `HS activo${activeFlightName ? ` · ${activeFlightName}` : ''}`
                      : hasActiveShift
                        ? `${isReopenedShift ? 'Jornada reabierta' : 'Jornada activa'} · Sin vuelo`
                        : 'Sin jornada activa'}
              </h2>
              <p className="field-situation-detail">
                {hasActiveShift
                  ? `${shiftText} · ${shiftSubText}`
                  : hasTodayClosedShift
                    ? 'La jornada de hoy está cerrada. Puedes reabrirla o iniciar una nueva.'
                    : 'Inicia la jornada para habilitar los vuelos KMS y HS.'}
              </p>
            </div>
            <span className={`field-situation-status ${hasTodayClosedShift && !hasActiveShift ? 'closed' : ''}`}>
              {hasTodayClosedShift && !hasActiveShift ? 'Finalizada' : isReopenedShift ? 'Reabierta' : hasActiveShift ? 'En operación' : 'Pendiente'}
            </span>
          </section>

          <span className="field-actions-label">Siguiente acción</span>

          {!hasActiveShift && (
            <div className="field-next-actions single">
              {hasTodayClosedShift && (
                <button type="button" className="field-primary-action" onClick={onReopenShift}>
                  <RotateCcw size={26} />
                  <span><strong>REABRIR JORNADA</strong>Recuperar la operación cerrada hoy</span>
                </button>
              )}
              {!hasTodayClosedShift && (
                <button type="button" className="field-primary-action" onClick={() => onNavigate('shift')}>
                  <LayoutDashboard size={26} />
                  <span><strong>INICIAR JORNADA</strong>Definir cliente, equipo y movilidad</span>
                </button>
              )}
            </div>
          )}

          {hasActiveShift && !hasActiveFlight && (
            <div className="field-next-actions">
              <button type="button" className="field-primary-action" onClick={() => onNewFlight('KMS')}>
                <Plane size={26} />
                <span><strong>INICIAR KMS</strong>Inspección de líneas</span>
              </button>
              <button type="button" className="field-primary-action" onClick={() => onNewFlight('HS')}>
                <Clock size={26} />
                <span><strong>INICIAR HS</strong>Registro de tareas por horas</span>
              </button>
            </div>
          )}

          {isKMSActive && (
            <div className="field-next-actions single">
              <button type="button" className="field-primary-action" onClick={() => onNavigate('batteries')}>
                <Cpu size={26} />
                <span><strong>BATERÍAS Y DETECCIONES</strong>{detectionsText} · {detectionsSubText}</span>
              </button>
            </div>
          )}

          {isHSActive && (
            <div className="field-next-actions single">
              <button type="button" className="field-primary-action" onClick={() => setActionMenu('HS')}>
                <Clock size={26} />
                <span><strong>GESTIONAR VUELO HS</strong>Editar, agregar otro vuelo o cerrar el actual</span>
              </button>
            </div>
          )}

          <section className="field-secondary-section" aria-label="Acciones secundarias">
            <span className="field-actions-label">Acciones secundarias</span>
            <div className="field-secondary-actions">
              {!hasActiveShift && hasTodayClosedShift && (
                <button type="button" className="field-secondary-action" onClick={() => onNavigate('shift')}>
                  <LayoutDashboard size={17} /> Iniciar otra Jornada
                </button>
              )}
              {hasActiveShift && (
                <button type="button" className="field-secondary-action" onClick={onEditShift}>
                  <Pencil size={17} /> Editar Jornada
                </button>
              )}
              {isKMSActive && (
                <>
                  <button type="button" className="field-secondary-action" onClick={() => setActionMenu('KMS')}>
                    <Plane size={17} /> Gestionar KMS
                  </button>
                  <button type="button" className="field-secondary-action" onClick={() => onNewFlight('HS')}>
                    <Clock size={17} /> Iniciar HS
                  </button>
                </>
              )}
              {isHSActive && (
                <button type="button" className="field-secondary-action" onClick={() => onNewFlight('KMS')}>
                  <Plane size={17} /> Iniciar KMS
                </button>
              )}
              <button type="button" className="field-secondary-action checklist-summary" onClick={() => onNavigate('checklist')}>
                <span className="field-secondary-action-title"><ShieldCheck size={17} /> Checklist</span>
                {hasActiveShift && (
                  <span className="field-checklist-status">
                    Vehículo: <span className={hasVehicleChecklistToday ? 'complete' : ''}>{hasVehicleChecklistToday ? '✓ Registrado' : 'Pendiente'}</span>
                    {' · '}Dron: <span className={hasDroneChecklistToday ? 'complete' : ''}>{hasDroneChecklistToday ? '✓ Registrado' : 'Pendiente'}</span>
                  </span>
                )}
              </button>
              <button type="button" className="field-secondary-action" onClick={() => onNavigate('explorer')}>
                <Download size={17} /> Registros
              </button>
              {hasActiveShift && (
                <button type="button" className="field-secondary-action danger" onClick={onCloseShift}>
                  <Power size={17} /> Cerrar Jornada
                </button>
              )}
            </div>
          </section>
        </main>
      )}

      {/* ─── SERVER DASHBOARD (PC/CONTROL) ─── */}
      {appRole === 'server' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', boxSizing: 'border-box', marginTop: '1rem' }}>
          
          {/* Top stats block */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '1px' }}>Jornadas Activas</span>
              <span style={{ fontSize: '3.2rem', fontWeight: 900, color: 'var(--primary)', lineHeight: 1.1 }}>
                {unitsStatus ? Array.from(unitsStatus.values()).filter(u => u.hasActiveShift && u.connected).length : 0}
              </span>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>de {unitsStatus ? unitsStatus.size : 0} unidades conocidas</span>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '1px' }}>Vuelos en Curso</span>
              <span style={{ fontSize: '3.2rem', fontWeight: 900, color: '#00ff88', lineHeight: 1.1 }}>
                {unitsStatus ? Array.from(unitsStatus.values()).filter(u => u.hasActiveFlight && u.connected).length : 0}
              </span>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>monitoreando en vivo</span>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '1px' }}>Total Vuelos del Día</span>
              <span style={{ fontSize: '3.2rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.1 }}>
                {unitsStatus ? Array.from(unitsStatus.values()).reduce((sum, u) => sum + u.kmsCount + u.hsCount, 0) : 0}
              </span>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>KMS y HS consolidados</span>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '1px' }}>Detecciones/Alertas</span>
              <span style={{ fontSize: '3.2rem', fontWeight: 900, color: 'var(--neon-red)', lineHeight: 1.1 }}>
                {unitsStatus ? Array.from(unitsStatus.values()).reduce((sum, u) => sum + u.detectionsCount, 0) : 0}
              </span>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>anomalías críticas</span>
            </div>
          </div>

          {/* Main layout grid for Server */}
          <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr', gap: '1.5rem' }} className="server-main-grid">
            
            {/* Left: Telemetry Panel */}
            <div className="units-panel" style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.06)', padding: '1.5rem' }}>
              <div className="units-panel-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '1rem', marginBottom: '1.2rem' }}>
                <Radio size={18} color="var(--primary)" />
                <span className="units-panel-title" style={{ fontSize: '1.15rem' }}>Telemetría de Flota</span>
                {unitsStatus && unitsStatus.size > 0 && (
                  <span style={{ marginLeft: 'auto', fontSize: '0.95rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
                    {Array.from(unitsStatus.values()).filter(u => u.connected).length} / {unitsStatus.size} Conectados
                  </span>
                )}
              </div>

              {(!unitsStatus || unitsStatus.size === 0) ? (
                <div className="units-empty" style={{ padding: '4rem 1rem', fontSize: '1rem' }}>
                  <WifiOff size={28} style={{ opacity: 0.5 }} />
                  <span>Esperando vinculación y reporte de unidades de campo...</span>
                </div>
              ) : (
                <div className="units-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: '1.2rem' }}>
                  {Array.from(unitsStatus.values()).map(unit => {
                    const isOnline = unit.connected;
                    const flightLabel = unit.hasActiveFlight
                      ? unit.activeFlightType === 'KMS'
                        ? `KMS: ${unit.activeFlightName || '—'}`
                        : `HS: ${unit.activeFlightName || '—'}`
                      : null;
                    return (
                      <div key={unit.deviceId || unit.deviceName} className={`unit-card ${isOnline ? 'unit-online' : 'unit-offline'}`} style={{ padding: '1.5rem', border: `1.5px solid ${isOnline ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255, 255, 255, 0.05)'}`, background: isOnline ? 'rgba(0, 255, 136, 0.01)' : 'rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        <div className="unit-card-header" style={{ marginBottom: '0.2rem' }}>
                          <span className="unit-name" style={{ fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {unit.deviceName}
                            {unit.appVersion && (
                              <span style={{ fontSize: '0.75rem', opacity: 0.6, background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 'normal' }}>
                                {unit.appVersion}
                              </span>
                            )}
                          </span>
                          <span className={`unit-status-badge ${isOnline ? 'online' : 'offline'}`} style={{ fontSize: '0.8rem', padding: '4px 10px' }}>
                            <span className={`unit-dot ${isOnline ? 'online' : 'offline'}`} style={{ width: '9px', height: '9px' }} />
                            {isOnline ? 'En línea' : 'Sin señal'}
                          </span>
                        </div>

                        {unit.hasActiveShift ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div className="unit-meta-row active-value" style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Wifi size={15} />
                              <span>Coord: {unit.coordinator || '—'}</span>
                            </div>
                            {unit.vehicle && (
                              <div className="unit-meta-row" style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>🚗 {unit.vehicle}</span>
                                {unit.drone && <span> | 🚁 {unit.drone}</span>}
                              </div>
                            )}

                            {flightLabel && (
                              <div className="unit-meta-row" style={{ color: '#00ff88', fontWeight: 800, fontSize: '1.05rem', background: 'rgba(0,255,136,0.05)', padding: '6px 12px', borderRadius: '6px', marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Plane size={15} className="spinning" />
                                <span>{flightLabel}</span>
                              </div>
                            )}

                            <div className="unit-stats-row" style={{ marginTop: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '0.8rem', gap: '0.6rem' }}>
                              <span className={`unit-stat-chip ${unit.kmsCount > 0 ? 'has-value' : ''}`} style={{ fontSize: '0.88rem', padding: '5px 12px' }}>
                                <Plane size={13} /> KMS {unit.kmsCount}
                              </span>
                              <span className={`unit-stat-chip ${unit.hsCount > 0 ? 'has-value' : ''}`} style={{ fontSize: '0.88rem', padding: '5px 12px' }}>
                                <Clock size={13} /> HS {unit.hsCount}
                              </span>
                              {unit.detectionsCount > 0 && (
                                <span className="unit-stat-chip has-value" style={{ color: 'var(--neon-red)', borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', fontSize: '0.88rem', padding: '5px 12px' }}>
                                  ⚠ {unit.detectionsCount}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="unit-no-shift" style={{ marginTop: '0.6rem', fontSize: '1.05rem' }}>Sin jornada activa</span>
                        )}
                        <button
                          type="button"
                          onClick={() => onNavigate('explorer', unit.deviceId)}
                          style={{
                            width: '100%',
                            minHeight: '48px',
                            marginTop: '0.65rem',
                            padding: '0.75rem 1rem',
                            borderRadius: '8px',
                            border: '1px solid var(--primary)',
                            background: 'rgba(0, 242, 255, 0.06)',
                            color: 'var(--primary)',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          Ver Registros
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right: Actions & Sync Feed */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: '720px', overflowY: 'auto', paddingRight: '8px' }}>
              
              {/* Control Actions Box */}
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-input)', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--primary)' }}>Acciones de Control</span>
                
                <button
                  onClick={() => onNavigate('explorer')}
                  style={{
                    width: '100%',
                    padding: '1.1rem',
                    background: 'rgba(0, 242, 255, 0.05)',
                    border: '1.5px solid var(--primary)',
                    borderRadius: '10px',
                    color: 'var(--text-primary)',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.6rem',
                    fontSize: '1.05rem',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 15px rgba(0, 242, 255, 0.05)'
                  }}
                >
                  <Download size={18} /> Explorar Registros
                </button>

                <button
                  onClick={onExport}
                  style={{
                    width: '100%',
                    padding: '1.1rem',
                    background: 'rgba(0, 255, 136, 0.05)',
                    border: '1.5px solid rgba(0, 255, 136, 0.4)',
                    borderRadius: '10px',
                    color: '#00ff88',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.6rem',
                    fontSize: '1.05rem',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 15px rgba(0, 255, 136, 0.05)'
                  }}
                >
                  <Table size={18} /> Exportar Reportes
                </button>

                <button
                  onClick={() => setShowRecoveryModal(true)}
                  style={{
                    width: '100%',
                    padding: '1.1rem',
                    background: 'rgba(255, 159, 67, 0.05)',
                    border: '1.5px solid rgba(255, 159, 67, 0.4)',
                    borderRadius: '10px',
                    color: '#ff9f43',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.6rem',
                    fontSize: '1.05rem',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 15px rgba(255, 159, 67, 0.05)'
                  }}
                >
                  <RefreshCw size={18} /> Recuperar Dispositivo
                </button>

                <button
                  onClick={() => onNavigate('backup-viewer')}
                  style={{
                    width: '100%',
                    padding: '1.1rem',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1.5px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '10px',
                    color: 'var(--text-primary)',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.6rem',
                    fontSize: '1.05rem',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 15px rgba(255, 255, 255, 0.02)'
                  }}
                >
                  <FileJson size={18} /> Visualizar Respaldos
                </button>
              </div>

              {/* Recent Sync Feed */}
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-input)', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '260px', minHeight: '150px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--primary)' }}>Sincronizaciones</span>
                
                {(!syncHistory || syncHistory.length === 0) ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center', padding: '1rem' }}>
                    Ningún dato recibido todavía hoy.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', overflowY: 'auto', maxHeight: '160px', paddingRight: '4px' }}>
                    {syncHistory.map((s, idx) => {
                      const timeStr = new Date(s.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
                      const totalReceived = s.kmsCount + s.hsCount;
                      return (
                        <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>{s.deviceName}</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{timeStr}</span>
                          </div>
                          <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <CheckCircle size={12} color="#00ff88" />
                            <span>Recibido: {totalReceived > 0 ? `${totalReceived} vuelos` : 'datos de jornada'}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      <footer className="dashboard-footer">
        <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '1px', margin: 0 }}>HORUS DRON | INTERFACE</p>
      </footer>

      {actionMenu && (
        <div className="dashboard-action-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }} onClick={() => setActionMenu(null)}>
          <div className="dashboard-action-dialog" style={{ background: 'var(--bg-dark)', padding: '1.5rem', borderRadius: '16px', border: '1.5px solid var(--border-input)', display: 'flex', flexDirection: 'column', gap: '1rem', width: '85%', maxWidth: '350px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: 0, textAlign: 'center', color: 'var(--text-primary)', marginBottom: '0.5rem', fontSize: '1.1rem' }}>Opciones de Vuelo {actionMenu}</h3>
            
            <button onClick={() => { onEditFlight(); setActionMenu(null); }} style={{ padding: '1rem', background: 'rgba(217,119,6,0.1)', color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
              <Pencil size={16} /> Editar vuelo actual
            </button>
            
            <button onClick={() => { onNewFlight(actionMenu); setActionMenu(null); }} style={{ padding: '1rem', background: 'rgba(16,185,129,0.1)', color: 'var(--neon-green)', border: '1px solid var(--neon-green)', borderRadius: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
              {actionMenu === 'KMS' ? <Plane size={16} /> : <Clock size={16} />} Agregar un vuelo nuevo
            </button>
            
            <button onClick={() => { onCloseFlight && activeFlightRecordUid && onCloseFlight(activeFlightRecordUid); setActionMenu(null); }} style={{ padding: '1rem', background: 'rgba(239,68,68,0.1)', color: 'var(--neon-red)', border: '1px solid var(--neon-red)', borderRadius: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
              <Power size={16} /> Cerrar el vuelo
            </button>
            
            <button onClick={() => setActionMenu(null)} style={{ padding: '1rem', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontWeight: 'bold', marginTop: '0.5rem', fontSize: '0.9rem' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {showRecoveryModal && (
        <div 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: 'rgba(0,0,0,0.85)', 
            zIndex: 9999, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            backdropFilter: 'blur(10px)' 
          }} 
          onClick={() => setShowRecoveryModal(false)}
        >
          <div 
            style={{ 
              background: 'var(--bg-dark)', 
              padding: '2.2rem', 
              borderRadius: '20px', 
              border: '1.5px solid rgba(255, 159, 67, 0.3)', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '1.2rem', 
              width: '90%', 
              maxWidth: '520px', 
              boxShadow: '0 15px 40px rgba(0, 0, 0, 0.6), 0 0 20px rgba(255, 159, 67, 0.05)' 
            }} 
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem' }}>
              <RefreshCw size={24} color="#ff9f43" />
              <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.3rem', fontWeight: 800 }}>Recuperación de Dispositivos</h3>
            </div>
            
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Solicita y descarga un respaldo completo de todos los registros históricos almacenados en la tablet seleccionada. Los datos se guardan en un archivo JSON independiente en tu PC.
            </p>

            {/* Estado de sincronización/recuperación en tiempo real */}
            {syncStatus && (syncStatus.includes('copia') || syncStatus.includes('Copia') || syncStatus.includes('recuper') || syncStatus.includes('Recuper')) && (
              <div style={{ 
                background: 'rgba(255, 159, 67, 0.08)', 
                border: '1px solid rgba(255, 159, 67, 0.3)', 
                color: '#ff9f43', 
                padding: '0.8rem 1rem', 
                borderRadius: '8px', 
                fontSize: '0.88rem',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <span style={{ 
                  width: '12px', 
                  height: '12px', 
                  border: '2px solid currentColor', 
                  borderTopColor: 'transparent', 
                  borderRadius: '50%', 
                  display: 'inline-block', 
                  animation: 'spin 1s linear infinite' 
                }} />
                {syncStatus}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', margin: '0.5rem 0' }}>
              {(!unitsStatus || unitsStatus.size === 0) ? (
                <div style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '1rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                  Ninguna unidad vinculada en la sesión actual.
                </div>
              ) : (
                Array.from(unitsStatus.values()).map(unit => {
                  const isOnline = unit.connected;
                  const isCurrentLoading = loadingBackup === unit.deviceName;
                  return (
                    <div 
                      key={unit.deviceId || unit.deviceName} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        background: 'rgba(255,255,255,0.02)', 
                        border: '1px solid rgba(255,255,255,0.04)', 
                        borderRadius: '10px', 
                        padding: '1rem' 
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {unit.deviceName}
                          {unit.appVersion && (
                            <span style={{ fontSize: '0.75rem', opacity: 0.6, background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 'normal' }}>
                              {unit.appVersion}
                            </span>
                          )}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: isOnline ? '#00ff88' : 'var(--text-secondary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isOnline ? '#00ff88' : 'var(--text-secondary)', display: 'inline-block' }} />
                          {isOnline ? 'En línea' : 'Sin señal'}
                        </span>
                      </div>
                      <button
                        className="btn-recovery-request"
                        disabled={!isOnline || !!loadingBackup}
                        onClick={async () => {
                          if (!onRequestFullBackup) return;
                          setLoadingBackup(unit.deviceName);
                          try {
                            await onRequestFullBackup(unit.deviceName, unit.peerId || '');
                          } catch (err) {
                            console.error(err);
                          } finally {
                            setLoadingBackup(null);
                          }
                        }}
                      >
                        {isCurrentLoading ? (
                          <>
                            <span style={{ 
                              width: '12px', 
                              height: '12px', 
                              border: '2px solid currentColor', 
                              borderTopColor: 'transparent', 
                              borderRadius: '50%', 
                              display: 'inline-block', 
                              animation: 'spin 1s linear infinite' 
                            }} />
                            Recuperando...
                          </>
                        ) : (
                          <>
                            <Download size={14} /> Solicitar Copia
                          </>
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1rem', marginTop: '0.5rem' }}>
              <button 
                onClick={() => setShowRecoveryModal(false)} 
                style={{ 
                  padding: '0.8rem 1.8rem', 
                  background: 'rgba(255, 255, 255, 0.05)', 
                  color: 'var(--text-primary)', 
                  border: '1px solid rgba(255, 255, 255, 0.1)', 
                  borderRadius: '8px', 
                  fontWeight: 'bold', 
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
