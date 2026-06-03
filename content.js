/**
 * BBB - Detector de grabación
 * Content script que se ejecuta dentro del cliente HTML5 de BigBlueButton.
 *
 * Detección (validada contra el DOM real de bbbXX.tucampusonline.com y el código
 * fuente de bigbluebutton-html5 v3.x):
 *
 *   <div data-test="recordingIndicator">
 *     <div aria-label="Esta sesión, ahora está siendo grabada">
 *       <span data-test="mainWhiteboard"><svg/></span>
 *       <div>02:55:11</div>          <-- cronómetro: SOLO existe si recording === true
 *     </div>
 *   </div>
 *
 * Señal primaria  -> presencia de un cronómetro HH:MM:SS dentro del indicador.
 * Señal de apoyo  -> aria-label del hijo ("...siendo grabada" vs "...no está siendo grabada").
 * Las clases CSS (sc-XXXX) son hashes de styled-components: NO se usan.
 */

(() => {
  "use strict";

  console.info("%c[BBB-REC] content script activo", "color:#2e7d32;font-weight:bold");
  // Marcador para comprobar desde la consola que el script está inyectado:
  //   window.__bbbRecDetector  -> { version, lastState }
  window.__bbbRecDetector = { version: "1.0.0", lastState: null };

  const INDICATOR_SEL = '[data-test="recordingIndicator"]';
  const TIMER_RE = /\b\d{1,2}:\d{2}:\d{2}\b/;
  const POLL_MS = 2000;

  // Marcas de que el cliente BBB ya ha cargado (para no alarmar durante la carga).
  const CLIENT_LOADED_SEL = [
    '[data-test="recordingIndicator"]',
    '[data-test="userListToggleButton"]',
    '[data-test="presentationContainer"]',
    '[data-test="whiteboard"]',
    '[data-test="actions"]'
  ].join(",");

  // Estados posibles
  const STATE = {
    LOADING: "loading",            // el cliente aún no ha terminado de cargar
    RECORDING: "recording",        // se está grabando (hay cronómetro)
    NOT_RECORDING: "not-recording",// indicador presente pero parado/pausado -> ALERTA
    NOT_RECORDABLE: "not-recordable" // cargado pero sin indicador -> la sala no se graba
  };

  let prefs = {
    overlay: true,
    sound: true,
    notifications: true,
    alertOnNotRecordable: false // avisar también si la sala no es grabable (off por defecto)
  };

  let lastState = null;
  let overlayEl = null;
  let audioCtx = null;
  let soundTimer = null;
  let snoozeUntil = 0;           // timestamp hasta el que se silencia el aviso
  const SNOOZE_MS = 5 * 60 * 1000;

  // Anti-falsos-positivos durante la carga del cliente:
  const scriptStart = Date.now();
  let pendingAlarmSince = 0;     // desde cuándo se mantiene la condición de alarma
  let lastAlarm = false;
  const CONFIRM_MS = 5000;       // la alarma debe sostenerse 5 s antes de avisar
  const INITIAL_GRACE_MS = 10000;// margen tras cargar antes de poder alarmar

  // ---------------------------------------------------------------------------
  // Lectura de preferencias
  // ---------------------------------------------------------------------------
  function loadPrefs() {
    try {
      chrome.storage.sync.get(prefs, (stored) => {
        if (chrome.runtime.lastError) return;
        prefs = { ...prefs, ...stored };
        // Reevaluar con las nuevas preferencias
        evaluate();
      });
    } catch (_) { /* contexto de extensión no disponible */ }
  }

  chrome.storage?.onChanged?.addListener((changes, area) => {
    if (area !== "sync") return;
    for (const k of Object.keys(changes)) {
      if (k in prefs) prefs[k] = changes[k].newValue;
    }
    evaluate();
  });

  // ---------------------------------------------------------------------------
  // Detección del estado de grabación
  // ---------------------------------------------------------------------------
  function detectState() {
    const indicator = document.querySelector(INDICATOR_SEL);

    if (indicator) {
      // textContent (no innerText) para no forzar reflow durante la carga.
      const text = indicator.textContent || "";
      const hasTimer = TIMER_RE.test(text);

      // El indicador puede ser:
      //  - vista participante: <div aria-label="...siendo grabada / no está siendo grabada">
      //  - vista moderador:    <button aria-label="Pausar / Reanudar / Iniciar grabación">
      const child = indicator.querySelector("[aria-label]") || indicator;
      const label = (child.getAttribute("aria-label") || "").toLowerCase();
      const labelSaysNot =
        label.includes("no está") ||
        label.includes("no se está") ||
        label.includes("not being recorded") ||
        label.includes("not recording") ||
        // rama moderador: si invita a iniciar/reanudar es que NO está grabando
        label.includes("iniciar grabación") ||
        label.includes("reanudar grabación") ||
        label.includes("start recording") ||
        label.includes("resume recording");
      const labelSaysYes =
        label.includes("siendo grabada") ||
        label.includes("being recorded") ||
        // rama moderador: si invita a pausar es que SÍ está grabando
        label.includes("pausar grabación") ||
        label.includes("pause recording");

      let recording;
      if (hasTimer) recording = true;            // señal definitiva
      else if (labelSaysYes && !labelSaysNot) recording = true;
      else recording = false;                    // indicador sin cronómetro -> parado

      return {
        state: recording ? STATE.RECORDING : STATE.NOT_RECORDING,
        timer: hasTimer ? (text.match(TIMER_RE) || [null])[0] : null,
        ariaLabel: child?.getAttribute("aria-label") || null
      };
    }

    // Sin indicador: ¿el cliente ha cargado? Exigimos un marcador real del
    // cliente (no el texto del body, que ya existe en la pantalla de carga).
    const loaded = !!document.querySelector(CLIENT_LOADED_SEL);
    if (!loaded) return { state: STATE.LOADING };

    return { state: STATE.NOT_RECORDABLE };
  }

  // ---------------------------------------------------------------------------
  // Overlay de aviso
  // ---------------------------------------------------------------------------
  function buildOverlay() {
    if (overlayEl) return overlayEl;
    const el = document.createElement("div");
    el.id = "bbb-rec-alert";
    el.className = "bbb-rec-alert";
    el.innerHTML = `
      <div class="bbb-rec-alert__dot"></div>
      <div class="bbb-rec-alert__msg">
        <strong class="bbb-rec-alert__title">⚠ LA SESIÓN NO SE ESTÁ GRABANDO</strong>
        <span class="bbb-rec-alert__sub"></span>
      </div>
      <button class="bbb-rec-alert__snooze" title="Silenciar durante el descanso (5 min)">Posponer 5 min</button>
      <button class="bbb-rec-alert__close" title="Ocultar este aviso">✕</button>
    `;
    el.querySelector(".bbb-rec-alert__snooze").addEventListener("click", (e) => {
      e.stopPropagation();
      snoozeUntil = Date.now() + SNOOZE_MS;
      hideOverlay();
      stopSound();
    });
    el.querySelector(".bbb-rec-alert__close").addEventListener("click", (e) => {
      e.stopPropagation();
      hideOverlay();
      stopSound();
    });
    (document.body || document.documentElement).appendChild(el);
    overlayEl = el;
    return el;
  }

  function showOverlay(subText) {
    if (!prefs.overlay) { hideOverlay(); return; }
    const el = buildOverlay();
    el.querySelector(".bbb-rec-alert__sub").textContent = subText || "";
    el.classList.add("bbb-rec-alert--visible");
  }

  function hideOverlay() {
    if (overlayEl) overlayEl.classList.remove("bbb-rec-alert--visible");
  }

  // ---------------------------------------------------------------------------
  // Sonido de aviso (WebAudio, sin assets)
  // ---------------------------------------------------------------------------
  function beep() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "square";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.15, audioCtx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.35);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.36);
    } catch (_) { /* autoplay bloqueado hasta interacción del usuario */ }
  }

  function startSound() {
    if (!prefs.sound) return;
    if (soundTimer) return;
    beep();
    soundTimer = setInterval(beep, 5000); // recordatorio cada 5 s
  }

  function stopSound() {
    if (soundTimer) { clearInterval(soundTimer); soundTimer = null; }
  }

  // ---------------------------------------------------------------------------
  // Evaluación + reacción
  // ---------------------------------------------------------------------------
  function evaluate() {
    const result = detectState();
    const { state } = result;
    const now = Date.now();

    const rawAlarm =
      state === STATE.NOT_RECORDING ||
      (state === STATE.NOT_RECORDABLE && prefs.alertOnNotRecordable);

    // Debounce: la condición de "sin grabar" debe sostenerse CONFIRM_MS y haber
    // pasado el margen inicial. Evita el falso aviso mientras el cliente carga
    // (el indicador aparece un instante sin cronómetro hasta que llega el estado
    // de grabación por GraphQL) y los parpadeos puntuales.
    if (rawAlarm) {
      if (!pendingAlarmSince) pendingAlarmSince = now;
    } else {
      pendingAlarmSince = 0;
    }

    const confirmedAlarm =
      rawAlarm &&
      (now - scriptStart) >= INITIAL_GRACE_MS &&
      (now - pendingAlarmSince) >= CONFIRM_MS;

    // Aviso visual/sonoro (respetando el snooze)
    if (confirmedAlarm && now >= snoozeUntil) {
      const sub = state === STATE.NOT_RECORDABLE
        ? "Esta sala no tiene la grabación activada."
        : "El indicador de grabación está parado o en pausa.";
      showOverlay(sub);
      startSound();
    } else {
      hideOverlay();
      stopSound();
      if (!rawAlarm) snoozeUntil = 0; // al volver a grabar se resetea el snooze
    }

    // Notificar al background en cambios de estado o de alarma confirmada
    if (state !== lastState || confirmedAlarm !== lastAlarm) {
      lastState = state;
      lastAlarm = confirmedAlarm;
      window.__bbbRecDetector.lastState = state;
      console.info("[BBB-REC] estado:", state, result.timer || "", confirmedAlarm ? "(ALARMA)" : "");
      try {
        chrome.runtime.sendMessage({
          type: "bbb-rec-state",
          state,
          alarm: confirmedAlarm,
          timer: result.timer || null,
          ariaLabel: result.ariaLabel || null,
          url: location.href,
          ts: now
        });
      } catch (_) { /* ignore */ }
    }
  }

  // Permite al popup pedir el estado actual bajo demanda
  chrome.runtime?.onMessage?.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "bbb-rec-get-state") {
      const r = detectState();
      sendResponse({ state: r.state, timer: r.timer || null, ariaLabel: r.ariaLabel || null });
    }
    return true;
  });

  // ---------------------------------------------------------------------------
  // Sondeo ligero
  // ---------------------------------------------------------------------------
  // Importante: NO usamos un MutationObserver sobre document.body. En una SPA
  // tan pesada como BBB dispararía miles de veces durante la carga y la
  // ralentizaría hasta bloquearla. Un sondeo cada POLL_MS es de coste mínimo
  // (un querySelector + textContent) y más que suficiente para detectar una
  // pausa de grabación.
  loadPrefs();
  setInterval(evaluate, POLL_MS);
  // Primera evaluación ya pasado el margen inicial, sin tocar la carga.
  setTimeout(evaluate, 1500);
})();
