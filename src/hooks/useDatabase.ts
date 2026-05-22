import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { DEFAULT_LISTS, type ListsData, type AppData, type ShiftData, type FlightData, type BatteryData, type DetectionData, type DroneChecklistData } from '../types';
import { useEffect, useRef } from 'react';
import { persistToDisk, loadFromDisk } from '../services/NativeStorage';

export function useDatabase() {
  // 1. Live Queries for real-time UI updates
  const shifts = useLiveQuery(() => db.shifts.toArray()) || [];
  const flights = useLiveQuery(() => db.flights.toArray()) || [];
  const batteries = useLiveQuery(() => db.batteries.toArray()) || [];
  const detections = useLiveQuery(() => db.detections.toArray()) || [];
  const checklists = useLiveQuery(() => db.vehicleChecklists.toArray()) || [];
  const droneChecklists = useLiveQuery(() => db.droneChecklists.toArray()) || [];
  
  // 2. Settings management (ListsData)
  const settingsRow = useLiveQuery(() => db.settings.get('current'));
  const lists = settingsRow?.data || DEFAULT_LISTS;

  // 3. Migration logic: From localStorage to Dexie (runs once)
  useEffect(() => {
    const migrate = async () => {
      const localDataStr = localStorage.getItem('field_ops_data_v2');
      const localListsStr = localStorage.getItem('field_ops_lists_v3');

      if (!settingsRow && !localListsStr) {
        // Seed with DEFAULT_LISTS if it's a fresh install
        try {
          await db.settings.put({ id: 'current', data: DEFAULT_LISTS });
          console.log('✅ Database seeded with default technical data');
        } catch (e) { console.error('Seeding error:', e); }
      }

      if (localListsStr && !settingsRow) {
        try {
          const localLists = JSON.parse(localListsStr);
          await db.settings.put({ id: 'current', data: localLists });
          localStorage.removeItem('field_ops_lists_v3');
          console.log('✅ Lists migrated from Legacy Storage');
        } catch (e) { console.error('Migration error (lists):', e); }
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
  }, [settingsRow]);

  const getDeviceName = () => {
    let name = localStorage.getItem('horus_device_name');
    if (!name || !name.trim()) {
      const generated = `Tablet-${Math.floor(1000 + Math.random() * 9000)}`;
      localStorage.setItem('horus_device_name', generated);
      name = generated;
    }
    return name;
  };

  // 4. Save/Update/Delete functions
  const saveShift = (item: ShiftData) => db.shifts.add({ ...item, isSynced: false, deviceName: item.deviceName || getDeviceName() });
  const getEditMetadata = () => {
    const now = new Date();
    return {
      isEdited: true,
      editedTimestamp: `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`
    };
  };

  const updateShift = (item: ShiftData) => db.shifts.put({ ...item, ...getEditMetadata(), isSynced: false, deviceName: item.deviceName || getDeviceName() });
  const deleteShift = (id: string) => db.shifts.delete(id);

  const saveFlight = (item: FlightData) => db.flights.add({ ...item, isSynced: false, deviceName: item.deviceName || getDeviceName() });
  const updateFlight = (item: FlightData) => db.flights.put({ ...item, ...getEditMetadata(), isSynced: false, deviceName: item.deviceName || getDeviceName() });
  const deleteFlight = (id: string) => db.flights.delete(id);

  const saveBattery = (item: BatteryData) => db.batteries.add({ ...item, isSynced: false, deviceName: item.deviceName || getDeviceName() });
  const updateBattery = (item: BatteryData) => db.batteries.put({ ...item, ...getEditMetadata(), isSynced: false, deviceName: item.deviceName || getDeviceName() });
  const deleteBattery = (id: string) => db.batteries.delete(id);

  const saveDetection = (item: DetectionData) => db.detections.add({ ...item, isSynced: false, deviceName: item.deviceName || getDeviceName() });
  const updateDetection = (item: DetectionData) => db.detections.put({ ...item, ...getEditMetadata(), isSynced: false, deviceName: item.deviceName || getDeviceName() });
  const deleteDetection = (id: string) => db.detections.delete(id);
  
  const saveChecklist = (item: any) => db.vehicleChecklists.add({ ...item, isSynced: false, deviceName: item.deviceName || getDeviceName() });
  const updateChecklist = (item: any) => db.vehicleChecklists.put({ ...item, ...getEditMetadata(), isSynced: false, deviceName: item.deviceName || getDeviceName() });
  const deleteChecklist = (id: string) => db.vehicleChecklists.delete(id);

  const saveDroneChecklist = (item: DroneChecklistData) => db.droneChecklists.add({ ...item, isSynced: false, deviceName: item.deviceName || getDeviceName() });
  const updateDroneChecklist = (item: DroneChecklistData) => db.droneChecklists.put({ ...item, ...getEditMetadata(), isSynced: false, deviceName: item.deviceName || getDeviceName() });
  const deleteDroneChecklist = (id: string) => db.droneChecklists.delete(id);
  
  const updateLists = (newList: ListsData) => db.settings.put({ id: 'current', data: newList });
 
  // ─── Transactional merger for incoming P2P data payload ───
  const syncIncomingData = async (incoming: AppData) => {
    await db.transaction('rw', [db.shifts, db.flights, db.batteries, db.detections, db.vehicleChecklists, db.droneChecklists], async () => {
      if (incoming.shifts && incoming.shifts.length > 0) {
        for (const item of incoming.shifts) {
          await db.shifts.put(item);
        }
      }
      if (incoming.flights && incoming.flights.length > 0) {
        for (const item of incoming.flights) {
          await db.flights.put(item);
        }
      }
      if (incoming.batteries && incoming.batteries.length > 0) {
        for (const item of incoming.batteries) {
          await db.batteries.put(item);
        }
      }
      if (incoming.detections && incoming.detections.length > 0) {
        for (const item of incoming.detections) {
          await db.detections.put(item);
        }
      }
      const checklistsToSync = incoming.checklists || (incoming as any).vehicleChecklists;
      if (checklistsToSync && checklistsToSync.length > 0) {
        for (const item of checklistsToSync) {
          await db.vehicleChecklists.put(item);
        }
      }
      if (incoming.droneChecklists && incoming.droneChecklists.length > 0) {
        for (const item of incoming.droneChecklists) {
          await db.droneChecklists.put(item);
        }
      }
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

  const markDataAsSynced = async (data: AppData) => {
    await db.transaction('rw', [db.shifts, db.flights, db.batteries, db.detections, db.vehicleChecklists, db.droneChecklists], async () => {
      if (data.shifts) for (const i of data.shifts) await db.shifts.update(i.id, { isSynced: true });
      if (data.flights) for (const i of data.flights) await db.flights.update(i.id, { isSynced: true });
      if (data.batteries) for (const i of data.batteries) await db.batteries.update(i.id, { isSynced: true });
      if (data.detections) for (const i of data.detections) await db.detections.update(i.id, { isSynced: true });
      if (data.checklists) for (const i of data.checklists) await db.vehicleChecklists.update(i.id, { isSynced: true });
      if (data.droneChecklists) for (const i of data.droneChecklists) await db.droneChecklists.update(i.id, { isSynced: true });
    });
  };


  // 5. Aggregate object for export
  const fullData: AppData = { shifts, flights, batteries, detections, checklists, droneChecklists };

  // 6. Auto-persist to physical disk on every data change
  //    - In Electron (.exe): writes to Mis Documentos/Horus_Datos/
  //    - In Capacitor (APK): writes to Android internal storage
  //    - In browser (dev): no-op, Dexie handles everything
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (shifts.length > 0 || flights.length > 0 || batteries.length > 0 || detections.length > 0 || checklists.length > 0 || droneChecklists.length > 0) {
      persistToDisk(fullData).catch(e => console.error('[DB] persist error:', e));
    }
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
    markDataAsSynced
  };
}
