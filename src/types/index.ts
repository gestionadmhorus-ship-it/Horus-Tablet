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
}

export interface FlightData {
  id: string;
  shiftId?: string; // Foreign key
  timestamp: string;
  pilot: string;
  lineName: string;
  authCode: string;
  observations: string;
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
}

/* ─── App State ─── */
export interface AppData {
  shifts: ShiftData[];
  flights: FlightData[];
  batteries: BatteryData[];
  detections: DetectionData[];
}
