# Estado del proyecto

Lo que quedó pendiente al momento del traspaso, y de quién depende cada cosa. Cuando algo se cierra
**se borra de acá**, no se marca como hecho: una lista de pendientes con la mitad tachada deja de
leerse.

Las reglas de código que no caducan están en `.claude/CLAUDE.md`. El contrato de datos, en
`data/schema/schema.md`.

**Última actualización:** 2026-08-03.

El sitio está publicado en **https://app.iclac.cl**. Cómo quedó montado, en `docs/traspaso.md`.

---

## 0. Lo que cambia en el sitio en el próximo deploy

**Un consorcio dejó de tener propiedad propia.** Es un acuerdo entre empresas y no una empresa, así
que su fila lleva `ownership` vacío y el sitio la resuelve desde sus miembros al filtrar. Una
inversión de consorcio aparece si **cualquiera** de sus miembros es del tipo pedido.

| Filtro | Antes | Ahora |
|---|---|---|
| Estatal central | 205 · US$153.717 MM | **220 · US$176.250 MM** |
| Privada | 106 · US$24.805 MM | 109 · US$26.411 MM |
| Estatal local | 35 · US$11.572 MM | 42 · US$22.297 MM |
| Capital mixto | 40 · US$29.504 MM | **21 · US$4.096 MM** |

`MIXED` queda en las 21 inversiones de las 12 empresas de capital genuinamente mixto, que es lo que la
etiqueta siempre quiso decir. Se le sacó el «/ Joint venture» del rótulo, porque ningún vehículo JV
cae ahí.

**Consecuencia que hay que decirle a ICLAC:** los cuatro filtros **ya no suman el total** (392 contra
386), porque 6 inversiones tienen miembros de dos tipos y aparecen en los dos. No es un defecto, es el
dato. No rompe nada visible, porque ningún lugar de la interfaz desglosa montos por propiedad.

**Falta el aval de ICLAC** y es reversible en un commit.

---

## 1. Bloqueado en una decisión de ICLAC

### 1.1 La tabla de inversores es trabajo nuestro, y se edita con dos comandos

`data/schema/investors_map.csv` traduce el nombre del inversor tal como viene de la fuente a una
empresa canónica, con su tipo de propiedad. **Desde el 03-08 mantenerla es responsabilidad declarada
de la asesoría**, no una tarea sin dueño.

**No se edita a mano nunca.** Excel en configuración regional española rompe el CSV, y con 241 filas,
texto en chino y cadenas de control con comas adentro la regla «se edita en el navegador» se rompe
sola:

```bash
npm run investors:export                              # CSV -> docs/investors_table.xlsx
npm run investors:import -- docs/investors_table.xlsx # dry-run, imprime el diff
npm run investors:import -- docs/investors_table.xlsx --write
```

**Prueba de que el circuito no pierde nada:** exportar e importar sin tocar nada da **0 cambios**. Si
algún día da distinto, algo se está perdiendo en el viaje. El import machaca por `company_id`, no
borra nunca, no escribe si el resultado no pasa el validador, y absorbe lo que Excel le haga al
archivo. Detalle completo en `data/schema/investors_map.README.md`.

**Ninguna inversión publicada queda hoy sin propiedad determinada.** El camino fue largo y conviene
tenerlo: 14 empresas se resolvieron el 31-07 con veredictos de la revisión externa que llevaban una
semana sin cargarse; el resto salió al implementar el modelo de consorcios y al registrar el primer
socio no chino. La opción «Sin determinar» **se sacó del filtro** (sigue siendo un valor válido del
dato, lo que salió es la casilla).

Lo que sí sigue esperando revisión externa son **16 clasificaciones que propusimos nosotros**, más 3
empresas que la revisión marcó para eliminar. El instrumento y el correo están listos en
`docs/sprint_5/`.

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
- **`Research`/`News` no reflejan `source1..3`:** 290 de las 465 inversiones tienen los dos flags en
  `No` y a la vez fuentes cargadas (US$103.824 MM; Brasil 145, Chile 42, Argentina 36). Son dos
  sistemas de documentación que nunca se cruzaron, y el sitio lee solo el viejo, así que esas
  inversiones se ven sin respaldo aunque lo tengan. La pregunta es metodológica: ¿una URL en
  `source*` cuenta como noticia o estudio, o son dimensiones distintas? Planilla del caso en
  `docs/sprint_5/research_news_vs_sources_31072026.xlsx`, regenerable con
  `node scripts/one-off/export_research_news_gap.mjs`. Nada modificado de nuestro lado.
- **Umbral de confiabilidad:** el corte deja fuera del sitio todo lo que tenga
  `reliability_score ≤ 2`, o sea lo que no llega a dos fuentes confiables independientes, y se puede
  mover con `--min-score`. Falta que ICLAC lo confirme.
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

- **La pestaña Datos ofrece dos archivos desde el 31-07** y el ETL los arma en cada build: el dataset
  completo y el «Anexo: evidencia limitada», con las inversiones de `reliability_score ≤ 2` (hoy 64,
  US$9.424 MM). Los dos tienen las mismas cuatro hojas —`README`, `investments` (una fila por inversión), `sites` (una por
  coordenada), `case_studies`— para que se puedan concatenar. Si alguien cambia la forma de las filas
  del ETL, cambian las dos descargas y el texto de la pestaña que las describe.
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
