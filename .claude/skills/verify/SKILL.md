---
name: verify
description: Receta de verificación end-to-end del mapa_FDI (SPA React/Vite). Cómo levantar la app y manejarla headless para capturar evidencia.
---

# Verificar mapa_FDI end-to-end

## Levantar

```bash
npm run dev          # Vite en http://localhost:5173 (background)
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/   # 200 = arriba
```

Si el cambio toca datos: correr antes `node scripts/build_investors_map.mjs` (o `npm run etl` para el pipeline completo) para regenerar los JSON de `public/data/`.

## Manejar (headless, sin tocar package.json del repo)

No hay Playwright en el proyecto. Instalar `playwright-core` en el scratchpad de la sesión y usar el Edge del sistema:

```js
import { chromium } from 'playwright-core'
const browser = await chromium.launch({ channel: 'msedge', headless: true })
```

## Rutas / superficies

- `/` mapa Leaflet (canvas + panel filtros)
- `/sankey` diagrama ECharts (canvas) + barra de dropdowns
- Estado de filtros vive en la URL (`p`, `yMin/yMax`, `s`, `inv`, `own`, `cons`…) — verificar leyendo `page.url()` y recargando con params.

## Viewports

**Son TRES estados de layout, no dos.** Cualquier cambio de layout se revisa en los tres:

```js
{ width: 1536, height: 730, deviceScaleFactor: 1.25 }                             // notebook
{ width: 800, height: 1024, deviceScaleFactor: 2, isMobile: true, hasTouch: true } // tablet
{ width: 360, height: 640, deviceScaleFactor: 2, isMobile: true, hasTouch: true }  // teléfono
{ width: 320, height: 568, deviceScaleFactor: 2, isMobile: true, hasTouch: true }  // sólo si algo va justo
```

360 es el que pilla: el cromo del mapa entraba a 390 y 414 y no a 360, y la barra de acciones que lo
reemplazó despeja su fila por 2 px ahí. Al monitor externo (1920×1080) no se le cree nada.

**La tablet (768–1023) tiene reglas propias** y es fácil de olvidar porque no falla como el teléfono:
ahí el panel de filtros y el listado son capas y arrancan cerrados (`useIsCompact`, corte `lg`), pero
el cromo del mapa flota como en escritorio (`useIsMobile`, corte `md`). Lo esperado a 800×1024: riel
de 48 px, listado cerrado, caja de totales y leyenda flotantes, barra de acciones móvil en **0×0**.

**El alto con `100dvh` no se puede verificar acá.** El headless no tiene barra de direcciones, así que
el bug que `dvh` corrige no se reproduce. Lo verificable es que `#root` mida `innerHeight` y que el
pie caiga justo en el borde; el resto es teléfono real.

Medir, no mirar: `getBoundingClientRect()` de los dos elementos y calcular la intersección. Un
screenshot con antialiasing no distingue "pegado" de "encima por 3 px".

## Gotchas

- **`CheckList` (país/sector/propiedad) muestra TODOS los checkbox marcados cuando la selección está vacía** ("todos = ninguno seleccionado"). Playwright `.check()` es no-op sobre un checkbox ya marcado → usar `.click()` para togglear.
- **Varios controles se renderizan DOS veces**, uno `hidden md:flex` y otro `md:hidden` (el conmutador Puntos/Agregados del mapa, la leyenda de sectores). En móvil `.first()` agarra la copia de escritorio, que está oculta: el clic no hace nada y con un `.catch(() => {})` alrededor el test pasa igual. Usar `.last()`, o mejor un selector que ancle el contenedor.
- Un elemento con `hidden` mide **0×0**, no `null`. Un chequeo de "existe" da falso positivo; comparar el ancho.
- El modal de presentación se abre solo una vez por sesión (`sessionStorage`) y cada `newContext()` es sesión nueva → cerrarlo antes de medir cualquier cosa, o tapa la vista. **Cerrarlo con `Escape`, no con su botón:** «Ver el mapa» navega a `/` y las mediciones terminan siendo de otra página.
- `innerText` de Chromium devuelve el texto **con `text-transform` aplicado**. Buscar «Cita sugerida» da 0 aunque la caja esté ahí, porque se renderiza en versalitas. Usar `textContent` o buscar sin distinguir mayúsculas.
- Los nodos del Sankey son canvas: no hay DOM que consultar. Validar vía URL params, filas del dropdown (`label:has(input[type=checkbox])`) y screenshots.
- Placeholder del buscador de inversores: `Buscar…` (i18n `list.search`).
- Dropdowns se cierran con `Escape`.
- Esperar `networkidle` + ~1.5s tras `goto` (fetch de investments.json 4.3 MB + render ECharts).
- **Los botones se buscan por su rótulo real, no por el nombre del concepto.** Colapsar el panel de
  filtros es `Ocultar filtros` / `Mostrar filtros` (`filter.collapse` / `filter.expand`), no
  «Colapsar». Un `getByRole` que no matchea se cuelga 30 s y muere por timeout.
- **Si se construye a un `outDir` alternativo para depurar** (por ejemplo `--mode development` a
  `dist-dev/` para conservar los `console.log`), **borrarlo antes de correr `npm run lint`**: eslint
  no ignora carpetas de build que no estén declaradas y se pone a revisar el bundle minificado, con
  miles de errores que parecen del proyecto.

### Técnicas que sirvieron

- **Franja gris del mapa** (Leaflet sin enterarse de un cambio de tamaño): comparar la unión de los
  rects de `.leaflet-tile-loaded` contra el rect de `.leaflet-container`. Si el borde de los tiles
  queda *dentro* del contenedor, falta un `invalidateSize`. Sano es negativo (los tiles se pasan).
- **Animaciones que compiten con un scroll**: trazar por frame en un `requestAnimationFrame` y guardar
  `[t, scrollTop, opacidad]` en `window`, después leerlo de una. Es la única forma de ver si el
  destello cae encima del movimiento; un screenshot en un instante elegido a mano no lo muestra.
- **Animación que no vuelve a correr**: `getAnimations()[0].animationName` sobre el nodo dice si está
  animando de verdad. Una clase presente no garantiza que la animación se reinició (hace falta
  remontar el nodo, con `key`).

## Flujos que vale la pena manejar

- Búsqueda de inversores (incluye members de consorcios — hint "incluye: …").
- Selección de inversor → URL `inv=` → nodos en diagrama (screenshot).
- Filtros Propiedad (`own=`) y Consorcios (`cons=only|none`, si llega a existir).
- Reload con params combinados → badges de los botones conservan estado.
- Params basura (`?cons=garbage&own=NOPE`) → no crash, fallback a default.
