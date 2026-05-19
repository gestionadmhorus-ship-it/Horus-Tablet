import React from 'react';
import { LayoutDashboard, Plane, Cpu, Download, Clock, Settings, Pencil, RotateCcw, Power } from 'lucide-react';
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
}

const Dashboard: React.FC<DashboardProps> = ({ 
  onNavigate, onSettings, hasActiveShift, hasActiveFlight, onCloseShift, 
  onReopenShift, hasTodayClosedShift, activeShiftId, activeFlightName,
  onEditShift, onEditFlight
}) => {
  const [currentTime, setCurrentTime] = React.useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      {/* Top Banner Image with Dark Tactical Overlay */}
      <div style={{ 
        width: '100%', height: '280px', borderRadius: '0 0 40px 40px', overflow: 'hidden', 
        position: 'relative', marginBottom: '3rem', borderBottom: `2px solid ${hasActiveShift ? '#00ff88' : '#ff0000'}`,
        boxShadow: hasActiveShift ? '0 10px 30px rgba(0,255,136,0.3)' : '0 10px 30px rgba(255,0,0,0.3)',
        transition: 'all 0.5s ease'
      }}>
        <img 
          src="file:///C:/Users/Adelio/.gemini/antigravity/brain/2fe9f4cc-a8ec-4eb6-afba-f0db33e886bd/drone_inspection_banner_1778596743258.png" 
          alt="Dron Horus" 
          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, var(--bg-dark), transparent)' }} />
        <div style={{ position: 'absolute', bottom: '2rem', left: '3rem' }}>
          <p style={{ color: hasActiveShift ? '#00ff88' : '#ff0000', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '8px', fontSize: '1.2rem', marginBottom: '0.2rem', transition: 'color 0.5s ease' }}>
            HORUS DRON
          </p>
          <h1 style={{ color: 'white', fontSize: '2.5rem', fontWeight: 900, margin: 0, textShadow: `0 0 20px ${hasActiveShift ? 'rgba(0,255,136,0.5)' : 'rgba(255,0,0,0.5)'}` }}>OPERACIONES DE CAMPO</h1>
        </div>
      </div>

      {/* Top-right settings button */}
      <div style={{ position: 'fixed', top: '2rem', right: '2rem', display: 'flex', gap: '1rem', zIndex: 1000 }}>
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
        <div style={{ 
          background: 'rgba(255,165,0,0.1)', border: '1px solid #ffa500', color: '#ffa500', 
          padding: '1rem 1.5rem', borderRadius: '8px', marginBottom: '2rem', 
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
          boxShadow: '0 0 15px rgba(255,165,0,0.2)' 
        }}>
          <span style={{ fontWeight: 'bold' }}>⚠️ La jornada de hoy fue cerrada</span>
          <button
            onClick={onReopenShift}
            style={{ 
              background: 'rgba(255,165,0,0.2)', border: '1px solid #ffa500', color: '#ffa500', 
              padding: '0.6rem 1.2rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold',
              display: 'flex', alignItems: 'center', gap: '0.5rem'
            }}
          >
            <RotateCcw size={16} /> Reabrir Jornada
          </button>
        </div>
      )}

      <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.2rem' }}>
          <Clock size={24} color="var(--primary)" />
          <span style={{ fontSize: '1.5rem', fontWeight: 900, color: 'white', letterSpacing: '1px' }}>
            {currentTime.toLocaleDateString()} | {currentTime.toLocaleTimeString()}
          </span>
        </div>
        <div style={{ width: '60px', height: '4px', background: 'var(--primary)', margin: '1.5rem auto', boxShadow: '0 0 10px var(--primary)' }} />
        
        {hasActiveShift && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center' }}
          >
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(255,23,68,0.6)' }}
              whileTap={{ scale: 0.95 }}
              onClick={onCloseShift}
              style={{
                background: 'linear-gradient(135deg, rgba(255,23,68,0.2) 0%, rgba(255,23,68,0.4) 100%)',
                border: '2px solid #ff1744',
                borderRadius: '8px',
                color: 'white',
                cursor: 'pointer',
                padding: '1.2rem 3rem',
                fontSize: '1.1rem',
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '2px',
                boxShadow: '0 0 20px rgba(255,23,68,0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                textShadow: '0 0 5px rgba(255,255,255,0.3)',
                transition: 'all 0.3s ease'
              }}
            >
              <Power size={22} />
              Cerrar Jornada Activa
            </motion.button>
          </motion.div>
        )}
      </div>

      <div className="grid-cols-2" style={{ gap: '2rem' }}>
        {/* ─── Inicio de Jornada ─── */}
        <div style={{ position: 'relative' }}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => hasActiveShift ? onEditShift() : onNavigate('shift')}
            className="glass card-3d"
            style={{ width: '100%', padding: '2.5rem', border: '1px solid rgba(240,196,25,0.1)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', textAlign: 'center' }}
          >
            <div style={{ color: 'var(--primary)' }}>
              <LayoutDashboard size={56} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.6rem', color: 'white', marginBottom: '0.5rem', fontWeight: 900, textTransform: 'uppercase' }}>Inicio de Jornada</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: 600 }}>Logística y personal de base.</p>
              {hasActiveShift && activeShiftId && (
                <p style={{ color: '#00ff88', fontSize: '0.8rem', fontWeight: 'bold', marginTop: '0.5rem' }}>✅ {activeShiftId}</p>
              )}
            </div>
          </motion.button>
          {hasActiveShift && (
            <button
              onClick={(e) => { e.stopPropagation(); onEditShift(); }}
              style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,255,136,0.15)', border: '1px solid #00ff88', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00ff88', boxShadow: '0 0 10px rgba(0,255,136,0.3)' }}
              title="Editar Jornada Activa"
            >
              <Pencil size={16} />
            </button>
          )}
        </div>

        {/* ─── Registro de Vuelos ─── */}
        <div style={{ position: 'relative' }}>
          <motion.button
            whileHover={hasActiveShift ? { scale: 1.02 } : {}}
            whileTap={hasActiveShift ? { scale: 0.98 } : {}}
            onClick={() => hasActiveShift && (hasActiveFlight ? onEditFlight() : onNavigate('flight'))}
            className="glass card-3d"
            style={{ 
              width: '100%', height: '100%', padding: '2.5rem', 
              border: `1px solid ${hasActiveShift ? 'rgba(240,196,25,0.1)' : 'rgba(255,0,0,0.3)'}`, 
              cursor: hasActiveShift ? 'pointer' : 'not-allowed', 
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', textAlign: 'center',
              opacity: hasActiveShift ? 1 : 0.5
            }}
          >
            <div style={{ color: hasActiveShift ? 'var(--primary)' : '#666' }}>
              <Plane size={56} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.6rem', color: 'white', marginBottom: '0.5rem', fontWeight: 900, textTransform: 'uppercase' }}>Registro de Vuelos</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: 600 }}>Inspección de líneas críticas.</p>
              {hasActiveFlight && activeFlightName && (
                <p style={{ color: '#00ff88', fontSize: '0.8rem', fontWeight: 'bold', marginTop: '0.5rem' }}>🚁 {activeFlightName}</p>
              )}
            </div>
          </motion.button>
          {!hasActiveShift && (
            <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: '#ff0000', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold' }}>
              REQUISITO: INICIAR JORNADA
            </div>
          )}
          {hasActiveFlight && (
            <button
              onClick={(e) => { e.stopPropagation(); onEditFlight(); }}
              style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,255,136,0.15)', border: '1px solid #00ff88', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00ff88', boxShadow: '0 0 10px rgba(0,255,136,0.3)' }}
              title="Editar Vuelo Activo"
            >
              <Pencil size={16} />
            </button>
          )}
        </div>

        {/* ─── Baterías & Detecciones ─── */}
        <div style={{ position: 'relative' }}>
          <motion.button
            whileHover={hasActiveFlight ? { scale: 1.02 } : {}}
            whileTap={hasActiveFlight ? { scale: 0.98 } : {}}
            onClick={() => hasActiveFlight && onNavigate('batteries')}
            className="glass card-3d"
            style={{ 
              width: '100%', height: '100%', padding: '2.5rem', 
              border: `1px solid ${hasActiveFlight ? 'rgba(240,196,25,0.1)' : 'rgba(255,0,0,0.3)'}`, 
              cursor: hasActiveFlight ? 'pointer' : 'not-allowed', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', textAlign: 'center',
              opacity: hasActiveFlight ? 1 : 0.5
            }}
          >
            <div style={{ color: hasActiveFlight ? 'var(--primary)' : '#666' }}>
              <Cpu size={56} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.6rem', color: 'white', marginBottom: '0.5rem', fontWeight: 900, textTransform: 'uppercase' }}>Baterías & Detecciones</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: 600 }}>Telemetría y anomalías.</p>
            </div>
          </motion.button>
          {!hasActiveFlight && (
            <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: '#ff0000', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold' }}>
              REQUISITO: REGISTRO DE VUELO
            </div>
          )}
        </div>

        {/* ─── Explorar Historial ─── */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onNavigate('explorer')}
          className="glass card-3d"
          style={{ padding: '2.5rem', border: '1px solid var(--primary)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', textAlign: 'center', background: 'rgba(240,196,25,0.05)' }}
        >
          <div style={{ color: 'var(--primary)' }}>
            <Download size={56} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.6rem', color: 'var(--primary)', marginBottom: '0.5rem', fontWeight: 900, textTransform: 'uppercase' }}>Explorar Historial</h2>
            <p style={{ color: 'white', fontSize: '0.95rem', fontWeight: 600 }}>Auditoría y reportes Excel.</p>
          </div>
        </motion.button>
      </div>

      <footer style={{ marginTop: '6rem', padding: '3rem', textAlign: 'center', opacity: 0.5 }}>
        <p style={{ fontSize: '0.9rem', fontWeight: 900, color: 'var(--primary)', letterSpacing: '4px' }}>HORUS DRON | TACTICAL INTERFACE</p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', marginTop: '0.5rem' }}>OPTIMIZADO PARA ALTA VISIBILIDAD EN CAMPO</p>
      </footer>
    </div>
  );
};

export default Dashboard;
