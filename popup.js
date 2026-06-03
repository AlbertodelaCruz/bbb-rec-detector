const DEFAULTS = {
  overlay: true,
  sound: true,
  notifications: true,
  alertOnNotRecordable: false
};

const LABELS = {
  recording:        { text: "Grabando ✔",            sub: "La sesión se está grabando." },
  "not-recording":  { text: "NO se está grabando",   sub: "Indicador parado o en pausa." },
  "not-recordable": { text: "Sala sin grabación",    sub: "Esta sala no permite grabar." },
  loading:          { text: "Cargando cliente…",     sub: "Esperando al cliente BBB." },
  unknown:          { text: "Sin datos",             sub: "Abre una sesión de BBB." }
};

function paintStatus(state) {
  const meta = LABELS[state] || LABELS.unknown;
  const dot = document.getElementById("dot");
  dot.className = "dot " + (state || "unknown");
  document.getElementById("statusText").textContent = meta.text;
  document.getElementById("statusSub").textContent = meta.sub;
}

// Estado en vivo: pregunta al content script de la pestaña activa.
function refreshStatus() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab || !/tucampusonline\.com\/html5client/.test(tab.url || "")) {
      paintStatus("unknown");
      return;
    }
    chrome.tabs.sendMessage(tab.id, { type: "bbb-rec-get-state" }, (resp) => {
      if (chrome.runtime.lastError || !resp) {
        // respaldo: último estado guardado
        chrome.storage.local.get(`tab-${tab.id}`, (data) => {
          paintStatus(data[`tab-${tab.id}`]?.state || "unknown");
        });
        return;
      }
      paintStatus(resp.state);
    });
  });
}

// Preferencias
function bindPrefs() {
  const ids = Object.keys(DEFAULTS);
  chrome.storage.sync.get(DEFAULTS, (prefs) => {
    ids.forEach((id) => {
      const el = document.getElementById(id);
      el.checked = !!prefs[id];
      el.addEventListener("change", () => {
        chrome.storage.sync.set({ [id]: el.checked });
      });
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bindPrefs();
  refreshStatus();
  setInterval(refreshStatus, 2000);
});
