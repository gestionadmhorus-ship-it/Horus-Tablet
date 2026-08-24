import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Data Storage Path (Physical disk, safe from browser cache cleans) ───
const dataDir = path.join(os.homedir(), 'Documents', 'Horus_Datos');
const dataFilePath = path.join(dataDir, 'horus_base_de_datos.json');
const historicalFilePath = path.join(dataDir, 'horus_historico.json');
const historicalPreviousFilePath = path.join(dataDir, 'horus_historico.previous.json');

// Ensure data directory exists on startup
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// ─── IPC Handlers: Bridge between React app and the real filesystem ───

// READ: Load data from physical disk when app starts
ipcMain.handle('horus:readData', () => {
  try {
    if (fs.existsSync(dataFilePath)) {
      const content = fs.readFileSync(dataFilePath, 'utf-8');
      return { success: true, data: JSON.parse(content) };
    }
    return { success: true, data: null }; // First run, no file yet
  } catch (err) {
    console.error('Error reading Horus data:', err);
    return { success: false, error: String(err) };
  }
});

// WRITE: Save data snapshot to physical disk after every change
ipcMain.handle('horus:writeData', (_event, payload: string) => {
  const temporaryPath = `${dataFilePath}.tmp`;
  try {
    const handle = fs.openSync(temporaryPath, 'w');
    try {
      fs.writeFileSync(handle, payload, 'utf-8');
      fs.fsyncSync(handle);
    } finally {
      fs.closeSync(handle);
    }
    fs.renameSync(temporaryPath, dataFilePath);
    return { success: true };
  } catch (err) {
    try { if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath); } catch {}
    console.error('Error writing Horus data:', err);
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('horus:readHistoricalData', () => {
  const read = (filePath: string) => {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  };
  try {
    return { success: true, data: read(historicalFilePath), previous: read(historicalPreviousFilePath) };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('horus:writeHistoricalData', (_event, payload: string, rotateCurrent: boolean) => {
  const temporaryPath = `${historicalFilePath}.tmp`;
  try {
    const handle = fs.openSync(temporaryPath, 'w');
    try {
      fs.writeFileSync(handle, payload, 'utf-8');
      fs.fsyncSync(handle);
    } finally {
      fs.closeSync(handle);
    }
    if (rotateCurrent && fs.existsSync(historicalFilePath)) {
      if (fs.existsSync(historicalPreviousFilePath)) fs.unlinkSync(historicalPreviousFilePath);
      fs.renameSync(historicalFilePath, historicalPreviousFilePath);
    } else if (fs.existsSync(historicalFilePath)) {
      fs.unlinkSync(historicalFilePath);
    }
    fs.renameSync(temporaryPath, historicalFilePath);
    return { success: true };
  } catch (err) {
    try { if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath); } catch {}
    return { success: false, error: String(err) };
  }
});

// ─── Window Creation ───
function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Hermes II — Tablet',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // In development: load from Vite dev server. In production: load from dist.
  if (process.env['VITE_DEV_SERVER_URL']) {
    win.loadURL(process.env['VITE_DEV_SERVER_URL']);
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
