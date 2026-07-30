# Estado del proyecto

Lo que quedó pendiente al momento del traspaso, y de quién depende cada cosa. Cuando algo se cierra
**se borra de acá**, no se marca como hecho: una lista de pendientes con la mitad tachada deja de
leerse.

Las reglas de código que no caducan están en `.claude/CLAUDE.md`. El contrato de datos, en
`data/schema/schema.md`.

**Última actualización:** 2026-07-30.

El sitio está publicado en **https://app.iclac.cl**. Cómo quedó montado, en `docs/traspaso.md`.

---

## 1. Bloqueado en una decisión de ICLAC

### 1.1 Quién mantiene la tabla de inversores

`data/schema/investors_map.csv` traduce el nombre del inversor tal como viene de la fuente a una
empresa canónica, con su tipo de propiedad. Está poblada y validada, pero **mantenerla es trabajo
experto** (estructura corporativa china), no de quien carga los datos.

Hace falta designar quién la mantiene. Mientras tanto el sitio no se rompe: un inversor nuevo cae a
propiedad desconocida y aparece listado por el validador y por
`node scripts/check_investor_coverage.mjs`.

Tres empresas esperan un veredicto de propiedad, marcadas con `REVISAR` en el CSV: Texhong/Danasun
(dos empresas en una misma celda, capital chino-hongkonés), Chaoyang Petroleum (vehículo registrado
en las Islas Vírgenes Británicas) y American Recycling (nombre no chino). Las tres pertenecen a
países que hoy no se publican, así que no corren prisa.

### 1.2 Qué países nuevos se publican

Costa Rica, Honduras, Nicaragua y Trinidad y Tobago pasan la validación y están **retenidos** con
`publish=no` en `data/schema/countries.csv`, a la espera de la decisión de ICLAC.

Antes de publicarlos conviene resolver dos cosas de contenido:

- Cinco filas de esos países traen `Area_EN = Construction`, que no es una de las ocho categorías de
  sector de la metodología. Se dibujarían en gris y con una categoría de más en el filtro.
- Cuatro filas de Honduras anotan a Sinohydro como contratista EPC con la propiedad del activo en
  manos de una empresa hondureña. Si es solo la obra, es construcción y no inversión china.

### 1.3 México

Está deliberadamente fuera del registro de países, por una decisión metodológica de julio de 2026.
Del lado del sistema no hay nada que impida incorporarlo: es una fila en `countries.csv`, su archivo
de datos y una corrida de `build_borders`. La geometría ya está disponible en
`data/sources/geo/america.geojson`.

### 1.4 Otras consultas abiertas sobre los datos

- **Sector de `PRY-0001` (COFCO):** `Area_EN` dice `Energy` y `Area_ES` dice `Agroindustria`. Una de
  las dos está mal y hace falta criterio para saber cuál.
- **`ECU-0041`:** la latitud (−6,62) cae en Perú; `Location` dice Orellana, que está cerca de −0,5.
- **Ventana temporal:** la metodología declara 2003–2025 y hay una inversión de 1997 (`0101101`,
  Venezuela, CNPC), sin monto.
- **Año de la cita sugerida:** el sitio cita 2024, igual que la versión anterior, y los datos llegan
  a 2025. Es una línea por idioma en `common.citation_text`.
- **Investigación y noticias:** falta definir si las noticias van en una columna aparte o se
  excluyen.
- **Consorcio y joint venture no son lo mismo:** un consorcio son varias empresas chinas asociadas;
  un joint venture tiene socio local. El dato existe para los dos; falta decidir cuál de los dos se
  ofrece como filtro en el sitio.

---

## 2. Trabajo técnico pendiente

### 2.1 Despliegue y CI

- **`validate-data` todavía no corre en `main`.** Su última ejecución fue el 28-07 en la rama vieja
  `iclac-mapa-fdi`, así que el informe de Pages sigue saliendo de ahí y el job `registro` (el que
  valida `countries.csv`) **nunca se ha ejecutado**. GitHub no aplica el filtro `paths:` cuando un
  push *crea* una rama, que es lo que pasó al traspasar. Se destraba una sola vez: Actions →
  validate-data → Run workflow → `main`. Después vuelve a dispararse solo con cada subida de datos.
- **Borrar la rama `iclac-mapa-fdi`** una vez que el informe de Pages se republique desde `main`.
  Quedó como resto del traspaso y `main` ya la contiene entera.

### 2.2 Interfaz

- **El filtro de sectores no se lee como filtro.** En móvil ya se rediseñó (un chip que abre una
  hoja); en escritorio sigue siendo la leyenda flotante, y no es evidente que sea accionable.
- **Fichas: los grupos por país parten colapsados.** En la vista de Tabla se revirtió a pedido; para
  Fichas falta confirmar cuál es el comportamiento deseado.
- **Riel de filtros detrás del listado en teléfono y tablet:** quedan 48 px visibles al abrir el
  listado. Es cosmético.
- **El alto de la ventana en teléfono está sin confirmar en un aparato real.** La app usa `100dvh`
  para que la barra de direcciones del navegador no se coma el pie de página. Un navegador sin barra
  (el headless con que se verifica) no puede reproducir el problema, así que la corrección se midió
  pero no se vio fallar. Abrir el sitio en un teléfono y confirmar que el pie y la barra de acciones
  del mapa quedan alcanzables sin scroll.
- **Pantallas de poca altura** (unos 475 px): se probó un punto de corte para encoger los logos, sin
  confirmar.
- **El texto chino de Metodología** conviene contrastarlo con el del sitio anterior. Hay una
  diferencia intencional: se eliminó el párrafo final que repetía la cita sugerida ya presente
  arriba. Cualquier otra diferencia sí es un hallazgo.

### 2.3 Datos y pipeline

- **Notificación por correo cuando la validación falla.** Hoy el resultado se ve en el informe de
  Pages y en la pestaña Actions. Sin decidir entre la notificación nativa de GitHub, un comentario
  con mención, o correo saliente.
- **Publicar la tabla de inversores en la pestaña Datos**, junto a la de inversiones.
- **`cccc-chec-consortium`:** sus miembros son la misma empresa dos veces (CHEC es filial de CCCC).
  Revisar si es un consorcio real o un doble conteo entre matriz y filial.
- **Conversión de geodatos a TopoJSON o simplificación adicional.** No urge: el archivo actual pesa
  200 KB.
- **`public/data/mx.json` se publica y no lo usa nadie.** Son 790 KB de geometría de México que
  ninguna parte de la aplicación pide: su único consumidor es `scripts/one-off/merge_geo.mjs`, que no
  forma parte de ninguna cadena. Todo lo que está en `public/` se sirve al mundo, así que ese archivo
  debería moverse a `data/sources/geo/` y ajustarse la ruta en ese script.
- **`south-america.geojson` ya no es solo Sudamérica.** Desde que entró Centroamérica el nombre
  quedó mentiroso. Renombrarlo toca el ETL, `build_borders` y el `fetch` del mapa, así que conviene
  hacerlo de una vez y no a medias.
- Borrar `data/schema/investors_map.csv.bak` cuando ya no haga falta.

---

## 3. Ideas no comprometidas

Figuras posibles con los datos que ya existen, ninguna decidida:

- **Propiedad en el tiempo:** área apilada por año y tipo de propiedad. El dato está listo.
- **Mezcla de tipo de proyecto por país o sector:** la más barata, mismo patrón de gráfico que ya
  existe.
- **Evolución de sectores en el tiempo:** streamgraph de año por sector. Mismo costo.
- **Red de coinversión entre consorcios:** grafo usando los miembros de cada consorcio. Es el ángulo
  más original y el de mayor esfuerzo: necesita un layout de grafo, no un gráfico de ECharts.
- **Popup interactivo por país:** clic en el polígono para filtrar y ver totales en vivo.

---

## 4. Riesgos a vigilar

| Riesgo | Qué lo contiene |
|---|---|
| La estructura de los archivos de datos cambia entre entregas | El contrato de `schema.md` más el validador en cada push |
| La tabla de inversores queda sin mantenedor | Degradación elegante: un inversor nuevo cae a propiedad desconocida y queda listado, el sitio no se rompe |
| Sobreconteo de montos en inversiones multipunto | El monto se cuenta una vez por inversión, no por fila, y construcción queda fuera del total por defecto. Hay tests que lo cubren |
| Las revisiones se hacen solo en pantalla grande | Varios problemas aparecen solo a 360 px de ancho, y otros solo entre 768 y 1023 (tablet, que no es ni un teléfono grande ni un escritorio angosto). Revisar en los tres antes de dar por buena una vista |
