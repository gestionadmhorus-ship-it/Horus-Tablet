import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { Capacitor } from '@capacitor/core';

// Apuntamos a la URL "cruda" (Raw) de tu repositorio en la rama 'ota-updates'
const GITHUB_REPO_URL = 'https://raw.githubusercontent.com/gestionadmhorus-ship-it/Horus-Tablet/ota-updates';

export interface UpdateStatus {
  hasUpdate: boolean;
  version: string;
  url: string;
}

export class UpdateManager {
  /**
   * Obtiene la versión actual instalada en la tablet.
   * Si es la primera vez, asume v2.0.0.
   */
  static getCurrentVersion(): string {
    return localStorage.getItem('horus_current_version') || 'v2.0.0';
  }

  /**
   * Verifica en GitHub si hay una versión más nueva.
   */
  static async checkForUpdates(): Promise<UpdateStatus> {
    const currentVersion = this.getCurrentVersion();

    if (!Capacitor.isNativePlatform()) {
      console.log(`[Modo Web] Versión actual: ${currentVersion}. OTA deshabilitado en navegador.`);
      return { hasUpdate: false, version: currentVersion, url: '' };
    }

    try {
      // Descarga el archivo version.json desde GitHub
      const response = await fetch(`${GITHUB_REPO_URL}/version.json`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('No se pudo conectar con el servidor de actualizaciones en GitHub.');
      }

      const data = await response.json();
      
      // Si la versión en GitHub es distinta a la instalada, hay actualización
      if (data.version && data.version !== currentVersion) {
        return {
          hasUpdate: true,
          version: data.version,
          url: data.url || `${GITHUB_REPO_URL}/bundle.zip`
        };
      }

      return { hasUpdate: false, version: currentVersion, url: '' };
    } catch (error) {
      console.error('Error al buscar actualizaciones OTA:', error);
      throw error;
    }
  }

  /**
   * Descarga y aplica el paquete desde GitHub usando Capacitor Updater.
   */
  static async performUpdate(updateUrl: string, newVersion: string): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      console.warn('Simulando actualización en web...');
      localStorage.setItem('horus_current_version', newVersion);
      return;
    }

    try {
      // 1. Descarga el .zip desde GitHub
      const versionData = await CapacitorUpdater.download({
        url: updateUrl,
        version: newVersion,
      });

      // 2. Registra la nueva versión en la memoria
      localStorage.setItem('horus_current_version', newVersion);

      // 3. Aplica y reinicia la app al instante
      await CapacitorUpdater.set({ id: versionData.id });
      
    } catch (error) {
      console.error('Error crítico al aplicar el parche:', error);
      throw error;
    }
  }
}
