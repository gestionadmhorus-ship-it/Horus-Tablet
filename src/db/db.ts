import Dexie, { type Table } from 'dexie';
import type {
  ShiftData, FlightData, BatteryData, DetectionData, ListsData,
  VehicleChecklistData, DroneChecklistData, HistoricalEntityType,
  HistoricalOriginalRecord, HistoricalOverrideRecord, HistoricalTrashRecord,
  HistoricalConflictRecord, HistoricalRecordPayload
} from '../types';

const createRecordUid = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `rec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
};

export class MainDatabase extends Dexie {
  shifts!: Table<ShiftData>;
  flights!: Table<FlightData>;
  batteries!: Table<BatteryData>;
  detections!: Table<DetectionData>;
  settings!: Table<{ id: string; data: ListsData }>;
  vehicleChecklists!: Table<VehicleChecklistData>;
  droneChecklists!: Table<DroneChecklistData>;
  historicalOriginals!: Table<HistoricalOriginalRecord>;
  historicalOverrides!: Table<HistoricalOverrideRecord>;
  historicalTrash!: Table<HistoricalTrashRecord>;
  historicalConflicts!: Table<HistoricalConflictRecord>;
  operationalShifts!: Table<ShiftData, string>;
  operationalFlights!: Table<FlightData, string>;
  operationalBatteries!: Table<BatteryData, string>;
  operationalDetections!: Table<DetectionData, string>;
  operationalVehicleChecklists!: Table<VehicleChecklistData, string>;
  operationalDroneChecklists!: Table<DroneChecklistData, string>;

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

    this.version(3).stores({
      vehicleChecklists: 'id, vehicleId, timestamp'
    });

    this.version(4).stores({
      droneChecklists: 'id, droneId, timestamp'
    });

    this.version(5).stores({
      shifts: 'id, timestamp, coordinator',
      flights: 'id, shiftId, timestamp, pilot',
      batteries: 'id, flightId, timestamp, pilot',
      detections: 'id, flightId, timestamp, element, anomaly',
      settings: 'id',
      vehicleChecklists: 'id, vehicleId, timestamp',
      droneChecklists: 'id, droneId, timestamp',
      historicalOriginals: 'recordUid, [entityType+sourceDeviceId+legacyId], entityType, sourceDeviceId, legacyId, capturedAt, originalStatus',
      historicalOverrides: 'recordUid, [entityType+sourceDeviceId+legacyId], entityType, sourceDeviceId, legacyId, updatedAt, originalStatus',
      historicalTrash: 'recordUid, [entityType+sourceDeviceId+legacyId], entityType, sourceDeviceId, legacyId, deletedAt, originalStatus'
    }).upgrade(async transaction => {
      const originals = transaction.table<HistoricalOriginalRecord, string>('historicalOriginals');
      const overrides = transaction.table<HistoricalOverrideRecord, string>('historicalOverrides');
      const trash = transaction.table<HistoricalTrashRecord, string>('historicalTrash');
      const migratedAt = Date.now();

      const migrateTable = async (tableName: string, entityType: HistoricalEntityType) => {
        const table = transaction.table<HistoricalRecordPayload, string>(tableName);
        const records = await table.toArray();

        for (const currentRecord of records) {
          const existingUid = typeof currentRecord.recordUid === 'string' && currentRecord.recordUid.trim()
            ? currentRecord.recordUid
            : undefined;
          const recordUid = existingUid || createRecordUid();
          const explicitSourceDeviceId = typeof currentRecord.sourceDeviceId === 'string' && currentRecord.sourceDeviceId.trim()
            ? currentRecord.sourceDeviceId
            : undefined;
          const shiftOriginDeviceId = entityType === 'shift'
            && 'originDeviceId' in currentRecord
            && typeof currentRecord.originDeviceId === 'string'
            && currentRecord.originDeviceId.trim()
              ? currentRecord.originDeviceId
              : undefined;
          const sourceDeviceId = explicitSourceDeviceId || shiftOriginDeviceId;
          const enrichedRecord = {
            ...currentRecord,
            recordUid,
            ...(sourceDeviceId ? { sourceDeviceId } : {})
          } as HistoricalRecordPayload;

          if (!existingUid || (sourceDeviceId && !explicitSourceDeviceId)) {
            await table.put(enrichedRecord);
          }

          if (currentRecord.isEdited) {
            if (!await overrides.get(recordUid)) {
              await overrides.add({
                recordUid,
                entityType,
                legacyId: currentRecord.id,
                sourceDeviceId,
                originalStatus: 'unavailable',
                capturedFrom: 'legacyMigration',
                updatedAt: currentRecord.lastModified || migratedAt,
                payload: enrichedRecord
              });
            }
          } else if (!currentRecord.isDeleted && !await originals.get(recordUid)) {
            await originals.add({
              recordUid,
              entityType,
              legacyId: currentRecord.id,
              sourceDeviceId,
              originalStatus: 'legacyBaseline',
              capturedFrom: 'legacyMigration',
              capturedAt: migratedAt,
              payload: enrichedRecord
            });
          }

          if (currentRecord.isDeleted && !await trash.get(recordUid)) {
            await trash.add({
              recordUid,
              entityType,
              legacyId: currentRecord.id,
              sourceDeviceId,
              originalStatus: 'unavailable',
              capturedFrom: 'legacyMigration',
              deletedAt: currentRecord.lastModified || migratedAt,
              deletionKind: 'legacyTombstone',
              payload: enrichedRecord
            });
          }
        }
      };

      await migrateTable('shifts', 'shift');
      await migrateTable('flights', 'flight');
      await migrateTable('batteries', 'battery');
      await migrateTable('detections', 'detection');
      await migrateTable('vehicleChecklists', 'vehicleChecklist');
      await migrateTable('droneChecklists', 'droneChecklist');
    });

    this.version(6).stores({
      shifts: 'id, timestamp, coordinator',
      flights: 'id, shiftId, timestamp, pilot',
      batteries: 'id, flightId, timestamp, pilot',
      detections: 'id, flightId, timestamp, element, anomaly',
      settings: 'id',
      vehicleChecklists: 'id, vehicleId, timestamp',
      droneChecklists: 'id, droneId, timestamp',
      historicalOriginals: 'recordUid, [entityType+sourceDeviceId+legacyId], entityType, sourceDeviceId, legacyId, capturedAt, originalStatus',
      historicalOverrides: 'recordUid, [entityType+sourceDeviceId+legacyId], entityType, sourceDeviceId, legacyId, updatedAt, originalStatus, editorRole, conflictStatus',
      historicalTrash: 'recordUid, [entityType+sourceDeviceId+legacyId], entityType, sourceDeviceId, legacyId, deletedAt, originalStatus, active, permanentlyRemovedAt',
      historicalConflicts: 'recordUid, [entityType+sourceDeviceId+legacyId], entityType, sourceDeviceId, legacyId, receivedAt, conflictStatus'
    });

    this.version(7).stores({
      shifts: 'id, timestamp, coordinator', flights: 'id, shiftId, timestamp, pilot',
      batteries: 'id, flightId, timestamp, pilot', detections: 'id, flightId, timestamp, element, anomaly',
      settings: 'id', vehicleChecklists: 'id, vehicleId, timestamp', droneChecklists: 'id, droneId, timestamp',
      historicalOriginals: 'recordUid, [entityType+sourceDeviceId+legacyId], entityType, sourceDeviceId, legacyId, capturedAt, originalStatus',
      historicalOverrides: 'recordUid, [entityType+sourceDeviceId+legacyId], entityType, sourceDeviceId, legacyId, updatedAt, originalStatus, editorRole, conflictStatus',
      historicalTrash: 'recordUid, [entityType+sourceDeviceId+legacyId], entityType, sourceDeviceId, legacyId, deletedAt, originalStatus, active, permanentlyRemovedAt',
      historicalConflicts: 'recordUid, [entityType+sourceDeviceId+legacyId], entityType, sourceDeviceId, legacyId, receivedAt, conflictStatus',
      operationalShifts: 'recordUid, id, sourceDeviceId, [sourceDeviceId+id], timestamp, status',
      operationalFlights: 'recordUid, id, sourceDeviceId, [sourceDeviceId+id], shiftRecordUid, shiftId, timestamp, status',
      operationalBatteries: 'recordUid, id, sourceDeviceId, [sourceDeviceId+id], flightRecordUid, flightId, timestamp',
      operationalDetections: 'recordUid, id, sourceDeviceId, [sourceDeviceId+id], flightRecordUid, flightId, timestamp',
      operationalVehicleChecklists: 'recordUid, id, sourceDeviceId, [sourceDeviceId+id], timestamp',
      operationalDroneChecklists: 'recordUid, id, sourceDeviceId, [sourceDeviceId+id], timestamp'
    }).upgrade(async transaction => {
      const definitions: Array<[string, string, HistoricalEntityType]> = [
        ['shifts', 'operationalShifts', 'shift'], ['flights', 'operationalFlights', 'flight'],
        ['batteries', 'operationalBatteries', 'battery'], ['detections', 'operationalDetections', 'detection'],
        ['vehicleChecklists', 'operationalVehicleChecklists', 'vehicleChecklist'],
        ['droneChecklists', 'operationalDroneChecklists', 'droneChecklist']
      ];
      const currentByUid = new Map<string, { entityType: HistoricalEntityType; payload: HistoricalRecordPayload }>();
      for (const [legacyName, , entityType] of definitions) {
        const records = await transaction.table<HistoricalRecordPayload, string>(legacyName).toArray();
        records.forEach(payload => { if (payload.recordUid) currentByUid.set(payload.recordUid, { entityType, payload }); });
      }
      const originals = await transaction.table<HistoricalOriginalRecord, string>('historicalOriginals').toArray();
      originals.forEach(item => { if (!currentByUid.has(item.recordUid)) currentByUid.set(item.recordUid, { entityType: item.entityType, payload: item.payload }); });
      const overrides = await transaction.table<HistoricalOverrideRecord, string>('historicalOverrides').toArray();
      overrides.forEach(item => currentByUid.set(item.recordUid, { entityType: item.entityType, payload: item.payload }));
      const trash = await transaction.table<HistoricalTrashRecord, string>('historicalTrash').toArray();
      trash.forEach(item => {
        if (item.active !== false && !item.restoredAt) currentByUid.set(item.recordUid, { entityType: item.entityType, payload: { ...item.payload, isDeleted: true } });
      });

      const shifts = Array.from(currentByUid.values()).filter(item => item.entityType === 'shift').map(item => item.payload as ShiftData);
      const shiftCandidates = (source: string | undefined, legacyId: string | undefined) => shifts.filter(item => item.sourceDeviceId === source && item.id === legacyId);
      const flights = Array.from(currentByUid.values()).filter(item => item.entityType === 'flight').map(item => item.payload as FlightData);
      const flightCandidates = (source: string | undefined, legacyId: string | undefined) => flights.filter(item => item.sourceDeviceId === source && item.id === legacyId);

      for (const [recordUid, current] of currentByUid) {
        let payload = { ...current.payload, recordUid } as HistoricalRecordPayload;
        if (current.entityType === 'flight') {
          const flight = payload as FlightData;
          const candidates = flight.shiftRecordUid ? shifts.filter(item => item.recordUid === flight.shiftRecordUid) : shiftCandidates(flight.sourceDeviceId, flight.shiftId);
          payload = { ...flight, shiftRecordUid: candidates.length === 1 ? candidates[0].recordUid : flight.shiftRecordUid, globalRelationStatus: candidates.length === 1 ? 'resolved' : candidates.length === 0 ? 'unresolved' : 'ambiguous' };
        } else if (current.entityType === 'battery' || current.entityType === 'detection') {
          const child = payload as BatteryData | DetectionData;
          const candidates = child.flightRecordUid ? flights.filter(item => item.recordUid === child.flightRecordUid) : flightCandidates(child.sourceDeviceId, child.flightId);
          payload = { ...child, flightRecordUid: candidates.length === 1 ? candidates[0].recordUid : child.flightRecordUid, globalRelationStatus: candidates.length === 1 ? 'resolved' : candidates.length === 0 ? 'unresolved' : 'ambiguous' };
        }
        const target = definitions.find(([, , type]) => type === current.entityType)![1];
        await transaction.table(target).put(payload);
      }
    });
  }
}

export const db = new MainDatabase();

