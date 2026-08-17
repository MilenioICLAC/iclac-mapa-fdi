# Estado del proyecto

Lo que quedó pendiente al momento del traspaso, y de quién depende cada cosa. Cuando algo se cierra
**se borra de acá**, no se marca como hecho: una lista de pendientes con la mitad tachada deja de
leerse.

Las reglas de código que no caducan están en `.claude/CLAUDE.md`. El contrato de datos, en
`data/schema/schema.md`.

**Última actualización:** 2026-08-17.

> **Hay trabajo en curso fuera de `main`:** el validador y la carga por el cliente viven en la rama
> `compuerta-por-inversion` y en la copia de pruebas `fsotoj/iclac-mapa-fdi`. Ver §2.4 antes de
> tocar el validador, el ETL o el workflow.

El sitio está publicado en **https://app.iclac.cl**. Cómo quedó montado, en `docs/traspaso.md`.

---

## 0. Cómo se citan las cifras del repositorio

**Toda cifra va sobre el universo SIN construcción**, que es lo que el sitio muestra por defecto, con
la cifra con construcción entre paréntesis. La metodología no cuenta construcción como IED, así que
dar el número con construcción a secas describe un universo que el lector nunca ve.

Los documentos anteriores a esta regla, incluido el informe de propiedad del 03-08, usan el número con
construcción **sin declararlo**. Cualquier cifra que se reutilice de ahí hay que convertirla primero.

Verificado el 11-08 contra `public/data/` (datos del 10-08):

| | Sin construcción (lo que se ve) | Con construcción |
|---|---|---|
| Total publicado | **272** | 386 |
| Estatal central | **132 · US$122.793 MM** | 221 · US$176.328 MM |
| Privada | **100 · US$21.725 MM** | 109 · US$26.411 MM |
| Estatal local | **27 · US$12.866 MM** | 40 · US$20.269 MM |
| Capital mixto | **17 · US$2.683 MM** | 21 · US$4.096 MM |

Los cuatro filtros de propiedad **no suman el total**: 276 contra 272 sin construcción, 391 contra 386
con ella. Son las inversiones de consorcios con miembros de dos tipos, que aparecen en los dos filtros.
Hoy son BRA-0067, ECU-0023, PAN-0028 y PER-0042, más COL-0026 sólo con construcción activada. No es un
defecto, es el dato, y **ICLAC ya lo aceptó por correo**.

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

### 1.2.b La entrega de países nuevos, sin cargar (estado al 10-08)

ICLAC entregó una base de 93 inversiones en 20 países, ocho de ellos nuevos (Costa Rica, Honduras,
Nicaragua, Trinidad y Tobago, El Salvador, Jamaica, Cuba y República Dominicana). **No está cargada al
pipeline.** Pasó por tres versiones y sólo la primera trae la geometría completa; el corte por país la
aplanó y la auditoría posterior se hizo encima de esa versión ya aplanada.

El archivo auditado **pasa el validador**: 18 de 20 archivos con 100% de filas válidas, y los dos que
fallan lo hacen por el nombre, no por los datos. Lo que falta antes de ingerirla, todo del lado de
ICLAC:

1. **Reponer la geometría.** 29 inversiones llegaron aplanadas a un punto y se pierden 416 filas de
   vértices que sí existen en la versión georreferenciada. Trazados y sitios múltiples se dibujan como
   un pin, y **el ETL no avisa**: un grupo `Vector` de una sola fila se emite como punto en silencio.
   La regla para el próximo corte es una fila por vértice, y que varios sitios no es un trazado
   (esos van con `Path = 0`, o el mapa dibuja una raya entre lugares que no están conectados).
2. **Renumerar los identificadores.** Parten de `0001` en cada país y 27 pisan inversiones ya
   publicadas. Falta además llenar `Id_Investment_Original`, sin la cual no hay trazabilidad hacia la
   entrega anterior.
3. **Clasificar `Research` y `News`.** Vienen constantes en las 93 filas, así que el filtro de
   estudios queda vacío para toda la entrega. **La misma revisión hace falta sobre lo ya publicado**,
   donde tampoco son confiables: hay inversiones marcadas como noticia cuya única cita cargada es un
   trabajo académico, y otras cuyo estudio quedó sólo en las columnas de respaldo del puntaje, sin
   pasar nunca a `CasoN`/`LinkN`.
4. **Decidir si se conservan los estudios de caso.** `CasoN` y `LinkN` vienen vacías y quedan enlaces
   sueltos dentro del texto de las notas. Si se conservan, alimentan el filtro, las fuentes citadas de
   la ficha y una hoja de las descargas; si no, hay que decidir qué pasa con los ya cargados.

**Hecho el 17-08 (comprometido en el correo del 10-08):** el ETL lee `cancelled` y enruta esas
inversiones al anexo, en vez de agregarle una dimensión de estado al esquema. El corte es **por
inversión**, no por fila. Sobre la base publicada hoy es un no-op: esos archivos todavía no traen la
columna.

**Pero la columna no significa lo que su nombre dice, y eso hay que hablarlo con ICLAC.** De las 103
inversiones con `cancelled=1` en la entrega del 15-08, sólo unas 31 son proyectos que no se
concretaron. El resto son otras decisiones metidas bajo la misma marca:

| `cancelled_motivo` | Inversiones |
|---|---|
| evidencia insuficiente (score <3) | **67** |
| cancelado | 26 |
| duplicado de CHL-0041 / PER-0069 / PER-0053 / PER-0037 | **4** |
| anuncio no ejecutado · MoU sin ejecución · en estudio · fuera de alcance | 6 |

Tres cosas que salen de ahí:

- **Los 67 «evidencia insuficiente» duplican a mano nuestra compuerta de puntaje.** Verificado: sobre
  esa entrega, la compuerta no encontró **ninguna** inversión que no estuviera ya marcada.
- **Los 4 duplicados no son caso de anexo, son un error a corregir en origen.** Publicarlos los
  conserva en vez de fusionarlos, y el motivo ya dice con cuál se duplica. Van al correo a Fran.
- **Por eso el texto del anexo no afirma que sean cancelaciones.** Describe lo que el anexo es (lo que
  queda fuera del principal) y deja el porqué en `cancelled_motivo`, que ahora viaja en las dos
  descargas. La redacción que estaba comprometida habría salido falsa para 72 de 103.

El título visible pasó a «Anexo: registros fuera del dataset» en los tres idiomas. **El nombre del
archivo no cambió** (`iclac_anexo_evidencia_limitada.xlsx`): es un enlace publicado y renombrarlo lo
rompe. El texto chino se escribió sin la revisión externa que pide la convención, por decisión de
Felipe el 17-08.

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

- **Borrar la rama `iclac-mapa-fdi`** del repositorio del cliente. Quedó como resto del traspaso y
  `main` ya la contiene entera. (Verificado el 17-08: sigue ahí, en `042c9fe`.)

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

## 2.4 El validador y la carga por el cliente — EN CURSO

Trabajo abierto al 17-08, en la rama **`compuerta-por-inversion`**. **Nada de esto está en el
repositorio del cliente todavía**: vive en la copia de pruebas `fsotoj/iclac-mapa-fdi`, cuyo `main`
apunta a esa rama. `origin` sigue intacto en `ac6413b`.

El objetivo, en una línea: **que ICLAC cargue sus propios datos sin romper el sitio.** El criterio de
éxito es que suban datos no corruptos por sí solos.

### Qué ya está hecho

| | Dónde |
|---|---|
| Compuerta de validación por **inversión** en vez de por archivo | `scripts/lib/validate.mjs` (`excludedIds`), `scripts/etl.mjs` |
| Validador que corre **en el navegador de quien edita** | `validador/`, publicado en `/validador/` |
| Guardia de caída brusca en el build | `scripts/lib/count_guard.mjs`, `data/schema/expected_counts.csv` |
| Planilla de pendientes cortada por dueño | `scripts/lib/pendientes.mjs`, botón en la página + `npm run pendientes` |
| Instructivo de subida, contextual al resultado | `validador/instructivo.js` |
| Repositorio movido a la organización `MilenioICLAC` | transferido el 17-08 desde la cuenta personal |
| Informe rediseñado: documento con índice, lista de hallazgos navegable, fondo claro fijo | `scripts/lib/findings.mjs`, `report_render.mjs`, `report_interact.mjs` |
| Guardia de caída brusca **también antes de subir**, en la página | `validador/main.js` (`problemasDeCaida`) |
| Lista en dos niveles, regla → inversión, con el mensaje en la línea | `report_interact.mjs` (`agrupar`, `subLinea`) |
| Las cuatro compuertas, compartidas entre ETL y validador | `scripts/lib/gates.mjs` |
| `cancelled` enruta al anexo, y el texto del anexo dejó de mentir | `scripts/etl.mjs`, `src/locales/*.json` |

Las reglas que no caducan de todo esto están en `.claude/CLAUDE.md`. Lo de acá es sólo lo que falta.

### Lo que se sigue puliendo del validador

El diseño se afinó a lo largo del 17-08 con el usuario mirando la página sobre datos reales, y las
decisiones que se tomaron están en `.claude/CLAUDE.md` («La forma del informe»). Lo que queda es
pulido, no estructura:

- **Las casillas cuentan hallazgos y el veredicto cuenta inversiones**, así que se lee «Ocultar
  canceladas (39)» arriba y «93 canceladas» en el veredicto. Los dos números son correctos y cada zona
  es consistente consigo misma (todo lo de la barra son hallazgos, igual que «Solo bloqueantes»), pero
  si al usarlo confunde, hay que ponerle la unidad.
- **En el corte por país el segundo número son problemas, no inversiones.** Es consistente con la regla
  («el número dice qué hay adentro») pero para un país lo más útil sería cuántas inversiones están
  afectadas. Ese corte sólo aparece con varios archivos y es el menos usado.
- **21 reglas del validador no tienen entrada en `RULE_HELP`.** No disparan sobre ningún dato real, así
  que muestran el slug crudo sólo en teoría. Al agregar una regla, agregarle su entrada.

### Pulido ya cerrado, para no reabrirlo

- El acordeón por país, las pestañas y la lista plana por defecto se probaron y se descartaron, cada
  una por una razón medida. Están en `.claude/CLAUDE.md`.
- El rótulo genérico «Ocultar lo que no publica» prometía más de lo que hacía. Hoy hay una casilla por
  motivo.

**La dirección del informe cambió** con la transferencia, porque GitHub redirige los enlaces de git y
web pero **no redirige Pages**: ahora es `https://milenioiclac.github.io/iclac-mapa-fdi/` y la vieja
deja de servir. Por eso se movió antes de repartirla y no después. Lo que la organización **no** da
es permisos por carpeta: eso no existe en GitHub para repos públicos en ningún plan (los rulesets por
ruta piden repo privado y plan Team). Lo que da es continuidad institucional y manejo de miembros.

**La subida por web SÍ reemplaza un archivo del mismo nombre**, en un solo commit y sin borrar antes.
Probado el 17-08 en la copia de pruebas: git registra el cambio como `M`, no como `Delete` + `Add`.
O sea que los **81 commits «Delete» contra 14 «Add files via upload»** de la historia son costumbre
de quien lo hacía, no un límite de GitHub. Por eso el instructivo se queda en 4 pasos y le dice
explícitamente a quien sube que **no** borre el anterior: entre el borrado y la subida el país queda
fuera del sitio, y ahí es donde una interrupción cualquiera lo deja fuera de verdad.

### Abierto, y depende del cliente

**¿Dónde está la copia maestra de la base?** La historia dice que hoy vive en el Excel de ICLAC y que
el repositorio es un espejo: las 98 subidas son **siempre el archivo de país completo**, nunca un
incremento, y los tamaños suben y bajan entre entregas (`argentina.xlsx` fue 93.571 → 68.678 → 67.574
→ 68.682 bytes en un mismo día). La entrega del 15-08 fue igual: 21 archivos completos en un `.rar`.

Comprobado sobre `BASE_FINAL_CORREGIDA`, comparando `Id_Investment` país por país contra lo
publicado: **la entrega trae lo antiguo.** Conserva todas las inversiones publicadas salvo dos
(`HND-0003` y `VEN-0101`), suma cuatro países nuevos (cuba, dominican_republic, el_salvador, jamaica)
y Trinidad llega **renombrado** (`trinidad_tobago` → `trinidad_and_tobago`) conservando sus 7. O sea
que mantienen la base entera y la exportan completa, no mandan altas sueltas.

**El pedido y los comentarios para Francisco están redactados en
`docs/sprint_6/pedido_francisco.md`**, con los números re-verificados el 17-08. Lo que lleva: los 9
identificadores repetidos, las 4 inversiones con columna obligatoria vacía, la pregunta por la columna
`cancelled`, los 4 duplicados declarados, las dos inversiones que no vienen, y la cifra que más
sorprende: la entrega suma **7** inversiones a la vista por defecto (272 → 279 sin construcción, 386 →
421 con construcción), porque 93 vienen marcadas con `cancelled = 1` y 67 de esas por evidencia
insuficiente.

**Un hallazgo que ahorra trabajo y conviene no perder:** los 9 identificadores repetidos son la causa
única de tres síntomas. Siete de ellos traen además `cancelled` a medias (filas en 0 y filas en 1) y
seis traen puntajes de confiabilidad distintos dentro de la misma inversión. No son 22 problemas: son
9, y al separar las inversiones desaparecen los tres. Lo mismo del otro lado: el chequeo de geometrías
compartidas confirma por su cuenta tres de los cuatro duplicados que ellos declararon en
`cancelled_motivo`, sin leer ese texto.

Eso tiene una consecuencia que todavía no está resuelta: **nuestras correcciones sobre los xlsx las
borra en silencio la próxima entrega completa.** Ya pasó con `042c9fe` («restaurar inversor original»)
y `44b3644`. Es el mismo modo de falla que el proyecto prohíbe —un dato en dos lugares— en el eje que
no habíamos mirado.

De la respuesta dependen cosas grandes: si nuestras correcciones pueden vivir en el xlsx o tienen que
vivir siempre en las capas de mapeo, y si tiene sentido que la página **fusione** un archivo de altas
con lo que ya hay. Ojo con esa fusión: si el maestro sigue siendo el Excel de ellos, fusionar crea un
**segundo maestro** que la próxima exportación completa pisa, o sea que construye la divergencia en
vez de arreglarla. Por eso lo que se hizo fue **detectar** la caída antes de subir, que sirve
cualquiera sea la respuesta, y no fusionar.

### Pendiente, en orden

1. **Invitar a Flo y Fran con cuentas propias.** Hasta ahora todos los commits del cliente salieron
   de una cuenta compartida (`comunicaciones.iclac@gmail.com`, 104 commits), así que no se puede
   saber quién hizo qué. Rol acordado: Write, y el instructivo acota por convención — el candado
   técnico no existe y la red es la guardia del build.
2. **Llevar la rama a `origin`.** Recién cuando 1 esté resuelto.

### Decisiones ya tomadas, para no rediscutirlas

- **La planilla de pendientes no parte el archivo del país en dos.** Sería forkear la fuente —un
  dato, un lugar— y además ya no hace falta: con la compuerta por inversión, lo bueno del archivo se
  publica solo. Es un **encargo de trabajo**, y la hoja `LÉEME` lo dice para que nadie la suba de
  vuelta creyendo que es la base corregida.
- **La página no commitea al repositorio.** Necesitaría un token: o se lo pedimos a quien la usa
  (mala práctica), o montamos un backend con el nuestro, y ahí pasamos de publicar una página a
  operar un servicio con permiso de escritura sobre el repositorio del cliente. El enlace a la
  pantalla de subida de GitHub da casi todo el valor con cero infraestructura.
- **La página no edita datos.** Sería un CMS sobre XLSX compitiendo con Excel, que es donde el dato
  se produce.
- **El cliente sube directo a `main`, no por pull request.** El PR protege producción pero devuelve
  una persona al lazo, y sacarla es justamente el objetivo. El riesgo lo cubre la guardia.
- **El informe y el validador comparten forma, no sólo núcleo.** Se evaluó dejar el informe de Pages
  como documento y darle otra vista al validador; se descartó porque son el mismo render y separarlos
  reabre la divergencia. Lo que cada lado agrega va por opciones (`extraSecciones`, `validatorHref`),
  y eso es una diferencia declarada, no una implementación paralela.
- **Nada de pestañas.** Se probaron y se sacaron el mismo día: resuelven el muro de texto pero
  esconden, y dejaron «Cómo se lee esto» detrás de un clic que nadie iba a dar. El índice lateral
  hace lo contrario, que es mostrar de un vistazo todo lo que hay. Si vuelve a aparecer la idea, la
  razón está acá.
- **La lista no se recorta nunca.** Arranca agrupada por regla, pero cada grupo abre con todos sus
  casos y el número completo está a la vista. Se sacó el «… y 66 caso(s) más» del informe viejo, que
  era un callejón sin salida: obligaba a bajar el xlsx para ver el resto.
- **La lista plana no es el default.** Se probó y abruma: 251 renglones donde 109 dicen lo mismo. La
  concentración medida (109 hallazgos en 4 inversiones, 25 en una) es lo que decide el corte. Plano
  queda como opción, no como punto de partida.

### Trampas ya pagadas en la cañería, para no repetirlas

Las tres fallaban **en silencio**, que es lo caro:

- **El script de interacción llegaba corrupto al informe publicado.** Se inlinea leyendo
  `report_interact.mjs` y metiéndolo en el HTML, y se metía con `String.replace` y una **cadena** de
  reemplazo. En una cadena de reemplazo `$$` significa `$` literal, así que el helper `$$` del módulo
  llegaba como `$` y el navegador tiraba `Identifier '$' has already been declared`. El informe se
  veía perfecto, sólo que sin pestañas ni filtros. Hoy el inlineado es `withInteract`, con test que lo
  fija, y además falla ruidosamente si el módulo trae una etiqueta de cierre de script.

- **El filtro `paths:` del workflow dejó el sitio publicado desactualizado dos veces.** `validador/**`
  nunca estuvo en la lista, así que la página podía cambiar entera sin que nada se reconstruyera, y
  no había ningún rojo: simplemente no había corrida. Se sacó el filtro entero. Si alguien lo quiere
  reponer: el sitio depende de datos, esquema, scripts, la página, la config de vite, `package.json`
  y del propio workflow, o sea de casi todo, y mantener esa lista al día es lo que falló.
- **La concurrencia estaba agrupada en `pages` a secas**, así que un push a cualquier rama entraba al
  mismo grupo que `main` y lo cancelaba. Encima el job de construcción declaraba
  `environment: github-pages`, que sólo acepta la rama por defecto, así que toda corrida de rama
  quedaba roja por una razón ajena a los datos. Hoy el grupo lleva la referencia y publicar es un job
  aparte, condicionado a la rama por defecto.

### Cómo se verifica

Lo de siempre (`npm test`, `npm run lint`, `npx tsc --noEmit`) más tres cosas propias:

- **Que el ETL sobre la base actual no cambie**: 386 inversiones, 6832 registros, cero registros
  distintos. Es la red contra cualquier refactor.
- **Que la página y el CLI no hayan divergido.** El panel de resultado del informe y la planilla que
  produce el navegador tienen que salir **idénticos** a los que produce el CLI para los mismos
  archivos. Comparar **por DOM** y no como texto: leyendo `innerHTML` desde el mismo navegador en los
  dos lados, las entidades quedan serializadas igual y una diferencia es una diferencia de verdad.
  Receta headless en `.claude/skills/verify`; se maneja con `playwright-core` y el Edge del sistema.
- **Que extraer el modelo no perdiera nada:** `npm run pendientes` sobre las dos bases antes y después
  del cambio tiene que dar el mismo xlsx, celda por celda.
- **Que la guardia no grite sobre datos correctos:** soltar un archivo suelto y los diecisiete juntos
  no tiene que avisar nada; un archivo recortado sí.
- **El fondo, con el navegador en oscuro** (`colorScheme: 'dark'` en el contexto de Playwright): tiene
  que salir blanco igual.
- **Los tres anchos** (1536, 800, 360), sin scroll horizontal y sin errores de consola.

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
