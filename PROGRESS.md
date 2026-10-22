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
