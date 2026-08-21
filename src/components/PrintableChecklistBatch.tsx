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
          <div key={record.id} className="batch-page" style={{ width: '100%', padding: '0.5cm', boxSizing: 'border-box' }}>
            
            {/* Header Section */}
            <div className="batch-header" style={{ textAlign: 'center', marginBottom: '10px' }}>
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
              <div className="batch-section batch-general-section">
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
              <div className="batch-section batch-verification-section">
                <h3 style={{ fontSize: '12px', color: 'black', margin: '0 0 5px 0', fontWeight: 800 }}>Ítems de Verificación</h3>
                <div className="batch-grid-4">
                  {currentGroups.map((group) => (
                    <div key={group.title} className="batch-verification-group">
                      <h4 style={{ color: 'black', borderBottom: '1px solid #CCC', paddingBottom: '2px', margin: '0 0 5px 0', fontSize: '10px', textTransform: 'uppercase', fontWeight: 800 }}>
                        {group.title}
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {group.items.map((item) => {
                          const isChecked = record.checks[item.key as keyof typeof record.checks];
                          return (
                            <div key={item.key} className="batch-verification-item" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
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
              <div className="batch-section batch-observations-section">
                <h3 style={{ fontSize: '12px', color: 'black', margin: '0 0 5px 0', fontWeight: 800 }}>Observaciones y Seguridad</h3>
                {!isDrone && record.expirations && (
                  <div className="batch-grid-3 batch-expirations" style={{ marginBottom: '5px' }}>
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

                <div className="batch-observations-field">
                  <label className="batch-label">Observaciones</label>
                  <div className="batch-value" style={{ minHeight: '30px', fontSize: '9px' }}>
                    {record.observations || 'Sin observaciones.'}
                  </div>
                </div>
                
                {/* Signature Lines */}
                <div className="batch-signatures" style={{ display: 'flex', marginTop: '20px', justifyContent: 'space-around' }}>
                  <div className="batch-signature" style={{ textAlign: 'center' }}>
                    <div className="batch-signature-line" style={{ borderBottom: '1px solid black', marginBottom: '5px' }}></div>
                    <p style={{ margin: 0, fontSize: '10px' }}>Firma del Responsable</p>
                    <p style={{ margin: '2px 0 0 0', fontSize: '10px' }}><strong>{isDrone ? record.pilot : record.driver}</strong></p>
                  </div>
                  <div className="batch-signature" style={{ textAlign: 'center' }}>
                    <div className="batch-signature-line" style={{ borderBottom: '1px solid black', marginBottom: '5px' }}></div>
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
            min-width: 0 !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            box-sizing: border-box !important;
          }
          .batch-print-wrapper,
          .batch-print-wrapper * {
            box-sizing: border-box !important;
          }
          .batch-page {
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
            overflow: visible !important;
            page-break-after: always;
            break-after: page;
          }
          .batch-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          .batch-header,
          .batch-general-section,
          .batch-expirations,
          .batch-verification-group,
          .batch-signatures {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .batch-verification-section,
          .batch-observations-section,
          .batch-observations-field {
            page-break-inside: auto;
            break-inside: auto;
          }
          .batch-header h1 {
            font-size: 18px !important;
            line-height: 1.2 !important;
            white-space: normal !important;
            overflow-wrap: anywhere !important;
          }
          .batch-print-wrapper h3 {
            font-size: 12px !important;
            line-height: 1.2 !important;
            white-space: normal !important;
            overflow-wrap: anywhere !important;
            page-break-after: avoid;
            break-after: avoid;
          }
          .batch-print-wrapper h4 {
            font-size: 10px !important;
            line-height: 1.2 !important;
            white-space: normal !important;
            overflow-wrap: anywhere !important;
          }
          .batch-section {
            min-width: 0 !important;
            max-width: 100% !important;
            padding: 5px !important;
            margin-bottom: 5px !important;
            border: 1px solid #CCC !important;
            overflow: visible !important;
          }
          .batch-grid-3 {
            display: grid !important;
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 5px !important;
            min-width: 0 !important;
            max-width: 100% !important;
          }
          .batch-grid-4 {
            display: grid !important;
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            gap: 5px !important;
            min-width: 0 !important;
            max-width: 100% !important;
          }
          .batch-grid-3 > *,
          .batch-grid-4 > *,
          .batch-verification-group,
          .batch-verification-item,
          .batch-verification-item > span,
          .batch-observations-field {
            min-width: 0 !important;
            max-width: 100% !important;
          }
          .batch-verification-item > div {
            flex: 0 0 12px !important;
          }
          .batch-verification-item > span {
            white-space: normal !important;
            overflow-wrap: anywhere !important;
          }
          .batch-label {
            color: black !important;
            font-size: 9px !important;
            font-weight: bold;
            margin-bottom: 2px !important;
            display: block;
            min-width: 0 !important;
            max-width: 100% !important;
            white-space: normal !important;
            overflow-wrap: anywhere !important;
            text-transform: none !important;
            letter-spacing: normal !important;
          }
          .batch-observations-field .batch-label {
            page-break-after: avoid;
            break-after: avoid;
          }
          .batch-value {
            border: 1px solid #CCC !important;
            padding: 4px !important;
            font-size: 10px !important;
            border-radius: 4px !important;
            background: white !important;
            color: black !important;
            min-width: 0 !important;
            max-width: 100% !important;
            height: auto !important;
            white-space: normal !important;
            overflow-wrap: anywhere !important;
            word-break: break-word !important;
            overflow: visible !important;
          }
          .batch-signatures {
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 16px !important;
            align-items: flex-start !important;
            justify-content: space-between !important;
            min-width: 0 !important;
            max-width: 100% !important;
          }
          .batch-signature {
            flex: 1 1 240px !important;
            min-width: 0 !important;
            max-width: 100% !important;
          }
          .batch-signature-line {
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
          }
          .batch-signature p,
          .batch-signature strong {
            white-space: normal !important;
            overflow-wrap: anywhere !important;
          }
        }
      `}} />
    </div>
  );
};

export default PrintableChecklistBatch;
