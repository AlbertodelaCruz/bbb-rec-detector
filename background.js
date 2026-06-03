/**
 * Service worker (MV3).
 * - Mantiene el badge del icono sincronizado con el estado de grabación.
 * - Lanza una notificación del sistema cuando una pestaña pasa a "no grabando".
 * - Guarda el último estado por pestaña para que el popup lo muestre.
 */

const STATE_META = {
  recording:       { badge: "REC", color: "#2e7d32", title: "Grabando" },
  "not-recording": { badge: "OFF", color: "#c62828", title: "NO se está grabando" },
  "not-recordable":{ badge: "—",   color: "#ef6c00", title: "Sala sin grabación" },
  loading:         { badge: "…",   color: "#757575", title: "Cargando…" }
};

const lastNotified = {}; // tabId -> estado ya notificado (evita spam)

function setBadge(tabId, state) {
  const meta = STATE_META[state] || STATE_META.loading;
  try {
    chrome.action.setBadgeText({ tabId, text: meta.badge });
    chrome.action.setBadgeBackgroundColor({ tabId, color: meta.color });
    chrome.action.setTitle({ tabId, title: `Detector de grabación BBB — ${meta.title}` });
  } catch (_) { /* la pestaña pudo cerrarse */ }
}

function maybeNotify(tabId, state, alarm) {
  // Solo notificamos cuando la alarma está CONFIRMADA por el content script
  // (debounce + margen de carga), nunca por el estado crudo durante el arranque.
  if (!alarm) { lastNotified[tabId] = null; return; }
  if (lastNotified[tabId] === state) return; // ya avisado para este estado
  lastNotified[tabId] = state;

  chrome.storage.sync.get({ notifications: true }, (prefs) => {
    if (!prefs.notifications) return;
    const msg = state === "not-recordable"
      ? "Esta sala no tiene la grabación activada."
      : "La grabación está parada o en pausa. ¡Reactívala!";
    try {
      chrome.notifications.create(`bbb-rec-${tabId}-${Date.now()}`, {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: "⚠ Sesión SIN grabar",
        message: msg,
        priority: 2,
        requireInteraction: true
      });
    } catch (_) { /* permiso de notificaciones no concedido */ }
  });
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type !== "bbb-rec-state") return;
  const tabId = sender.tab?.id;
  if (tabId == null) return;

  setBadge(tabId, msg.state);
  maybeNotify(tabId, msg.state, msg.alarm === true);

  chrome.storage.local.set({
    [`tab-${tabId}`]: {
      state: msg.state,
      timer: msg.timer || null,
      ariaLabel: msg.ariaLabel || null,
      url: msg.url || null,
      ts: msg.ts || Date.now()
    }
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  delete lastNotified[tabId];
  chrome.storage.local.remove(`tab-${tabId}`);
});
