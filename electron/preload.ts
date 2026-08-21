import { contextBridge, ipcRenderer } from 'electron';

// Expose safe, limited bridge from Electron to the React app
// The React app will call window.horusNative.readData() / .writeData()
contextBridge.exposeInMainWorld('horusNative', {
  readData: () => ipcRenderer.invoke('horus:readData'),
  writeData: (payload: string) => ipcRenderer.invoke('horus:writeData', payload),
  readHistoricalData: () => ipcRenderer.invoke('horus:readHistoricalData'),
  writeHistoricalData: (payload: string, rotateCurrent: boolean) => ipcRenderer.invoke('horus:writeHistoricalData', payload, rotateCurrent),
  platform: process.platform,
});
