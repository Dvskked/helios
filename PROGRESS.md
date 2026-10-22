# PROGRESS — HELIOS

## Fase 0 — Estructura base — ✅ Completada (2026-10-21)

**Hecho**
- Inspección de `F:\elios`: directorio vacío, sin repositorio previo.
- Entorno verificado: Node 24.19 / npm 11.17 / Python 3.14.7 / Git 2.55 / 16 GB RAM / ~237 GB libres / GPU AMD integrada (inferencia por CPU).
- Creados `AGENTS.md` y `PROGRESS.md`.
- Definida estructura mínima de directorios (`electron/`, `renderer/`, `backend/helios/`, `assets/`, `scripts/`).
- Esqueleto de archivos base: `package.json`, `.gitignore`, `electron/main.js`, `electron/preload.js`, `electron/ipc-channels.js`, `renderer/index.html`, `renderer/styles/main.css`, `renderer/js/app.js`, `backend/requirements.txt`, `backend/helios/{__init__,__main__,main}.py`, `backend/helios/core/config.py`, `backend/helios/routers/health.py`.
- Inicializado repositorio Git con primer commit.

**Decisiones**
- El backend Python es un *sidecar* en `127.0.0.1:8723` (REST + WebSocket), lanzado por Electron.
- IA local tras una capa de abstracción de proveedor; Ollama y llama.cpp server son candidatos (GPU no disponible → CPU).
- Renderer sin framework en las fases iniciales; `contextIsolation` activo.

**Pendiente**
- Nada pendiente en Fase 0.

**Bloqueos**
- Ninguno. Requerirá permiso del usuario para `npm install` y `pip install -r backend/requirements.txt`.

## Próxima fase

**Fase 1 — Ventana Electron + puente IPC + backend vivo**
1. `npm install` (pedir permiso).
2. `pip install -r backend/requirements.txt` (pedir permiso).
3. Electron: ventana base, spawn del sidecar, preload con `contextBridge` sobre canales IPC definidos en `ipc-channels.js`.
4. Backend: `/api/health` responding y `electron/main.js` mostrando su resultado en la UI.

## Fase 1 — Ventana Electron + puente IPC + backend vivo — 🟡 En curso (2026-10-21)

**Instalaciones (con permiso del usuario)**
- `npm install` → 70 paquetes; Electron 33.4.11 (`node_modules/electron/dist/electron.exe` verificado). npm reporta 6 vulnerabilidades (4 moderate, 2 high) y un aviso `allow-scripts` por el postinstall de Electron; el binario quedó descargado y operativo.
- `pip install -r backend/requirements.txt` → fastapi 0.159.1, uvicorn 0.54.0, pydantic 2.14.1, pydantic-settings 2.16.1, httpx 0.28.1, psutil 7.2.2. **Sin incompatibilidades con Python 3.14.7.**

**Implementado**
- Backend: `/api/health` operativo en `http://127.0.0.1:8723`; `core/config.py` expone `backend_port` (env `HELIOS_BACKEND_PORT`).
- Electron: `main.js` lanza el sidecar (`python -m helios`, cwd `backend/`), sondea el readiness, proxea `/api/health` por IPC y lo detiene en `before-quit`.
- Puente IPC completo: `main.js` (proxy HTTP + evento `BACKEND_STATUS`) → `preload.js` (`contextBridge`) → `renderer/js/app.js` (pinta estado y detalle).
- `electron/ipc-channels.js` convertido a CommonJS (ver error below). Canales verificados en runtime: `helios:health`, `helios:system:snapshot`, `helios:system:processes`, `helios:backend:status`.

**Errores encontrados y resueltos**
- **Crash al cargar `main.js`**: `ipc-channels.js` estaba en ESM (`export const`) y se consumía con `require()` desde CommonJS → `SyntaxError: Unexpected token 'export'`. Electron 33 embiere Node v20.18.3, sin soporte de `require(esm)`. El proceso main moría antes de `app.whenReady()`, por lo que el sidecar nunca se lanzaba y el puerto 8723 quedaba libre. **Resuelto** pasando a `module.exports` conservando constantes y valores.
- **Falso negativo de validación**: `node --check` y `node -e "require(...)"` con el Node del sistema (v24.19, que sí soporta `require(esm)`) no detectaban el fallo. Para validar contra el runtime real hay que usar `ELECTRON_RUN_AS_NODE=1 node_modules/electron/dist/electron.exe`.

**Verificaciones superadas**
- `require('./electron/ipc-channels.js')` bajo el Node de Electron → OK; desestructuración de `main.js` → OK; parseo del flag `--helios-channels=` del preload → OK.
- Sidecar arrancado por Electron: `python -m helios` con Uvicorn en `127.0.0.1:8723`, `Listen` con `OwningProcess` del intérprete real.
- `GET /api/health` → `{"status":"ok","version":"0.1.0","backend":"online","provider":"none"}`; log del backend con `200 OK`.
- Renderer (consultado por CDP sobre la instancia viva): `visibility: visible`, `hasFocus: true`, `outer 1280x762`; `window.helios` presente; estado en pantalla `EN LINEA` con detalle `backend online · version 0.1.0 · proveedor none`. **Puente IPC verificado de extremo a extremo.**

**Pendiente**
- Verificar que el cierre de Electron libera el puerto 8723. `stopBackend()` hace `child.kill()` sobre el proceso lanzador, pero en este equipo `python` en PATH es el alias de Python Install Manager (`WindowsApps\PythonSoftwareFoundation.PythonManager_...\python.exe`), que re-lanza el intérprete real como hijo (`...\pythoncore-3.14-64\python.exe`). `child.kill()` no mata al nieto en Windows → riesgo de sidecar huérfano con el puerto ocupado. Fix candidato: `taskkill /PID <pid> /T /F` o lanzar directamente el intérprete real.
- Decidir si se ignoran los avisos de `npm audit` (6 vulnerabilidades) antes de la Fase 5.
- Limpiar artefactos temporales `.tmp-electron.*.log` (no cubiertos por `.gitignore`).

**Bloqueos**
- Ninguno técnico. Pendiente de autorización el ajuste de `stopBackend()` antes de dar la Fase 1 por cerrada.

## Próxima fase

**Fase 1 (cierre)** — verificar liberación del puerto 8723 al salir y endurecer `stopBackend()`.

**Fase 2 — UI estilo HUD (sci-fi) y telemetría de sistema**
1. Backend: `/api/system/snapshot` y `/api/system/processes` con psutil.
2. Renderer: paneles de CPU/RAM/disco, top procesos, animaciones HUD.
3. IPC: `SYSTEM_SNAPSHOT` y `SYSTEM_PROCESSES` registrados en `main.js` y expuestos en `preload.js`.
