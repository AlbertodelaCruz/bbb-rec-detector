# BBB — Detector de grabación

Extensión de Chrome (Manifest V3) que **avisa de forma llamativa cuando una sesión de
BigBlueButton NO se está grabando**. Pensada para el anfitrión/moderador, que tras los
descansos a veces olvida reanudar la grabación.

## Qué hace

- Vigila el cliente HTML5 de BBB (`*.tucampusonline.com/html5client/*`).
- Detecta el estado real de grabación leyendo el indicador `data-test="recordingIndicator"`:
  - **Grabando** → dentro del indicador hay un cronómetro `HH:MM:SS` (señal definitiva).
  - **Parado/pausado** → el indicador existe pero sin cronómetro (y el `aria-label`
    pasa a *"no está siendo grabada"* / *"Reanudar grabación"*).
- Cuando NO se está grabando:
  - Muestra un **banner rojo parpadeante** arriba.
  - Emite un **pitido recurrente** (cada 5 s).
  - Lanza una **notificación del sistema**.
  - Pone el **badge** del icono en rojo (`OFF`); verde (`REC`) mientras graba.
- Botón **"Posponer 5 min"** para silenciar durante el descanso: el aviso reaparece
  solo cuando termina, justo cuando hay que reanudar.

## Instalación

1. Abre `chrome://extensions`.
2. Activa **Modo de desarrollador** (arriba a la derecha).
3. **Cargar descomprimida** → selecciona esta carpeta `bbb-rec-detector/`.
4. Abre la sesión de BBB. El badge del icono mostrará el estado.

> Para que suene el pitido, Chrome exige una interacción previa con la pestaña
> (autoplay). Basta con hacer clic una vez en la página de la sesión.

📖 **Guía detallada:** consulta [`INSTALL.md`](INSTALL.md) para instrucciones paso a
paso en Chrome, Edge y Brave, verificación, permisos y resolución de problemas.

## Ajustes

Clic en el icono de la extensión: estado en vivo + interruptores para banner, sonido,
notificación y aviso cuando la sala no es grabable.

## Soporte para otras instancias de BBB

Edita `manifest.json` y añade dominios en `host_permissions` y `content_scripts.matches`
(p. ej. `"*://*.misservidor.com/html5client/*"`). La lógica de detección es genérica de
BigBlueButton 3.x, no específica de tucampusonline.

## Ficheros

| Fichero | Función |
|---------|---------|
| `manifest.json` | Configuración MV3 |
| `content.js` | Detección en el DOM + banner + sonido |
| `overlay.css` | Estilos del banner de aviso |
| `background.js` | Badge del icono + notificaciones del sistema |
| `popup.html/js` | Estado en vivo y preferencias |
| `make_icons.py` | Genera los iconos (ya generados en `icons/`) |
