# CLAUDE.md — Repositorio ICLAC

Contexto para quien retome este repositorio, sea persona o agente. Acá van **las reglas que no
caducan**: por qué el código está como está y qué se rompe si se cambia sin saber. Lo que falta hacer
vive en `docs/estado.md`.

## Qué es

El Repositorio Regional de Inversiones Chinas en América Latina: la base de inversiones de ICLAC,
publicada como sitio. Dos instrumentos sobre los mismos datos y los mismos filtros:

- **Mapa** (`/`): cada inversión en su ubicación, con listado y fichas.
- **Tendencias** (`/sankey`): diagrama Sankey de flujos por propiedad, país y sector.

Más tres páginas de contenido: Metodología, Datos (descargas) y Contacto. Tres idiomas: español
(por defecto), inglés y chino.

## Stack

React 18 + Vite + **TypeScript strict** · react-router-dom 6 · react-i18next · Leaflet 1.9 +
react-leaflet + markercluster · D3 v7 (módulos sueltos) · ECharts 5 · Tailwind 3. Node ≥ 20.
Hosting: Netlify, que construye con `npm run etl && npm run build`.

## Cómo se levanta

```bash
npm install
npm run etl      # XLSX -> public/data/*.json. Necesario antes del primer dev.
npm run dev      # http://localhost:5173
```

Antes de dar algo por terminado: `npm run lint` (la CI corre eslint con `--max-warnings 0`, así que
un warning rompe el build), `npm test` y `npx tsc --noEmit`.

**Los cambios visibles se verifican en el navegador**, no solo con tests. Varios problemas de esta
clase (encuadre del mapa, popovers recortados, controles que se pisan) solo aparecen a cierto ancho
de pantalla. Receta en `.claude/skills/verify`.

---

## El recorrido del dato, de punta a punta

Entender esto explica la mitad de las decisiones del repositorio.

1. **El equipo de ICLAC edita un XLSX por país** y lo sube a `data/sources/countries/`.
2. **GitHub Actions valida** ese archivo contra el contrato de `data/schema/schema.md` y publica un
   informe legible en GitHub Pages, que dice país por país qué está bien y qué corregir.
3. **Netlify reconstruye** el sitio. El ETL transforma los XLSX en los JSON que consume el frontend.
4. **Solo entran al sitio los países que pasan la validación y están marcados para publicar.**

El punto 4 son **cuatro** compuertas distintas, y confundirlas costó rehacer trabajo:

| Compuerta | Pregunta | Unidad | La contesta | Vive en |
|---|---|---|---|---|
| Estructural | ¿se puede **leer** el archivo? | archivo | el validador | nombre que no rutea a ningún país, más de una hoja, columna obligatoria o prohibida |
| Contenido | ¿esta inversión está bien? | **inversión** | el validador, mecánicamente | reglas de `schema.md` |
| Publicación | ¿lo mostramos ya? | país | ICLAC, por decisión editorial | columna `publish` de `data/schema/countries.csv` |
| Confiabilidad | ¿la evidencia alcanza? | inversión | la metodología, por rúbrica | `reliability_score` de la base + `minScore` del ETL |

**Las dos primeras eran una sola, por archivo, hasta el 17-08.** Eso hacía que una celda vacía botara
un país entero: la entrega del 15-08 dejaba fuera Costa Rica, República Dominicana y Trinidad
completas por 105 celdas sobre 12.974 filas, y ese todo-o-nada es lo que convertía cada corrección en
una vuelta completa por correo. Ahora un archivo con filas malas publica las buenas.

**La unidad de la compuerta de contenido es la inversión, no la fila.** Una inversión son varias
filas: botar una sola mutila el trazado del vector o pierde la fila que trae el monto, las dos en
silencio. Cualquier fila con error saca la inversión completa (`excludedIds` de `validateRows`).

**Lo excluido se dice.** El ETL lo imprime en el log del build con los ids, y el informe abre una
sección por país. Filtrar callado sería el parche que este repositorio prohíbe.

`validPct` y el umbral del 95% **ya no son compuerta**: quedaron como número de salud en el informe.

**Y encima de las cuatro va la guardia de caída brusca** (`scripts/lib/count_guard.mjs`), que es de
otra naturaleza: las compuertas preguntan si el dato está bien, la guardia pregunta si *cambió
demasiado*. Existe porque subir a `main` es publicar en producción y un archivo **legible y
equivocado** —200 filas borradas sin querer, un país subido con otro nombre— pasa las cuatro
compuertas: el dato es válido, sólo que hay menos. Si un país desaparece o pierde más del 30% de sus
inversiones respecto de `data/schema/expected_counts.csv`, el ETL sale con código 1, **Netlify
conserva el deploy anterior** y el sitio sigue con los datos buenos.

La línea base se declara a propósito: `npm run counts:update`, y el CSV va en el **mismo commit** que
el cambio de datos. Esa es toda la mecánica — la diferencia entre un borrado accidental y un país que
legítimamente encogió no está en los datos, está en la intención, así que hay que declararla. El
umbral es generoso a propósito (30%): tiene que disparar con el accidente, no con una edición normal.
`--skip-count-check` la salta.

Un país con `publish=no` **se sigue validando** y aparece en el informe como «PASA · RETENIDO», pero
el ETL no lo ingesta y `build_borders` no le arma el polígono (si no, quedaría un país vacío
clickeable en el mapa). **Sin columna o celda vacía = publica**: el default no puede ser retener, o
un CSV viejo apagaría el mapa entero.

Para publicar un país retenido: cambiar su fila a `publish,yes` y correr `npm run etl` +
`node scripts/build_borders.mjs data/sources/countries`. Para mirarlo local sin tocar el CSV:
`npm run etl -- --include-unpublished`.

**`countries.csv` se edita en el navegador, no en Excel.** Excel lo guarda con punto y coma en
configuración regional en español, y se come los ceros a la izquierda de los códigos de país. Las dos
cosas dejan el registro ilegible. `npm run validate:countries` las detecta, y por eso corre en su
propio job de la CI: un país que falla es un estado normal, un registro roto no.

### Dónde vive cada hecho

Un dato, un lugar. Tenerlo en dos garantiza que diverjan, y ya pasó:

- **La base por país** lleva el inversor con el **nombre tal como viene de la fuente**. No se
  normaliza ahí.
- **`data/schema/investors_map.csv`** mapea ese nombre a la empresa canónica, su tipo de propiedad y,
  si es un consorcio, sus miembros. Es la **única** fuente de propiedad: la base no la lleva.
  **Se edita con `npm run investors:export` / `investors:import`, nunca a mano.** La prueba de que el
  circuito no pierde nada: exportar e importar sin tocar nada da **0 cambios**.
- **La propiedad es de una empresa, así que un consorcio la lleva vacía.** Un consorcio es una
  relación, no una empresa: no tiene dueño, lo tienen sus partes. `ownershipsOf` la resuelve desde
  `members` al filtrar, y una inversión de consorcio entra si **cualquiera** de sus miembros es del
  tipo pedido. Consecuencia visible: los filtros de propiedad **dejan de ser una partición**, porque
  las inversiones con miembros de dos tipos aparecen en los dos. No es un defecto, es el dato, y
  ICLAC lo aceptó por correo. Al 11-08 son cuatro en la vista por defecto (BRA-0067, ECU-0023,
  PAN-0028, PER-0042) y cinco con construcción activada (más COL-0026), pero **el número se mueve con
  cada edición de `investors_map.csv`: contarlo, no citarlo de memoria.**
- Un inversor que aparece en la base y no está en esa tabla **no rompe nada**: cae a propiedad
  desconocida y el validador lo avisa (`fila/inversor-sin-mapear`, un aviso por nombre distinto y no
  por fila). Esa es la cola de trabajo de quien mantiene la tabla, y `check_investor_coverage.mjs`
  la lista con montos para priorizar.

### Cómo se tratan los problemas de datos

**Se documentan, no se enmascaran en el código.** Si una fila viene con la latitud equivocada o una
URL pegada en la columna del caso, el sitio muestra el dato tal cual y el problema se reporta a quien
mantiene la base. Parchear en silencio esconde el problema y hace que nadie lo arregle en el origen.

Las excepciones son las correcciones **deterministas y sin pérdida**: espacios de más, mayúsculas, un
apóstrofe de Excel, un typo canonizable. Esas se aplican en el ETL y en el validador, y se **listan**
en el informe como «curación aplicada». Se corrigen a la vista, no a escondidas.

### La forma del informe: una lista de hallazgos, no un acordeón por país

El informe y el validador muestran **una lista de hallazgos agrupada en dos niveles: regla → inversión**.
El acordeón por país que había antes venía de la CI, donde lo normal son diecisiete archivos de una;
**quien valida abre uno**, y ahí el país es constante y sobra. Los controles que sólo tienen sentido
con varios archivos aparecen sólo con varios archivos.

**Hay tres unidades y conviene no mezclarlas**: la unidad de la **acción** es la fila (la celda que
hay que tocar en Excel), la de la **consecuencia** es la inversión (lo que sale del mapa), y la del
**trabajo en tanda** es la regla (109 `Project_Type` vacíos son un solo gesto). Por eso el
«cómo se corrige» va una vez por grupo y no repetido en los 109 renglones: repetirlo es exactamente
el muro de texto que hace que un informe deje de leerse.

**Por qué la regla arriba y la inversión abajo, y no al revés.** Medido sobre una entrega de 21
países: **251 hallazgos, 13 reglas, 52 inversiones**, y una concentración enorme — los 109 «columna
obligatoria vacía» son **4** inversiones y los 25 de inversor son **una** (`URY-0002`, un vector de
25 puntos). O sea que la lista plana gasta 251 renglones en describir muchísimo menos. Por regla son
13 renglones de entrada, por inversión 52. Y hay reglas 1:1 con la inversión (los 35 inversores sin
mapear son 35 inversiones): por inversión serían 35 entradas de una línea, puro ruido; por regla es
una. Además la acción tiene forma de regla: «rellenar `Project_Type` en costa_rica» es un gesto,
«arreglar CRI-0003» son gestos repartidos. **Empezar plano no funciona: abruma.**

El segundo nivel es una línea por inversión con los números de fila **colapsados en rangos**
(«filas 4-73»), no una línea por fila. Y hay un tercer nivel, pero **sólo cuando aporta**: se
despliega si los mensajes de sus filas difieren entre sí. Las 70 filas que dicen todas «falta
`Project_Type`» no tienen nada que abrir; las de una colisión de id sí, porque cada mensaje nombra al
otro inversor y su fila. Anidar por anidar sería peor que no anidar.

**Al filtrar o buscar, los grupos se abren solos.** Buscar y después tener que abrir trece grupos
para ver dónde cayó la coincidencia no es buscar.

**El armazón es un documento con secciones numeradas e índice lateral, y NO pestañas.** Las pestañas
estuvieron un rato y se sacaron: resuelven el muro de texto pero esconden. «Cómo se lee esto» quedó
detrás de un clic, en una barra que no se lee como navegación, y nadie iba a encontrarla nunca. Un
índice hace el mismo trabajo al revés: muestra de un vistazo **todo** lo que hay, y la ayuda y el
instructivo quedan al final, separados por un corte, a un clic desde cualquier parte sin estorbar el
trabajo. El título de sección lleva número grande y línea de ancho completo para que se lea al hacer
scroll rápido, y el número del índice y el del cuerpo son el mismo.

**La explicación va además pegada a cada concepto**, con el `(?)` que abre por clic (nunca por hover:
en pantalla táctil no hay hover). Es un `<details>` y no un popover con JavaScript, así funciona
impreso y sin scripts. Va donde el concepto **nace** —el control, la tarjeta, el título de la
sección— y no repetido en cada renglón: doscientos signos de pregunta idénticos son otra forma del
mismo muro.

**Todo eso sale de `scripts/lib/findings.mjs`**, que es el modelo compartido: la lista en pantalla y
la planilla de pendientes son dos vestidos del mismo cálculo. Al agregar un campo, va ahí.

**Fondo claro fijo, sin modo oscuro.** No es preferencia estética: el informe se imprime, se captura
y se pega en correos, y la paleta semántica (rojo bloquea, ámbar avisa) está calibrada en claro. Y no
alcanza con borrar el `@media (prefers-color-scheme: dark)`: hay que declarar `color-scheme: light`
en `:root` más el `<meta>`, o el navegador igual pinta con su esquema las barras de scroll, los
controles de formulario y el fondo detrás del `<body>`.

**Una regla sin entrada en `RULE_HELP` no rompe nada pero se ve fea**: cae al slug crudo
(`fila/path`) como título y se rutea a la hoja «Contenido» por defecto. Al agregar una regla al
validador, agregarle su entrada.

---

## Estado de los filtros = la URL (`useFilters`)

`src/hooks/useFilters.ts` es la única fuente: `Filters` ↔ query string. El mapa y Tendencias comparten
los mismos parámetros, por eso las pestañas del encabezado navegan con `search` (si no, cambiar de
vista resetea los filtros). `reset()` limpia el query string entero.

| Parámetro | Campo | Notas |
|---|---|---|
| `p` `t` `s` `inv` `own` | países, tipos, sectores, inversores, propiedad | CSV; `[]` = todos |
| `yMin` `yMax` | rango de años | |
| `c` | `construction` | **enum, no booleano**: sin parámetro = `exclude` (default), `c=1` = `include`, `c=only` = `only` |
| `r` | research | |
| `q` | búsqueda del listado | debounce en `ProjectSearchBox` |
| `view` `pie` `pm` | presentación | **no** cuentan como filtro |
| `id` | aislar una inversión | gana sobre todo lo demás |

`activeFilterCount` (en `lib/filter.ts`) decide cuándo mostrar «Limpiar filtros». Compara **contra
`DEFAULT_FILTERS`**, no contra una dirección fija: con construcción excluida por defecto, lo que
cuenta como filtro activo es *pedirla*.

**Construcción es una dimensión propia, no un valor de `types`:** la metodología la cuenta aparte
porque no es IED (ver `data/schema/sectores.md`). El filtro Tipo no gobierna esas filas, y con `only`
queda deshabilitado, porque Adquisición y Greenfield son justo lo que se está filtrando fuera.

**Y por eso toda cifra que salga de acá se cita sobre el universo SIN construcción**, con la cifra con
construcción entre paréntesis. Contar sobre las 386 publicadas describe un universo que el lector nunca
ve, porque el default excluye construcción y son 272. Los documentos anteriores al 11-08, incluido el
informe de propiedad del 03-08, usan el número con construcción **sin declararlo**: convertir antes de
reutilizar cualquier cifra de ahí. La tabla vigente está en `docs/estado.md` §0.

## Regla de hover

Resaltado único del proyecto: **`brand` = `#00A89C`**, con `brand-dark` = `#00776E` para lo que ya es
oscuro. Definidos en `tailwind.config.js`. La regla existe porque el hover gris aclaraba los botones
activos (fondo `gray-900`, texto blanco) y **el texto desaparecía**.

| Elemento | Reposo | Hover |
|---|---|---|
| Botón o fila clara | `bg-white` / transparente | `hover:bg-brand hover:text-gray-900` |
| Botón activo u oscuro | `bg-gray-900 text-white` | `hover:bg-brand-dark` (el texto sigue blanco) |
| Link o ícono suelto | `text-gray-500` | `hover:text-brand-dark` |
| Fila de tabla | zebra | `hover:bg-brand/20` |

**Nunca `text-white` sobre `brand`**: da 2,96:1, bajo el mínimo AA de 4,5:1 para el texto chico del
panel. Las combinaciones de la tabla dan entre 5,4:1 y 6:1, medidas en navegador.

## Componentes compartidos

Antes de escribir uno nuevo, revisar estos (todos en `src/components/`):

- `Segmented` (dentro de `FilterPanel.tsx`) — botones unidos, activo en oscuro. Acepta `disabled` y
  `vertical`, que apila en vez de repartir en fila. Vertical existe por Construcción: en 256 px útiles
  (205 en la banda del 80%) no entran tres frases, y abreviadas a «Sin / Con / Solo» no dicen sin qué.
  Apilado cada opción es una oración entera y el control no necesita nota al pie.
- `MiniSegmented.tsx` — la misma idea en chico, para las cabeceras del listado y del mapa.
- `ProjectSearchBox.tsx` — buscador del listado. Lo usan Fichas **y** Tabla; escribe `filters.query`.
- `HelpTip.tsx` — el `(?)` chico, para **un control**. Abre por **clic**, no hover (en touch no hay
  hover). `\n` en el texto = párrafo.
- `InfoModal.tsx` — el armazón de los paneles que interrumpen la vista (backdrop, ×, Escape, foco,
  portal). Lo usan `LandingModal` y `ToolInfo`; `panelClass` define ancho y fondo.
- `LandingModal.tsx` — presentación del Repositorio, tres columnas es/中文/en simultáneas. Una vez por
  sesión, más el ícono «Acerca de» del encabezado. Es el **único** panel con el trazo de fondo.
- `ToolInfo.tsx` — el `(?)` de **una herramienta**: ícono de la pestaña, texto de `about.*` y una nota
  opcional (la cita sugerida).
- `Citation.tsx` — cita sugerida con botón de copiar. La etiqueta «Cita sugerida» la pone el
  componente: los strings de `about.*.citation` **no** llevan ese prefijo.
- `BottomSheet.tsx` — hoja que sube desde abajo, para lo que en escritorio es caja flotante o
  popover. `max-h-[70vh]` y scroll propio.
- `SectorLegend.tsx` — exporta **dos** componentes: `SectorLegend` (caja flotante, `hidden md:block`)
  y `SectorLegendChip` (chip + hoja, `md:hidden`). Las filas son el mismo control interno.
- `CollapsibleSection.tsx` — sección del panel de filtros. Acepta `Icon` (el mismo del riel) y `jump`,
  el salto que llega desde el riel: abre la sección y hace guiñar su ícono.
- `CheckList.tsx`, `InvestorFilter.tsx`, `YearRangeSlider.tsx`, `icons.tsx`.

**El riel del panel de filtros y las siete secciones salen de la misma lista** (`RAIL` en
`FilterPanel.tsx`), así el ícono del riel y el del título no pueden separarse. Cada ícono del riel
tiene **destino**: abre el panel, abre esa sección y la trae a la vista con un guiño. El riel no es un
botón de «abrir» repetido siete veces.

El guiño (`.filtro-guino`) son **dos capas**: un disco `brand` de 24 px detrás del glifo y el giro
corto a ambos lados. Solo el cambio de tinta del trazo quedaba demasiado sutil para leerse. El glifo
va a `gray-900` mientras está sobre el disco, nunca blanco. `prefers-reduced-motion` apaga el giro y
deja el disco: se reduce el movimiento, no el aviso. El disco es el `<span>` contenedor con `-my-1`,
que es lo que evita que el chip estire las filas del panel.

**El scroll al destino lo pide la sección, no el panel** (`useJumpScroll`). Medido: pidiéndolo desde
el panel en el frame siguiente al clic, el contenido todavía medía lo mismo que la caja
(`scrollHeight` 547 == `clientHeight` 547) porque el acordeón destino abre en su propio efecto, y sin
nada que scrollear el navegador no hace nada. Esperar a que el alto «se estabilice» tampoco sirve: en
la primera apertura se queda dos frames en 547 antes de crecer. La sección sí sabe cuándo abrió.

**Los valores de la base que se muestran traducidos viven en `lib/`**, no en cada componente:
`lib/sectors.ts` + `sector.*`, `lib/countries.ts` + `country.*`. La clave es el **valor exacto en
inglés** que trae la base y el respaldo es ese mismo valor, así un sector o país nuevo se dibuja
igual, solo que sin traducir. El **inversor no se traduce**: es nombre propio.

**`cn` no es una etiqueta BCP-47.** Es la etiqueta interna del proyecto; `Intl` conoce `zh`. Y no
falla ruidosamente: `localeCompare(a, b, 'cn')` cae a orden de codepoint, que no es ni pinyin ni
trazos (la lista de países salía 乌拉圭 antes que 阿根廷). Para cualquier `Intl` pasar `intlLocale(lang)`
de `lib/countries.ts`. Y **ordenar por el nombre mostrado**, no por el crudo: ordenar por el inglés
deja la lista arbitraria en los otros dos idiomas.

**Ningún locale se escribe a mano, y los montos salen todos de `lib/money.ts`.** Un locale literal en
un `Intl` o en un `toLocaleString` no falla: formatea, y formatea mal en los otros dos idiomas. Estuvo
publicado: la caja de totales del mapa tenía `'es-CL'` fijo, así que en inglés mostraba `US$ 229.022 MM`
—que en inglés es 229 coma cero dos dos— mientras Tendencias, que sí usaba el idioma activo, decía
`229,022` para la misma cifra. Los popups y el listado tenían `'en-US'` fijo y hacían lo simétrico en
español (`US$ 2,530 MM` para 2.530 millones, que se lee 2,53). Cinco lugares con el locale a mano, dos
apuntando a lados opuestos. `money.ts` recibe el idioma y usa `compactDisplay: 'long'`, o sea que
**la unidad la elige el idioma**: el chino agrupa en 亿 (10⁸) y no en el corte occidental de 10⁹.
La base guarda `Investment` en **millones de USD**; el sitio nunca muestra esa cifra cruda.

**Todo lo flotante va portalizado a `<body>`.** `position: fixed` solo es relativo al viewport si
**ningún** ancestro tiene `transform`, `filter` o `backdrop-filter`. La caja de totales del mapa usa
`backdrop-blur`: sin portal, el popover del `HelpTip` aterrizaba a unos 300 px de su ícono y el
`InfoModal` quedaba encerrado dentro de esa cajita. Portalizar, no clampear. Ojo: al portalizar, un
popover que cierra por clic afuera necesita chequear también su propio nodo, que ya no está dentro
del ref del disparador.

## Dos cortes, dos preguntas distintas

No hay un solo umbral de «móvil». Confundirlos fue lo que dejó a la tablet heredando media mitad de
cada layout: el panel de filtros y el listado le robaban dos tercios del ancho, y el cromo del mapa se
apoyaba en una barra pese a que ahí sí cabe flotando.

| Hook | Corte | Pregunta que contesta | Qué gobierna |
|---|---|---|---|
| `useIsCompact` | ≤ 1023 px (`lg`) | ¿quién puede quedarse con ancho propio? | Panel de filtros y listado son **capas** y arrancan cerrados. Mismo corte que el nav del encabezado y la greca editorial. |
| `useIsMobile` | ≤ 767 px (`md`) | ¿qué cabe flotando sobre el mapa? | El cromo del mapa y los márgenes del Sankey. |

O sea que **la tablet tiene estado propio**: riel de filtros y listado como capa, pero cromo flotante
como escritorio. Al tocar una clase `md:` o `lg:` en el mapa o en los dos asides, decidir primero cuál
de las dos preguntas es.

### Entre 1024 y 1279 px la interfaz se dibuja al 80%

Una regla de CSS, en `index.css`: `html { font-size: 80% }` en esa banda. Es el laptop de 15,6", donde
el layout de escritorio ya está entero pero el ancho no da: panel de 288 + listado de 512 le dejaban
al mapa 465 px de 1280. El cliente lo resolvía bajando el zoom del navegador al 80%; esto es lo mismo,
de fábrica. Medido a 1168 px: el mapa pasa de ~420 a 513.

**La consecuencia es que toda medida va en `rem`.** Tailwind ya lo hace (`w-72` = 18rem, `text-xs` =
0,75rem), así que mover la raíz escala el layout entero en proporción. Pero una clase arbitraria en px
—`text-[13px]`, `h-[68px]`— **se queda fija y rompe la proporción justo en esa banda**. Por eso no hay
ninguna en `src/`: se convirtieron todas (÷16, o sea sin cambio visual fuera de la banda). Si hace
falta un valor arbitrario, va en `rem`.

No se usa `transform: scale` ni `zoom` para esto. `transform` invalida el `position: fixed` de todo lo
que quede adentro —el mismo motivo por el que lo flotante está portalizado a `<body>`— y las dos
falsean el `getBoundingClientRect` con que Leaflet calcula el encuadre.

El porcentaje es relativo al tamaño de fuente que el usuario tenga configurado en su navegador, no a
16 px fijos. Contra: el texto más chico de la interfaz queda en 8 px dentro de esa banda.

## Móvil: nada flota sobre el mapa

**Regla: en teléfono el cromo del mapa no flota, se apoya.** La caja de totales, el botón del listado
y la leyenda eran tres cajas flotantes sobre 312 px de ancho útil, y el botón del listado se comía el
monto en los tres tamaños medidos (360, 390 y 414). Ahora:

- La caja de totales toma el ancho completo y solo lleva las cifras.
- El conmutador Puntos/Datos agregados, la leyenda y el listado bajan a una **barra de acciones que
  es hermana del mapa, no una capa encima**: el mapa se achica solo, sin pelear con la atribución de
  Leaflet. `displayControls` se define una vez y se renderiza en los dos sitios.
- La barra entra en una fila a 360 px con `gap-1` y `px-1.5`: los tres controles suman 294 px sobre
  296 disponibles. Con `gap-1.5` se pasaba por 2 px y «Lista» caía a una segunda fila.
- La barra pasa a dos filas en modo agregado, así que el alto del mapa cambia. Leaflet se entera solo
  (ver abajo), no hay que declarar la causa.

**El alto de la ventana lo fija `#root` en `index.css`, no `h-screen`.** En teléfono la barra de
direcciones del navegador no se descuenta de `100vh`, así que el pie quedaba abajo del borde. La raíz
usa `100dvh` bajo `@supports`, y el Layout hereda con `h-full`. No volver a `h-screen`.

**Etiquetas del Sankey en móvil:** el margen derecho por defecto de ECharts (`right: '20%'`) es donde
se dibujan las etiquetas de la última columna; en un teléfono son unos 70 px y los nombres salían
cortados. En móvil se recupera ese margen (`right: '3%'`) y los nodos de `depth === 2` llevan
`label: { position: 'left' }`, o sea hacia adentro.

## Mapa: encuadre y límites (`MapView.tsx`)

Zona sensible, con dos trampas ya conocidas:

- **La región paneable se DERIVA del geojson cargado** (`regionOf`), intersecada con `REGION_CLAMP`.
  El alcance de países es un dato, así que sumar Centroamérica o el Caribe amplía el cuadro solo. El
  clamp existe solo por Isla de Pascua (lng −109,4, cero inversiones): si algún día entra un dato al
  oeste de −95, hay que correrlo.
- **`fitBounds({padding})` no sirve para reservar el espacio de la caja de totales.** Si el viewport
  es más alto en grados que `maxBounds` (pantallas bajas), Leaflet recentra dentro de `maxBounds` y
  descarta el padding en silencio. Se resuelve desplazando el **centro** en píxeles proyectados
  (`framedView`) y metiendo el mismo offset en `maxBounds`. El alto de la caja se mide del DOM
  (`totalsRef`), porque envuelve a dos líneas en pantallas angostas.
- **A Leaflet se le avisa del cambio de tamaño observando la caja, no enumerando causas.**
  `AutoInvalidateSize` es un `ResizeObserver` sobre el contenedor. Antes era un `trigger` con la lista
  de lo que cambia el ancho, y la lista se quedaba corta: faltaban Fichas↔Tabla (el listado va de
  24rem a 32rem) y colapsar el panel de filtros, cuyo estado ni vive en `MapView`. El síntoma es una
  franja gris donde el mapa creció y nadie pidió los tiles.
- `RegionLimits` reencuadra en cada `resize` **hasta el primer gesto del usuario** (`pointerdown` o
  `wheel` del contenedor, no eventos de Leaflet, que dispara nuestro propio fit).
- `MAX_ZOOM = 8` (nivel provincia) es una decisión editorial: las coordenadas de la base tienen
  precisión despareja y el detalle de calle sugiere una exactitud que no existe.

## Reglas geográficas: la caja es la del país

El chequeo de coordenadas compara cada punto contra la caja de **su propio país**, derivada de la
geometría (`loadCountryBounds` sobre `borders.geojson`), con 1° de margen y la caja de la región como
respaldo para los países sin geometría.

Antes comparaba contra una ventana fija pensada para Sudamérica (`lat < 15`), y al entrar
Centroamérica marcó 35 filas correctas de Honduras, que llega a 16°N. Lo reportó quien mantiene los
datos, y tenía razón: **un validador que grita sobre datos correctos deja de leerse**. Al cambiarlo
quedaron 0 falsos positivos y apareció un error real que la regla vieja no podía ver.

Antes de agregar un umbral geográfico nuevo: preguntarse si esa referencia ya existe como dato.

## Colores por sector

```
Energy:        rgba(198,42,75,1)      Infrastructure: rgba(221,119,75,1)
Manufacturing: rgba(125,46,103,1)     Agroindustry:   rgba(24,108,5,1)
Mining:        rgba(5,115,160,1)      Finance:        rgba(176,129,197,1)
RealEstate:    rgba(60,57,182,1)      ICT:            rgba(81,124,254,1)
```

**Los ocho son un conjunto, no ocho decisiones sueltas.** Cambiar uno solo rompe el
conjunto: la paleta anterior tenía Energy y Finance a ΔE 11,4 en **visión normal** (piso
15), y bajo protanopia cuatro sectores colapsaban al mismo verde oliva. Esta se generó
maximizando la separación del par más parecido sujeto a banda de luminosidad, piso de
croma, contraste ≥ 3:1 contra el basemap y ΔE ≥ 15 contra `brand`, para que ningún sector
se confunda con el hover. Antes de tocar un color, correr el validador de la skill
`dataviz` sobre los ocho: `node scripts/validate_palette.js "<hex,…>" --mode light --pairs
all` (**`--pairs all`, no el default**: en un mapa cualquier par puede quedar contiguo).
Que la paleta cargue al azul es forzado, no estético — bajo daltonismo el arco cálido
colapsa. Los ocho valores viven en tres archivos que van en lockstep: `lib/sectors.ts`,
este bloque y la tabla de `data/schema/sectores.md`.

## Convenciones

- Componentes en PascalCase, uno por archivo. Hooks con prefijo `use`.
- **Estado global mínimo:** solo idioma y selección de país. La URL primero.
- Tests con vitest: solo lógica de filtros y validación de datos, no componentes.
- **i18n: toda cadena visible en los tres idiomas.** Antes de redactar una nueva, buscar si ya
  existe: buena parte del texto viene del sitio anterior, ya traducido y revisado. Los textos chinos
  escritos por el equipo van a revisión externa antes de publicarse.
- **El vocabulario del equipo se queda fuera de la interfaz.** «Empresa canónica», «raw», «vector»,
  «FK» son términos del esquema, no del lector: en pantalla se describe lo que le pasa al dato (el
  Sankey dice «las filiales se cuentan bajo su matriz y las variantes del mismo nombre se unifican»).
  En `data/schema/` y en los scripts el término técnico sigue siendo el correcto.
- **La herramienta del Sankey se llama «Tendencias»** en la interfaz. La ruta `/sankey` y las claves
  `sankey.*` no se renombraron: romperían enlaces compartidos sin cambiar nada visible.
- **ECharts: registrar TODO lo que la opción usa** en el `echarts.use([...])` de `SankeyView.tsx`,
  incluidas las *features* (`echarts/features`), no solo charts, components y renderers. El servidor
  de desarrollo empaqueta echarts entero y disimula lo que falte; el build no. Caso real: sin
  `LabelLayout`, `labelLayout: { hideOverlap: true }` se ignoraba **solo en producción** y las
  etiquetas se solapaban. Si se toca la opción del gráfico, probar contra
  `npm run build && npx vite preview`, no contra `npm run dev`.
- **Un archivo de componente que además exporta un helper rompe Fast Refresh** y `npm run lint` lo
  falla (`react-refresh/only-export-components`). El helper se mueve a `lib/`.

## Decisiones de arquitectura, y por qué

El sitio reemplaza una implementación anterior en Vue. Estas decisiones vienen de problemas concretos
que se arrastraban y conviene no reintroducir:

- **Dependencias por npm, no por CDN.** La versión anterior cargaba d3 v4 desde un CDN, con una API
  que ya no existía (`d3.event`).
- **Componentes chicos.** Había una vista de mapa de más de 1.000 líneas.
- **El estado de selección vive en la URL**, no en variables de módulo: así un filtro se puede
  compartir por enlace.
- **Los XLSX se convierten a JSON en el build**, no se sirven al navegador.
- **Geometrías simplificadas.** Se llegó a servir decenas de MB de geojson sin simplificar.
- **Rutas con `React.lazy` y `Suspense`.**

## Scripts

Los que forman parte de la operación:

- `npm run etl` (`scripts/etl.mjs`) — XLSX → `public/data/investments.json`. Corre en cada build. Lee
  el directorio de países y **filtra por las cuatro compuertas**: estructura y contenido
  (`--no-filter` salta las dos), publicación (`--include-unpublished` la salta) y confiabilidad
  (`--min-score=N`, default 3, o sea
  **sale del sitio todo lo que tenga score ≤ 2**; `--min-score=0` la apaga). Las banderas se leen aparte de los posicionales, así que
  `npm run etl -- --include-unpublished` funciona sin pasar rutas. También emite **las dos descargas**
  que sirve la pestaña Datos: `iclac_inversiones_china_latam.xlsx` y
  `iclac_anexo_evidencia_limitada.xlsx`, con las mismas cuatro hojas —`README`, `investments` (una
  fila por inversión), `sites` (una fila por coordenada), `case_studies`— para que se concatenen. Si
  cambia la forma de las filas, cambian las dos descargas.
- `npm run validate` (`scripts/validate_data.mjs`, núcleo en `scripts/lib/validate.mjs`) — valida los
  XLSX por país contra `data/schema/schema.md`. Corre en GitHub Actions y alimenta el informe de
  Pages. Acepta un directorio o archivos sueltos. El núcleo es **puro**: recibe el registro de
  países, los bordes y la tabla de inversores por `opts`, y no toca disco.
- `npm run validate:countries` (`scripts/validate_countries.mjs`) — valida el registro de países.
- `npm run validate:investors` (`scripts/validate_investors.mjs`) — valida la tabla de inversores:
  enum de propiedad, nombres únicos, un identificador por empresa, propiedad consistente.
- `npm run validate:report` (`scripts/build_validation_report.mjs`) — el informe HTML que se publica
  en Pages. Autocontenido, escrito para quien mantiene los datos, no para programadores. Es sólo la
  cáscara de I/O: **el render vive en `scripts/lib/report_render.mjs`, puro**, y la interacción en
  `scripts/lib/report_interact.mjs`, que el informe lleva **inlineado** (lo lee con `readFileSync` y
  lo mete con `withInteract`). Dos trampas de ese inlineado, las dos ya pagadas y las dos mudas: si
  ese módulo llegara a contener una etiqueta de cierre de script el navegador corta el informe ahí, y
  si el HTML se arma con `String.replace` y una **cadena** de reemplazo, `$$` significa `$` literal y
  el módulo llega corrompido (`Identifier '$' has already been declared`, informe sin pestañas ni
  filtros, sin ningún otro síntoma). Por eso el inlineado es una función testeada y no dos líneas
  sueltas en el script.
- `npm run validate:page` (`vite.validador.config.ts`) — construye `validador/` a `site/validador/`,
  la página que corre el validador **en el navegador de quien edita los datos**. Existe porque el
  informe de Pages sólo puede generarse después de que el archivo pasó por nosotros, así que nunca
  alcanza a atrapar nada antes del envío: ahí estaba el ida y vuelta. El archivo no se sube, se lee
  con `FileReader`.
  **La página no reimplementa nada**: importa `scripts/lib/validate.mjs`, `report_render.mjs` y
  `report_interact.mjs`, los mismos del CLI, y el registro va empaquetado con `?raw` para que sea un
  solo archivo sin fetch que pueda fallar. La prueba de que no divergieron es que el **panel de
  resultado** del informe del CLI y el de la página salgan idénticos para los mismos archivos (receta
  headless en `.claude/skills/verify`; comparar por DOM y no como texto, así las entidades quedan
  serializadas igual en los dos lados). Lo que sí difiere está **declarado por opciones**: el informe
  lleva el aviso que enlaza al validador, y el validador agrega la sección del instructivo vía
  `extraSecciones`. Ojo al comparar: las secciones de **referencia** (ayuda e instructivo, las que
  van después del corte del índice) se **renumeran** legítimamente cuando un lado aporta una propia,
  así que el número se compara sólo en las de trabajo. `scripts/registry_parse.test.mjs` fija en CI
  la parte que se puede probar sin navegador: que las dos rutas armen los mismos `opts`.
  Después del informe la página muestra una **región de acciones** que cambia según el resultado: si
  hay archivos ilegibles no ofrece el botón de subir (sería mandar a romper el sitio), y si hay
  inversiones que no publican dice que se puede subir igual. El texto del instructivo vive aparte, en
  `validador/instructivo.js`, porque lo relee y corrige alguien que no está tocando código; la
  constante `REPO` de ese archivo es el **único** lugar donde está escrito el dueño del repositorio.
  **La guardia de caída brusca también corre acá, antes de subir**: `expected_counts.csv` va
  empaquetado con `?raw` y se reusa `checkCounts`. Ojo con acotar la línea base a los archivos que se
  soltaron: sin eso, validar un archivo suelto marca los otros dieciséis países como ausentes, que es
  el validador que grita sobre datos correctos.
- `npm run pendientes` (`scripts/build_pendientes.mjs`) — la planilla de pendientes, **cortada por
  dueño del arreglo** y no por país, reusando el `tipo` de `scripts/lib/rules_help.mjs`. Es la versión
  CLI de lo que la página ofrece como descarga, con el mismo constructor
  (`scripts/lib/pendientes.mjs`). Es un **encargo de trabajo, no un archivo para volver a subir**:
  partir el xlsx del país en «validado» y «pendiente» forkearía la fuente, y con la compuerta por
  inversión lo bueno del archivo ya se publica solo.
  **La planilla no calcula nada**: viste el modelo de `scripts/lib/findings.mjs` con nombres de
  columna en español. Ese modelo es el mismo que dibuja la lista en pantalla, y por eso la descarga y
  lo que se ve no pueden decir cosas distintas.
- `node scripts/build_investors_map.mjs` — regenera `public/data/investors_map.json` desde el CSV. El
  ETL hace lo mismo en cada build; este sirve para regenerar sin correr el ETL entero.
  **Los dos llaman al mismo núcleo, `scripts/lib/investors_map.mjs`**, y ahí tiene que quedarse
  cualquier campo nuevo del mapa. Tuvieron su propia copia del constructor hasta el 05-08 y
  divergieron: `non_chinese` se agregó sólo al script suelto, así que el JSON **publicado** nunca lo
  llevó y el modelo del socio no chino funcionaba únicamente corriendo el script a mano. El síntoma
  era mudo —`PAN-0015` resolvía `["Local SOE","UNKNOWN"]` en vez de `["Local SOE"]`, y como el filtro
  usa `.some()` y `UNKNOWN` no está entre sus opciones, no se veía en pantalla— así que la única forma
  de detectarlo fue diffear los dos JSON. Si se vuelve a tocar el mapa: generarlo con los dos scripts
  y comparar, tienen que salir **idénticos byte a byte**.
- `node scripts/build_borders.mjs [dirDatos]` — desde `data/sources/geo/america.geojson` genera la
  semilla de bordes disponibles y el geojson que dibuja el mapa, filtrado por las dos compuertas.
  **Correrlo es parte de incorporar un país nuevo.** Idempotente.
- `npm run counts:update` (`scripts/build_expected_counts.mjs`) — regenera `expected_counts.csv`, la
  línea base de la guardia de caída brusca. Se corre **a propósito**, cuando el cambio de datos es
  legítimo, y el CSV va en el mismo commit. Acepta `--out` para no pisar la línea base real al
  probar contra un directorio de prueba.
- `node scripts/check_investor_coverage.mjs` — lista los inversores de la base que no están en la
  tabla, con monto, para priorizar. Escribe en `reports/`.

En `scripts/one-off/` hay herramientas de auditorías puntuales que **no** son parte de ninguna
cadena; ver su README.

## Dónde está lo que falta

`docs/estado.md`: qué quedó pendiente, qué decisiones están abiertas y de quién depende cada una.
