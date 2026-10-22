const statusEl = document.getElementById('status');
const detailEl = document.getElementById('detail');

let backendState = 'starting';

function setStatus(label, state) {
  if (!statusEl) return;
  statusEl.textContent = label;
  statusEl.dataset.state = state;
}

function setDetail(text) {
  if (detailEl) detailEl.textContent = text;
}

function applyBackendState(state, detail) {
  backendState = state;

  if (state === 'online') {
    setStatus('EN LINEA', 'ok');
    refreshHealth();
  } else if (state === 'conflict') {
    setStatus('CONFLICTO DE PUERTO', 'err');
    setDetail(detail || 'el puerto del backend esta ocupado por otro proceso');
  } else if (state === 'starting') {
    setStatus('CONECTANDO', 'warn');
    setDetail(detail || 'iniciando el sidecar python');
  } else {
    setStatus('BACKEND OFFLINE', 'err');
    setDetail(detail || 'el sidecar python no responde');
  }
}

async function refreshHealth() {
  const bridge = window.helios;

  if (!bridge) {
    setStatus('SIN PUENTE IPC', 'err');
    setDetail('el preload no expone contextBridge');
    return;
  }

  try {
    const health = await bridge.health();

    if (health?.status === 'ok') {
      setStatus('EN LINEA', 'ok');
      setDetail(
        `backend ${health.backend} · version ${health.version} · proveedor ${health.provider}`,
      );
    } else if (backendState !== 'conflict') {
      setStatus('BACKEND OFFLINE', 'err');
      setDetail(health?.error || 'el sidecar no responde');
    }
  } catch (error) {
    if (backendState !== 'conflict') {
      setStatus('BACKEND OFFLINE', 'err');
      setDetail(error.message);
    }
  }
}

async function boot() {
  const bridge = window.helios;

  if (!bridge) {
    applyBackendState('offline', 'el preload no expone contextBridge');
    return;
  }

  bridge.on(bridge.channels.BACKEND_STATUS, (payload) => {
    applyBackendState(payload.state, payload.detail);
  });

  try {
    const current = await bridge.backendStatus();
    applyBackendState(current.state, current.detail);
  } catch {
    applyBackendState('starting', 'iniciando el sidecar python');
  }
}

boot();
