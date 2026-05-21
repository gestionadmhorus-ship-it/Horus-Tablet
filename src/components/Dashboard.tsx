import React from 'react';
import { LayoutDashboard, Plane, Cpu, Download, Clock, Settings, Pencil, RotateCcw, Power, ShieldCheck, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

interface DashboardProps {
  onNavigate: (page: string) => void;
  onSettings: () => void;
  hasActiveShift: boolean;
  hasActiveFlight: boolean;
  onCloseShift: () => void;
  onReopenShift: () => void;
  hasTodayClosedShift: boolean;
  activeShiftId?: string;
  activeFlightName?: string;
  onEditShift: () => void;
  onEditFlight: () => void;
  onNewFlight: () => void;
  deviceName?: string;
  syncStatus?: string;
  appRole?: string | null;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  onNavigate, onSettings, hasActiveShift, hasActiveFlight, onCloseShift, 
  onReopenShift, hasTodayClosedShift, activeShiftId, activeFlightName,
  onEditShift, onEditFlight, onNewFlight, deviceName, syncStatus, appRole
}) => {
  const [currentTime, setCurrentTime] = React.useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="dashboard-container">
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
          padding: 2.5rem;
          box-sizing: border-box;
          overflow: hidden;
          background: rgba(10, 15, 26, 0.45);
          backdrop-filter: blur(25px);
          border: 1px solid rgba(240, 196, 25, 0.12);
          border-radius: 24px;
          box-shadow: 
            0 25px 50px -12px rgba(0, 0, 0, 0.8),
            0 0 40px rgba(240, 196, 25, 0.03),
            inset 0 0 20px rgba(255, 255, 255, 0.02);
        }
        
        .dashboard-banner {
          width: 100%;
          height: 130px;
          border-radius: 16px;
          overflow: hidden;
          position: relative;
          border-bottom: 2px solid var(--banner-border);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          flex-shrink: 0;
        }
        
        .dashboard-banner-title {
          font-size: 2rem;
          font-weight: 900;
          margin: 0;
          letter-spacing: 1px;
        }
        
        .dashboard-banner-subtitle {
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 6px;
          font-size: 0.9rem;
          margin-bottom: 0.1rem;
        }

        .dashboard-reopen-banner {
          background: rgba(255,165,0,0.06);
          border: 1px solid rgba(255, 165, 0, 0.3);
          color: #ffa500; 
          padding: 0.6rem 1.2rem;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
          flex-shrink: 0;
          font-size: 0.9rem;
        }

        .dashboard-clock-section {
          text-align: center;
          margin: 0.75rem 0;
          flex-shrink: 0;
        }
        
        .dashboard-clock-text {
          font-size: 1.15rem;
          font-weight: 900;
          color: white;
          letter-spacing: 1px;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 1.25rem;
          flex-grow: 1;
          align-content: center;
        }
        
        .dashboard-card {
          background: rgba(10, 15, 26, 0.7);
          border: 1px solid rgba(240, 196, 25, 0.1);
          border-radius: 16px;
          padding: 1.5rem 1rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          text-align: center;
          height: 100%;
          min-height: 120px;
          transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
        }
        
        .dashboard-card:hover {
          transform: translateY(-4px);
          background: rgba(240, 196, 25, 0.06);
          border-color: var(--primary);
          box-shadow: 
            0 12px 28px rgba(0, 0, 0, 0.6),
            0 0 20px rgba(240, 196, 25, 0.2);
        }

        .dashboard-card.card-vuelo-activo {
          border-color: rgba(0, 255, 136, 0.2);
        }
        .dashboard-card.card-vuelo-activo:hover {
          border-color: #00ff88;
          background: rgba(0, 255, 136, 0.05);
          box-shadow: 
            0 12px 28px rgba(0, 0, 0, 0.6),
            0 0 20px rgba(0, 255, 136, 0.2);
        }

        .dashboard-card.card-vehicular {
          border-color: rgba(255, 102, 0, 0.2);
        }
        .dashboard-card.card-vehicular:hover {
          border-color: #ff6600;
          background: rgba(255, 102, 0, 0.05);
          box-shadow: 
            0 12px 28px rgba(0, 0, 0, 0.6),
            0 0 20px rgba(255, 102, 0, 0.2);
        }
        
        .dashboard-card-title {
          font-size: 1.15rem !important;
          font-weight: 900;
          text-transform: uppercase;
          margin: 0;
          color: white;
          letter-spacing: 0.5px;
        }
        
        .dashboard-card-desc {
          color: var(--text-secondary);
          font-size: 0.78rem !important;
          font-weight: 600;
          margin: 0;
          line-height: 1.3;
        }
        
        .dashboard-footer {
          padding: 0.75rem 0 0 0;
          text-align: center;
          opacity: 0.4;
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
            backdrop-filter: none;
            box-shadow: none;
          }
          .dashboard-banner {
            height: 110px;
          }
          .dashboard-banner-title {
            font-size: 1.6rem;
          }
        }

        @media (max-width: 768px) {
          .dashboard-container {
            padding: 0.8rem;
            padding-top: 1rem;
          }
          .dashboard-banner {
            height: 70px;
            border-radius: 12px;
            margin-top: 2.5rem;
          }
          .dashboard-banner-title {
            font-size: 1.1rem;
          }
          .dashboard-banner-subtitle {
            font-size: 0.65rem;
            letter-spacing: 2px;
          }
          .dashboard-clock-text {
            font-size: 0.85rem;
          }
          .dashboard-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 0.5rem;
          }
          .col-span-2 { grid-column: span 1 !important; }
          .col-span-3 { grid-column: span 1 !important; }
          .mobile-full-width { grid-column: span 2 !important; }
          
          .dashboard-card {
            padding: 0.6rem;
            gap: 0.25rem;
            min-height: 80px;
            border-radius: 12px;
          }
          .dashboard-card-title {
            font-size: 0.85rem !important;
          }
          .dashboard-card-desc {
            display: none !important;
          }
          .dashboard-card svg {
            width: 24px !important;
            height: 24px !important;
          }
          .dashboard-footer {
            display: none !important;
          }
          .dashboard-top-actions {
            top: 0.5rem !important;
            right: 0.5rem !important;
            gap: 0.4rem !important;
          }
          .dashboard-top-actions button {
            padding: 0.4rem 0.6rem !important;
            font-size: 0.7rem !important;
          }
          .dashboard-top-actions .sync-label {
            display: none;
          }
          .dashboard-edit-badge {
            width: 26px !important;
            height: 26px !important;
          }
          .dashboard-edit-badge svg {
            width: 12px !important;
            height: 12px !important;
          }
          .dashboard-req-badge {
            font-size: 0.6rem !important;
            padding: 3px 8px !important;
            white-space: nowrap;
          }
          .dashboard-equipo-badge {
            display: none !important;
          }
        }
      `}} />
      {/* Top Banner Image with Dark Tactical Overlay */}
      <div 
        className="dashboard-banner"
        style={{ 
          '--banner-border': hasActiveShift ? '#00ff88' : '#ff0000',
          '--banner-shadow': hasActiveShift ? 'rgba(0,255,136,0.3)' : 'rgba(255,0,0,0.3)',
        } as React.CSSProperties}
      >
        <img 
          src="file:///C:/Users/Adelio/.gemini/antigravity/brain/2fe9f4cc-a8ec-4eb6-afba-f0db33e886bd/drone_inspection_banner_1778596743258.png" 
          alt="Dron Horus" 
          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, var(--bg-dark), transparent)' }} />
        <div style={{ position: 'absolute', bottom: '1rem', left: '2rem' }}>
          <p 
            style={{ color: hasActiveShift ? '#00ff88' : '#ff0000', transition: 'color 0.5s ease', margin: 0 }} 
            className="dashboard-banner-subtitle"
          >
            HORUS DRON
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <h1 
              style={{ textShadow: `0 0 20px ${hasActiveShift ? 'rgba(0,255,136,0.5)' : 'rgba(255,0,0,0.5)'}`, margin: 0 }} 
              className="dashboard-banner-title"
            >
              OPERACIONES DE CAMPO
            </h1>
            {deviceName && (
              <span className="dashboard-equipo-badge" style={{ 
                background: 'rgba(0, 242, 255, 0.15)', 
                color: '#00f2ff', 
                border: '1px solid rgba(0, 242, 255, 0.4)', 
                padding: '4px 10px', 
                borderRadius: '6px', 
                fontSize: '0.8rem', 
                fontWeight: 900, 
                textTransform: 'uppercase',
                letterSpacing: '1px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: '0 0 15px rgba(0, 242, 255, 0.25)',
                marginTop: '0.2rem'
              }}>
                ⚙️ EQUIPO: {deviceName}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Top-right settings and status */}
      <div className="dashboard-top-actions" style={{ position: 'fixed', top: '2rem', right: '2rem', display: 'flex', gap: '1rem', zIndex: 1000, alignItems: 'center' }}>
        {syncStatus && (
          <div style={{
            background: 'rgba(0,0,0,0.8)',
            border: `1px solid ${appRole === 'server' ? 'var(--primary)' : '#00f2d1'}`,
            borderRadius: '4px',
            color: appRole === 'server' ? 'var(--primary)' : '#00f2d1',
            padding: '0.8rem 1.2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: `0 0 15px ${appRole === 'server' ? 'rgba(240,196,25,0.2)' : 'rgba(0,242,255,0.2)'}`,
            fontWeight: 'bold',
            fontSize: '0.8rem'
          }}>
            <RefreshCw size={16} className={syncStatus.includes('✅') || syncStatus.includes('⚠️') || syncStatus.includes('❌') ? '' : 'spinning'} />
            <span className="sync-label">{syncStatus}</span>
          </div>
        )}
        <button
          onClick={onSettings}
          style={{
            background: 'rgba(0,0,0,0.8)',
            border: `1px solid ${hasActiveShift ? '#00ff88' : '#ff0000'}`,
            borderRadius: '4px',
            color: hasActiveShift ? '#00ff88' : '#ff0000',
            cursor: 'pointer',
            padding: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            transition: 'all 0.5s ease',
            boxShadow: `0 0 15px ${hasActiveShift ? 'rgba(0,255,136,0.2)' : 'rgba(255,0,0,0.2)'}`
          }}
          title="Configuración"
        >
          <Settings size={24} />
        </button>
      </div>

      {/* Reopen shift banner */}
      {!hasActiveShift && hasTodayClosedShift && (
        <div className="dashboard-reopen-banner">
          <span style={{ fontWeight: 'bold' }}>⚠️ La jornada de hoy fue cerrada</span>
          <button
            onClick={onReopenShift}
            style={{ 
              background: 'rgba(255,165,0,0.2)', border: '1px solid #ffa500', color: '#ffa500', 
              padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold',
              display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem'
            }}
          >
            <RotateCcw size={14} /> Reabrir Jornada
          </button>
        </div>
      )}

      <div className="dashboard-clock-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
          <Clock size={20} color="var(--primary)" />
          <span className="dashboard-clock-text">
            {currentTime.toLocaleDateString()} | {currentTime.toLocaleTimeString()}
          </span>
          {hasActiveShift && (
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: '0 0 20px rgba(255,23,68,0.6)' }}
              whileTap={{ scale: 0.95 }}
              onClick={onCloseShift}
              style={{
                background: 'linear-gradient(135deg, rgba(255,23,68,0.2) 0%, rgba(255,23,68,0.4) 100%)',
                border: '1.5px solid #ff1744',
                borderRadius: '4px',
                color: 'white',
                cursor: 'pointer',
                padding: '0.4rem 1rem',
                fontSize: '0.8rem',
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                boxShadow: '0 0 10px rgba(255,23,68,0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                marginLeft: '1.5rem',
                transition: 'all 0.3s ease'
              }}
            >
              <Power size={14} />
              Cerrar Jornada
            </motion.button>
          )}
        </div>
      </div>

      <div className="dashboard-grid">
        {/* ─── Inicio de Jornada ─── */}
        <div style={{ position: 'relative' }} className="col-span-2">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => hasActiveShift ? onEditShift() : onNavigate('shift')}
            className="dashboard-card"
            style={{ width: '100%', cursor: 'pointer' }}
          >
            <div style={{ color: 'var(--primary)' }}>
              <LayoutDashboard size={36} />
            </div>
            <div>
              <h2 className="dashboard-card-title">Inicio de Jornada</h2>
              <p className="dashboard-card-desc">Logística y personal de base.</p>
              {hasActiveShift && activeShiftId && (
                <p style={{ color: '#00ff88', fontSize: '0.75rem', fontWeight: 'bold', marginTop: '0.2rem', marginBottom: 0 }}>✅ {activeShiftId.split(' ')[0]}</p>
              )}
            </div>
          </motion.button>
          {hasActiveShift && (
            <button
              onClick={(e) => { e.stopPropagation(); onEditShift(); }}
              className="dashboard-edit-badge"
              style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,255,136,0.15)', border: '1px solid #00ff88', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00ff88', boxShadow: '0 0 10px rgba(0,255,136,0.3)' }}
              title="Editar Jornada Activa"
            >
              <Pencil size={16} />
            </button>
          )}
        </div>
 
        {/* ─── Registro de Vuelos ─── */}
        <div style={{ position: 'relative' }} className="col-span-2">
          <motion.div
            className={`dashboard-card ${hasActiveFlight ? 'card-vuelo-activo' : ''}`}
            onClick={() => hasActiveShift && !hasActiveFlight ? onNavigate('flight') : undefined}
            style={{ 
              width: '100%', 
              cursor: hasActiveShift && !hasActiveFlight ? 'pointer' : 'default',
              opacity: hasActiveShift ? 1 : 0.5
            }}
          >
            <div style={{ color: hasActiveShift ? (hasActiveFlight ? '#00ff88' : 'var(--primary)') : '#666' }}>
              <Plane size={36} />
            </div>
            <div>
              <h2 className="dashboard-card-title">Registro de Vuelos</h2>
              <p className="dashboard-card-desc">Inspección de líneas críticas.</p>
            </div>

            {hasActiveFlight && activeFlightName ? (
              <div style={{ marginTop: '0.3rem', width: '100%', display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'center' }}>
                <div style={{ background: 'rgba(0,255,136,0.1)', padding: '0.3rem 0.6rem', borderRadius: '4px', border: '1px solid #00ff88', color: '#00ff88', fontWeight: 'bold', width: '100%', fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                  🚁 VUELO ACTIVO
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', width: '100%' }}>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onEditFlight(); }}
                    className="btn-3d"
                    style={{ flex: 1, padding: '0.4rem', background: 'rgba(240,196,25,0.1)', border: '1px solid var(--primary)', color: 'var(--primary)', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem', fontSize: '0.7rem' }}
                  >
                    <Pencil size={12} /> EDITAR
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onNewFlight(); }}
                    className="btn-3d"
                    style={{ flex: 1, padding: '0.4rem', background: 'rgba(0,255,136,0.1)', border: '1px solid #00ff88', color: '#00ff88', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem', fontSize: '0.7rem' }}
                  >
                    + NUEVO
                  </button>
                </div>
              </div>
            ) : (
              hasActiveShift && (
                <div style={{ marginTop: '0.2rem', color: 'var(--primary)', fontWeight: 'bold', fontSize: '0.75rem' }} className="dashboard-card-desc">
                  Iniciar vuelo
                </div>
              )
            )}
          </motion.div>
          {!hasActiveShift && (
            <div className="dashboard-req-badge" style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: '#ff0000', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold' }}>
              REQ: JORNADA
            </div>
          )}
        </div>

        {/* ─── Baterías & Detecciones ─── */}
        <div style={{ position: 'relative' }} className="col-span-2">
          <motion.button
            whileTap={hasActiveFlight ? { scale: 0.98 } : {}}
            onClick={() => hasActiveFlight && onNavigate('batteries')}
            className="dashboard-card"
            style={{ 
              width: '100%', 
              cursor: hasActiveFlight ? 'pointer' : 'not-allowed',
              opacity: hasActiveFlight ? 1 : 0.5
            }}
          >
            <div style={{ color: hasActiveFlight ? 'var(--primary)' : '#666' }}>
              <Cpu size={36} />
            </div>
            <div>
              <h2 className="dashboard-card-title">Baterías & Detecciones</h2>
              <p className="dashboard-card-desc">Telemetría y anomalías.</p>
            </div>
          </motion.button>
          {!hasActiveFlight && (
            <div className="dashboard-req-badge" style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: '#ff0000', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold' }}>
              REQ: VUELO
            </div>
          )}
        </div>

        {/* ─── Explorar Historial ─── */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => onNavigate('explorer')}
          className="dashboard-card col-span-3"
          style={{ cursor: 'pointer', background: 'rgba(240,196,25,0.03)' }}
        >
          <div style={{ color: 'var(--primary)' }}>
            <Download size={36} />
          </div>
          <div>
            <h2 className="dashboard-card-title" style={{ color: 'var(--primary)' }}>Explorar Historial</h2>
            <p className="dashboard-card-desc" style={{ color: 'white' }}>Auditoría e historial.</p>
          </div>
        </motion.button>
 
        {/* ─── Checklist Vehicular ─── */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => onNavigate('checklist')}
          className="dashboard-card col-span-3 mobile-full-width card-vehicular"
          style={{ 
            cursor: 'pointer', 
            background: 'rgba(255,102,0,0.03)'
          }}
        >
          <div style={{ color: '#ff6600' }}>
            <ShieldCheck size={36} />
          </div>
          <div>
            <h2 className="dashboard-card-title" style={{ color: '#ff6600' }}>Inspección Vehicular</h2>
            <p className="dashboard-card-desc" style={{ color: 'white' }}>Checklist diario y vencimientos.</p>
          </div>
        </motion.button>
      </div>
 
      <footer className="dashboard-footer">
        <p style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--primary)', letterSpacing: '2px', margin: 0 }}>HORUS DRON | TACTICAL INTERFACE</p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.6rem', marginTop: '0.1rem', marginBottom: 0 }}>OPTIMIZADO PARA ALTA VISIBILIDAD EN CAMPO</p>
      </footer>
    </div>
  );
};

export default Dashboard;
