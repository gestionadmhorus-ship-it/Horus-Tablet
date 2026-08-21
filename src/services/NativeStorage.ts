/**
 * NativeStorage.ts — El Adaptador Universal
 *
 * Este archivo es el "Secretario físico" de Horus.
 * - Si estamos en un .exe de Windows (Electron): Usa el disco duro real del PC
 *   y guarda en: Mis Documentos/Horus_Datos/horus_base_de_datos.json
 * - Si estamos en un APK Android (Capacitor): Usa el almacenamiento interno
 *   profundo del celular, inaccesible por limpieza de caché.
 * - Si estamos en un navegador web (desarrollo/browser): No hace nada,
 *   Dexie maneja todo, el sistema de desarrollo no se ve afectado.
 */

import type { AppData, HistoricalArchive } from '../types';

export type PersistToDiskResult =
  | { status: 'success' }
  | { status: 'failure'; error: string }
  | { status: 'not-applicable' };

type HistoricalArchiveInput = Omit<HistoricalArchive, 'generation' | 'createdAt' | 'metadata'>;

const historicalContent = (archive: HistoricalArchiveInput | HistoricalArchive) => ({
  schemaVersion: archive.schemaVersion,
  originals: archive.originals,
  currentOverrides: archive.currentOverrides,
  trash: archive.trash,
  conflicts: archive.conflicts,
  operationalState: archive.operationalState,
  knowledgeBase: archive.knowledgeBase
});

const checksum = async (value: unknown) => {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
};

export const validateHistoricalArchive = async (candidate: unknown): Promise<HistoricalArchive | null> => {
  if (!candidate || typeof candidate !== 'object') return null;
  const archive = candidate as HistoricalArchive;
  if ((archive.schemaVersion !== 1 && archive.schemaVersion !== 2) || !Number.isInteger(archive.generation) || archive.generation < 1) return null;
  if (!Array.isArray(archive.originals) || !Array.isArray(archive.currentOverrides) || !Array.isArray(archive.trash) || !Array.isArray(archive.conflicts)) return null;
  if (archive.schemaVersion === 2 && (!archive.operationalState || !Array.isArray(archive.operationalState.shifts) || !Array.isArray(archive.operationalState.flights)
    || !Array.isArray(archive.operationalState.batteries) || !Array.isArray(archive.operationalState.detections))) return null;
  if (archive.schemaVersion === 2 && archive.operationalState) {
    if ((archive.operationalState.checklists !== undefined && !Array.isArray(archive.operationalState.checklists))
      || (archive.operationalState.droneChecklists !== undefined && !Array.isArray(archive.operationalState.droneChecklists))) return null;
    const operationalRecords = [
      ...archive.operationalState.shifts, ...archive.operationalState.flights,
      ...archive.operationalState.batteries, ...archive.operationalState.detections,
      ...(archive.operationalState.checklists || []), ...(archive.operationalState.droneChecklists || [])
    ];
    if (!operationalRecords.every(record => record && typeof record.id === 'string' && typeof record.recordUid === 'string' && !!record.recordUid.trim())) return null;
  }
  if (!archive.metadata || archive.metadata.checksumAlgorithm !== 'SHA-256' || typeof archive.metadata.contentChecksum !== 'string') return null;
  const entityTypes = new Set(['shift', 'flight', 'battery', 'detection', 'vehicleChecklist', 'droneChecklist']);
  const validBase = (entry: any) => entry && typeof entry === 'object'
    && typeof entry.recordUid === 'string' && !!entry.recordUid.trim()
    && entityTypes.has(entry.entityType)
    && typeof entry.legacyId === 'string'
    && entry.payload && typeof entry.payload === 'object'
    && entry.payload.id === entry.legacyId
    && (!entry.payload.recordUid || entry.payload.recordUid === entry.recordUid)
    && (!entry.sourceDeviceId || !entry.payload.sourceDeviceId || entry.sourceDeviceId === entry.payload.sourceDeviceId);
  if (!archive.originals.every(entry => validBase(entry) && (entry.originalStatus === 'verified' || entry.originalStatus === 'legacyBaseline'))) return null;
  if (!archive.currentOverrides.every(validBase) || !archive.trash.every(validBase) || !archive.conflicts.every(validBase)) return null;
  if (new Set(archive.originals.map(entry => entry.recordUid)).size !== archive.originals.length) return null;
  const calculated = await checksum(historicalContent(archive));
  return calculated === archive.metadata.contentChecksum ? archive : null;
};

// Detect if we're running inside Electron (.exe)
const isElectron = (): boolean => {
  return typeof window !== 'undefined' && 
         typeof (window as any).horusNative !== 'undefined';
};

// Detect if we're running inside a Capacitor native app (APK)
const isCapacitor = (): boolean => {
  return typeof window !== 'undefined' && 
         !!(window as any).Capacitor?.isNativePlatform?.();
};

/**
 * WRITE: Save a full snapshot of data to physical disk.
 * Called silently after every save/update/delete operation.
 */
export async function persistToDisk(data: AppData): Promise<PersistToDiskResult> {
  if (!isElectron() && !isCapacitor()) {
    return { status: 'not-applicable' };
  }

  let payload: string;
  try {
    payload = JSON.stringify(data, null, 2);
  } catch (e) {
    console.error('[NativeStorage] Backup serialization failed:', e);
    return { status: 'failure', error: e instanceof Error ? e.message : String(e) };
  }

  if (isElectron()) {
    // Windows .exe path: Uses Node.js fs via IPC bridge
    try {
      const result = await (window as any).horusNative.writeData(payload);
      if (result?.success === false) {
        const error = result.error || 'Error desconocido al escribir el respaldo.';
        console.error('[NativeStorage] Electron write failed:', error);
        return { status: 'failure', error: String(error) };
      }
      return { status: 'success' };
    } catch (e) {
      console.error('[NativeStorage] Electron write failed:', e);
      return { status: 'failure', error: e instanceof Error ? e.message : String(e) };
    }
  }

  if (isCapacitor()) {
    // Android APK path: Uses Capacitor Filesystem plugin
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      await Filesystem.writeFile({
        path: 'Horus_Datos/horus_base_de_datos.json',
        data: payload,
        directory: Directory.Documents,
        recursive: true,
        encoding: (await import('@capacitor/filesystem')).Encoding.UTF8,
      });
      return { status: 'success' };
    } catch (e) {
      console.error('[NativeStorage] Capacitor write failed:', e);
      return { status: 'failure', error: e instanceof Error ? e.message : String(e) };
    }
  }

  return { status: 'not-applicable' };
}

/**
 * READ: Load data snapshot from physical disk on app startup.
 * Returns null if no file exists yet (fresh install).
 */
export async function loadFromDisk(): Promise<AppData | null> {
  if (isElectron()) {
    try {
      const result = await (window as any).horusNative.readData();
      if (result.success && result.data) {
        return result.data as AppData;
      }
    } catch (e) {
      console.error('[NativeStorage] Electron read failed:', e);
    }
    return null;
  }

  if (isCapacitor()) {
    try {
      const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
      const result = await Filesystem.readFile({
        path: 'Horus_Datos/horus_base_de_datos.json',
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
      });
      return JSON.parse(result.data as string) as AppData;
    } catch {
      // File doesn't exist yet — first install
      return null;
    }
  }

  // Browser: return null, let Dexie do its job
  return null;
}

export async function loadHistoricalFromDisk(): Promise<HistoricalArchive | null> {
  const validateWithFallback = async (current: unknown, previous: unknown) =>
    await validateHistoricalArchive(current) || await validateHistoricalArchive(previous);

  if (isElectron()) {
    try {
      const result = await (window as any).horusNative.readHistoricalData();
      if (!result?.success) return null;
      return await validateWithFallback(result.data, result.previous);
    } catch (error) {
      console.error('[NativeStorage] Historical read failed:', error);
      return null;
    }
  }

  if (isCapacitor()) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const read = async (path: string) => {
      try {
        const result = await Filesystem.readFile({ path, directory: Directory.Documents, encoding: Encoding.UTF8 });
        return JSON.parse(result.data as string);
      } catch { return null; }
    };
    return await validateWithFallback(
      await read('Horus_Datos/horus_historico.json'),
      await read('Horus_Datos/horus_historico.previous.json')
    );
  }

  return null;
}

export async function persistHistoricalToDisk(input: HistoricalArchiveInput): Promise<PersistToDiskResult> {
  if (!isElectron() && !isCapacitor()) return { status: 'not-applicable' };
  try {
    let previous: HistoricalArchive | null = null;
    let rotateCurrent = false;
    if (isElectron()) {
      const candidates = await (window as any).horusNative.readHistoricalData();
      const currentValid = candidates?.success ? await validateHistoricalArchive(candidates.data) : null;
      previous = currentValid || (candidates?.success ? await validateHistoricalArchive(candidates.previous) : null);
      rotateCurrent = !!currentValid;
    } else {
      const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
      const readCandidate = async (path: string) => {
        try {
          const result = await Filesystem.readFile({ path, directory: Directory.Documents, encoding: Encoding.UTF8 });
          return await validateHistoricalArchive(JSON.parse(result.data as string));
        } catch { return null; }
      };
      const currentValid = await readCandidate('Horus_Datos/horus_historico.json');
      previous = currentValid || await readCandidate('Horus_Datos/horus_historico.previous.json');
      rotateCurrent = !!currentValid;
    }
    const mergeUnique = <T>(older: T[], newer: T[], key: (item: T) => string) => {
      const merged = new Map<string, T>();
      older.forEach(item => merged.set(key(item), item));
      newer.forEach(item => merged.set(key(item), item));
      return Array.from(merged.values());
    };
    const accumulated: HistoricalArchiveInput = {
      ...input,
      originals: mergeUnique(input.originals, previous?.originals || [], item => item.recordUid),
      currentOverrides: input.currentOverrides,
      trash: mergeUnique(previous?.trash || [], input.trash, item => `${item.recordUid}:${item.deletedAt}:${item.restoredAt || 0}:${item.permanentlyRemovedAt || 0}`),
      conflicts: mergeUnique(previous?.conflicts || [], input.conflicts, item => `${item.recordUid}:${item.receivedAt}:${item.conflictStatus}:${item.resolvedAt || 0}`)
    };
    const archive: HistoricalArchive = {
      ...accumulated,
      generation: (previous?.generation || 0) + 1,
      createdAt: new Date().toISOString(),
      metadata: {
        application: 'Hermes 2.0',
        checksumAlgorithm: 'SHA-256',
        contentChecksum: await checksum(historicalContent(accumulated))
      }
    };
    const payload = JSON.stringify(archive, null, 2);

    if (isElectron()) {
      const result = await (window as any).horusNative.writeHistoricalData(payload, rotateCurrent);
      return result?.success ? { status: 'success' } : { status: 'failure', error: String(result?.error || 'Error de escritura histórica') };
    }

    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const current = 'Horus_Datos/horus_historico.json';
    const previousPath = 'Horus_Datos/horus_historico.previous.json';
    const temporary = 'Horus_Datos/horus_historico.tmp.json';
    await Filesystem.writeFile({ path: temporary, data: payload, directory: Directory.Documents, recursive: true, encoding: Encoding.UTF8 });
    if (rotateCurrent) {
      try { await Filesystem.deleteFile({ path: previousPath, directory: Directory.Documents }); } catch {}
      try { await Filesystem.rename({ from: current, to: previousPath, directory: Directory.Documents }); } catch {}
    } else {
      try { await Filesystem.deleteFile({ path: current, directory: Directory.Documents }); } catch {}
    }
    await Filesystem.rename({ from: temporary, to: current, directory: Directory.Documents });
    return { status: 'success' };
  } catch (error) {
    console.error('[NativeStorage] Historical write failed:', error);
    return { status: 'failure', error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Returns a human-readable description of the current storage platform.
 * Useful for debugging and the Settings panel.
 */
export function getStoragePlatform(): string {
  if (isElectron()) return 'Windows (Disco Físico: Mis Documentos/Horus_Datos/)';
  if (isCapacitor()) return 'Android (Almacenamiento Interno Nativo)';
  return 'Navegador Web (Modo Desarrollo - IndexedDB)';
}
