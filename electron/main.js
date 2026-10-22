'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { CHANNELS } = require('./ipc-channels.js');

const isDev = process.argv.includes('--dev');
const BACKEND_PORT = Number(process.env.HELIOS_BACKEND_PORT || 8723);
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const BACKEND_DIR = path.join(__dirname, '..', 'backend');
const PYTHON_BIN = process.env.HELIOS_PYTHON || 'python';
const HEALTH_TIMEOUT_MS = 3000;
const READY_TIMEOUT_MS = 25000;

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {import('node:child_process').ChildProcess | null} */
let backendProcess = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(pathname, timeoutMs = HEALTH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${BACKEND_URL}${pathname}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function notifyBackend(state) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(CHANNELS.BACKEND_STATUS, { state });
  }
}

function startBackend() {
  const child = spawn(PYTHON_BIN, ['-m', 'helios'], {
    cwd: BACKEND_DIR,
    env: { ...process.env, HELIOS_BACKEND_PORT: String(BACKEND_PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => process.stdout.write(`[backend] ${chunk}`));
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => process.stderr.write(`[backend] ${chunk}`));

  child.on('error', (error) => {
    console.error(`[backend] no se pudo iniciar (${error.message})`);
    notifyBackend('offline');
  });

  child.on('exit', (code, signal) => {
    backendProcess = null;
    console.log(`[backend] detenido (code=${code} signal=${signal})`);
    notifyBackend('offline');
  });

  backendProcess = child;
  return child;
}

function stopBackend() {
  if (!backendProcess) return;
  const child = backendProcess;
  backendProcess = null;
  child.kill();
}

async function waitForBackend(timeoutMs = READY_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!backendProcess) return false;
    try {
      await fetchJson('/api/health', 1000);
      return true;
    } catch {
      await sleep(250);
    }
  }
  return false;
}

ipcMain.handle(CHANNELS.HEALTH, async () => {
  try {
    return await fetchJson('/api/health');
  } catch (error) {
    return { status: 'error', backend: 'offline', provider: 'none', error: error.message };
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 940,
    minHeight: 600,
    show: false,
    backgroundColor: '#04070d',
    title: 'HELIOS',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      additionalArguments: [`--helios-channels=${JSON.stringify(CHANNELS)}`],
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function bootstrap() {
  startBackend();
  const ready = await waitForBackend();
  notifyBackend(ready ? 'online' : 'offline');
}

app.whenReady().then(() => {
  createWindow();
  bootstrap();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', stopBackend);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
