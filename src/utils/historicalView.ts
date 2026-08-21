import type {
  AppData, HistoricalConflictRecord, HistoricalEntityType, HistoricalOriginalRecord,
  HistoricalOverrideRecord, HistoricalRecordPayload, HistoricalTrashRecord
} from '../types';

export interface HistoricalViewState {
  originals: HistoricalOriginalRecord[];
  overrides: HistoricalOverrideRecord[];
  trash: HistoricalTrashRecord[];
  conflicts: HistoricalConflictRecord[];
}

export interface HistoricalRecordState {
  original?: HistoricalOriginalRecord;
  override?: HistoricalOverrideRecord;
  trash?: HistoricalTrashRecord;
  conflict?: HistoricalConflictRecord;
  directEdit: boolean;
  descendantEdited: boolean;
  descendantDeleted: boolean;
}

const entityCollections: Array<[HistoricalEntityType, keyof AppData]> = [
  ['shift', 'shifts'], ['flight', 'flights'], ['battery', 'batteries'],
  ['detection', 'detections'], ['vehicleChecklist', 'checklists'],
  ['droneChecklist', 'droneChecklists']
];

const isActiveTrash = (entry?: HistoricalTrashRecord) =>
  !!entry && entry.active !== false && !entry.restoredAt;

export const buildHistoricalStateMap = (history: HistoricalViewState) => {
  const result = new Map<string, HistoricalRecordState>();
  const identityByLegacy = new Map<string, string | null>();
  const payloadByLegacy = new Map<string, HistoricalRecordPayload>();
  const legacyKey = (entityType: HistoricalEntityType, legacyId: string, sourceDeviceId?: string) =>
    `${entityType}:${sourceDeviceId || ''}:${legacyId}`;
  const indexLegacyIdentity = (entityType: HistoricalEntityType, legacyId: string, recordUid: string, payload: HistoricalRecordPayload) => {
    const key = legacyKey(entityType, legacyId, payload.sourceDeviceId);
    const existing = identityByLegacy.get(key);
    identityByLegacy.set(key, identityByLegacy.has(key) && existing !== recordUid ? null : recordUid);
    if (!payloadByLegacy.has(key)) payloadByLegacy.set(key, payload);
  };
  const get = (uid: string) => result.get(uid) || {
    directEdit: false, descendantEdited: false, descendantDeleted: false
  };
  history.originals.forEach(value => {
    indexLegacyIdentity(value.entityType, value.legacyId, value.recordUid, value.payload);
    result.set(value.recordUid, { ...get(value.recordUid), original: value });
  });
  history.overrides.forEach(value => {
    indexLegacyIdentity(value.entityType, value.legacyId, value.recordUid, value.payload);
    result.set(value.recordUid, {
      ...get(value.recordUid), override: value, directEdit: value.changeKind !== 'descendantEdited' && value.changeKind !== 'descendantDeleted'
    });
  });
  history.trash.forEach(value => {
    indexLegacyIdentity(value.entityType, value.legacyId, value.recordUid, value.payload);
    result.set(value.recordUid, { ...get(value.recordUid), trash: value });
  });
  history.conflicts.forEach(value => result.set(value.recordUid, { ...get(value.recordUid), conflict: value }));

  const markParent = (payload: HistoricalRecordPayload, deleted: boolean) => {
    const directFlightUid = 'flightRecordUid' in payload ? payload.flightRecordUid : undefined;
    const directShiftUid = 'shiftRecordUid' in payload ? payload.shiftRecordUid : undefined;
    if (directFlightUid) {
      result.set(directFlightUid, { ...get(directFlightUid), [deleted ? 'descendantDeleted' : 'descendantEdited']: true });
      const flightState = get(directFlightUid);
      const flight = flightState.override?.payload || flightState.original?.payload || flightState.trash?.payload;
      const ancestorUid = flight && 'shiftRecordUid' in flight ? flight.shiftRecordUid : undefined;
      if (ancestorUid) result.set(ancestorUid, { ...get(ancestorUid), [deleted ? 'descendantDeleted' : 'descendantEdited']: true });
      return;
    }
    if (directShiftUid) {
      result.set(directShiftUid, { ...get(directShiftUid), [deleted ? 'descendantDeleted' : 'descendantEdited']: true });
      return;
    }
    if (payload.globalRelationStatus === 'unresolved' || payload.globalRelationStatus === 'ambiguous') return;
    const flightId = 'flightId' in payload ? payload.flightId : undefined;
    const shiftId = 'shiftId' in payload ? payload.shiftId : undefined;
    if (flightId) {
      const parentUid = identityByLegacy.get(legacyKey('flight', flightId, payload.sourceDeviceId));
      if (parentUid) {
        result.set(parentUid, { ...get(parentUid), [deleted ? 'descendantDeleted' : 'descendantEdited']: true });
        const flight = payloadByLegacy.get(legacyKey('flight', flightId, payload.sourceDeviceId));
        const ancestorShiftId = flight && 'shiftId' in flight ? flight.shiftId : undefined;
        const ancestorUid = ancestorShiftId ? identityByLegacy.get(legacyKey('shift', ancestorShiftId, payload.sourceDeviceId)) : undefined;
        if (ancestorUid) result.set(ancestorUid, { ...get(ancestorUid), [deleted ? 'descendantDeleted' : 'descendantEdited']: true });
      }
    }
    if (shiftId) {
      const parentUid = identityByLegacy.get(legacyKey('shift', shiftId, payload.sourceDeviceId));
      if (parentUid) result.set(parentUid, { ...get(parentUid), [deleted ? 'descendantDeleted' : 'descendantEdited']: true });
    }
  };
  history.overrides.forEach(value => markParent(value.payload, false));
  history.trash.filter(isActiveTrash).forEach(value => markParent(value.payload, true));
  return result;
};

export const getConsolidatedView = (operational: AppData, history: HistoricalViewState): AppData => {
  const overrideMap = new Map(history.overrides.map(item => [item.recordUid, item]));
  const trashMap = new Map(history.trash.map(item => [item.recordUid, item]));
  const output: AppData = { shifts: [], flights: [], batteries: [], detections: [], checklists: [], droneChecklists: [] };

  for (const [, key] of entityCollections) {
    const records = (operational[key] || []) as HistoricalRecordPayload[];
    (output as any)[key] = records
      .filter(record => !record.isDeleted && !isActiveTrash(record.recordUid ? trashMap.get(record.recordUid) : undefined))
      .map(record => {
        const override = record.recordUid ? overrideMap.get(record.recordUid) : undefined;
        return (override && (override.editorRole === 'control' || !override.editorRole) ? override.payload : record) as HistoricalRecordPayload;
      });
  }

  return output;
};

export const getHistoricalDifferences = (original: unknown, current: unknown) => {
  const before = (original && typeof original === 'object' ? original : {}) as Record<string, unknown>;
  const after = (current && typeof current === 'object' ? current : {}) as Record<string, unknown>;
  const ignored = new Set(['isSynced', 'lastModified', 'isEdited', 'editedTimestamp']);
  return Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
    .filter(field => !ignored.has(field))
    .map(field => ({ field, original: before[field], current: after[field] }))
    .filter(change => JSON.stringify(change.original ?? null) !== JSON.stringify(change.current ?? null));
};
