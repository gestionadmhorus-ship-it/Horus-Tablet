import React from 'react';
import { Truck, Cpu, ArrowLeft } from 'lucide-react';

interface ChecklistSelectorProps {
  onSelect: (type: 'vehicle' | 'drone') => void;
  onBack: () => void;
}

export const ChecklistSelector: React.FC<ChecklistSelectorProps> = ({ onSelect, onBack }) => {
  return (
    <div className="container checklist-selector" style={{ maxWidth: 'min(800px, 100%)', marginTop: '2rem', paddingBottom: '3rem' }}>
      <button 
        onClick={onBack}
        className="btn-3d checklist-selector-back"
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

      <div className="checklist-selector-header" style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 className="checklist-selector-title" style={{
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
        <p className="checklist-selector-text" style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.95rem' }}>
          Selecciona la unidad o equipo a verificar antes de iniciar la jornada
        </p>
      </div>

      <div className="checklist-selector-grid" style={{
        display: 'grid',
        gap: '1.5rem',
        marginTop: '1rem'
      }}>
        {/* Tarjeta Vehículo */}
        <div 
          onClick={() => onSelect('vehicle')}
          className="dashboard-card card-vehicular checklist-selector-card"
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
          <div className="checklist-selector-card-content">
            <h3 className="checklist-selector-card-title" style={{
              fontSize: '1.25rem', 
              fontWeight: 800, 
              color: '#fff', 
              margin: '0 0 0.5rem 0',
              textTransform: 'uppercase'
            }}>
              Inspección Vehicular
            </h3>
            <p className="checklist-selector-card-description" style={{
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
          className="dashboard-card card-vuelo-activo checklist-selector-card"
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
          <div className="checklist-selector-card-content">
            <h3 className="checklist-selector-card-title" style={{
              fontSize: '1.25rem', 
              fontWeight: 800, 
              color: '#fff', 
              margin: '0 0 0.5rem 0',
              textTransform: 'uppercase'
            }}>
              Inspección de Dron
            </h3>
            <p className="checklist-selector-card-description" style={{
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

      <style>{`
        .checklist-selector {
          width: 100%;
          min-width: 0;
          max-width: 100%;
          height: auto;
          overflow-x: hidden;
        }

        .checklist-selector-header,
        .checklist-selector-grid,
        .checklist-selector-card,
        .checklist-selector-card-content,
        .checklist-selector-text {
          min-width: 0;
          max-width: 100%;
        }

        .checklist-selector-title {
          min-width: 0;
          max-width: 100%;
          font-size: 2.2rem !important;
          white-space: normal;
          overflow-wrap: anywhere;
        }

        .checklist-selector-back {
          min-width: 0;
          max-width: 100%;
          min-height: 48px;
          white-space: normal;
          overflow-wrap: anywhere;
          flex-wrap: wrap;
        }

        .checklist-selector-back svg {
          flex: 0 0 auto;
        }

        .checklist-selector-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .checklist-selector-card {
          width: 100%;
          min-width: 0;
          max-width: 100%;
          box-sizing: border-box;
        }

        .checklist-selector-card-title,
        .checklist-selector-card-description,
        .checklist-selector-text {
          min-width: 0;
          max-width: 100%;
          white-space: normal;
          overflow-wrap: anywhere;
        }

        @media (max-width: 600px) {
          .checklist-selector-grid {
            grid-template-columns: minmax(0, 1fr);
          }

          .checklist-selector-back,
          .checklist-selector-card {
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
};
