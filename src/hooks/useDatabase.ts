import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { DEFAULT_LISTS, type ListsData, type AppData, type ShiftData, type FlightData, type BatteryData, type DetectionData, type DroneChecklistData } from '../types';
import { useEffect, useRef } from 'react';
import { persistToDisk, loadFromDisk } from '../services/NativeStorage';
import { formatTimestamp } from '../utils/dateUtils';

export function useDatabase() {
  // 1. Live Queries for real-time UI updates
  const shifts = useLiveQuery(() => db.shifts.filter(i => !i.isDeleted).toArray()) || [];
  const flights = useLiveQuery(() => db.flights.filter(i => !i.isDeleted).toArray()) || [];
  const batteries = useLiveQuery(() => db.batteries.filter(i => !i.isDeleted).toArray()) || [];
  const detections = useLiveQuery(() => db.detections.filter(i => !i.isDeleted).toArray()) || [];
  const checklists = useLiveQuery(() => db.vehicleChecklists.filter(i => !i.isDeleted).toArray()) || [];
  const droneChecklists = useLiveQuery(() => db.droneChecklists.filter(i => !i.isDeleted).toArray()) || [];
  
  // 2. Settings management (ListsData)
  const settingsRow = useLiveQuery(() => db.settings.get('current'));
  const lists = settingsRow?.data || DEFAULT_LISTS;

  // 3. Migration & Seeding logic (runs exactly ONCE per app lifecycle)
  //    Uses a ref guard to prevent the race condition where useLiveQuery
  //    returns undefined while Dexie is still loading (indistinguishable
  //    from "row does not exist"), which would overwrite user-customized
  //    settings with DEFAULT_LISTS on every reload.
  const hasSeeded = useRef(false);
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
          await db.settings.put({ id: 'current', data: localLists });
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
            console.log('✅ Record data migrated to Database');
          }
          localStorage.removeItem('field_ops_data_v2');
        } catch (e) { console.error('Migration error (data):', e); }
      }
    };
    migrate();
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

  // 4. Save/Update/Delete functions
  const saveShift = (item: ShiftData) => db.shifts.add({ ...item, isSynced: false, lastModified: Date.now(), deviceName: item.deviceName || getDeviceName() });
  const getEditMetadata = () => {
    const now = new Date();
    return {
      isEdited: true,
      lastModified: Date.now(),
      editedTimestamp: formatTimestamp(now)
    };
  };

  const updateShift = (item: ShiftData) => db.shifts.put({ ...item, ...getEditMetadata(), isSynced: false, deviceName: item.deviceName || getDeviceName() });
  const deleteShift = async (id: string) => {
    await db.transaction('rw', [db.shifts, db.flights, db.batteries, db.detections], async () => {
      // 1. Find all flights belonging to the shift
      const flightsToDelete = await db.flights.where('shiftId').equals(id).toArray();
      const flightIds = flightsToDelete.map(f => f.id);

      if (flightIds.length > 0) {
        // 2. Delete all batteries for these flights
        await db.batteries.where('flightId').anyOf(flightIds).modify({ isDeleted: true, isSynced: false, lastModified: Date.now() });

        // 3. Delete all detections for these flights
        await db.detections.where('flightId').anyOf(flightIds).modify({ isDeleted: true, isSynced: false, lastModified: Date.now() });

        // 4. Delete the flights
        await db.flights.where('shiftId').equals(id).modify({ isDeleted: true, isSynced: false, lastModified: Date.now() });
      }

      // 5. Delete the shift itself
      await db.shifts.update(id, { isDeleted: true, isSynced: false, lastModified: Date.now() });
    });
  };

  const saveFlight = (item: FlightData) => db.flights.add({ ...item, isSynced: false, lastModified: Date.now(), deviceName: item.deviceName || getDeviceName() });
  const updateFlight = (item: FlightData) => db.flights.put({ ...item, ...getEditMetadata(), isSynced: false, deviceName: item.deviceName || getDeviceName() });
  const deleteFlight = async (id: string) => {
    await db.transaction('rw', [db.flights, db.batteries, db.detections], async () => {
      await db.batteries.where('flightId').equals(id).modify({ isDeleted: true, isSynced: false, lastModified: Date.now() });
      await db.detections.where('flightId').equals(id).modify({ isDeleted: true, isSynced: false, lastModified: Date.now() });
      await db.flights.update(id, { isDeleted: true, isSynced: false, lastModified: Date.now() });
    });
  };

  const saveBattery = (item: BatteryData) => db.batteries.add({ ...item, isSynced: false, lastModified: Date.now(), deviceName: item.deviceName || getDeviceName() });
  const updateBattery = (item: BatteryData) => db.batteries.put({ ...item, ...getEditMetadata(), isSynced: false, deviceName: item.deviceName || getDeviceName() });
  const deleteBattery = (id: string) => db.batteries.update(id, { isDeleted: true, isSynced: false, lastModified: Date.now() });

  const saveDetection = (item: DetectionData) => db.detections.add({ ...item, isSynced: false, lastModified: Date.now(), deviceName: item.deviceName || getDeviceName() });
  const updateDetection = (item: DetectionData) => db.detections.put({ ...item, ...getEditMetadata(), isSynced: false, deviceName: item.deviceName || getDeviceName() });
  const deleteDetection = (id: string) => db.detections.update(id, { isDeleted: true, isSynced: false, lastModified: Date.now() });
  
  const saveChecklist = (item: any) => db.vehicleChecklists.add({ ...item, isSynced: false, lastModified: Date.now(), deviceName: item.deviceName || getDeviceName() });
  const updateChecklist = (item: any) => db.vehicleChecklists.put({ ...item, ...getEditMetadata(), isSynced: false, deviceName: item.deviceName || getDeviceName() });
  const deleteChecklist = (id: string) => db.vehicleChecklists.update(id, { isDeleted: true, isSynced: false, lastModified: Date.now() });

  const saveDroneChecklist = (item: DroneChecklistData) => db.droneChecklists.add({ ...item, isSynced: false, lastModified: Date.now(), deviceName: item.deviceName || getDeviceName() });
  const updateDroneChecklist = (item: DroneChecklistData) => db.droneChecklists.put({ ...item, ...getEditMetadata(), isSynced: false, deviceName: item.deviceName || getDeviceName() });
  const deleteDroneChecklist = (id: string) => db.droneChecklists.update(id, { isDeleted: true, isSynced: false, lastModified: Date.now() });
  
  const updateLists = (newList: ListsData) => db.settings.put({ id: 'current', data: newList });
 
  // ─── Transactional merger for incoming P2P data payload ───
  const syncIncomingData = async (incoming: AppData) => {
    await db.transaction('rw', [db.shifts, db.flights, db.batteries, db.detections, db.vehicleChecklists, db.droneChecklists], async () => {
      const syncTable = async (table: any, items: any[] | undefined) => {
        if (!items || items.length === 0) return;
        for (const item of items) {
          const local = await table.get(item.id);
          const incomingTime = item.lastModified || 0;
          const localTime = local?.lastModified || 0;
          // Last write wins resolver
          if (!local || incomingTime >= localTime) {
            await table.put(item);
          }
        }
      };

      await syncTable(db.shifts, incoming.shifts);
      await syncTable(db.flights, incoming.flights);
      await syncTable(db.batteries, incoming.batteries);
      await syncTable(db.detections, incoming.detections);
      await syncTable(db.vehicleChecklists, incoming.checklists || (incoming as any).vehicleChecklists);
      await syncTable(db.droneChecklists, incoming.droneChecklists);
    });
  };

  const getUnsyncedData = async (): Promise<AppData> => {
    const s = await db.shifts.filter((i) => !i.isSynced).toArray();
    const f = await db.flights.filter((i) => !i.isSynced).toArray();
    const b = await db.batteries.filter((i) => !i.isSynced).toArray();
    const d = await db.detections.filter((i) => !i.isSynced).toArray();
    const c = await db.vehicleChecklists.filter((i) => !i.isSynced).toArray();
    const dc = await db.droneChecklists.filter((i) => !i.isSynced).toArray();
    return { shifts: s, flights: f, batteries: b, detections: d, checklists: c, droneChecklists: dc };
  };

  const getAllData = async (): Promise<AppData> => {
    const s = await db.shifts.filter((i) => !i.isDeleted).toArray();
    const f = await db.flights.filter((i) => !i.isDeleted).toArray();
    const b = await db.batteries.filter((i) => !i.isDeleted).toArray();
    const d = await db.detections.filter((i) => !i.isDeleted).toArray();
    const c = await db.vehicleChecklists.filter((i) => !i.isDeleted).toArray();
    const dc = await db.droneChecklists.filter((i) => !i.isDeleted).toArray();
    return { shifts: s, flights: f, batteries: b, detections: d, checklists: c, droneChecklists: dc };
  };

  const markDataAsSynced = async (data: AppData) => {
    await db.transaction('rw', [db.shifts, db.flights, db.batteries, db.detections, db.vehicleChecklists, db.droneChecklists], async () => {
      const markTable = async (table: any, items: any[] | undefined) => {
        if (!items || items.length === 0) return;
        for (const item of items) {
          const local = await table.get(item.id);
          // Only mark as synced if the record hasn't been updated locally since it was sent
          if (local && (!local.lastModified || !item.lastModified || local.lastModified <= item.lastModified)) {
            await table.update(item.id, { isSynced: true });
          }
        }
      };

      await markTable(db.shifts, data.shifts);
      await markTable(db.flights, data.flights);
      await markTable(db.batteries, data.batteries);
      await markTable(db.detections, data.detections);
      await markTable(db.vehicleChecklists, data.checklists);
      await markTable(db.droneChecklists, data.droneChecklists);
    });
  };


  // 5. Aggregate object for export
  const fullData: AppData = { shifts, flights, batteries, detections, checklists, droneChecklists };

  // 6. Auto-persist to physical disk on every data change
  //    - In Electron (.exe): writes to Mis Documentos/Horus_Datos/
  //    - In Capacitor (APK): writes to Android internal storage
  //    - In browser (dev): no-op, Dexie handles everything
  const isFirstRender = useRef(true);
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (shifts.length > 0 || flights.length > 0 || batteries.length > 0 || detections.length > 0 || checklists.length > 0 || droneChecklists.length > 0) {
      if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
      persistTimeoutRef.current = setTimeout(() => {
        persistToDisk(fullData).catch(e => console.error('[DB] persist error:', e));
      }, 2000);
    }
    
    return () => {
      if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
    };
  }, [shifts, flights, batteries, detections, checklists, droneChecklists]);

  // 7. Load from physical disk on first boot and seed Dexie if DB is empty
  useEffect(() => {
    const seedFromDisk = async () => {
      const diskData = await loadFromDisk();
      if (!diskData) return;
      const count = await db.shifts.count();
      if (count === 0 && diskData.shifts && diskData.shifts.length > 0) {
        console.log('[NativeStorage] Seeding Dexie from physical disk backup...');
        await db.transaction('rw', [db.shifts, db.flights, db.batteries, db.detections, db.vehicleChecklists, db.droneChecklists], async () => {
          await db.shifts.bulkPut(diskData.shifts);
          await db.flights.bulkPut(diskData.flights || []);
          await db.batteries.bulkPut(diskData.batteries || []);
          await db.detections.bulkPut(diskData.detections || []);
          await db.vehicleChecklists.bulkPut(diskData.checklists || []);
          await db.droneChecklists.bulkPut(diskData.droneChecklists || []);
        });
        console.log('[NativeStorage] ✅ Restored from physical disk.');
      }
    };
    seedFromDisk();
  }, []);

  return {
    fullData,
    lists,
    saveShift, updateShift, deleteShift,
    saveFlight, updateFlight, deleteFlight,
    saveBattery, updateBattery, deleteBattery,
    saveDetection, updateDetection, deleteDetection,
    saveChecklist, updateChecklist, deleteChecklist,
    saveDroneChecklist, updateDroneChecklist, deleteDroneChecklist,
    updateLists,
    syncIncomingData,
    getUnsyncedData,
    markDataAsSynced,
    getAllData
  };
}
