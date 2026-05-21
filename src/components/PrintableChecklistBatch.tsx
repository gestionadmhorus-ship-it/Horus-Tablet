import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface PrintableChecklistBatchProps {
  data: any[];
}

const PrintableChecklistBatch: React.FC<PrintableChecklistBatchProps> = ({ data }) => {
  if (!data || data.length === 0) return null;

  // Items de verificación de drones agrupados por fase
  const droneGroups = [
    {
      title: "Fase 1: Inspección Física (Dron Apagado)",
      items: [
        { key: 'frameSecured', label: 'Brazos y Bastidor Asegurados' },
        { key: 'landingGearLocked', label: 'Tren Aterrizaje Trabado' },
        { key: 'propellersIntact', label: 'Hélices sin Fisuras ni Daños' },
        { key: 'motorsFreeSpinning', label: 'Motores Giran Libremente' },
        { key: 'batterySecured', label: 'Batería Insertada y Trabada' },
        { key: 'cameraProtectorRemoved', label: 'Protector de Gimbal Retirado' },
        { key: 'sdCardInsertedPhysically', label: 'Tarjeta SD Colocada' },
        { key: 'areaSecured', label: 'Zona de Despegue Segura' },
      ]
    },
    {
      title: "Fase 2: Marcha y Enlace (Encendido)",
      items: [
        { key: 'rcAntennasDeployed', label: 'Antenas RC Desplegadas' },
        { key: 'rcSticksCentered', label: 'Sticks de Control Centrados' },
        { key: 'appStarted', label: 'App de Vuelo Abierta' },
        { key: 'dronePoweredOn', label: 'Dron Encendido' },
        { key: 'rcDroneLinked', label: 'Radio y Dron Enlazados' },
      ]
    },
    {
      title: "Fase 3: Telemetría y Sistemas",
      items: [
        { key: 'systemBatteriesChecked', label: 'Carga Dron y RC OK' },
        { key: 'imuCompassCalibrated', label: 'Calibración de Sensores OK' },
        { key: 'gpsLockOptimal', label: 'Señal GPS Óptima' },
        { key: 'rthParamsConfigured', label: 'Altura RTH de Emergencia Set' },
        { key: 'obstacleAvoidanceActive', label: 'Sensores Anticolisión ON' },
        { key: 'cameraFeedFluid', label: 'Cámara Feed & SD Listas' },
      ]
    },
    {
      title: "Fase 4: Vuelo y Hover Test",
      items: [
        { key: 'casesClosedAndStored', label: 'Valijas y Equipaje Guardado' },
        { key: 'takeoffAreaClear', label: 'Área Libre de Personas' },
        { key: 'hoverTestPassed', label: 'Prueba Hover 2 Metros Estable' },
      ]
    }
  ];

  const vehicleGroups = [
    {
      title: "Fluidos y Lubricantes",
      items: [
        { key: 'oil', label: 'Aceite de Motor' },
        { key: 'brakesFluid', label: 'Líquido de Frenos' },
        { key: 'coolant', label: 'Líquido Refrigerante' },
        { key: 'steeringFluid', label: 'Líquido de Dirección' },
        { key: 'washerFluid', label: 'Líquido Limpiaparabrisas' },
      ]
    },
    {
      title: "Seguridad y Visibilidad",
      items: [
        { key: 'lights', label: 'Luces (Altas, Bajas, Posición, Giro, Balizas, Freno)' },
        { key: 'mirrors', label: 'Espejos Retrovisores' },
        { key: 'horn', label: 'Bocina' },
        { key: 'wipers', label: 'Limpia Parabrisas (Escobillas)' },
        { key: 'seatbelts', label: 'Cinturones de Seguridad' },
      ]
    },
    {
      title: "Neumáticos y Frenos",
      items: [
        { key: 'tirePressure', label: 'Presión de Neumáticos' },
        { key: 'tireWear', label: 'Desgaste de Neumáticos' },
        { key: 'spareWheel', label: 'Rueda de Auxilio y Herramientas' },
        { key: 'handbrake', label: 'Freno de Mano' },
      ]
    },
    {
      title: "Documentación y Equipamiento",
      items: [
        { key: 'greenCard', label: 'Cédula Verde / Azul' },
        { key: 'drivingLicense', label: 'Registro de Conducir' },
        { key: 'fireExtinguisher', label: 'Matafuego (Carga y Vigencia)' },
        { key: 'firstAidKit', label: 'Botiquín de Primeros Auxilios' },
      ]
    }
  ];

  return (
    <div className="batch-print-wrapper print-only" style={{ display: 'none' }}>
      {data.map((record) => {
        const isDrone = 'droneId' in record;
        const currentGroups = isDrone ? droneGroups : vehicleGroups;

        return (
          <div key={record.id} className="batch-page" style={{ pageBreakAfter: 'always', width: '100%', padding: '0.5cm', boxSizing: 'border-box' }}>
            
            {/* Header Section */}
            <div style={{ textAlign: 'center', marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
                <img src="/logo_horus_nuevo.png" alt="Horus Logo" style={{ height: '40px' }} />
              </div>
              <h1 style={{ fontSize: '18px', fontWeight: 900, color: 'black', textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 5px 0' }}>
                {isDrone ? 'CHECKLIST PRE-VUELO DE DRON' : 'CHECKLIST DIARIO DE VEHÍCULOS'}
              </h1>
              <p style={{ color: '#333', fontSize: '10px', marginTop: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={12} color="black" /> gestionadm.horus@gmail.com
              </p>
              <p style={{ color: 'black', fontSize: '10px', fontWeight: 600, marginTop: '2px', marginBottom: '2px' }}>
                Fecha y hora registrada: <span style={{ fontWeight: 'bold' }}>{record.timestamp}</span>
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              
              {/* Section 1: General Info */}
              <div className="batch-section">
                <h3 style={{ fontSize: '12px', color: 'black', margin: '0 0 5px 0', fontWeight: 800 }}>
                  {isDrone ? 'Información del Sistema Aéreo' : 'Información General de la Unidad'}
                </h3>
                <div className="batch-grid-3">
                  {isDrone ? (
                    <>
                      <div>
                        <label className="batch-label">Aeronave (Dron)</label>
                        <div className="batch-value">{record.droneId}</div>
                      </div>
                      <div>
                        <label className="batch-label">Piloto a Cargo</label>
                        <div className="batch-value">{record.pilot}</div>
                      </div>
                      <div>
                        <label className="batch-label">Código de Planilla</label>
                        <div className="batch-value">{record.id}</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="batch-label">Unidad</label>
                        <div className="batch-value">{record.vehicleId}</div>
                      </div>
                      <div>
                        <label className="batch-label">Kilometraje Actual</label>
                        <div className="batch-value">{record.mileage} km</div>
                      </div>
                      <div>
                        <label className="batch-label">Responsable</label>
                        <div className="batch-value">{record.driver}</div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Section 2: Verification Items */}
              <div className="batch-section">
                <h3 style={{ fontSize: '12px', color: 'black', margin: '0 0 5px 0', fontWeight: 800 }}>Ítems de Verificación</h3>
                <div className="batch-grid-4">
                  {currentGroups.map((group) => (
                    <div key={group.title}>
                      <h4 style={{ color: 'black', borderBottom: '1px solid #CCC', paddingBottom: '2px', margin: '0 0 5px 0', fontSize: '10px', textTransform: 'uppercase', fontWeight: 800 }}>
                        {group.title}
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {group.items.map((item) => {
                          const isChecked = record.checks[item.key as keyof typeof record.checks];
                          return (
                            <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <div style={{
                                width: '12px', height: '12px', borderRadius: '50%',
                                border: '1px solid black',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                              }}>
                                {isChecked && <div style={{ width: '8px', height: '8px', background: 'black', borderRadius: '50%' }} />}
                              </div>
                              <span style={{ color: 'black', fontSize: '9px' }}>
                                {item.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 3: Expirations and Observations */}
              <div className="batch-section">
                <h3 style={{ fontSize: '12px', color: 'black', margin: '0 0 5px 0', fontWeight: 800 }}>Observaciones y Seguridad</h3>
                {!isDrone && record.expirations && (
                  <div className="batch-grid-3" style={{ marginBottom: '5px' }}>
                    <div>
                      <label className="batch-label">Vencimiento Matafuego</label>
                      <div className="batch-value">{record.expirations.fireExtinguisher || '-'}</div>
                    </div>
                    <div>
                      <label className="batch-label">Vencimiento VTV</label>
                      <div className="batch-value">{record.expirations.vtv || '-'}</div>
                    </div>
                    <div>
                      <label className="batch-label">Vencimiento Seguro</label>
                      <div className="batch-value">{record.expirations.insurance || '-'}</div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="batch-label">Observaciones</label>
                  <div className="batch-value" style={{ minHeight: '30px', fontSize: '9px' }}>
                    {record.observations || 'Sin observaciones.'}
                  </div>
                </div>
                
                {/* Signature Lines */}
                <div style={{ display: 'flex', marginTop: '20px', justifyContent: 'space-around' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ width: '250px', borderBottom: '1px solid black', marginBottom: '5px' }}></div>
                    <p style={{ margin: 0, fontSize: '10px' }}>Firma del Responsable</p>
                    <p style={{ margin: '2px 0 0 0', fontSize: '10px' }}><strong>{isDrone ? record.pilot : record.driver}</strong></p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ width: '250px', borderBottom: '1px solid black', marginBottom: '5px' }}></div>
                    <p style={{ margin: 0, fontSize: '10px' }}>Sello de Recepción / Aprobación</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        );
      })}

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page {
            margin: 0.5cm;
            size: A4 portrait;
          }
          body {
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          /* Hide the main UI from RecordsExplorer */
          .records-explorer-ui {
            display: none !important;
          }
          .batch-print-wrapper {
            display: block !important;
            width: 100% !important;
          }
          .batch-page {
            page-break-after: always;
          }
          .batch-page:last-child {
            page-break-after: auto;
          }
          .batch-section {
            padding: 5px !important;
            margin-bottom: 5px !important;
            border: 1px solid #CCC !important;
          }
          .batch-grid-3 {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 5px !important;
          }
          .batch-grid-4 {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 5px !important;
          }
          .batch-label {
            color: black !important;
            font-size: 9px !important;
            font-weight: bold;
            margin-bottom: 2px !important;
            display: block;
          }
          .batch-value {
            border: 1px solid #CCC !important;
            padding: 4px !important;
            font-size: 10px !important;
            border-radius: 4px !important;
            background: white !important;
            color: black !important;
          }
        }
      `}} />
    </div>
  );
};

export default PrintableChecklistBatch;
