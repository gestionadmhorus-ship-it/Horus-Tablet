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
  clients: string[];
  coordinators: string[];
  pilots: string[];
  assistants: string[];
  vehicles: string[];
  drones: string[];
  elements: ElementEntry[];     // Hierarchical: element → anomalies → recommendations
  criticalities: string[];
}

export const DEFAULT_LISTS: ListsData = PRELOADED_LISTS;

export type HistoricalEntityType =
  | 'shift'
  | 'flight'
  | 'battery'
  | 'detection'
  | 'vehicleChecklist'
  | 'droneChecklist';

export type HistoricalOriginalStatus = 'verified' | 'legacyBaseline' | 'unavailable';

export type HistoricalCaptureSource = 'localCreation' | 'fieldSync' | 'legacyMigration';
export type HistoricalEditorRole = 'control' | 'field';
export type HistoricalChangeKind = 'directEdit' | 'descendantEdited' | 'descendantDeleted';
export type HistoricalConflictStatus = 'none' | 'pending' | 'accepted' | 'rejected';

export interface HistoricalRecordIdentity {
  recordUid?: string;
  sourceDeviceId?: string;
  globalRelationStatus?: 'resolved' | 'unresolved' | 'ambiguous';
}

export type ConfigurableListsSnapshot = Omit<ListsData, 'elements' | 'clients'> & { clients?: string[] };

/* ─── Form Records ─── */
export interface ShiftData extends HistoricalRecordIdentity {
  id: string;
  client?: string;
  timestamp: string;
  coordinator: string;
  assistants: string[];
  assistant?: string;
  vehicle: string;
  drone: string;
  status?: 'active' | 'closed';
  deviceName?: string;
  originDeviceId?: string;
  isSynced?: boolean;
  isEdited?: boolean;
  editedTimestamp?: string;
  lastModified?: number;
  isDeleted?: boolean;
}

export interface FlightData extends HistoricalRecordIdentity {
  id: string;
  shiftId?: string; // Foreign key
  shiftRecordUid?: string;
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

export interface BatteryData extends HistoricalRecordIdentity {
  id: string;
  flightId?: string; // Foreign key
  flightRecordUid?: string;
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

export interface DetectionData extends HistoricalRecordIdentity {
  id: string;
  flightId?: string; // Foreign key
  flightRecordUid?: string;
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

export interface VehicleChecklistData extends HistoricalRecordIdentity {
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

export interface DroneChecklistData extends HistoricalRecordIdentity {
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
  knowledgeBase?: ElementEntry[];
}

export type HistoricalRecordPayload =
  | ShiftData
  | FlightData
  | BatteryData
  | DetectionData
  | VehicleChecklistData
  | DroneChecklistData;

export interface HistoricalOriginalRecord {
  recordUid: string;
  entityType: HistoricalEntityType;
  legacyId: string;
  sourceDeviceId?: string;
  originalStatus: Exclude<HistoricalOriginalStatus, 'unavailable'>;
  capturedFrom: HistoricalCaptureSource;
  capturedAt: number;
  payload: HistoricalRecordPayload;
}

export interface HistoricalOverrideRecord {
  recordUid: string;
  entityType: HistoricalEntityType;
  legacyId: string;
  sourceDeviceId?: string;
  originalStatus: HistoricalOriginalStatus;
  capturedFrom: HistoricalCaptureSource;
  updatedAt: number;
  editorRole?: HistoricalEditorRole;
  editorDeviceId?: string;
  changeKind?: HistoricalChangeKind;
  conflictStatus?: HistoricalConflictStatus;
  payload: HistoricalRecordPayload;
}

export interface HistoricalTrashRecord {
  recordUid: string;
  entityType: HistoricalEntityType;
  legacyId: string;
  sourceDeviceId?: string;
  originalStatus: HistoricalOriginalStatus;
  capturedFrom: HistoricalCaptureSource;
  deletedAt: number;
  deletionKind: 'direct' | 'cascade' | 'legacyTombstone';
  active?: boolean;
  restoredAt?: number;
  permanentlyRemovedAt?: number;
  payload: HistoricalRecordPayload;
}

export interface HistoricalConflictRecord {
  recordUid: string;
  entityType: HistoricalEntityType;
  legacyId: string;
  sourceDeviceId?: string;
  editorRole: 'field';
  editorDeviceId?: string;
  changeKind: 'directEdit';
  conflictStatus: Exclude<HistoricalConflictStatus, 'none'>;
  receivedAt: number;
  resolvedAt?: number;
  resolution?: 'acceptedField' | 'keptControl';
  payload: HistoricalRecordPayload;
}

export interface HistoricalArchive {
  schemaVersion: 1 | 2;
  generation: number;
  createdAt: string;
  originals: HistoricalOriginalRecord[];
  currentOverrides: HistoricalOverrideRecord[];
  trash: HistoricalTrashRecord[];
  conflicts: HistoricalConflictRecord[];
  operationalState?: AppData;
  knowledgeBase?: ElementEntry[];
  configurableLists?: ConfigurableListsSnapshot;
  metadata: {
    application: 'Hermes 2.0';
    checksumAlgorithm: 'SHA-256';
    contentChecksum: string;
  };
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
