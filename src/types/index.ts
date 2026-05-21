import { PRELOADED_LISTS } from '../constants/preloadedData';

/* ─── Knowledge Base ─── */
export interface AnomalyEntry {
  name: string;
  recommendation: string;
}

export interface ElementEntry {
  name: string;
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
}

export interface FlightData {
  id: string;
  shiftId?: string; // Foreign key
  timestamp: string;
  pilot: string;
  lineName: string;
  authCode: string;
  observations: string;
  deviceName?: string;
  isSynced?: boolean;
}

export interface BatteryData {
  id: string;
  flightId?: string; // Foreign key
  timestamp: string;
  pilot: string;
  droneBatteryName: string;   // Alphanumeric ID, max 3 chars
  droneBattery: string;
  controlBatteryName: string; // Alphanumeric ID, max 3 chars
  controlBattery: string;
  deviceName?: string;
  isSynced?: boolean;
}

export interface DetectionData {
  id: string;
  flightId?: string; // Foreign key
  timestamp: string;
  element: string;
  anomaly: string;
  recommendation: string;   // Auto-populated from knowledge base
  criticality: string;
  fileName: string;
  observations: string;
  deviceName?: string;
  isSynced?: boolean;
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
}

/* ─── App State ─── */
export interface AppData {
  shifts: ShiftData[];
  flights: FlightData[];
  batteries: BatteryData[];
  detections: DetectionData[];
  checklists?: VehicleChecklistData[];
}

/* ─── Sync Configuration ─── */
export type AppRole = 'server' | 'client' | 'unassigned';

export interface SyncConfig {
  role: AppRole;
  deviceId: string; // Used to identify the sender (e.g. "Dron-Alfa")
  myServerId?: string; // The generated UUID if this device is the server
  targetServerId?: string; // The scanned UUID of the boss if this is a client
  blockedClients?: string[]; // Array of deviceNames that the server ignores
}
