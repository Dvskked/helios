const statusEl = document.getElementById('status');
const detailEl = document.getElementById('detail');

function setStatus(label, state) {
  if (!statusEl) return;
  statusEl.textContent = label;
  statusEl.dataset.state = state;
}

function setDetail(text) {
  if (detailEl) detailEl.textContent = text;
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
    } else {
      setStatus('BACKEND OFFLINE', 'err');
      setDetail(health?.error ?? 'el sidecar no responde');
    }
  } catch (error) {
    setStatus('BACKEND OFFLINE', 'err');
    setDetail(error.message);
  }
}

function listenBackendStatus() {
  const bridge = window.helios;
  if (!bridge) return;

  bridge.on(bridge.channels.BACKEND_STATUS, ({ state }) => {
    if (state === 'online') {
      setStatus('EN LINEA', 'ok');
      refreshHealth();
    } else {
      setStatus('CONECTANDO', 'warn');
      setDetail('el sidecar python no responde todavia');
    }
  });
}

listenBackendStatus();
refreshHealth();
