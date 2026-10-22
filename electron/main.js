'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');
const { CHANNELS } = require('./ipc-channels.js');

const isDev = process.argv.includes('--dev');
const BACKEND_PORT = Number(process.env.HELIOS_BACKEND_PORT || 8723);
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const BACKEND_DIR = path.join(__dirname, '..', 'backend');
const HEALTH_TIMEOUT_MS = 3000;
const READY_TIMEOUT_MS = 25000;

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {import('node:child_process').ChildProcess | null} */
let backendProcess = null;
let backendState = 'starting';
let backendDetail = 'iniciando el sidecar python';
let backendLog = '';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function resolvePython() {
  const explicit = process.env.HELIOS_PYTHON;
  if (explicit) return explicit;
  if (process.platform !== 'win32') return 'python';

  const probe = spawnSync('python', ['-c', 'import sys; print(sys.executable)'], {
    encoding: 'utf8',
    windowsHide: true,
  });

  const resolved = probe.stdout?.trim();
  if (probe.status === 0 && resolved && path.isAbsolute(resolved)) return resolved;
  return 'python';
}

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

function isPortBusy(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', (error) => resolve(error.code === 'EADDRINUSE'));
    probe.once('listening', () => probe.close(() => resolve(false)));
    probe.listen(port, '127.0.0.1');
  });
}

function setBackendState(state, detail) {
  backendState = state;
  backendDetail = detail;
  notifyBackend();
}

function notifyBackend() {
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isLoading()) {
    mainWindow.webContents.send(CHANNELS.BACKEND_STATUS, {
      state: backendState,
      detail: backendDetail,
    });
  }
}

function startBackend() {
  const child = spawn(resolvePython(), ['-m', 'helios'], {
    cwd: BACKEND_DIR,
    env: { ...process.env, HELIOS_BACKEND_PORT: String(BACKEND_PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => process.stdout.write(`[backend] ${chunk}`));
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    backendLog = `${backendLog}${chunk}`.slice(-2000);
    process.stderr.write(`[backend] ${chunk}`);
  });

  child.on('error', (error) => {
    console.error(`[backend] no se pudo iniciar (${error.message})`);
    setBackendState('offline', `no se pudo ejecutar el interprete python: ${error.message}`);
  });

  child.on('exit', (code, signal) => {
    backendProcess = null;
    console.log(`[backend] detenido (code=${code} signal=${signal})`);
    isPortBusy(BACKEND_PORT).then((busy) => {
      if (busy) {
        setBackendState(
          'conflict',
          `el puerto ${BACKEND_PORT} ya esta ocupado por otro proceso`,
        );
      } else {
        setBackendState(
          'offline',
          backendLog.trim().split('\n').pop() || 'el sidecar python se detuvo',
        );
      }
    });
  });

  backendProcess = child;
  return child;
}

function stopBackend() {
  if (!backendProcess) return;
  const child = backendProcess;
  backendProcess = null;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    child.kill();
  }
}

async function waitForBackend(timeoutMs = READY_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!backendProcess) return false;
    try {
      await fetchJson('/api/health', 1000);
      setBackendState('online', 'sidecar python listo');
      return true;
    } catch {
      await sleep(250);
    }
  }
  return false;
}

ipcMain.handle(CHANNELS.HEALTH, async () => {
  if (backendState !== 'online') {
    return { status: 'error', backend: 'offline', provider: 'none', error: backendDetail };
  }
  try {
    return await fetchJson('/api/health');
  } catch (error) {
    return { status: 'error', backend: 'offline', provider: 'none', error: error.message };
  }
});

ipcMain.handle(CHANNELS.BACKEND_STATUS, () => ({
  state: backendState,
  detail: backendDetail,
}));

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

  mainWindow.webContents.on('did-finish-load', () => notifyBackend());

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function bootstrap() {
  if (await isPortBusy(BACKEND_PORT)) {
    setBackendState(
      'conflict',
      `el puerto ${BACKEND_PORT} ya esta ocupado por otro proceso`,
    );
    return;
  }

  startBackend();

  const ready = await waitForBackend();
  if (ready) return;

  if (await isPortBusy(BACKEND_PORT)) {
    setBackendState(
      'conflict',
      `el puerto ${BACKEND_PORT} ya esta ocupado por otro proceso`,
    );
  } else {
    setBackendState(
      'offline',
      backendLog.trim().split('\n').pop() || 'el sidecar python no responde',
    );
  }
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
