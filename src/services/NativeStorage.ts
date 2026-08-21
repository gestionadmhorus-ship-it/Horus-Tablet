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

import type { AppData } from '../types';

export type PersistToDiskResult =
  | { status: 'success' }
  | { status: 'failure'; error: string }
  | { status: 'not-applicable' };

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

/**
 * Returns a human-readable description of the current storage platform.
 * Useful for debugging and the Settings panel.
 */
export function getStoragePlatform(): string {
  if (isElectron()) return 'Windows (Disco Físico: Mis Documentos/Horus_Datos/)';
  if (isCapacitor()) return 'Android (Almacenamiento Interno Nativo)';
  return 'Navegador Web (Modo Desarrollo - IndexedDB)';
}
