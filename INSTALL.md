# Guía de instalación — BBB Detector de grabación

Extensión de navegador (Manifest V3) que avisa cuando una sesión de BigBlueButton
**no se está grabando**. Esta guía explica cómo instalarla en navegadores basados en
Chromium en **modo desarrollador** (no requiere la Chrome Web Store).

## Requisitos

- Un navegador basado en Chromium:
  - **Google Chrome** 88 o superior.
  - **Microsoft Edge** 88 o superior.
  - **Brave**, **Opera**, **Vivaldi** u otros derivados de Chromium recientes.
- La carpeta `bbb-rec-detector/` completa (la que contiene `manifest.json`).

> No es compatible con Firefox tal cual: usa Manifest V3 con `service_worker`.
> Para Firefox haría falta una adaptación menor del `manifest.json`.

## Obtener los ficheros

Necesitas la carpeta del proyecto en una ubicación **estable**: no la borres ni la
muevas después, porque la extensión se carga **desde** esa carpeta.

### Opción A — Descargar el ZIP desde GitHub (sin git)

1. Abre la página del repositorio en GitHub.
2. Pulsa el botón verde **`< > Code`** y elige **Download ZIP**.
3. Descomprime el `.zip` en una carpeta permanente (p. ej. tu carpeta de documentos,
   **no** en "Descargas" temporal).
4. Al descomprimir, GitHub suele crear una subcarpeta con sufijo de rama, p. ej.
   `bbb-rec-detector-main/`. Esa es la carpeta que cargarás en el navegador
   (la que contiene directamente `manifest.json`).

> En Windows: clic derecho sobre el ZIP → **Extraer todo**.
> En macOS: doble clic sobre el ZIP.
> En Linux: `unzip bbb-rec-detector-main.zip`.

### Opción B — Clonar con git

```bash
git clone <url-del-repositorio> bbb-rec-detector
```

### Comprobación

Verifica que dentro está el `manifest.json`:

```bash
ls bbb-rec-detector/manifest.json     # o bbb-rec-detector-main/manifest.json
```

## Instalación en Chrome / Brave / Opera / Vivaldi

1. Abre `chrome://extensions` en la barra de direcciones.
2. Activa el **Modo de desarrollador** (interruptor arriba a la derecha).
3. Pulsa **Cargar descomprimida** (*Load unpacked*).
4. Selecciona la carpeta `bbb-rec-detector/` (la que contiene `manifest.json`).
5. La extensión aparecerá en la lista con su icono 🎥.

## Instalación en Microsoft Edge

1. Abre `edge://extensions`.
2. Activa **Modo de desarrollador** (abajo a la izquierda).
3. Pulsa **Cargar desempaquetada**.
4. Selecciona la carpeta `bbb-rec-detector/`.

## Verificar que funciona

1. Fija el icono de la extensión en la barra (pulsa el icono de la pieza de puzle y
   ancla "Detector de grabación BBB").
2. Abre una sesión de BigBlueButton en `*.tucampusonline.com/html5client/...`.
3. **Haz clic una vez sobre la página** de la sesión: Chrome exige una interacción
   previa con la pestaña para poder reproducir el pitido (política de autoplay).
4. Observa el **badge** del icono:
   - `REC` en verde → la sala se está grabando.
   - `OFF` en rojo → **no** se está grabando (verás banner + sonido + notificación).
5. Pulsa el icono para abrir el popup y ver el estado en vivo y los interruptores.

### Probar sin una sesión real

El repositorio incluye una página de prueba en `test/mock-bbb.html` que simula el
indicador de grabación de BBB. Para que la extensión actúe sobre ella, sírvela en
`localhost` (ya está permitido en el `manifest.json`):

```bash
cd bbb-rec-detector
python3 -m http.server 8000
# abre http://localhost:8000/test/mock-bbb.html
```

## Permisos que solicita

| Permiso | Para qué |
|---------|----------|
| `storage` | Guardar tus preferencias (banner, sonido, notificación…). |
| `notifications` | Lanzar la notificación del sistema cuando no se graba. |
| `host_permissions` | Inyectar el detector en `*.tucampusonline.com`, `localhost` y `127.0.0.1`. |

No envía datos a ningún servidor: toda la detección ocurre en local, en tu navegador.

## Usarla en otra instancia de BBB

Si tu campus no es `tucampusonline.com`, edita `manifest.json` y añade tu dominio
tanto en `host_permissions` como en `content_scripts.matches`, por ejemplo:

```json
"host_permissions": [
  "*://*.misservidor.com/*"
],
"content_scripts": [
  {
    "matches": ["*://*.misservidor.com/html5client/*"],
    ...
  }
]
```

Tras editar el manifiesto, vuelve a `chrome://extensions` y pulsa **Recargar** (↻)
en la tarjeta de la extensión.

## Actualizar tras cambiar el código

Cada vez que modifiques cualquier fichero de la extensión:

1. Ve a `chrome://extensions`.
2. Pulsa el botón **Recargar** (↻) de la tarjeta "Detector de grabación BBB".
3. Recarga también la pestaña de BBB para que se reinyecte el `content.js`.

## Resolución de problemas

- **No suena el pitido:** haz clic una vez en la página de la sesión (autoplay).
  Revisa también el interruptor "Sonido de alerta" en el popup.
- **El badge no aparece / no detecta nada:** confirma que la URL coincide con
  `content_scripts.matches` (`.../html5client/...`) y recarga la pestaña.
- **No salen notificaciones del sistema:** comprueba los permisos de notificaciones
  del navegador y del sistema operativo, y el interruptor del popup.
- **"Error al cargar el manifiesto":** asegúrate de seleccionar la carpeta que
  contiene directamente `manifest.json`, no una carpeta superior.
- **La extensión desaparece al reiniciar:** no borres ni muevas la carpeta original;
  la instalación en modo desarrollador la referencia desde su ubicación.

## Desinstalar

En `chrome://extensions`, pulsa **Quitar** en la tarjeta de la extensión.
