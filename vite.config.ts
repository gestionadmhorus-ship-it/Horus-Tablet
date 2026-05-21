import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';

const isElectronBuild = process.env['BUILD_TARGET'] === 'electron';

// https://vite.dev/config/
export default defineConfig({
  // CRITICAL for Electron: relative paths so file:// protocol resolves assets.
  // For web/Android builds, base '/' is correct for HTTP servers.
  base: isElectronBuild ? './' : '/',
  plugins: [
    react(),
    // Only activates when BUILD_TARGET=electron — zero impact on APK builds
    ...(isElectronBuild
      ? [
          electron([
            {
              entry: 'electron/main.ts',
              onstart(options) {
                options.startup();
              },
              vite: {
                build: {
                  outDir: 'dist-electron',
                },
              },
            },
            {
              entry: 'electron/preload.ts',
              onstart(options) {
                options.reload();
              },
              vite: {
                build: {
                  outDir: 'dist-electron',
                },
              },
            },
          ]),
        ]
      : []),
  ],
  server: {
    host: true,
    port: 5173,
  },
});
