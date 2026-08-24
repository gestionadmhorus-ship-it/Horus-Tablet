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
      try {
        const response = await fetch(`${GITHUB_REPO_URL}/version.json`, { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          if (data && data.version) {
            localStorage.setItem('horus_current_version', data.version);
            return { hasUpdate: false, version: data.version, url: '' };
          }
        }
      } catch (error) {
        console.error('[Modo Web] Error al verificar versión desde GitHub:', error);
      }
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

    const previousVersion = this.getCurrentVersion();
    let versionMetadataUpdated = false;

    try {
      // 1. Descarga el .zip desde GitHub
      const versionData = await CapacitorUpdater.download({
        url: updateUrl,
        version: newVersion,
      });

      // 2. Prepara el metadato antes de set(): una activación correcta destruye
      // el contexto JavaScript y no garantiza ejecutar código posterior.
      localStorage.setItem('horus_current_version', newVersion);
      versionMetadataUpdated = true;

      // 3. Aplica y reinicia la app al instante; si rechaza, el catch restaura
      // la versión anterior declarada.
      await CapacitorUpdater.set({ id: versionData.id });
      
    } catch (error) {
      if (versionMetadataUpdated) {
        try {
          localStorage.setItem('horus_current_version', previousVersion);
        } catch (restoreError) {
          console.error('No se pudo restaurar el metadato de versión anterior:', restoreError);
        }
      }
      console.error('Error crítico al aplicar el parche:', error);
      throw error;
    }
  }
}
