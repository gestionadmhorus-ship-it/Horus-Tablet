import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import {
  DEFAULT_LISTS, type ListsData, type AppData, type ShiftData, type FlightData,
  type BatteryData, type DetectionData, type DroneChecklistData,
  type HistoricalEntityType, type HistoricalRecordPayload,
  type HistoricalOriginalStatus, type HistoricalCaptureSource,
  type HistoricalEditorRole, type ConfigurableListsSnapshot
} from '../types';
import { useEffect, useMemo, useRef, useState } from 'react';
import { persistToDisk, loadFromDisk, persistHistoricalToDisk, loadHistoricalFromDisk } from '../services/NativeStorage';
import { formatTimestamp } from '../utils/dateUtils';
import { buildHistoricalStateMap, getConsolidatedView } from '../utils/historicalView';

export function useDatabase() {
  const [historicalStorageReady, setHistoricalStorageReady] = useState(false);
  // 1. Live Queries for real-time UI updates
  const shifts = useLiveQuery(() => db.operationalShifts.filter(i => !i.isDeleted).toArray()) || [];
  const flights = useLiveQuery(() => db.operationalFlights.filter(i => !i.isDeleted).toArray()) || [];
  const batteries = useLiveQuery(() => db.operationalBatteries.filter(i => !i.isDeleted).toArray()) || [];
  const detections = useLiveQuery(async () => {
    const list = await db.operationalDetections.filter(i => !i.isDeleted).toArray();
    return list.map(d => ({ ...d, accessStatus: d.accessStatus || 'Buena' }));
  }) || [];
  const checklists = useLiveQuery(() => db.operationalVehicleChecklists.filter(i => !i.isDeleted).toArray()) || [];
  const droneChecklists = useLiveQuery(() => db.operationalDroneChecklists.filter(i => !i.isDeleted).toArray()) || [];
  const historicalOriginals = useLiveQuery(() => db.historicalOriginals.toArray()) || [];
  const historicalOverrides = useLiveQuery(() => db.historicalOverrides.toArray()) || [];
  const historicalTrash = useLiveQuery(() => db.historicalTrash.toArray()) || [];
  const historicalConflicts = useLiveQuery(() => db.historicalConflicts.toArray()) || [];
  
  // 2. Settings management (ListsData)
  const settingsRow = useLiveQuery(() => db.settings.get('current'));
  const lists: ListsData = useMemo(() => settingsRow?.data
    ? { ...DEFAULT_LISTS, ...settingsRow.data, clients: settingsRow.data.clients || [] }
    : DEFAULT_LISTS, [settingsRow?.data]);
  const configurableLists = useMemo(() => {
    const { elements: _elements, ...flatLists } = lists;
    return flatLists;
  }, [lists]);

  // 3. Migration & Seeding logic (runs exactly ONCE per app lifecycle)
  //    Uses a ref guard to prevent the race condition where useLiveQuery
  //    returns undefined while Dexie is still loading (indistinguishable
  //    from "row does not exist"), which would overwrite user-customized
  //    settings with DEFAULT_LISTS on every reload.
  const hasSeeded = useRef(false);
  const settingsInitializationRef = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    if (hasSeeded.current) return;
    hasSeeded.current = true;

    const migrate = async () => {
      const localDataStr = localStorage.getItem('field_ops_data_v2');
      const localListsStr = localStorage.getItem('field_ops_lists_v3');

      // Explicit DB query to confirm whether settings truly exist
      // (avoids relying on the reactive settingsRow which may be undefined while loading)
      const existingSettings = await db.settings.get('current');

      if (localListsStr && !existingSettings) {
        // Priority: migrate from legacy localStorage if available
        try {
          const localLists = JSON.parse(localListsStr);
          await db.settings.put({ id: 'current', data: { ...DEFAULT_LISTS, ...localLists, clients: localLists.clients || [] } });
          localStorage.removeItem('field_ops_lists_v3');
          console.log('✅ Lists migrated from Legacy Storage');
        } catch (e) { console.error('Migration error (lists):', e); }
      } else if (!existingSettings) {
        // Fresh install: seed with DEFAULT_LISTS
        try {
          await db.settings.put({ id: 'current', data: DEFAULT_LISTS });
          console.log('✅ Database seeded with default technical data');
        } catch (e) { console.error('Seeding error:', e); }
      } else {
        console.log('✅ Settings already exist in DB, skipping seeding');
      }

      if (localDataStr) {
        try {
          const localData: AppData = JSON.parse(localDataStr);
          // Only migrate if DB is empty to avoid duplicates
          const count = await db.shifts.count();
          if (count === 0 && (localData.shifts.length > 0 || localData.flights.length > 0)) {
            await db.shifts.bulkAdd(localData.shifts);
            await db.flights.bulkAdd(localData.flights);
            await db.batteries.bulkAdd(localData.batteries);
            await db.detections.bulkAdd(localData.detections);
            await ensureHistoricalFoundations();
            console.log('✅ Record data migrated to Database');
          }
          localStorage.removeItem('field_ops_data_v2');
        } catch (e) { console.error('Migration error (data):', e); }
      }
    };
    settingsInitializationRef.current = migrate();
  }, []); // Empty deps: run exactly once on mount

  const getDeviceName = () => {
    let name = localStorage.getItem('horus_device_name');
    if (!name || !name.trim()) {
      const generated = `Tablet-${Math.floor(1000 + Math.random() * 9000)}`;
      localStorage.setItem('horus_device_name', generated);
      name = generated;
    }
    if (!localStorage.getItem('horus_device_id')) {
      const devId = 'dev-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(36);
      localStorage.setItem('horus_device_id', devId);
    }
    return name;
  };

  const getDeviceId = () => {
    let deviceId = localStorage.getItem('horus_device_id');
    if (!deviceId) {
      deviceId = 'dev-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(36);
      localStorage.setItem('horus_device_id', deviceId);
    }
    return deviceId;
  };

  const createRecordUid = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `rec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
  };

  const withRecordIdentity = <T extends HistoricalRecordPayload>(
    item: T,
    requestedSourceDeviceId?: string | null
  ): T => {
    const sourceDeviceId = requestedSourceDeviceId === null
      ? item.sourceDeviceId
      : requestedSourceDeviceId || item.sourceDeviceId || getDeviceId();
    return {
      ...item,
      recordUid: item.recordUid || createRecordUid(),
      ...(sourceDeviceId ? { sourceDeviceId } : {})
    };
  };

  const addOriginalIfAbsent = async (
    item: HistoricalRecordPayload,
    entityType: HistoricalEntityType,
    originalStatus: Exclude<HistoricalOriginalStatus, 'unavailable'>,
    capturedFrom: HistoricalCaptureSource
  ) => {
    if (!item.recordUid) throw new Error('No se puede capturar un original sin recordUid.');
    if (await db.historicalOriginals.get(item.recordUid)) return;
    await db.historicalOriginals.add({
      recordUid: item.recordUid,
      entityType,
      legacyId: item.id,
      sourceDeviceId: item.sourceDeviceId,
      originalStatus,
      capturedFrom,
      capturedAt: Date.now(),
      payload: item
    });
  };

  const legacyTableForEntity = (entityType: HistoricalEntityType): any => ({
    shift: db.shifts, flight: db.flights, battery: db.batteries, detection: db.detections,
    vehicleChecklist: db.vehicleChecklists, droneChecklist: db.droneChecklists
  })[entityType];

  const addNewRecord = async <T extends HistoricalRecordPayload>(
    table: any,
    item: T,
    entityType: HistoricalEntityType
  ) => {
    let record = withRecordIdentity({
      ...item,
      isSynced: false,
      lastModified: Date.now(),
      deviceName: item.deviceName || getDeviceName()
    } as T);
    if (entityType === 'flight' && !(record as FlightData).shiftRecordUid) {
      const candidates = await db.operationalShifts.where('[sourceDeviceId+id]').equals([record.sourceDeviceId || '', (record as FlightData).shiftId || '']).toArray();
      record = { ...record, shiftRecordUid: candidates.length === 1 ? candidates[0].recordUid : undefined, globalRelationStatus: candidates.length === 1 ? 'resolved' : candidates.length === 0 ? 'unresolved' : 'ambiguous' } as T;
    } else if ((entityType === 'battery' || entityType === 'detection') && !(record as BatteryData | DetectionData).flightRecordUid) {
      const candidates = await db.operationalFlights.where('[sourceDeviceId+id]').equals([record.sourceDeviceId || '', (record as BatteryData | DetectionData).flightId || '']).toArray();
      record = { ...record, flightRecordUid: candidates.length === 1 ? candidates[0].recordUid : undefined, globalRelationStatus: candidates.length === 1 ? 'resolved' : candidates.length === 0 ? 'unresolved' : 'ambiguous' } as T;
    } else if ((entityType === 'flight' && (record as FlightData).shiftRecordUid)
      || ((entityType === 'battery' || entityType === 'detection') && (record as BatteryData | DetectionData).flightRecordUid)) {
      record = { ...record, globalRelationStatus: 'resolved' } as T;
    }
    const legacyTable = legacyTableForEntity(entityType);
    await db.transaction('rw', [table, legacyTable, db.historicalOriginals], async () => {
      await table.add(record);
      await legacyTable.put(record);
      await addOriginalIfAbsent(record, entityType, 'verified', 'localCreation');
    });
  };

  const updateExistingRecord = async <T extends HistoricalRecordPayload>(
    table: any,
    item: T,
    entityType: HistoricalEntityType
  ): Promise<boolean> => {
    let applied = false;
    const legacyTable = legacyTableForEntity(entityType);
    await db.transaction('rw', [table, legacyTable, db.historicalOriginals, db.historicalOverrides, db.historicalConflicts], async () => {
      const existing = item.recordUid
        ? await table.get(item.recordUid)
        : undefined;
      if (!existing?.recordUid && !item.recordUid) {
        throw new Error(`No se puede editar ${entityType}:${item.id} sin recordUid global.`);
      }
      const sourceDeviceId = item.sourceDeviceId || existing?.sourceDeviceId || null;
      const identifiedItem = withRecordIdentity({
        ...item,
        recordUid: item.recordUid || existing?.recordUid,
        ...(sourceDeviceId ? { sourceDeviceId } : {}),
        ...getEditMetadata(),
        isSynced: false,
        deviceName: item.deviceName || existing?.deviceName || getDeviceName()
      } as T, sourceDeviceId);
      const editorRole: HistoricalEditorRole = localStorage.getItem('horus_sync_role') === 'server' ? 'control' : 'field';
      const existingOverride = await db.historicalOverrides.get(identifiedItem.recordUid!);
      const existingConflict = await db.historicalConflicts.get(identifiedItem.recordUid!);
      if (editorRole === 'field' && existingOverride?.editorRole === 'control') {
        await db.historicalConflicts.put({
          recordUid: identifiedItem.recordUid!, entityType, legacyId: identifiedItem.id,
          sourceDeviceId: identifiedItem.sourceDeviceId, editorRole: 'field', editorDeviceId: getDeviceId(),
          changeKind: 'directEdit', conflictStatus: 'pending', receivedAt: Date.now(), payload: identifiedItem
        });
        await db.historicalOverrides.update(identifiedItem.recordUid!, { conflictStatus: 'pending' });
        return;
      }
      await table.put(identifiedItem);
      await legacyTable.put(identifiedItem);
      const original = await db.historicalOriginals.get(identifiedItem.recordUid!);
      await db.historicalOverrides.put({
        recordUid: identifiedItem.recordUid!,
        entityType,
        legacyId: identifiedItem.id,
        sourceDeviceId: identifiedItem.sourceDeviceId,
        originalStatus: original?.originalStatus || 'unavailable',
        capturedFrom: 'localCreation',
        updatedAt: identifiedItem.lastModified || Date.now(),
        editorRole,
        editorDeviceId: getDeviceId(),
        changeKind: 'directEdit',
        conflictStatus: existingConflict?.conflictStatus === 'pending' ? 'pending' : 'none',
        payload: identifiedItem
      });
      applied = true;
    });
    return applied;
  };

  const preserveTrashState = async (
    item: HistoricalRecordPayload,
    entityType: HistoricalEntityType,
    deletionKind: 'direct' | 'cascade' | 'legacyTombstone',
    deletedAt: number
  ) => {
    const identifiedItem = withRecordIdentity(item, item.sourceDeviceId || null);
    const original = await db.historicalOriginals.get(identifiedItem.recordUid!);
    await db.historicalTrash.put({
      recordUid: identifiedItem.recordUid!,
      entityType,
      legacyId: identifiedItem.id,
      sourceDeviceId: identifiedItem.sourceDeviceId,
      originalStatus: original?.originalStatus || 'unavailable',
      capturedFrom: 'localCreation',
      deletedAt,
      deletionKind,
      active: true,
      payload: { ...identifiedItem, isDeleted: true, isSynced: false, lastModified: deletedAt }
    });
    return identifiedItem;
  };

  const markDeleted = async (
    table: any,
    item: HistoricalRecordPayload,
    entityType: HistoricalEntityType,
    deletionKind: 'direct' | 'cascade',
    deletedAt: number
  ) => {
    const identifiedItem = await preserveTrashState(item, entityType, deletionKind, deletedAt);
    const deletedRecord = { ...identifiedItem, isDeleted: true, isSynced: false, lastModified: deletedAt };
    await table.put(deletedRecord);
    await legacyTableForEntity(entityType).put(deletedRecord);
  };

  const deleteSingleRecord = async (table: any, id: string, entityType: HistoricalEntityType) => {
    await db.transaction('rw', [table, legacyTableForEntity(entityType), db.historicalOriginals, db.historicalTrash], async () => {
      const item = await table.get(id);
      if (!item) return;
      await markDeleted(table, item, entityType, 'direct', Date.now());
    });
  };

  const ensureHistoricalFoundations = async () => {
    const operationalTables: Array<[any, HistoricalEntityType]> = [
      [db.shifts, 'shift'],
      [db.flights, 'flight'],
      [db.batteries, 'battery'],
      [db.detections, 'detection'],
      [db.vehicleChecklists, 'vehicleChecklist'],
      [db.droneChecklists, 'droneChecklist']
    ];

    await db.transaction('rw', [
      ...operationalTables.map(([table]) => table),
      db.operationalShifts, db.operationalFlights, db.operationalBatteries, db.operationalDetections,
      db.operationalVehicleChecklists, db.operationalDroneChecklists,
      db.historicalOriginals, db.historicalOverrides, db.historicalTrash
    ], async () => {
      const classifiedAt = Date.now();

      for (const [table, entityType] of operationalTables) {
        const records = await table.toArray() as HistoricalRecordPayload[];
        for (const currentRecord of records) {
          const explicitSourceDeviceId = currentRecord.sourceDeviceId?.trim() || undefined;
          const shiftOriginDeviceId = entityType === 'shift'
            && 'originDeviceId' in currentRecord
            && typeof currentRecord.originDeviceId === 'string'
            && currentRecord.originDeviceId.trim()
              ? currentRecord.originDeviceId
              : undefined;
          const sourceDeviceId = explicitSourceDeviceId || shiftOriginDeviceId;
          const identifiedRecord = withRecordIdentity(currentRecord, sourceDeviceId || null);

          if (!currentRecord.recordUid || (sourceDeviceId && !explicitSourceDeviceId)) {
            await table.put(identifiedRecord);
          }

          let operationalRecord = identifiedRecord;
          if (entityType === 'flight' && !(operationalRecord as FlightData).shiftRecordUid) {
            const candidates = sourceDeviceId ? await db.operationalShifts.where('[sourceDeviceId+id]').equals([sourceDeviceId, (operationalRecord as FlightData).shiftId || '']).toArray() : [];
            operationalRecord = { ...operationalRecord, shiftRecordUid: candidates.length === 1 ? candidates[0].recordUid : undefined, globalRelationStatus: candidates.length === 1 ? 'resolved' : candidates.length === 0 ? 'unresolved' : 'ambiguous' } as HistoricalRecordPayload;
          } else if ((entityType === 'battery' || entityType === 'detection') && !(operationalRecord as BatteryData | DetectionData).flightRecordUid) {
            const candidates = sourceDeviceId ? await db.operationalFlights.where('[sourceDeviceId+id]').equals([sourceDeviceId, (operationalRecord as BatteryData | DetectionData).flightId || '']).toArray() : [];
            operationalRecord = { ...operationalRecord, flightRecordUid: candidates.length === 1 ? candidates[0].recordUid : undefined, globalRelationStatus: candidates.length === 1 ? 'resolved' : candidates.length === 0 ? 'unresolved' : 'ambiguous' } as HistoricalRecordPayload;
          }
          await tableForEntity(entityType).put(operationalRecord);

          if (identifiedRecord.isEdited) {
            if (!await db.historicalOverrides.get(identifiedRecord.recordUid!)) {
              await db.historicalOverrides.add({
                recordUid: identifiedRecord.recordUid!,
                entityType,
                legacyId: identifiedRecord.id,
                sourceDeviceId: identifiedRecord.sourceDeviceId,
                originalStatus: 'unavailable',
                capturedFrom: 'legacyMigration',
                updatedAt: identifiedRecord.lastModified || classifiedAt,
                payload: identifiedRecord
              });
            }
          } else if (!identifiedRecord.isDeleted) {
            await addOriginalIfAbsent(identifiedRecord, entityType, 'legacyBaseline', 'legacyMigration');
          }

          if (identifiedRecord.isDeleted && !await db.historicalTrash.get(identifiedRecord.recordUid!)) {
            await db.historicalTrash.add({
              recordUid: identifiedRecord.recordUid!,
              entityType,
              legacyId: identifiedRecord.id,
              sourceDeviceId: identifiedRecord.sourceDeviceId,
              originalStatus: 'unavailable',
              capturedFrom: 'legacyMigration',
              deletedAt: identifiedRecord.lastModified || classifiedAt,
              deletionKind: 'legacyTombstone',
              payload: identifiedRecord
            });
          }
        }
      }
    });
  };

  // 4. Save/Update/Delete functions
  const patchOperationalProjection = async (table: any, recordUid: string, patch: Record<string, unknown>, entityType: HistoricalEntityType) => {
    const legacyTable = legacyTableForEntity(entityType);
    await db.transaction('rw', [table, legacyTable, db.historicalOverrides], async () => {
      await table.update(recordUid, patch);
      const current = await table.get(recordUid) as HistoricalRecordPayload | undefined;
      if (!current?.recordUid) return;
      await legacyTable.put(current);
      const currentOverride = await db.historicalOverrides.get(current.recordUid);
      if (currentOverride?.editorRole === 'control') {
        await db.historicalOverrides.update(current.recordUid, {
          payload: { ...currentOverride.payload, ...patch } as HistoricalRecordPayload,
          updatedAt: Number(patch.lastModified) || Date.now()
        });
      }
    });
  };

  const saveShift = async (item: ShiftData) => {
    const originDeviceId = getDeviceId();
    const now = new Date();
    const lastModified = now.getTime();
    const closedTimestamp = formatTimestamp(now);
    const newShift = withRecordIdentity({
      ...item,
      originDeviceId,
      isSynced: false,
      lastModified,
      deviceName: item.deviceName || getDeviceName()
    }, originDeviceId);

    await db.transaction('rw', [db.operationalShifts, db.operationalFlights, db.shifts, db.flights, db.historicalOriginals, db.historicalOverrides], async () => {
      const previousOwnShifts = await db.operationalShifts
        .filter(shift => !shift.isDeleted
          && shift.status === 'active'
          && (shift.sourceDeviceId === originDeviceId || shift.originDeviceId === originDeviceId))
        .toArray();

      for (const shift of previousOwnShifts) {
        const flightsToClose = await db.operationalFlights
          .filter(flight => !flight.isDeleted && flight.shiftRecordUid === shift.recordUid && flight.status !== 'closed').toArray();
        for (const flight of flightsToClose) {
          const closePatch = {
            status: 'closed' as const,
            closedTimestamp,
            lastModified,
            isSynced: false
          };
          await db.operationalFlights.update(flight.recordUid!, closePatch);
          await db.flights.update(flight.id, closePatch);
          if (flight.recordUid) {
            const override = await db.historicalOverrides.get(flight.recordUid);
            if (override?.editorRole === 'control') await db.historicalOverrides.update(flight.recordUid, { payload: { ...override.payload, ...closePatch }, updatedAt: lastModified });
          }
        }

        const shiftClosePatch = {
          status: 'closed' as const,
          lastModified,
          isSynced: false
        };
        await db.operationalShifts.update(shift.recordUid!, shiftClosePatch);
        await db.shifts.update(shift.id, shiftClosePatch);
        if (shift.recordUid) {
          const override = await db.historicalOverrides.get(shift.recordUid);
          if (override?.editorRole === 'control') await db.historicalOverrides.update(shift.recordUid, { payload: { ...override.payload, ...shiftClosePatch }, updatedAt: lastModified });
        }
      }

      await db.operationalShifts.add(newShift);
      await db.shifts.put(newShift);
      await addOriginalIfAbsent(newShift, 'shift', 'verified', 'localCreation');
    });
  };
  const getEditMetadata = () => {
    const now = new Date();
    return {
      isEdited: true,
      lastModified: Date.now(),
      editedTimestamp: formatTimestamp(now)
    };
  };

  const updateShift = async (item: ShiftData) => { await updateExistingRecord(db.operationalShifts, item, 'shift'); };
  const closeShift = (recordUid: string, closureEventId?: string) => patchOperationalProjection(db.operationalShifts, recordUid, {
    status: 'closed',
    ...(closureEventId ? { lastClosureEventId: closureEventId } : {}),
    lastModified: Date.now(),
    isSynced: false
  }, 'shift');
  const reopenShift = (recordUid: string) => patchOperationalProjection(db.operationalShifts, recordUid, { status: 'active', lastModified: Date.now(), isSynced: false }, 'shift');
  const deleteShift = async (recordUid: string) => {
    await db.transaction('rw', [db.operationalShifts, db.operationalFlights, db.operationalBatteries, db.operationalDetections, db.shifts, db.flights, db.batteries, db.detections, db.historicalOriginals, db.historicalTrash], async () => {
      const deletedAt = Date.now();
      const shift = await db.operationalShifts.get(recordUid);
      // 1. Find all flights belonging to the shift
      const flightsToDelete = await db.operationalFlights.where('shiftRecordUid').equals(recordUid).toArray();
      const flightIds = flightsToDelete.map(f => f.recordUid!);

      if (flightIds.length > 0) {
        // 2. Delete all batteries for these flights
        const batteriesToDelete = await db.operationalBatteries.where('flightRecordUid').anyOf(flightIds).toArray();
        for (const battery of batteriesToDelete) {
          await markDeleted(db.operationalBatteries, battery, 'battery', 'cascade', deletedAt);
        }

        // 3. Delete all detections for these flights
        const detectionsToDelete = await db.operationalDetections.where('flightRecordUid').anyOf(flightIds).toArray();
        for (const detection of detectionsToDelete) {
          await markDeleted(db.operationalDetections, detection, 'detection', 'cascade', deletedAt);
        }

        // 4. Delete the flights
        for (const flight of flightsToDelete) {
          await markDeleted(db.operationalFlights, flight, 'flight', 'cascade', deletedAt);
        }
      }

      // 5. Delete the shift itself
      if (shift) await markDeleted(db.operationalShifts, shift, 'shift', 'direct', deletedAt);
    });
  };

  const saveFlight = (item: FlightData) => addNewRecord(db.operationalFlights, item, 'flight');
  const updateFlight = async (item: FlightData) => { await updateExistingRecord(db.operationalFlights, item, 'flight'); };
  const closeFlight = (recordUid: string, closedTimestamp: string, closingObservations: string, closureEventId?: string) => patchOperationalProjection(db.operationalFlights, recordUid, {
    status: 'closed',
    closedTimestamp,
    closingObservations,
    ...(closureEventId ? { shiftClosure: {
      eventId: closureEventId,
      closedTimestamp,
      ...(closingObservations ? { closingObservations } : {})
    } } : {}),
    lastModified: Date.now(),
    isSynced: false
  }, 'flight');

  const closeShiftClosure = async (
    shift: ShiftData,
    flights: Array<{ flight: FlightData; closedTimestamp: string; closingObservations: string }>,
    eventId: string,
    eventAt: number
  ): Promise<{ ok: boolean; reason?: 'CONFLICT' | 'INVALID' | 'ERROR'; message?: string }> => {
    if (!shift.recordUid || flights.some(entry => !entry.flight.recordUid)) {
      return { ok: false, reason: 'INVALID', message: 'La Jornada o uno de sus Vuelos no posee identidad global.' };
    }
    const closureFlightRecordUids = flights.map(entry => entry.flight.recordUid!);
    if (new Set(closureFlightRecordUids).size !== closureFlightRecordUids.length) {
      return { ok: false, reason: 'INVALID', message: 'El conjunto de Vuelos del cierre contiene identidades duplicadas.' };
    }

    const editorRole: HistoricalEditorRole = localStorage.getItem('horus_sync_role') === 'server' ? 'control' : 'field';
    if (editorRole === 'field') {
      const protectedRecords = await Promise.all([
        db.historicalOverrides.get(shift.recordUid),
        ...flights.map(entry => db.historicalOverrides.get(entry.flight.recordUid!))
      ]);
      if (protectedRecords.some(override => override?.editorRole === 'control')) {
        return { ok: false, reason: 'CONFLICT', message: 'El cierre fue detenido porque Control protege la Jornada o uno de sus Vuelos. No se modificó ningún registro.' };
      }
    }

    try {
      await db.transaction('rw', [
        db.operationalFlights, db.flights, db.operationalShifts, db.shifts,
        db.historicalOriginals, db.historicalOverrides, db.historicalConflicts
      ], async () => {
        const currentShift = await db.operationalShifts.get(shift.recordUid!);
        if (!currentShift || currentShift.status === 'closed') throw new Error('La Jornada ya no está activa.');

        for (const entry of flights) {
          const currentFlight = await db.operationalFlights.get(entry.flight.recordUid!);
          if (!currentFlight || currentFlight.status === 'closed') throw new Error('Uno de los Vuelos ya no está activo.');
          const belongsToShift = currentShift.recordUid
            ? currentFlight.shiftRecordUid === currentShift.recordUid
            : currentFlight.shiftId === currentShift.id;
          if (!belongsToShift) throw new Error('Uno de los Vuelos ya no pertenece a la Jornada objetivo.');
          const updatedFlight: FlightData = {
            ...currentFlight,
            status: 'closed',
            closedTimestamp: entry.closedTimestamp,
            closingObservations: entry.closingObservations,
            shiftClosure: {
              eventId,
              closedTimestamp: entry.closedTimestamp,
              ...(entry.closingObservations ? { closingObservations: entry.closingObservations } : {})
            }
          };
          if (!await updateExistingRecord(db.operationalFlights, updatedFlight, 'flight')) {
            throw new Error('Control protegió uno de los Vuelos durante el cierre.');
          }
        }

        const updatedShift: ShiftData = {
          ...currentShift,
          status: 'closed',
          lastClosureEventId: eventId,
          lastClosureEventAt: eventAt,
          lastClosureFlightRecordUids: closureFlightRecordUids
        };
        if (!await updateExistingRecord(db.operationalShifts, updatedShift, 'shift')) {
          throw new Error('Control protegió la Jornada durante el cierre.');
        }
      });
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error && error.message.includes('Control') ? 'CONFLICT' : 'ERROR',
        message: error instanceof Error ? error.message : 'No se pudo completar atómicamente el cierre.'
      };
    }
  };

  const reopenShiftClosure = async (
    shift: ShiftData,
    flights: FlightData[],
    legacyEventId?: string
  ): Promise<{ ok: boolean; message?: string }> => {
    if (!shift.recordUid) return { ok: false, message: 'La Jornada no posee identidad global.' };
    if (flights.some(flight => !flight.recordUid)) return { ok: false, message: 'Uno de los Vuelos no posee identidad global.' };

    const editorRole: HistoricalEditorRole = localStorage.getItem('horus_sync_role') === 'server' ? 'control' : 'field';
    if (editorRole === 'field') {
      const protectedRecords = await Promise.all([
        db.historicalOverrides.get(shift.recordUid),
        ...flights.map(flight => db.historicalOverrides.get(flight.recordUid!))
      ]);
      if (protectedRecords.some(override => override?.editorRole === 'control')) {
        return { ok: false, message: 'La reapertura fue detenida porque existe una versión protegida por Control. No se modificó la Jornada ni sus Vuelos.' };
      }
    }

    const undoneAt = Date.now();
    const isLegacyReopen = !!legacyEventId;
    const effectiveEventId = legacyEventId || shift.lastClosureEventId;
    if (flights.some(flight => !(isLegacyReopen ? flight.closedTimestamp : flight.shiftClosure?.closedTimestamp || flight.closedTimestamp))) {
      return { ok: false, message: 'No se puede documentar la reapertura: falta la hora de cierre de uno de los Vuelos.' };
    }
    try {
      await db.transaction('rw', [
        db.operationalFlights, db.flights, db.operationalShifts, db.shifts,
        db.historicalOriginals, db.historicalOverrides, db.historicalConflicts
      ], async () => {
        for (const flight of flights) {
          const existingClosure = flight.shiftClosure;
          const closedTimestamp = (isLegacyReopen ? flight.closedTimestamp : existingClosure?.closedTimestamp || flight.closedTimestamp)!;
          const closingObservations = isLegacyReopen
            ? flight.closingObservations
            : existingClosure?.closingObservations || flight.closingObservations;
          const updatedFlight: FlightData = {
            ...flight,
            status: 'active',
            closedTimestamp: undefined,
            closingObservations: undefined,
            shiftClosure: {
              eventId: effectiveEventId || `legacy-${shift.recordUid}-${undoneAt}`,
              closedTimestamp,
              ...(closingObservations
                ? { closingObservations }
                : {}),
              undoneAt
            }
          };
          if (!await updateExistingRecord(db.operationalFlights, updatedFlight, 'flight')) {
            throw new Error('Control protegió uno de los Vuelos; la Jornada no fue reabierta.');
          }
        }

        const updatedShift: ShiftData = {
          ...shift,
          status: 'active',
          ...(effectiveEventId ? { lastClosureEventId: effectiveEventId } : {}),
          ...(isLegacyReopen ? { lastClosureEventAt: undefined } : {})
        };
        if (!await updateExistingRecord(db.operationalShifts, updatedShift, 'shift')) {
          throw new Error('Control protegió la Jornada; no pudo completarse la reapertura.');
        }
      });
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'No se pudo completar atómicamente la reapertura.' };
    }

    const persistedShift = await db.operationalShifts.get(shift.recordUid);
    const persistedFlights = await Promise.all(flights.map(flight => db.operationalFlights.get(flight.recordUid!)));
    const coherent = persistedShift?.status === 'active'
      && persistedFlights.every(flight => flight?.status === 'active' && !flight.closedTimestamp && !flight.closingObservations);
    return coherent
      ? { ok: true }
      : { ok: false, message: 'La proyección resultante no es coherente; la reapertura no se considera completa.' };
  };
  const deleteFlight = async (recordUid: string) => {
    await db.transaction('rw', [db.operationalFlights, db.operationalBatteries, db.operationalDetections, db.flights, db.batteries, db.detections, db.historicalOriginals, db.historicalTrash], async () => {
      const deletedAt = Date.now();
      const flight = await db.operationalFlights.get(recordUid);
      const batteriesToDelete = await db.operationalBatteries.where('flightRecordUid').equals(recordUid).toArray();
      const detectionsToDelete = await db.operationalDetections.where('flightRecordUid').equals(recordUid).toArray();
      for (const battery of batteriesToDelete) {
        await markDeleted(db.operationalBatteries, battery, 'battery', 'cascade', deletedAt);
      }
      for (const detection of detectionsToDelete) {
        await markDeleted(db.operationalDetections, detection, 'detection', 'cascade', deletedAt);
      }
      if (flight) await markDeleted(db.operationalFlights, flight, 'flight', 'direct', deletedAt);
    });
  };

  const saveBattery = (item: BatteryData) => addNewRecord(db.operationalBatteries, item, 'battery');
  const updateBattery = async (item: BatteryData) => { await updateExistingRecord(db.operationalBatteries, item, 'battery'); };
  const deleteBattery = (recordUid: string) => deleteSingleRecord(db.operationalBatteries, recordUid, 'battery');

  const saveDetection = (item: DetectionData) => addNewRecord(db.operationalDetections, { ...item, accessStatus: item.accessStatus || 'Buena' }, 'detection');
  const updateDetection = async (item: DetectionData) => { await updateExistingRecord(db.operationalDetections, { ...item, accessStatus: item.accessStatus || 'Buena' }, 'detection'); };
  const deleteDetection = (recordUid: string) => deleteSingleRecord(db.operationalDetections, recordUid, 'detection');
  
  const saveChecklist = (item: any) => addNewRecord(db.operationalVehicleChecklists, item, 'vehicleChecklist');
  const updateChecklist = async (item: any) => { await updateExistingRecord(db.operationalVehicleChecklists, item, 'vehicleChecklist'); };
  const deleteChecklist = (recordUid: string) => deleteSingleRecord(db.operationalVehicleChecklists, recordUid, 'vehicleChecklist');

  const saveDroneChecklist = (item: DroneChecklistData) => addNewRecord(db.operationalDroneChecklists, item, 'droneChecklist');
  const updateDroneChecklist = async (item: DroneChecklistData) => { await updateExistingRecord(db.operationalDroneChecklists, item, 'droneChecklist'); };
  const deleteDroneChecklist = (recordUid: string) => deleteSingleRecord(db.operationalDroneChecklists, recordUid, 'droneChecklist');
  
  const updateLists = async (newList: ListsData) => {
    const isLinkedTablet = localStorage.getItem('horus_sync_role') === 'client'
      && !!localStorage.getItem('horus_target_server_id')?.trim();

    await db.transaction('rw', db.settings, async () => {
      const currentSettings = await db.settings.get('current');
      await db.settings.put({
        id: 'current',
        data: isLinkedTablet ? (currentSettings?.data || DEFAULT_LISTS) : newList
      });
    });
  };

  const replaceKnowledgeBase = async (elements: ListsData['elements']) => {
    await db.transaction('rw', db.settings, async () => {
      const currentSettings = await db.settings.get('current');
      await db.settings.put({
        id: 'current',
        data: {
          ...(currentSettings?.data || DEFAULT_LISTS),
          elements
        }
      });
    });
  };

  const replaceOperationalLists = async (incomingLists: ConfigurableListsSnapshot) => {
    await db.transaction('rw', db.settings, async () => {
      const currentSettings = await db.settings.get('current');
      await db.settings.put({
        id: 'current',
        data: {
          ...(currentSettings?.data || DEFAULT_LISTS),
          ...incomingLists,
          clients: incomingLists.clients || []
        }
      });
    });
  };
 
  // ─── Transactional merger for incoming P2P data payload ───
  const syncIncomingData = async (incoming: AppData) => {
    await db.transaction('rw', [
      db.operationalShifts, db.operationalFlights, db.operationalBatteries, db.operationalDetections,
      db.operationalVehicleChecklists, db.operationalDroneChecklists,
      db.shifts, db.flights, db.batteries, db.detections, db.vehicleChecklists, db.droneChecklists,
      db.historicalOriginals, db.historicalOverrides, db.historicalTrash, db.historicalConflicts
    ], async () => {
      const findHistoricalUids = async (
        entityType: HistoricalEntityType,
        sourceDeviceId: string | undefined,
        legacyId: string
      ) => {
        if (!sourceDeviceId) return [] as string[];
        const key = [entityType, sourceDeviceId, legacyId];
        const [originals, overrides, deleted] = await Promise.all([
          db.historicalOriginals.where('[entityType+sourceDeviceId+legacyId]').equals(key).toArray(),
          db.historicalOverrides.where('[entityType+sourceDeviceId+legacyId]').equals(key).toArray(),
          db.historicalTrash.where('[entityType+sourceDeviceId+legacyId]').equals(key).toArray()
        ]);
        return Array.from(new Set([...originals, ...overrides, ...deleted].map(entry => entry.recordUid)));
      };

      const unresolvedLegacyUid = (entityType: HistoricalEntityType, sourceDeviceId: string, legacyId: string) =>
        `legacy-unresolved:${encodeURIComponent(sourceDeviceId)}:${entityType}:${encodeURIComponent(legacyId)}`;

      const syncTable = async (
        table: any,
        items: HistoricalRecordPayload[] | undefined,
        entityType: HistoricalEntityType
      ) => {
        if (!items || items.length === 0) return;
        for (const item of items) {
          const sourceDeviceId = item.sourceDeviceId;
          const historicalUids = await findHistoricalUids(entityType, sourceDeviceId, item.id);
          const operationalCandidates = !item.recordUid && sourceDeviceId
            ? await table.where('[sourceDeviceId+id]').equals([sourceDeviceId, item.id]).toArray() as HistoricalRecordPayload[]
            : [];
          const candidateUids = Array.from(new Set([
            ...historicalUids,
            ...operationalCandidates.map(candidate => candidate.recordUid).filter((uid): uid is string => !!uid)
          ]));
          const matchedHistoricalUid = candidateUids.length === 1
            ? candidateUids[0]
            : candidateUids.length > 1 && sourceDeviceId
              ? unresolvedLegacyUid(entityType, sourceDeviceId, item.id)
              : undefined;
          if (!item.recordUid && candidateUids.length > 1) {
            console.warn(`[Sync] Identidad legacy ambigua conservada sin fusionar: ${entityType}:${sourceDeviceId || 'sin-origen'}:${item.id}`);
          }
          const local = item.recordUid
            ? await table.get(item.recordUid)
            : matchedHistoricalUid
              ? await table.get(matchedHistoricalUid)
              : undefined;
          if (item.recordUid) {
            const knownIdentity = await db.historicalOriginals.get(item.recordUid)
              || await db.historicalOverrides.get(item.recordUid)
              || await db.historicalTrash.get(item.recordUid);
            if (knownIdentity && (
              knownIdentity.entityType !== entityType
              || knownIdentity.legacyId !== item.id
              || (knownIdentity.sourceDeviceId && sourceDeviceId && knownIdentity.sourceDeviceId !== sourceDeviceId)
            )) throw new Error(`recordUid reutilizado con otra identidad lógica: ${item.recordUid}.`);
          }
          const historicalUid = item.recordUid || matchedHistoricalUid;
          const canReuseLocalUid = local?.recordUid
            && (!sourceDeviceId || !local.sourceDeviceId || local.sourceDeviceId === sourceDeviceId);
          let identifiedItem = withRecordIdentity({
            ...item,
            recordUid: historicalUid || (canReuseLocalUid ? local.recordUid : undefined),
            ...(sourceDeviceId ? { sourceDeviceId } : {})
          } as HistoricalRecordPayload, sourceDeviceId || null);
          if (entityType === 'flight') {
            const flight = identifiedItem as FlightData;
            const directParent = flight.shiftRecordUid ? await db.operationalShifts.get(flight.shiftRecordUid) : undefined;
            const directIsValid = !!directParent
              && directParent.id === flight.shiftId
              && (!sourceDeviceId || directParent.sourceDeviceId === sourceDeviceId);
            const candidates = directIsValid ? [directParent] : await db.operationalShifts.where('[sourceDeviceId+id]').equals([sourceDeviceId || '', flight.shiftId || '']).toArray();
            identifiedItem = { ...identifiedItem, shiftRecordUid: candidates.length === 1 ? candidates[0].recordUid : undefined, globalRelationStatus: candidates.length === 1 ? 'resolved' : candidates.length === 0 ? 'unresolved' : 'ambiguous' } as HistoricalRecordPayload;
          } else if (entityType === 'battery' || entityType === 'detection') {
            const child = identifiedItem as BatteryData | DetectionData;
            const directParent = child.flightRecordUid ? await db.operationalFlights.get(child.flightRecordUid) : undefined;
            const directIsValid = !!directParent
              && directParent.id === child.flightId
              && (!sourceDeviceId || directParent.sourceDeviceId === sourceDeviceId);
            const candidates = directIsValid ? [directParent] : await db.operationalFlights.where('[sourceDeviceId+id]').equals([sourceDeviceId || '', child.flightId || '']).toArray();
            identifiedItem = { ...identifiedItem, flightRecordUid: candidates.length === 1 ? candidates[0].recordUid : undefined, globalRelationStatus: candidates.length === 1 ? 'resolved' : candidates.length === 0 ? 'unresolved' : 'ambiguous' } as HistoricalRecordPayload;
          }

          if (!identifiedItem.isEdited && !identifiedItem.isDeleted) {
            await addOriginalIfAbsent(
              identifiedItem,
              entityType,
              sourceDeviceId && !sourceDeviceId.startsWith('legacy-') ? 'verified' : 'legacyBaseline',
              'fieldSync'
            );
          }

          const incomingTime = item.lastModified || 0;
          const localTime = local?.lastModified || 0;
          const currentOverride = await db.historicalOverrides.get(identifiedItem.recordUid!);
          const controlIsAuthoritative = currentOverride?.editorRole === 'control';
          const comparable = (value: HistoricalRecordPayload) => {
            const { isSynced: _isSynced, lastModified: _lastModified, ...rest } = value as any;
            return JSON.stringify(rest);
          };

          if (controlIsAuthoritative) {
            if (comparable(currentOverride.payload) !== comparable(identifiedItem)) {
              const previousConflict = await db.historicalConflicts.get(identifiedItem.recordUid!);
              if (!previousConflict || comparable(previousConflict.payload) !== comparable(identifiedItem)) {
                await db.historicalConflicts.put({
                  recordUid: identifiedItem.recordUid!,
                  entityType,
                  legacyId: identifiedItem.id,
                  sourceDeviceId: identifiedItem.sourceDeviceId,
                  editorRole: 'field',
                  editorDeviceId: identifiedItem.sourceDeviceId,
                  changeKind: 'directEdit',
                  conflictStatus: 'pending',
                  receivedAt: Date.now(),
                  payload: identifiedItem
                });
                await db.historicalOverrides.update(identifiedItem.recordUid!, { conflictStatus: 'pending' });
              }
            }
            continue;
          }

          // Last write wins resolver
          if (!local || incomingTime >= localTime) {
            await table.put(identifiedItem);
            await legacyTableForEntity(entityType).put(identifiedItem);

            if (identifiedItem.isEdited) {
              const original = await db.historicalOriginals.get(identifiedItem.recordUid!);
              await db.historicalOverrides.put({
                recordUid: identifiedItem.recordUid!,
                entityType,
                legacyId: identifiedItem.id,
                sourceDeviceId: identifiedItem.sourceDeviceId,
                originalStatus: original?.originalStatus || 'unavailable',
                capturedFrom: 'fieldSync',
                updatedAt: incomingTime || Date.now(),
                editorRole: 'field',
                editorDeviceId: identifiedItem.sourceDeviceId,
                changeKind: 'directEdit',
                conflictStatus: 'none',
                payload: identifiedItem
              });
            }

            if (identifiedItem.isDeleted) {
              const original = await db.historicalOriginals.get(identifiedItem.recordUid!);
              await db.historicalTrash.put({
                recordUid: identifiedItem.recordUid!,
                entityType,
                legacyId: identifiedItem.id,
                sourceDeviceId: identifiedItem.sourceDeviceId,
                originalStatus: original?.originalStatus || 'unavailable',
                capturedFrom: 'fieldSync',
                deletedAt: incomingTime || Date.now(),
                deletionKind: 'direct',
                active: true,
                payload: identifiedItem
              });
            }
          }
        }
      };

      await syncTable(db.operationalShifts, incoming.shifts, 'shift');
      await syncTable(db.operationalFlights, incoming.flights, 'flight');
      await syncTable(db.operationalBatteries, incoming.batteries, 'battery');
      await syncTable(db.operationalDetections, incoming.detections?.map(d => ({ ...d, accessStatus: d.accessStatus || 'Buena' })), 'detection');
      await syncTable(db.operationalVehicleChecklists, incoming.checklists || (incoming as any).vehicleChecklists, 'vehicleChecklist');
      await syncTable(db.operationalDroneChecklists, incoming.droneChecklists, 'droneChecklist');
    });
  };

  const getUnsyncedData = async (): Promise<AppData> => {
    const s = await db.operationalShifts.filter((i) => !i.isSynced).toArray();
    const f = await db.operationalFlights.filter((i) => !i.isSynced).toArray();
    const b = await db.operationalBatteries.filter((i) => !i.isSynced).toArray();
    const d = await db.operationalDetections.filter((i) => !i.isSynced).toArray();
    const c = await db.operationalVehicleChecklists.filter((i) => !i.isSynced).toArray();
    const dc = await db.operationalDroneChecklists.filter((i) => !i.isSynced).toArray();
    return { shifts: s, flights: f, batteries: b, detections: d, checklists: c, droneChecklists: dc };
  };

  const getAllData = async (): Promise<AppData> => {
    const s = await db.operationalShifts.filter((i) => !i.isDeleted).toArray();
    const f = await db.operationalFlights.filter((i) => !i.isDeleted).toArray();
    const b = await db.operationalBatteries.filter((i) => !i.isDeleted).toArray();
    const d = await db.operationalDetections.filter((i) => !i.isDeleted).toArray();
    const mappedDetections = d.map(i => ({ ...i, accessStatus: i.accessStatus || 'Buena' }));
    const c = await db.operationalVehicleChecklists.filter((i) => !i.isDeleted).toArray();
    const dc = await db.operationalDroneChecklists.filter((i) => !i.isDeleted).toArray();
    const history = {
      originals: await db.historicalOriginals.toArray(),
      overrides: await db.historicalOverrides.toArray(),
      trash: await db.historicalTrash.toArray(),
      conflicts: await db.historicalConflicts.toArray()
    };
    return getConsolidatedView(
      { shifts: s, flights: f, batteries: b, detections: mappedDetections, checklists: c, droneChecklists: dc },
      history
    );
  };

  const getControlRecordsState = async (sourceDeviceId: string): Promise<AppData> => {
    const current = await getAllData();
    const belongsToDevice = (item: HistoricalRecordPayload) => item.sourceDeviceId === sourceDeviceId;
    const deleted = (await db.historicalTrash.toArray())
      .filter(entry => entry.active !== false && !entry.restoredAt && entry.sourceDeviceId === sourceDeviceId)
      .map(entry => ({ ...entry.payload, isDeleted: true, isSynced: true } as HistoricalRecordPayload));
    const deletedByType = (entityType: HistoricalEntityType) => deleted.filter(item => {
      if (entityType === 'shift') return 'coordinator' in item;
      if (entityType === 'flight') return 'status' in item && ('pilot' in item || 'requestedBy' in item);
      if (entityType === 'battery') return 'droneBatteryName' in item;
      if (entityType === 'detection') return 'element' in item;
      if (entityType === 'vehicleChecklist') return 'vehicleId' in item;
      return 'droneId' in item && 'checks' in item;
    });
    return {
      shifts: [...current.shifts.filter(belongsToDevice), ...deletedByType('shift')] as ShiftData[],
      flights: [...current.flights.filter(belongsToDevice), ...deletedByType('flight')] as FlightData[],
      batteries: [...current.batteries.filter(belongsToDevice), ...deletedByType('battery')] as BatteryData[],
      detections: [...current.detections.filter(belongsToDevice), ...deletedByType('detection')] as DetectionData[],
      checklists: [...(current.checklists || []).filter(belongsToDevice), ...deletedByType('vehicleChecklist')] as any[],
      droneChecklists: [...(current.droneChecklists || []).filter(belongsToDevice), ...deletedByType('droneChecklist')] as DroneChecklistData[]
    };
  };

  const applyControlRecordsState = async (incoming: AppData): Promise<{ applied: number; protectedLocal: number }> => {
    let applied = 0;
    let protectedLocal = 0;
    const localDeviceId = getDeviceId();
    await db.transaction('rw', [db.operationalShifts, db.operationalFlights, db.operationalBatteries, db.operationalDetections, db.operationalVehicleChecklists, db.operationalDroneChecklists, db.shifts, db.flights, db.batteries, db.detections, db.vehicleChecklists, db.droneChecklists, db.historicalOriginals, db.historicalTrash], async () => {
      const localShifts = await db.operationalShifts.toArray();
      const localFlights = await db.operationalFlights.toArray();
      const localBatteries = await db.operationalBatteries.toArray();
      const localDetections = await db.operationalDetections.toArray();
      const pendingFlights = localFlights.filter(item => item.isSynced === false);
      const pendingBatteries = localBatteries.filter(item => item.isSynced === false);
      const pendingDetections = localDetections.filter(item => item.isSynced === false);
      const protectedFlightUids = new Set([
        ...pendingFlights.map(item => item.recordUid).filter(Boolean),
        ...pendingBatteries.map(item => item.flightRecordUid).filter(Boolean),
        ...pendingDetections.map(item => item.flightRecordUid).filter(Boolean)
      ]);
      const protectedShiftUids = new Set([
        ...localShifts.filter(item => item.isSynced === false).map(item => item.recordUid).filter(Boolean),
        ...localFlights.filter(item => item.recordUid && protectedFlightUids.has(item.recordUid)).map(item => item.shiftRecordUid).filter(Boolean)
      ]);
      const apply = async (table: any, items: HistoricalRecordPayload[] | undefined, entityType: HistoricalEntityType) => {
        for (const item of items || []) {
          if (!item.recordUid) { protectedLocal += 1; continue; }
          const local = await table.get(item.recordUid) as HistoricalRecordPayload | undefined;
          const knownOriginal = item.recordUid ? await db.historicalOriginals.get(item.recordUid) : undefined;
          if (knownOriginal && (knownOriginal.entityType !== entityType || knownOriginal.legacyId !== item.id)) {
            protectedLocal += 1;
            continue;
          }
          if (item.sourceDeviceId !== localDeviceId || (local?.recordUid && item.recordUid && local.recordUid !== item.recordUid)) {
            protectedLocal += 1;
            continue;
          }
          if (local && local.isSynced === false) { protectedLocal += 1; continue; }
          if (item.isDeleted && (('coordinator' in item && item.recordUid && protectedShiftUids.has(item.recordUid)) || ('shiftId' in item && item.recordUid && protectedFlightUids.has(item.recordUid)))) {
            protectedLocal += 1;
            continue;
          }
          if (!local || (item.lastModified || 0) >= (local.lastModified || 0)) {
            await table.put({ ...item, isSynced: true });
            await legacyTableForEntity(entityType).put({ ...item, isSynced: true });
            if (item.isDeleted) {
              const original = await db.historicalOriginals.get(item.recordUid);
              await db.historicalTrash.put({
                recordUid: item.recordUid,
                entityType,
                legacyId: item.id,
                sourceDeviceId: item.sourceDeviceId,
                originalStatus: original?.originalStatus || 'unavailable',
                capturedFrom: 'fieldSync',
                deletedAt: item.lastModified || Date.now(),
                deletionKind: 'direct',
                active: true,
                payload: { ...item, isDeleted: true, isSynced: true }
              });
            } else {
              const trash = await db.historicalTrash.get(item.recordUid);
              if (trash?.active !== false && !trash?.permanentlyRemovedAt) {
                await db.historicalTrash.update(item.recordUid, { active: false, restoredAt: Date.now() });
              }
            }
            applied += 1;
          }
        }
      };
      await apply(db.operationalShifts, incoming.shifts, 'shift');
      await apply(db.operationalFlights, incoming.flights, 'flight');
      await apply(db.operationalBatteries, incoming.batteries, 'battery');
      await apply(db.operationalDetections, incoming.detections, 'detection');
      await apply(db.operationalVehicleChecklists, incoming.checklists || (incoming as any).vehicleChecklists, 'vehicleChecklist');
      await apply(db.operationalDroneChecklists, incoming.droneChecklists, 'droneChecklist');
    });
    return { applied, protectedLocal };
  };

  const markDataAsSynced = async (data: AppData) => {
    await db.transaction('rw', [db.operationalShifts, db.operationalFlights, db.operationalBatteries, db.operationalDetections, db.operationalVehicleChecklists, db.operationalDroneChecklists, db.shifts, db.flights, db.batteries, db.detections, db.vehicleChecklists, db.droneChecklists], async () => {
      const markTable = async (table: any, legacyTable: any, items: any[] | undefined) => {
        if (!items || items.length === 0) return;
        for (const item of items) {
          const local = item.recordUid ? await table.get(item.recordUid) : undefined;
          // Only mark as synced if the record hasn't been updated locally since it was sent
          if (local && (!local.lastModified || !item.lastModified || local.lastModified <= item.lastModified)) {
            await table.update(item.recordUid, { isSynced: true });
            await legacyTable.put({ ...local, isSynced: true });
          }
        }
      };

      await markTable(db.operationalShifts, db.shifts, data.shifts);
      await markTable(db.operationalFlights, db.flights, data.flights);
      await markTable(db.operationalBatteries, db.batteries, data.batteries);
      await markTable(db.operationalDetections, db.detections, data.detections);
      await markTable(db.operationalVehicleChecklists, db.vehicleChecklists, data.checklists);
      await markTable(db.operationalDroneChecklists, db.droneChecklists, data.droneChecklists);
    });
  };

  const tableForEntity = (entityType: HistoricalEntityType): any => ({
    shift: db.operationalShifts,
    flight: db.operationalFlights,
    battery: db.operationalBatteries,
    detection: db.operationalDetections,
    vehicleChecklist: db.operationalVehicleChecklists,
    droneChecklist: db.operationalDroneChecklists
  })[entityType];

  const restoreHistoricalRecord = async (recordUid: string): Promise<{ ok: boolean; message?: string }> => {
    const trashEntry = await db.historicalTrash.get(recordUid);
    if (!trashEntry || trashEntry.active === false || trashEntry.restoredAt) return { ok: false, message: 'El registro ya no está en la Papelera.' };
    if (trashEntry.permanentlyRemovedAt) return { ok: false, message: 'El registro fue retirado definitivamente de la proyección restaurable.' };

    const payload = trashEntry.payload;
    let parentType: HistoricalEntityType | undefined;
    let parentId: string | undefined;
    if (trashEntry.entityType === 'flight') { parentType = 'shift'; parentId = (payload as FlightData).shiftId; }
    if (trashEntry.entityType === 'battery' || trashEntry.entityType === 'detection') {
      parentType = 'flight'; parentId = (payload as BatteryData | DetectionData).flightId;
    }
    if (parentType && parentId) {
      const globalParentUid = parentType === 'shift' ? (payload as FlightData).shiftRecordUid : (payload as BatteryData | DetectionData).flightRecordUid;
      const candidates = globalParentUid
        ? [await tableForEntity(parentType).get(globalParentUid)].filter(Boolean)
        : await tableForEntity(parentType).where('id').equals(parentId).and((item: HistoricalRecordPayload) => item.sourceDeviceId === payload.sourceDeviceId).toArray();
      if (candidates.length !== 1) return { ok: false, message: 'La relación global con el padre no está resuelta de forma inequívoca.' };
      const parent = candidates[0];
      if (!parent || parent.isDeleted) return { ok: false, message: 'Primero debes restaurar la cadena de registros padre.' };
    }

    const table = tableForEntity(trashEntry.entityType);
    const legacyTable = legacyTableForEntity(trashEntry.entityType);
    await db.transaction('rw', [table, legacyTable, db.historicalTrash], async () => {
      const restored = { ...payload, isDeleted: false, isSynced: false, lastModified: Date.now() };
      await table.put(restored);
      await legacyTable.put(restored);
      await db.historicalTrash.update(recordUid, { active: false, restoredAt: Date.now() });
    });
    return { ok: true };
  };

  const permanentlyRemoveHistoricalRecord = async (recordUid: string) => {
    const trashEntry = await db.historicalTrash.get(recordUid);
    if (!trashEntry || trashEntry.active === false) return;
    const table = tableForEntity(trashEntry.entityType);
    const legacyTable = legacyTableForEntity(trashEntry.entityType);
    await db.transaction('rw', [table, legacyTable, db.historicalOverrides, db.historicalTrash], async () => {
      await table.put({ ...trashEntry.payload, isDeleted: true });
      await legacyTable.put({ ...trashEntry.payload, isDeleted: true });
      await db.historicalOverrides.delete(recordUid);
      await db.historicalTrash.update(recordUid, { permanentlyRemovedAt: Date.now(), active: true });
    });
  };

  const resolveHistoricalConflict = async (recordUid: string, resolution: 'acceptField' | 'keepControl') => {
    const conflict = await db.historicalConflicts.get(recordUid);
    const currentOverride = await db.historicalOverrides.get(recordUid);
    if (!conflict || conflict.conflictStatus !== 'pending' || !currentOverride) return;
    const table = tableForEntity(conflict.entityType);
    const legacyTable = legacyTableForEntity(conflict.entityType);
    const resolvedAt = Date.now();
    await db.transaction('rw', [table, legacyTable, db.historicalOriginals, db.historicalOverrides, db.historicalConflicts, db.historicalTrash], async () => {
      if (resolution === 'acceptField') {
        const approvedPayload = { ...conflict.payload, isSynced: true } as HistoricalRecordPayload;
        await table.put(approvedPayload);
        await legacyTable.put(approvedPayload);
        await db.historicalOverrides.put({
          ...currentOverride,
          payload: approvedPayload,
          updatedAt: resolvedAt,
          editorRole: 'control',
          editorDeviceId: getDeviceId(),
          changeKind: 'directEdit',
          conflictStatus: 'accepted'
        });
        if (approvedPayload.isDeleted) {
          const original = await db.historicalOriginals.get(recordUid);
          await db.historicalTrash.put({
            recordUid,
            entityType: conflict.entityType,
            legacyId: conflict.legacyId,
            sourceDeviceId: conflict.sourceDeviceId,
            originalStatus: original?.originalStatus || 'unavailable',
            capturedFrom: 'fieldSync',
            deletedAt: resolvedAt,
            deletionKind: 'direct',
            active: true,
            payload: approvedPayload
          });
        }
      } else {
        await db.historicalOverrides.update(recordUid, { conflictStatus: 'rejected' });
      }
      await db.historicalConflicts.update(recordUid, {
        conflictStatus: resolution === 'acceptField' ? 'accepted' : 'rejected',
        resolvedAt,
        resolution: resolution === 'acceptField' ? 'acceptedField' : 'keptControl'
      });
    });
  };


  // 5. Aggregate object for export
  const operationalData: AppData = { shifts, flights, batteries, detections, checklists, droneChecklists };
  const historicalView = useMemo(() => ({
    originals: historicalOriginals,
    overrides: historicalOverrides,
    trash: historicalTrash,
    conflicts: historicalConflicts
  }), [historicalOriginals, historicalOverrides, historicalTrash, historicalConflicts]);
  const historicalState = useMemo(() => buildHistoricalStateMap(historicalView), [historicalView]);
  const fullData = useMemo(() => getConsolidatedView(operationalData, historicalView), [
    shifts, flights, batteries, detections, checklists, droneChecklists, historicalView
  ]);
  const physicalBackupData: AppData = { ...fullData, knowledgeBase: lists.elements };

  // 6. Auto-persist to physical disk on every data change
  //    - In Electron (.exe): writes to Mis Documentos/Horus_Datos/
  //    - In Capacitor (APK): writes to Android internal storage
  //    - In browser (dev): no-op, Dexie handles everything
  const isFirstRender = useRef(true);
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historicalPersistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backupFailureReportedRef = useRef(false);
  const historicalBackupFailureReportedRef = useRef(false);
  const previousKnowledgeBaseRef = useRef(lists.elements);
  
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      previousKnowledgeBaseRef.current = lists.elements;
      return;
    }
    const knowledgeBaseChanged = previousKnowledgeBaseRef.current !== lists.elements;
    previousKnowledgeBaseRef.current = lists.elements;

    if (shifts.length > 0 || flights.length > 0 || batteries.length > 0 || detections.length > 0 || checklists.length > 0 || droneChecklists.length > 0 || knowledgeBaseChanged) {
      if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
      persistTimeoutRef.current = setTimeout(() => {
        persistToDisk(physicalBackupData)
          .then(result => {
            if (result.status === 'not-applicable') return;

            if (result.status === 'failure') {
              if (!backupFailureReportedRef.current) {
                backupFailureReportedRef.current = true;
                void window.customAlert(
                  '⚠️ No se pudo actualizar la copia de respaldo física.\n\n' +
                  'Tus datos siguen guardados dentro de Hermes, pero conviene revisar el espacio de almacenamiento y los permisos del dispositivo.'
                );
              }
              return;
            }

            if (backupFailureReportedRef.current) {
              backupFailureReportedRef.current = false;
              void window.customAlert('✅ El respaldo físico volvió a funcionar correctamente.');
            }
          })
          .catch(e => console.error('[DB] persist error:', e));
      }, 2000);
    }
    
    return () => {
      if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
    };
  }, [shifts, flights, batteries, detections, checklists, droneChecklists, lists]);

  useEffect(() => {
    if (!historicalStorageReady) return;
    if (historicalPersistTimeoutRef.current) clearTimeout(historicalPersistTimeoutRef.current);
    historicalPersistTimeoutRef.current = setTimeout(() => {
      persistHistoricalToDisk({
        schemaVersion: 2,
        originals: historicalOriginals,
        currentOverrides: historicalOverrides,
        trash: historicalTrash,
        conflicts: historicalConflicts,
        operationalState: fullData,
        knowledgeBase: lists.elements,
        configurableLists
      }).then(result => {
        if (result.status === 'failure') {
          console.error('[DB] Historical backup failed:', result.error);
          if (!historicalBackupFailureReportedRef.current) {
            historicalBackupFailureReportedRef.current = true;
            void window.customAlert('No se pudo actualizar el histórico físico. Los datos continúan seguros en Hermes y se reintentará ante el próximo cambio.');
          }
        } else if (result.status === 'success') {
          historicalBackupFailureReportedRef.current = false;
        }
      }).catch(error => console.error('[DB] Historical backup failed:', error));
    }, 2500);
    return () => {
      if (historicalPersistTimeoutRef.current) clearTimeout(historicalPersistTimeoutRef.current);
    };
  }, [historicalStorageReady, historicalOriginals, historicalOverrides, historicalTrash, historicalConflicts, shifts, flights, batteries, detections, checklists, droneChecklists, lists.elements, configurableLists]);

  // 7. Load from physical disk on first boot and seed Dexie if DB is empty
  useEffect(() => {
    const seedFromDisk = async () => {
      try {
        await settingsInitializationRef.current;
        const diskData = await loadFromDisk();
        const historicalArchive = await loadHistoricalFromDisk();
      const count = await db.shifts.count();
      if (diskData && !historicalArchive && count === 0 && diskData.shifts && diskData.shifts.length > 0) {
        console.log('[NativeStorage] Seeding Dexie from physical disk backup...');
        await db.transaction('rw', [db.shifts, db.flights, db.batteries, db.detections, db.vehicleChecklists, db.droneChecklists], async () => {
          await db.shifts.bulkPut(diskData.shifts);
          await db.flights.bulkPut(diskData.flights || []);
          await db.batteries.bulkPut(diskData.batteries || []);
          await db.detections.bulkPut(diskData.detections || []);
          await db.vehicleChecklists.bulkPut(diskData.checklists || []);
          await db.droneChecklists.bulkPut(diskData.droneChecklists || []);
        });
        await ensureHistoricalFoundations();
        console.log('[NativeStorage] ✅ Restored from physical disk.');
      }

      const operationalCount = await Promise.all([
        db.operationalShifts.count(), db.operationalFlights.count(), db.operationalBatteries.count(), db.operationalDetections.count(),
        db.operationalVehicleChecklists.count(), db.operationalDroneChecklists.count()
      ]).then(values => values.reduce((total, value) => total + value, 0));
      const historicalCount = await db.historicalOriginals.count();
      if (historicalArchive && operationalCount === 0 && historicalCount === 0) {
        const logicalKeys = new Set<string>();
        const collision = historicalArchive.originals.some(original => {
          const key = `${original.entityType}:${original.legacyId}`;
          if (logicalKeys.has(key)) return true;
          logicalKeys.add(key);
          return false;
        });
        if (collision) {
          console.warn('[NativeStorage] Legacy mirror collision detected; global operational records will all be preserved.');
        }
        {
          const records = new Map<string, { entityType: HistoricalEntityType; payload: HistoricalRecordPayload }>();
          const addOperational = (entityType: HistoricalEntityType, items: HistoricalRecordPayload[] | undefined) =>
            (items || []).forEach(payload => {
              if (payload.recordUid) records.set(payload.recordUid, { entityType, payload });
            });
          addOperational('shift', historicalArchive.operationalState?.shifts);
          addOperational('flight', historicalArchive.operationalState?.flights);
          addOperational('battery', historicalArchive.operationalState?.batteries);
          addOperational('detection', historicalArchive.operationalState?.detections);
          addOperational('vehicleChecklist', historicalArchive.operationalState?.checklists);
          addOperational('droneChecklist', historicalArchive.operationalState?.droneChecklists);
          historicalArchive.originals.forEach(item => {
            if (!records.has(item.recordUid)) records.set(item.recordUid, { entityType: item.entityType, payload: item.payload });
          });
          historicalArchive.currentOverrides.forEach(item => records.set(item.recordUid, { entityType: item.entityType, payload: item.payload }));
          historicalArchive.trash.forEach(item => {
            const current = records.get(item.recordUid) || { entityType: item.entityType, payload: item.payload };
            records.set(item.recordUid, { ...current, payload: { ...current.payload, isDeleted: item.active !== false && !item.restoredAt } as HistoricalRecordPayload });
          });
          const legacyKeyCounts = new Map<string, number>();
          records.forEach(record => {
            const key = `${record.entityType}:${record.payload.id}`;
            legacyKeyCounts.set(key, (legacyKeyCounts.get(key) || 0) + 1);
          });
          await db.transaction('rw', [
            db.shifts, db.flights, db.batteries, db.detections, db.vehicleChecklists, db.droneChecklists,
            db.operationalShifts, db.operationalFlights, db.operationalBatteries, db.operationalDetections,
            db.operationalVehicleChecklists, db.operationalDroneChecklists,
            db.historicalOriginals, db.historicalOverrides, db.historicalTrash, db.historicalConflicts
          ], async () => {
            await db.historicalOriginals.bulkPut(historicalArchive.originals);
            await db.historicalOverrides.bulkPut(historicalArchive.currentOverrides);
            await db.historicalTrash.bulkPut(historicalArchive.trash);
            await db.historicalConflicts.bulkPut(historicalArchive.conflicts);
            for (const record of records.values()) {
              await tableForEntity(record.entityType).put(record.payload);
              if (legacyKeyCounts.get(`${record.entityType}:${record.payload.id}`) === 1) await legacyTableForEntity(record.entityType).put(record.payload);
            }
          });
        }
      }

        const restoredKnowledgeBase = diskData?.knowledgeBase || historicalArchive?.knowledgeBase;
        const restoredLists = historicalArchive?.configurableLists;
        if (restoredKnowledgeBase || restoredLists) {
        await db.transaction('rw', db.settings, async () => {
          const currentSettings = await db.settings.get('current');
          await db.settings.put({
            id: 'current',
            data: {
              ...(currentSettings?.data || DEFAULT_LISTS),
              ...(restoredLists || {}),
              clients: restoredLists ? (restoredLists.clients || []) : (currentSettings?.data?.clients || []),
              elements: restoredKnowledgeBase || currentSettings?.data?.elements || DEFAULT_LISTS.elements
            }
          });
        });
        }
      } finally {
        setHistoricalStorageReady(true);
      }
    };
    seedFromDisk();
  }, []);

  return {
    fullData,
    lists,
    saveShift, updateShift, closeShift, closeShiftClosure, reopenShift, reopenShiftClosure, deleteShift,
    saveFlight, updateFlight, closeFlight, deleteFlight,
    saveBattery, updateBattery, deleteBattery,
    saveDetection, updateDetection, deleteDetection,
    saveChecklist, updateChecklist, deleteChecklist,
    saveDroneChecklist, updateDroneChecklist, deleteDroneChecklist,
    updateLists,
    replaceKnowledgeBase,
    replaceOperationalLists,
    syncIncomingData,
    getUnsyncedData,
    markDataAsSynced,
    getAllData, getControlRecordsState, applyControlRecordsState
    , historicalView, historicalState, restoreHistoricalRecord,
    permanentlyRemoveHistoricalRecord, resolveHistoricalConflict
  };
}
