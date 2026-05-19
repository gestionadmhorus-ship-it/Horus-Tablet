import Dexie, { type Table } from 'dexie';
import type { ShiftData, FlightData, BatteryData, DetectionData, ListsData } from '../types';

export class MainDatabase extends Dexie {
  shifts!: Table<ShiftData>;
  flights!: Table<FlightData>;
  batteries!: Table<BatteryData>;
  detections!: Table<DetectionData>;
  settings!: Table<{ id: string; data: ListsData }>;

  constructor() {
    super('TabletCampoDB');
    this.version(1).stores({
      shifts: 'id, timestamp, coordinator',
      flights: 'id, timestamp, pilot',
      batteries: 'id, timestamp, pilot',
      detections: 'id, timestamp, element, anomaly',
      settings: 'id'
    });

    this.version(2).stores({
      flights: 'id, shiftId, timestamp, pilot',
      batteries: 'id, flightId, timestamp, pilot',
      detections: 'id, flightId, timestamp, element, anomaly'
    });
  }
}

export const db = new MainDatabase();
