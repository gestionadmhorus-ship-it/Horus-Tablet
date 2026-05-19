import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { DEFAULT_LISTS, type ListsData, type AppData, type ShiftData, type FlightData, type BatteryData, type DetectionData } from '../types';
import { useEffect } from 'react';

export function useDatabase() {
  // 1. Live Queries for real-time UI updates
  const shifts = useLiveQuery(() => db.shifts.toArray()) || [];
  const flights = useLiveQuery(() => db.flights.toArray()) || [];
  const batteries = useLiveQuery(() => db.batteries.toArray()) || [];
  const detections = useLiveQuery(() => db.detections.toArray()) || [];
  
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
        } catch (e) { console.error('Migration error (data):', e); }
      }
    };
    migrate();
  }, [settingsRow]);

  // 4. Save/Update/Delete functions
  const saveShift = (item: ShiftData) => db.shifts.add(item);
  const updateShift = (item: ShiftData) => db.shifts.put(item);
  const deleteShift = (id: string) => db.shifts.delete(id);

  const saveFlight = (item: FlightData) => db.flights.add(item);
  const updateFlight = (item: FlightData) => db.flights.put(item);
  const deleteFlight = (id: string) => db.flights.delete(id);

  const saveBattery = (item: BatteryData) => db.batteries.add(item);
  const updateBattery = (item: BatteryData) => db.batteries.put(item);
  const deleteBattery = (id: string) => db.batteries.delete(id);

  const saveDetection = (item: DetectionData) => db.detections.add(item);
  const updateDetection = (item: DetectionData) => db.detections.put(item);
  const deleteDetection = (id: string) => db.detections.delete(id);
  
  const updateLists = (newList: ListsData) => db.settings.put({ id: 'current', data: newList });

  // 5. Aggregate object for export
  const fullData: AppData = { shifts, flights, batteries, detections };

  return {
    fullData,
    lists,
    saveShift, updateShift, deleteShift,
    saveFlight, updateFlight, deleteFlight,
    saveBattery, updateBattery, deleteBattery,
    saveDetection, updateDetection, deleteDetection,
    updateLists
  };
}
