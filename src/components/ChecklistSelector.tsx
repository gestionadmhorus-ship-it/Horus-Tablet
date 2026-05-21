import React from 'react';
import { Truck, Cpu, ArrowLeft } from 'lucide-react';

interface ChecklistSelectorProps {
  onSelect: (type: 'vehicle' | 'drone') => void;
  onBack: () => void;
}

export const ChecklistSelector: React.FC<ChecklistSelectorProps> = ({ onSelect, onBack }) => {
  return (
    <div className="container" style={{ maxWidth: '800px', marginTop: '2rem', paddingBottom: '3rem' }}>
      <button 
        onClick={onBack}
        className="btn-3d"
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          color: 'var(--text-secondary)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.6rem 1.2rem',
          fontSize: '0.85rem',
          marginBottom: '2.5rem'
        }}
      >
        <ArrowLeft size={16} /> Volver al Dashboard
      </button>

      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{ 
          fontSize: '2.2rem', 
          fontWeight: 900, 
          letterSpacing: '1px',
          textTransform: 'uppercase',
          margin: 0,
          background: 'linear-gradient(135deg, #fff 30%, var(--primary) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Checklist Diario
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.95rem' }}>
          Selecciona la unidad o equipo a verificar antes de iniciar la jornada
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.5rem',
        marginTop: '1rem'
      }}>
        {/* Tarjeta Vehículo */}
        <div 
          onClick={() => onSelect('vehicle')}
          className="dashboard-card card-vehicular"
          style={{
            cursor: 'pointer',
            padding: '2.5rem 2rem',
            borderRadius: '16px',
            position: 'relative',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.25rem',
            textAlign: 'center',
            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            minHeight: '220px',
            justifyContent: 'center'
          }}
        >
          <div style={{
            background: 'rgba(255, 102, 0, 0.1)',
            padding: '1.25rem',
            borderRadius: '50%',
            color: 'var(--neon-orange)',
            boxShadow: '0 0 20px rgba(255, 102, 0, 0.05)'
          }}>
            <Truck size={36} />
          </div>
          <div>
            <h3 style={{ 
              fontSize: '1.25rem', 
              fontWeight: 800, 
              color: '#fff', 
              margin: '0 0 0.5rem 0',
              textTransform: 'uppercase'
            }}>
              Inspección Vehicular
            </h3>
            <p style={{ 
              color: 'var(--text-secondary)', 
              fontSize: '0.82rem', 
              margin: 0,
              lineHeight: 1.4
            }}>
              Chequeo diario de niveles, estado de neumáticos, luces y documentación de la camioneta.
            </p>
          </div>
        </div>

        {/* Tarjeta Dron */}
        <div 
          onClick={() => onSelect('drone')}
          className="dashboard-card card-vuelo-activo"
          style={{
            cursor: 'pointer',
            padding: '2.5rem 2rem',
            borderRadius: '16px',
            position: 'relative',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.25rem',
            textAlign: 'center',
            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            minHeight: '220px',
            justifyContent: 'center'
          }}
        >
          <div style={{
            background: 'rgba(0, 255, 136, 0.1)',
            padding: '1.25rem',
            borderRadius: '50%',
            color: 'var(--neon-green)',
            boxShadow: '0 0 20px rgba(0, 255, 136, 0.05)'
          }}>
            <Cpu size={36} />
          </div>
          <div>
            <h3 style={{ 
              fontSize: '1.25rem', 
              fontWeight: 800, 
              color: '#fff', 
              margin: '0 0 0.5rem 0',
              textTransform: 'uppercase'
            }}>
              Inspección de Dron
            </h3>
            <p style={{ 
              color: 'var(--text-secondary)', 
              fontSize: '0.82rem', 
              margin: 0,
              lineHeight: 1.4
            }}>
              Verificación física, electrónica, calibración de sensores y prueba de enlace del sistema aéreo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
