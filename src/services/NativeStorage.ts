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
export async function persistToDisk(data: AppData): Promise<void> {
  const payload = JSON.stringify(data, null, 2);

  if (isElectron()) {
    // Windows .exe path: Uses Node.js fs via IPC bridge
    try {
      await (window as any).horusNative.writeData(payload);
    } catch (e) {
      console.error('[NativeStorage] Electron write failed:', e);
    }
    return;
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
    } catch (e) {
      console.error('[NativeStorage] Capacitor write failed:', e);
    }
    return;
  }

  // Browser (development): No-op, Dexie handles everything
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
