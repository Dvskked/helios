# HELIOS — Manual del Agente

Asistente de escritorio personal (Windows) con estética de ciencia ficción.
Electron (UI) + Python (backend + IA local).

## Reglas de operación (obligatorias)

1. **Fases.** Trabaja solo en la fase indicada. No adelantes fases ni escribas código de fases futuras.
2. **Tokens.** No repitas la descripción del proyecto, no generes documentación innecesaria, no reescribas archivos que ya funcionan.
3. **Dependencias.** No instales nada sin permiso explícito del usuario. `package.json` y `requirements.txt` declaran dependencias; instalar es una fase aparte.
4. **Modelos de IA.** No descargues modelos ni weights sin autorización explícita (son GB de descarga).
5. **Acciones sensibles.** Pide confirmación antes de: borrar archivos, modificar el registro de Windows, instalar drivers, abrir puertos fuera de `localhost`, enviar datos a servicios externos, ejecutar comandos sobre rutas del sistema.
6. **Progreso.** Actualiza `PROGRESS.md` al cerrar cada fase. Sin extenderte: fecha, qué se hizo, qué falta, bloqueos.

## Stack

| Capa | Tecnología | Notas |
|---|---|---|
| Shell | Electron | `electron/main.js`, `electron/preload.js` |
| UI | HTML + CSS + JS vanilla | `renderer/` — sin framework en Fase 0/1 |
| Backend | Python 3.14 + FastAPI + Uvicorn | Proceso *sidecar* en `localhost` |
| IA local | Abstracción de proveedor | Ollama / llama.cpp server — se elige en Fase IA |
| Sistema | psutil | Telemetría CPU/RAM/disco |

Entorno verificado: Windows, Ryzen 7 (16 hilos), 16 GB RAM, ~237 GB libres en `F:`, GPU AMD Radeon integrada → **inferencia por CPU**. Node 24.19, npm 11.17, Python 3.14.7, Git 2.55.

## Arquitectura

```
Electron (main)
  ├─ spawn python -m helios  →  http://127.0.0.1:<PUERTO>  (REST + WS)
  ├─ preload.js → contextBridge → renderer (sin nodeIntegration)
  └─ renderer  → fetch/WS hacia 127.0.0.1
```

- El backend Python se lanza como proceso hijo de Electron y se cierra con él.
- Solo `127.0.0.1`. Sin red externa por defecto.
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox` activo en el renderer.

## Estructura

```
electron/       main.js, preload.js, ipc-channels.js
renderer/       index.html, styles/, js/, assets/
backend/helios/ main.py, core/, routers/, services/, schemas/
assets/         iconos, recursos
scripts/        utilidades de arranque/diagnóstico
```

## Contrato de API (estable)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Estado del backend y del proveedor de IA |
| GET | `/api/system/snapshot` | CPU, RAM, disco, uptime |
| GET | `/api/system/processes` | Top procesos por CPU |
| POST | `/api/chat` | Mensaje al modelo local |
| WS | `/ws` | Flujo de tokens en tiempo real |

Prefijo configurable por variable de entorno `HELIOS_BACKEND_PORT` (por defecto `8723`).

## Convenciones

- JS: ES modules en `renderer/` (cargados con `<script type="module">`), `camelCase`.
- `electron/main.js` y `electron/preload.js` son **CommonJS** a proposito: el renderer usa `sandbox: true` y un preload sandboxed no admite `require` de rutas relativas ni ESM. Los canales IPC se pasan al preload con `additionalArguments` (`--helios-channels=...`) para no duplicarlos.
- Python: `snake_case`, tipado con Pydantic v2, `core/config.py` como única fuente de configuración.
- Un router por dominio en `routers/`, lógica de negocio en `services/`.
- Nada de secretos en el repo. `.env` local ignorado por git.

## Comandos (usar solo tras instalar dependencias)

```bash
npm install                      # Frontend/Electron  (requiere permiso)
npm start                        # Electron en modo dev
python -m pip install -r backend/requirements.txt   # Backend (requiere permiso)
python -m helios                 # Backend standalone
```

## Roadmap

- **Fase 0** — Estructura mínima, AGENTS.md, PROGRESS.md. ✅
- **Fase 1** — Ventana Electron + puente IPC + backend `/api/health` vivo.
- **Fase 2** — UI estilo HUD (sci-fi) y telemetría de sistema.
- **Fase 3** — Capa de IA local (proveedor + streaming).
- **Fase 4** — Habilidades del asistente y acciones del sistema.
- **Fase 5** — Empaquetado ydistribution (portable/instalador).
