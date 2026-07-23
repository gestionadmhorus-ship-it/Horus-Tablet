import { PRELOADED_LISTS } from '../constants/preloadedData';

/* ─── Knowledge Base ─── */
export interface AnomalyEntry {
  name: string;
  recommendation: string;
}

export interface ElementEntry {
  name: string;
  category?: string;
  anomalies: AnomalyEntry[];
}

/* ─── Configurable Lists ─── */
export interface ListsData {
  coordinators: string[];
  pilots: string[];
  assistants: string[];
  vehicles: string[];
  drones: string[];
  elements: ElementEntry[];     // Hierarchical: element → anomalies → recommendations
  criticalities: string[];
}

export const DEFAULT_LISTS: ListsData = PRELOADED_LISTS;

/* ─── Form Records ─── */
export interface ShiftData {
  id: string;
  timestamp: string;
  coordinator: string;
  assistants: string[];
  assistant?: string;
  vehicle: string;
  drone: string;
  status?: 'active' | 'closed';
  deviceName?: string;
  isSynced?: boolean;
  isEdited?: boolean;
  editedTimestamp?: string;
  lastModified?: number;
  isDeleted?: boolean;
}

export interface FlightData {
  id: string;
  shiftId?: string; // Foreign key
  timestamp: string;
  pilot: string;
  lineName: string;
  authCode: string;
  observations: string;
  category?: string;
  deviceName?: string;
  isSynced?: boolean;
  isEdited?: boolean;
  editedTimestamp?: string;
  flightType?: 'KMS' | 'HS';
  stage?: string;
  taskTypeAndLocation?: string;
  details?: string;
  requestedBy?: string;
  status?: 'active' | 'closed';
  closedTimestamp?: string;
  closingObservations?: string;
  lastModified?: number;
  isDeleted?: boolean;
}

export interface BatteryData {
  id: string;
  flightId?: string; // Foreign key
  timestamp: string;
  pilot: string;
  droneBatteryName: string;   // Alphanumeric ID, max 3 chars
  controlBatteryName: string; // Alphanumeric ID, max 3 chars
  deviceName?: string;
  isSynced?: boolean;
  isEdited?: boolean;
  editedTimestamp?: string;
  lastModified?: number;
  isDeleted?: boolean;
}

export interface DetectionData {
  id: string;
  flightId?: string; // Foreign key
  timestamp: string;
  element: string;
  anomaly: string;
  recommendation: string;   // Auto-populated from knowledge base
  criticality: string;
  accessStatus?: string;
  fileName: string;
  observations: string;
  deviceName?: string;
  isSynced?: boolean;
  isEdited?: boolean;
  editedTimestamp?: string;
  lastModified?: number;
  isDeleted?: boolean;
}

export interface VehicleChecklistData {
  id: string;
  timestamp: string;
  vehicleId: string;
  driver: string;
  mileage: number;
  checks: {
    oil: boolean;
    brakesFluid: boolean;
    coolant: boolean;
    steeringFluid: boolean;
    washerFluid: boolean;
    tirePressure: boolean;
    tireWear: boolean;
    spareWheel: boolean;
    handbrake: boolean;
    lights: boolean;
    mirrors: boolean;
    horn: boolean;
    wipers: boolean;
    seatbelts: boolean;
    greenCard: boolean;
    drivingLicense: boolean;
    fireExtinguisher: boolean;
    firstAidKit: boolean;
  };
  expirations: {
    fireExtinguisher: string;
    vtv: string;
    insurance: string;
  };
  observations: string;
  deviceName?: string;
  isSynced?: boolean;
  isEdited?: boolean;
  editedTimestamp?: string;
  lastModified?: number;
  isDeleted?: boolean;
}

export interface DroneChecklistData {
  id: string;
  timestamp: string;
  pilot: string;
  droneId: string;
  checks: {
    // Fase 1: Inspección Física (Dron y Control APAGADOS)
    frameSecured: boolean;
    landingGearLocked: boolean;
    propellersIntact: boolean;
    motorsFreeSpinning: boolean;
    batterySecured: boolean;
    cameraProtectorRemoved: boolean;
    sdCardInsertedPhysically: boolean;
    areaSecured: boolean;

    // Fase 2: Puesta en Marcha y Enlace (Encendido)
    rcAntennasDeployed: boolean;
    rcSticksCentered: boolean;
    appStarted: boolean;
    dronePoweredOn: boolean;
    rcDroneLinked: boolean;

    // Fase 3: Verificación Sistémica (Sistema Conectado)
    systemBatteriesChecked: boolean;
    imuCompassCalibrated: boolean;
    gpsLockOptimal: boolean;
    rthParamsConfigured: boolean;
    obstacleAvoidanceActive: boolean;
    cameraFeedFluid: boolean;

    // Fase 4: Vuelo y Prueba Inmediata (Despegue)
    casesClosedAndStored: boolean;
    takeoffAreaClear: boolean;
    hoverTestPassed: boolean;
  };
  observations: string;
  deviceName?: string;
  isSynced?: boolean;
  isEdited?: boolean;
  editedTimestamp?: string;
  lastModified?: number;
  isDeleted?: boolean;
}

/* ─── App State ─── */
export interface AppData {
  shifts: ShiftData[];
  flights: FlightData[];
  batteries: BatteryData[];
  detections: DetectionData[];
  checklists?: VehicleChecklistData[];
  droneChecklists?: DroneChecklistData[];
}

/* ─── Sync Configuration ─── */
export type AppRole = 'server' | 'client' | 'unassigned';

export interface KnownClient {
  deviceId: string;
  deviceName: string;
}

export interface SyncConfig {
  role: AppRole;
  deviceId: string; // Used to identify the sender (e.g. "Dron-Alfa")
  myServerId?: string; // The generated UUID if this device is the server
  targetServerId?: string; // The scanned UUID of the boss if this is a client
  blockedClients?: string[]; // Array of deviceNames that the server ignores
}

/* ─── Real-time Unit Telemetry ─── */
export interface UnitStatus {
  deviceId: string;
  deviceName: string;
  peerId?: string;            // Temporary peer ID for Control recovery connections
  connected: boolean;
  lastSeen: number;           // ms epoch — used to detect "no signal"
  hasActiveShift: boolean;
  coordinator?: string;
  vehicle?: string;
  drone?: string;
  assistants?: string[];
  hasActiveFlight: boolean;
  activeFlightType?: 'KMS' | 'HS';
  activeFlightName?: string;
  kmsCount: number;
  hsCount: number;
  detectionsCount: number;
  appVersion?: string;
}

export const INSPECTION_CATEGORIES = [
  "Línea de 13.2 kV",
  "Línea de 33 kV",
  "Línea de 132 kV",
  "SET/ETR",
  "Otros"
];
