// Render del informe de validación — PURO, sin I/O.
//
// Vive aparte de scripts/build_validation_report.mjs (que es la cáscara que lee
// los xlsx y escribe el archivo) para que la página del validador que corre en el
// navegador use ESTE mismo render y no una copia parecida. Un informe con dos
// implementaciones diverge, y este repositorio ya pagó esa lección con los dos
// generadores del mapa de inversores.
//
// FORMA: un DOCUMENTO con secciones numeradas e índice lateral, y adentro una
// LISTA DE HALLAZGOS. No un acordeón por país: esa estructura venía de la CI,
// donde lo normal son diecisiete archivos de una, y quien valida abre uno. Con la
// compuerta por inversión el país dejó de ser la unidad de nada. Agrupar es un
// CONTROL, no la estructura.
//
// NO HAY PESTAÑAS. Las hubo un rato y escondieron la explicación: el índice
// lateral hace el mismo trabajo mejor, porque muestra TODO lo que hay de un
// vistazo en vez de esconder dos tercios detrás de un clic.
//
// Se emite todo ya armado en HTML y el JavaScript sólo mejora (filtra, reagrupa,
// resalta la sección en curso). Sin JS esto sigue siendo un documento legible e
// imprimible, que es la mitad de la razón de ser del informe publicado.
import { alpha3ForFilename } from './countries.mjs'
import { SECTOR_PAIRS } from './validate.mjs'
import { RULE_HELP, tipoBadge } from './rules_help.mjs'
import { buildFindings } from './findings.mjs'

// La lista arranca SIEMPRE agrupada por regla, y el HTML la emite plana para que
// sin JavaScript siga siendo un documento completo. Medido sobre una entrega de 21
// países: 251 hallazgos, 13 reglas, 52 inversiones. Plana son 251 renglones de
// entrada; por regla son 13. Y la concentración es enorme —los 109 "columna
// obligatoria vacía" son 4 inversiones, y los 25 de inversor son UNA— así que la
// lista plana describe con 251 renglones muchísimo menos que eso.
//
// No se recorta nada nunca: agrupar pliega, no esconde, y cada grupo dice cuántos
// casos tiene.

// El mismo de la página del validador. Sin esto el navegador pide /favicon.ico y
// deja un 404 en la consola de una página que el cliente abre todos los días.
const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' rx='3' fill='%2300A89C'/%3E%3Cpath d='M4 8.5l2.5 2.5L12 5.5' stroke='%23111' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"

// ES canónico → concepto EN, más variantes no canónicas pero conceptualmente
// claras. Sirve para detectar cuando Area_ES apunta a un sector DISTINTO del de
// Area_EN (conflicto conceptual, no de formato). Ver next_steps §0.b C9.
const ES_TO_EN = {}
for (const [en, es] of Object.entries(SECTOR_PAIRS)) ES_TO_EN[es.toLowerCase()] = en
Object.assign(ES_TO_EN, {
  agroindustria: 'Agroindustry',
  tic: 'ICT',
  manufacturas: 'Manufacturing',
  manufactura: 'Manufacturing'
})
const conceptOf = (es) => {
  const k = String(es ?? '').trim().toLowerCase()
  if (!k) return null
  if (ES_TO_EN[k]) return ES_TO_EN[k]
  for (const [esk, en] of Object.entries(ES_TO_EN)) if (k.startsWith(esk)) return en
  return null
}

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

// Para atributos: además de lo de arriba, las comillas.
const att = (s) => esc(s).replace(/"/g, '&quot;')

const n = (x) => Number(x ?? 0).toLocaleString('es')

/**
 * El (?) que explica UN concepto, en el lugar donde el concepto aparece.
 *
 * Es un <details> y no un popover con JavaScript: así funciona en el informe
 * impreso y sin scripts, y abre por CLIC y no por hover, porque en pantalla táctil
 * no hay hover. Mismo criterio que el HelpTip de la app.
 *
 * Va donde el concepto NACE (el control, la tarjeta, el título de la sección) y no
 * repetido en cada renglón: doscientos cincuenta y un signos de pregunta idénticos
 * son otra forma del muro de texto.
 */
const tip = (cuerpo) =>
  `<details class="tip"><summary title="Qué significa" aria-label="Qué significa">?</summary><div class="tip-cuerpo">${cuerpo}</div></details>`

// ---- Hallazgos ----

const sevPill = (bloquea) =>
  bloquea
    ? '<span class="pill block">Bloquea</span>'
    : '<span class="pill warn">Aviso</span>'

/**
 * Un hallazgo. La línea de arriba es densa y de un renglón, y el detalle (qué
 * pasa y cómo se corrige) va adentro de un <details>: repetir el mismo "cómo se
 * corrige" en las 109 filas de un mismo error es el muro de texto que esta vista
 * vino a sacar.
 */
const findingItem = (f, { multiFile }) => {
  const badge = tipoBadge[f.tipo] ?? tipoBadge.contenido
  const buscar = [f.pais, f.id, f.fila || '', f.columna || '', f.titulo, f.valor, f.inversor]
    .join(' ')
    .toLowerCase()
  const donde = f.fila > 0 ? `fila ${f.fila}` : 'archivo'
  return `
    <li class="h" data-regla="${att(f.regla)}" data-tipo="${att(f.tipo)}" data-pais="${att(f.pais)}"
        data-id="${att(f.id)}" data-fila="${f.fila}" data-bloquea="${f.bloquea ? 1 : 0}"
        data-inversor="${att(f.inversor)}" data-publica="${f.publicaHoy === null ? '' : f.publicaHoy ? 1 : 0}"
        data-columna="${att(f.columna ?? '')}" data-buscar="${att(buscar)}">
      <details>
        <summary>
          ${sevPill(f.bloquea)}
          ${multiFile ? `<span class="h-pais">${esc(f.pais)}</span>` : ''}
          <span class="h-donde">${f.id ? `<b>${esc(f.id)}</b> · ` : ''}${donde}</span>
          ${f.columna ? `<code class="h-col">${esc(f.columna)}</code>` : ''}
          <span class="h-tit">${esc(f.titulo)}</span>
          ${f.valor ? `<span class="h-val" title="Lo que dice la celda">“${esc(f.valor)}”</span>` : ''}
          <span class="h-meta">
            <span class="badge ${badge.cls}">${badge.label}</span>
            ${f.publicaHoy === false ? '<span class="estado no">no publica</span>' : ''}
          </span>
        </summary>
        <div class="h-det">
          <p class="msg">${esc(f.mensaje)}</p>
          ${f.fix ? `<p class="fix"><strong>Cómo se corrige:</strong> ${esc(f.fix)}</p>` : ''}
        </div>
      </details>
    </li>`
}

/** Metadatos por regla, para que el JS pueda armar las cabeceras al agrupar. */
const reglasMeta = (findings) => {
  const out = {}
  for (const f of findings) {
    if (out[f.regla]) continue
    const badge = tipoBadge[f.tipo] ?? tipoBadge.contenido
    out[f.regla] = { titulo: f.titulo, causa: f.causa, fix: f.fix, badge: badge.label, cls: badge.cls }
  }
  return out
}

const AYUDA_BLOQUEA = `<p><strong>Bloquea</strong> saca del mapa la <em>inversión</em> a la que pertenece esa
  fila. No bota el archivo: todo el resto se publica igual.</p>
  <p><strong>Aviso</strong> no saca nada, es algo a revisar.</p>
  <p>Lo único que deja un archivo entero afuera es no poder interpretarlo: un nombre que no
  corresponde a ningún país, más de una hoja, o una columna obligatoria que falta.</p>`

const AYUDA_CATEGORIA = `<p>La categoría dice <strong>de quién es el arreglo</strong>, no si bloquea.
  Son dos preguntas distintas, y confundirlas hace que el informe se lea como una lista de culpas.</p>
  <p><b>Formato</b> es cómo está escrito el dato. <b>Contenido</b> es qué dice, y necesita criterio.
  <b>Revisar</b> pide mirar la fuente. <b>Lo resolvemos nosotros</b> no requiere acción de tu lado.
  <b>Encargado de la tabla de inversores</b> es la cola de ese rol.</p>`

const AYUDA_ENTERA = `<p>Una inversión son varias filas, una por punto en el mapa. Botar sólo la fila
  con el problema publicaría medio trazado, o perdería la fila que trae el monto, las dos en
  silencio. Por eso la unidad es la inversión y no la fila.</p>
  <p>Corregir las filas señaladas la reincorpora: la corrección es puntual y no hay que rehacer la
  entrega.</p>`

const AYUDA_RETENIDO = `<p><strong>Pasar el validador y publicarse son cosas distintas.</strong> Un
  archivo puede cumplir el esquema y aun así no salir en el mapa, porque el país está marcado como
  retenido en <code>data/schema/countries.csv</code>. Es una decisión editorial de ICLAC, no un
  problema del archivo.</p>`

const AYUDA_CURACION = `<p>Los problemas de <strong>formato</strong> deterministas y sin pérdida se
  arreglan de nuestro lado: el apóstrofe en <code>COUNTRY_ISO_NUM</code>, el país en MAYÚSCULAS, y el
  nombre del archivo (vale el nombre del país o cualquiera de sus variantes, así que no hay que
  renombrarlo).</p>
  <p>Se listan uno por uno a propósito: se corrige a la vista, no a escondidas.</p>`

const controles = (findings, { multiFile }) => {
  const bloqueantes = findings.filter((f) => f.bloquea).length
  return `
  <div class="controles" data-total="${findings.length}" data-bloqueantes="${bloqueantes}">
    <label class="ctl-check"><input type="checkbox" id="solo-bloqueantes"> Solo bloqueantes
      <span class="ctl-n">(${n(bloqueantes)})</span></label>${tip(AYUDA_BLOQUEA)}
    <label class="ctl-buscar"><span class="vh">Buscar</span>
      <input type="search" id="buscar" placeholder="Buscar por id, fila, columna…"></label>
    <div class="ctl-agrupar" role="group" aria-label="Agrupar hallazgos">
      <span class="ctl-lab">Agrupar:</span>
      <button type="button" data-group="regla" class="on">Regla</button>
      <button type="button" data-group="id">Inversión</button>
      ${multiFile ? '<button type="button" data-group="pais">País</button>' : ''}
      <button type="button" data-group="nada">Nada</button>
    </div>
    <p class="ctl-conteo" id="conteo">${n(findings.length)} hallazgo(s)</p>
  </div>`
}

// ---- Bloques ----

// `corto` es para el resumen plegado: ahí los rótulos van separados por " · " y
// los largos ya traen un " · " adentro, así que "7 PASA · PARCIAL · 10 PASA" no se
// puede leer.
const ESTADO = {
  bad: { cls: 'bad', txt: 'NO SE PUEDE LEER', corto: 'no se pueden leer', orden: 0 },
  parcial: { cls: 'hold', txt: 'PASA · PARCIAL', corto: 'parciales', orden: 1 },
  hold: { cls: 'hold', txt: 'PASA · RETENIDO', corto: 'retenidos', orden: 2 },
  ok: { cls: 'ok', txt: 'PASA', corto: 'pasan enteros', orden: 3 }
}

const estadoDe = (r) => {
  if (r.error || !r.stats?.passed) return ESTADO.bad
  if (r.published === false) return ESTADO.hold
  if ((r.excludedIds?.length ?? 0) > 0) return ESTADO.parcial
  return ESTADO.ok
}

/**
 * Una línea por archivo con el resultado de las compuertas. Resumen, no estructura.
 *
 * Se pliega por encima de tres archivos: con los 21 países de una entrega, veinte
 * renglones de referencia empujan fuera de la pantalla la lista de trabajo, que es
 * a lo que se vino. Con uno o dos es una línea y conviene verla.
 */
const PLEGAR_TIRA_SOBRE = 3

const tiraArchivos = (results) => {
  const filas = results
    .map((r) => {
      const e = estadoDe(r)
      const excl = r.excludedIds?.length ?? 0
      const detalle = r.error
        ? esc(r.error)
        : `${n(r.stats?.investments)} inversiones · ${n(r.stats?.rows)} filas${excl ? ` · ${n(excl)} no publican` : ''}`
      return `<div class="tira-f ${e.cls}">
        <span class="fname">${esc(r.name)}</span>
        <span class="status ${e.cls}">${e.txt}</span>
        <span class="tira-det">${detalle}</span>
      </div>`
    })
    .join('')

  if (results.length <= PLEGAR_TIRA_SOBRE) return `<div class="tira">${filas}</div>`

  const porEstado = new Map()
  for (const r of results) {
    const e = estadoDe(r)
    porEstado.set(e.corto, { orden: e.orden, cuenta: (porEstado.get(e.corto)?.cuenta ?? 0) + 1 })
  }
  const resumen = [...porEstado.entries()]
    .sort((a, b) => a[1].orden - b[1].orden)
    .map(([corto, { cuenta }]) => `${cuenta} ${corto}`)
    .join(' · ')
  return `
  <details class="plegable">
    <summary><b>${results.length} archivos</b> <span class="pleg-res">${esc(resumen)}</span></summary>
    <div class="tira">${filas}</div>
  </details>`
}

const bloqueIlegibles = (results) => {
  const malos = results.filter((r) => r.error || !r.stats?.passed)
  return `
  <div class="file-errors">
    <strong>${malos.length} archivo(s) no se pueden leer.</strong> No es que tengan datos malos: el
    sistema no puede interpretarlos, así que no entra ninguna de sus inversiones. Esto se resuelve
    antes que cualquier otra cosa.
    <ul>${malos
      .map((r) => {
        const causas = r.error
          ? `<li>${esc(r.error)}</li>`
          : r.fileErrors
              .map((fe) => {
                const help = RULE_HELP[fe.rule]
                return `<li>${esc(fe.message)}${help ? ` <span class="fix-inline">— ${esc(help.fix)}</span>` : ''}</li>`
              })
              .join('')
        return `<li><b>${esc(r.name)}</b><ul>${causas}</ul></li>`
      })
      .join('')}</ul>
  </div>`
}

const bloqueExcluidas = (results) => {
  const conExcluidas = results.filter((r) => (r.excludedIds?.length ?? 0) > 0)
  const total = conExcluidas.reduce((s, r) => s + r.excludedIds.length, 0)
  return `
  <div class="excluidas">
    <strong>Estas ${n(total)} inversiones no se publican</strong> hasta que se corrijan sus filas. El
    resto de cada archivo entra al mapa igual.
    ${conExcluidas
      .map(
        (r) =>
          `<p class="ids"><span class="ids-pais">${esc(r.name.replace(/\.xlsx$/i, ''))}</span> ${r.excludedIds
            .map((id) => `<code>${esc(id)}</code>`)
            .join(' ')}</p>`
      )
      .join('')}
  </div>`
}

/**
 * La curación va PLEGADA. Es una lista larga (una línea por archivo curado, 21 en
 * una entrega completa) de cosas que ya están resueltas: tiene que constar, para
 * que no parezca que arreglamos a escondidas, pero no tiene que ocupar media
 * pantalla arriba de lo que sí hay que hacer.
 */
const bloqueCuraciones = (results) => {
  const conCuraciones = results.filter((r) => r.curaciones?.length)
  const total = conCuraciones.reduce((s, r) => s + r.curaciones.length, 0)
  return `
  <details class="plegable curaciones">
    <summary><b>${n(total)} arreglo(s) automáticos</b>
      <span class="pleg-res">en ${conCuraciones.length} archivo(s) · nada que hacer de tu lado</span></summary>
    ${conCuraciones
      .map(
        (r) =>
          `<div class="cur-f"><b>${esc(r.name)}</b><ul>${r.curaciones
            .map((c) => `<li>${esc(c.message)}</li>`)
            .join('')}</ul></div>`
      )
      .join('')}
  </details>`
}

// ---- Estilos ----
// Sin bloques de modo oscuro a propósito. Este informe se imprime, se captura y se
// pega en correos, y la paleta semántica (rojo bloqueante, ámbar aviso) está
// calibrada en claro. `color-scheme: light` es lo que de verdad lo fija: sin eso el
// navegador igual pinta con su esquema las barras de scroll y los controles.
const style = `
  :root { color-scheme: light;
    --bg:#fff; --fg:#1a1a1a; --muted:#666; --card:#f7f7f8; --border:#e2e2e5;
    --ok:#0a7d34; --bad:#c62828; --warn:#b26a00; --accent:#0b4f6c; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--fg);
    font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }
  .wrap { max-width:1180px; margin:0 auto; padding:32px 20px 80px; }
  h1 { font-size:26px; margin:0 0 4px; }
  .sub { color:var(--muted); margin:0 0 20px; }
  .vh { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }

  .veredicto { font-size:17px; font-weight:600; border-radius:10px; padding:14px 18px; margin:0 0 16px;
    border:1px solid var(--border); border-left:4px solid var(--muted); background:var(--card); }
  .veredicto.ok { border-left-color:var(--ok); }
  .veredicto.hold { border-left-color:var(--warn); }
  .veredicto.bad { border-left-color:var(--bad); }
  .veredicto span.det { display:block; font-size:14px; font-weight:400; color:var(--muted); margin-top:4px; }

  .cards { display:flex; gap:12px; flex-wrap:wrap; margin:0 0 26px; }
  .stat { background:var(--card); border:1px solid var(--border); border-radius:10px;
    padding:12px 16px; min-width:110px; }
  .stat .n { font-size:24px; font-weight:700; }
  .stat .l { color:var(--muted); font-size:13px; display:flex; align-items:center; gap:5px; }
  .stat.ok { border-left:3px solid var(--ok); } .stat.ok .n { color:var(--ok); }
  .stat.bad { border-left:3px solid var(--bad); } .stat.bad .n { color:var(--bad); }
  .stat.hold { border-left:3px solid var(--warn); } .stat.hold .n { color:var(--warn); }

  /* Documento: índice a la izquierda, secciones a la derecha. */
  .doc { display:grid; grid-template-columns:15rem minmax(0,1fr); gap:36px; align-items:start; }
  .indice { position:sticky; top:20px; border:1px solid var(--border); border-radius:10px;
    background:var(--card); padding:6px 4px; max-height:calc(100vh - 40px); overflow:auto; }
  .indice > summary { display:none; }
  .indice ol { list-style:none; margin:0; padding:0; counter-reset:none; }
  .indice li { margin:0; }
  .indice li.corte { border-top:1px solid var(--border); margin:6px 10px; padding:0; }
  .indice a { display:flex; gap:8px; padding:6px 12px; border-radius:7px; font-size:13.5px;
    color:var(--fg); text-decoration:none; line-height:1.35; }
  .indice a:hover { background:var(--bg); color:var(--accent); }
  .indice a.aqui { background:var(--bg); font-weight:700; box-shadow:inset 3px 0 0 var(--accent); }
  .indice a .ix-n { color:var(--muted); font-variant-numeric:tabular-nums; min-width:1.1em; }
  .indice a.aqui .ix-n { color:var(--accent); }

  /* Título de sección: número grande al costado y línea de ancho completo. Tiene
     que leerse al hacer scroll rápido, no sólo al detenerse. */
  .sec { margin:0 0 38px; scroll-margin-top:16px; }
  .sec-tit { display:flex; align-items:baseline; gap:14px; margin:0 0 14px;
    padding-bottom:8px; border-bottom:1px solid var(--fg); font-size:19px; }
  .sec-n { font-size:30px; font-weight:800; color:var(--border); line-height:1;
    font-variant-numeric:tabular-nums; }
  .sec-tit .tip { margin-left:auto; }
  .sec-tit h2 { font-size:19px; margin:0; font-weight:700; }
  .sec p:first-of-type { margin-top:0; }

  /* El (?) por concepto: <details> y no popover con JS, así funciona impreso y sin
     scripts. Abre por clic, nunca por hover: en pantalla táctil no hay hover. */
  .tip { display:inline-block; position:relative; vertical-align:middle; }
  .tip > summary { list-style:none; cursor:help; width:17px; height:17px; border-radius:50%;
    border:1px solid var(--border); background:var(--bg); color:var(--muted);
    font-size:11px; font-weight:700; line-height:15px; text-align:center; }
  .tip > summary::-webkit-details-marker { display:none; }
  .tip > summary:hover { border-color:var(--accent); color:var(--accent); }
  .tip[open] > summary { background:var(--accent); color:#fff; border-color:var(--accent); }
  .tip-cuerpo { position:absolute; z-index:20; top:24px; left:0; width:22rem; max-width:80vw;
    background:var(--bg); border:1px solid var(--border); border-radius:10px; padding:12px 15px;
    box-shadow:0 8px 28px rgba(0,0,0,.14); font-size:13.5px; font-weight:400; text-align:left;
    color:var(--fg); }
  .tip-cuerpo p { margin:0 0 8px; }
  .tip-cuerpo p:last-child { margin:0; }
  .sec-tit .tip-cuerpo, .cards .tip-cuerpo { left:auto; right:0; }

  .controles { display:flex; gap:14px; align-items:center; flex-wrap:wrap; margin:0 0 12px;
    padding:10px 14px; background:var(--card); border:1px solid var(--border); border-radius:10px; }
  .controles label { font-size:13.5px; }
  .ctl-check { margin-right:-8px; }
  .ctl-n { color:var(--muted); }
  .ctl-buscar input { font:inherit; font-size:13.5px; padding:5px 10px; min-width:14rem;
    border:1px solid var(--border); border-radius:7px; background:var(--bg); color:var(--fg); }
  .ctl-agrupar { display:flex; gap:0; align-items:center; }
  .ctl-lab { font-size:13.5px; color:var(--muted); margin-right:8px; }
  .ctl-agrupar button { font:inherit; font-size:13px; padding:5px 11px; cursor:pointer;
    border:1px solid var(--border); background:var(--bg); color:var(--fg); margin-left:-1px; }
  .ctl-agrupar button:first-of-type { border-radius:7px 0 0 7px; margin-left:0; }
  .ctl-agrupar button:last-child { border-radius:0 7px 7px 0; }
  .ctl-agrupar button.on { background:#1a1a1a; color:#fff; border-color:#1a1a1a; }
  .ctl-agrupar button:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
  .ctl-conteo { margin:0 0 0 auto; font-size:13px; color:var(--muted); }

  ul.hallazgos { list-style:none; margin:0; padding:0; }
  li.h { border:1px solid var(--border); border-radius:9px; margin:0 0 6px; background:var(--bg); }
  li.h[data-bloquea="1"] { border-left:3px solid var(--bad); }
  li.h[data-bloquea="0"] { border-left:3px solid var(--warn); }
  li.h > details > summary { list-style:none; cursor:pointer; padding:9px 14px;
    display:flex; align-items:center; gap:9px; flex-wrap:wrap; font-size:13.5px; }
  li.h > details > summary::-webkit-details-marker { display:none; }
  li.h > details > summary::before { content:"▸"; color:var(--muted); font-size:11px; }
  li.h > details[open] > summary::before { content:"▾"; }
  li.h > details > summary:hover { background:var(--card); border-radius:8px; }
  .h-pais { color:var(--muted); }
  .h-donde { white-space:nowrap; }
  .h-col { font-size:12px; }
  .h-tit { font-weight:600; }
  .h-val { color:var(--muted); font-style:italic; max-width:22rem; overflow:hidden;
    text-overflow:ellipsis; white-space:nowrap; }
  .h-meta { display:flex; gap:6px; align-items:center; margin-left:auto; }
  .estado.no { font-size:11px; font-weight:700; color:var(--bad); white-space:nowrap; }
  .h-det { padding:0 14px 12px 34px; font-size:13.5px; }
  .h-det .msg { margin:0; }
  .h-det .fix { margin:6px 0 0; color:var(--muted); }

  .grupo { border:1px solid var(--border); border-radius:10px; margin:0 0 8px; overflow:hidden; }
  .grupo > summary { list-style:none; cursor:pointer; padding:11px 14px; background:var(--card);
    display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  .grupo > summary::-webkit-details-marker { display:none; }
  .grupo > summary::before { content:"▸"; color:var(--muted); font-size:11px; }
  .grupo[open] > summary::before { content:"▾"; }
  .grupo .g-tit { font-weight:700; }
  .grupo .g-n { color:var(--muted); font-size:13px; margin-left:auto; }
  .grupo .g-ayuda { padding:10px 14px 2px; font-size:13.5px; border-top:1px solid var(--border); }
  .grupo .g-ayuda p { margin:0 0 6px; }
  .grupo .g-ayuda .fix { color:var(--muted); }
  .grupo ul.hallazgos { padding:8px 10px 10px; }
  .vacio { color:var(--muted); font-style:italic; padding:14px 0; }

  /* Segundo nivel: una línea por inversión (o por regla, si el corte es por
     inversión), con los números de fila colapsados en rangos. No es desplegable a
     menos que haga falta: se abre sólo cuando los mensajes de sus filas difieren
     entre sí, que es cuando hay algo distinto que leer. */
  .sub { margin:0; padding:6px 12px 10px; }
  .sub-f { border-top:1px solid var(--border); }
  .sub-f:first-child { border-top:0; }
  .sub-l { display:flex; align-items:center; gap:9px; flex-wrap:wrap; padding:7px 4px;
    font-size:13.5px; }
  details.sub-f > summary.sub-l { cursor:pointer; list-style:none; }
  details.sub-f > summary.sub-l::-webkit-details-marker { display:none; }
  details.sub-f > summary.sub-l::before { content:"▸"; color:var(--muted); font-size:11px; }
  details.sub-f[open] > summary.sub-l::before { content:"▾"; }
  details.sub-f > summary.sub-l:hover { background:var(--card); border-radius:7px; }
  div.sub-f > .sub-l { padding-left:19px; }
  .sub-id { font-weight:700; }
  .sub-pais, .sub-inv { color:var(--muted); }
  .sub-filas { font-variant-numeric:tabular-nums; }
  .sub-meta { margin-left:auto; display:flex; gap:8px; align-items:center; }
  .sub-fix { flex:1 1 100%; color:var(--muted); font-size:13px; padding:0 4px 4px 19px; margin:0; }
  /* El mensaje del hallazgo, en la línea: dice qué columna está vacía o qué otra
     inversión se quedó con el id. Sin recortar, que es justo lo que se vino a ver. */
  .sub-msg { margin:0; padding:0 4px 8px 19px; font-size:13px; color:var(--fg); }
  .g-col { font-size:11.5px; padding:1px 6px; }
  .sub-f ul.hallazgos { padding:2px 0 8px 19px; }
  .sub-f ul.hallazgos li.h { border:0; border-left:2px solid var(--border); border-radius:0;
    margin:0 0 2px; }
  .sub-f ul.hallazgos li.h > details > summary { padding:5px 10px; }

  /* Plegables de referencia: la tira de archivos y la curación aplicada. */
  .plegable { border:1px solid var(--border); border-radius:10px; }
  .plegable > summary { cursor:pointer; padding:10px 14px; font-size:13.5px; list-style:none;
    display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
  .plegable > summary::-webkit-details-marker { display:none; }
  .plegable > summary::before { content:"▸"; color:var(--muted); font-size:11px; }
  .plegable[open] > summary::before { content:"▾"; }
  .plegable > summary:hover { background:var(--card); border-radius:9px; }
  .pleg-res { color:var(--muted); }
  .plegable .tira { margin:0; padding:0 12px 12px; }
  .tira { display:flex; flex-direction:column; gap:4px; }
  .tira-f { display:flex; align-items:center; gap:10px; flex-wrap:wrap; font-size:13.5px;
    padding:7px 12px; border:1px solid var(--border); border-radius:8px; }
  .tira-f.ok { border-left:3px solid var(--ok); }
  .tira-f.bad { border-left:3px solid var(--bad); }
  .tira-f.hold { border-left:3px solid var(--warn); }
  .tira-f .fname { font-weight:600; }
  .tira-det { color:var(--muted); margin-left:auto; }

  .curaciones { border-left:3px solid var(--ok); }
  .cur-f { padding:2px 14px 8px; font-size:13.5px; }
  .cur-f ul { margin:4px 0 0; padding-left:18px; color:var(--muted); }
  .excluidas { background:color-mix(in srgb,var(--warn) 10%,transparent); border-left:4px solid var(--warn);
    border-radius:8px; padding:10px 14px; font-size:13.5px; }
  .excluidas .ids { margin:6px 0 0; line-height:1.9; }
  .excluidas .ids-pais { color:var(--muted); }
  .excluidas .ids code { background:var(--bg); border:1px solid var(--border); border-radius:4px; padding:1px 6px; }
  .callout { background:var(--card); border-left:4px solid var(--accent); border-radius:6px;
    padding:14px 18px; margin:0 0 20px; }
  .pending tr.grave td { background:color-mix(in srgb,var(--bad) 12%,transparent); font-weight:600; }
  .pending .note { color:var(--muted); font-size:13px; margin:8px 0 0; }
  .onb-card { background:var(--card); border:1px solid var(--border); border-radius:8px;
    padding:12px 16px; margin:10px 0; }
  .onb-name { font-weight:700; font-size:15px; margin-bottom:6px; }
  .onb-gate { font-size:14px; margin:3px 0; }
  .onb-gate .box { font-family:monospace; font-weight:700; margin-right:6px; }
  .onb-gate .muted { color:var(--muted); }
  .file-errors { background:color-mix(in srgb,var(--bad) 8%,transparent); border-left:4px solid var(--bad);
    border-radius:8px; padding:10px 14px; font-size:14px; }
  .file-errors ul { margin:6px 0 0; padding-left:18px; }
  .fix-inline { color:var(--muted); }
  code { background:var(--card); border:1px solid var(--border); border-radius:4px;
    padding:1px 5px; font-size:.9em; }
  table { border-collapse:collapse; width:100%; margin:10px 0; }
  th,td { text-align:left; padding:8px 10px; border-bottom:1px solid var(--border); }
  td.num,th.num { text-align:right; font-variant-numeric:tabular-nums; }
  .overflow { overflow-x:auto; }
  .status { font-size:12px; font-weight:700; padding:2px 8px; border-radius:999px; }
  .status.ok { background:color-mix(in srgb,var(--ok) 18%,transparent); color:var(--ok); }
  .status.bad { background:color-mix(in srgb,var(--bad) 18%,transparent); color:var(--bad); }
  .status.hold { background:color-mix(in srgb,var(--warn) 18%,transparent); color:var(--warn); }
  .badge { font-size:11px; font-weight:600; padding:2px 8px; border-radius:999px;
    border:1px solid var(--border); white-space:nowrap; }
  .pill { font-size:10.5px; font-weight:700; padding:2px 8px; border-radius:5px;
    letter-spacing:.03em; text-transform:uppercase; white-space:nowrap; }
  .pill.block { background:var(--bad); color:#fff; }
  .pill.warn { background:color-mix(in srgb,var(--warn) 22%,transparent); color:var(--warn);
    border:1px solid color-mix(in srgb,var(--warn) 45%,transparent); }
  .b-formato { background:color-mix(in srgb,var(--accent) 15%,transparent); color:var(--accent); }
  .b-contenido { background:color-mix(in srgb,var(--bad) 12%,transparent); color:var(--bad); }
  .b-revisar { background:color-mix(in srgb,var(--warn) 15%,transparent); color:var(--warn); }
  .b-nuestro { background:color-mix(in srgb,var(--ok) 15%,transparent); color:var(--ok); }
  .b-inversores { background:color-mix(in srgb,var(--accent) 15%,transparent); color:var(--accent); }
  .ayuda-sec h3 { font-size:15px; margin:18px 0 4px; }
  .ayuda-sec h3:first-child { margin-top:0; }
  .ayuda-sec p { margin:0 0 8px; }
  .pasos { margin:12px 0 0; padding-left:20px; font-size:14px; }
  .pasos li { margin:0 0 10px; }
  .pasos li b { display:block; }
  .pasos li span { color:var(--muted); }
  .nota { font-size:13px; color:var(--muted); }
  footer { margin-top:40px; color:var(--muted); font-size:12px; border-top:1px solid var(--border); padding-top:16px; }

  /* Angosto: el índice se pliega arriba y ocupa un renglón. Sigue estando. */
  @media (max-width:900px) {
    .doc { grid-template-columns:minmax(0,1fr); gap:20px; }
    .indice { position:static; max-height:none; padding:0; }
    .indice > summary { display:flex; gap:8px; align-items:center; cursor:pointer;
      list-style:none; padding:10px 14px; font-size:13.5px; font-weight:600; }
    .indice > summary::-webkit-details-marker { display:none; }
    .indice > summary::before { content:"▸"; color:var(--muted); font-size:11px; }
    .indice[open] > summary::before { content:"▾"; }
    .indice ol { padding:0 4px 6px; }
  }
  @media (max-width:640px) {
    .wrap { padding:20px 14px 60px; }
    .ctl-conteo { margin-left:0; }
    .ctl-buscar { flex:1 1 100%; }
    .ctl-buscar input { min-width:0; width:100%; }
    .h-meta { margin-left:0; }
    .h-val { max-width:100%; }
    .tira-det { margin-left:0; flex:1 1 100%; }
    .sec-n { font-size:24px; }
    .tip-cuerpo { width:min(22rem,86vw); }
  }
`

/**
 * Mete el módulo de interacción adentro del informe, para que el archivo publicado
 * sea autocontenido. Vive acá y no en la cáscara del CLI porque tiene dos trampas
 * que ya se pagaron y no se ven al leer el resultado:
 *
 *  · `String.replace` con una CADENA de reemplazo interpreta `$$` como un `$`
 *    literal, así que el `$$` del módulo llegaba corrompido y el informe quedaba
 *    sin índice ni filtros, sin decir nada. Va con función de reemplazo.
 *  · Si el módulo llegara a contener una etiqueta de cierre de script, el navegador
 *    corta ahí. Se comprueba y se avisa fuerte en vez de publicar algo roto.
 *
 * @param {string} html lo que devolvió renderReport
 * @param {string} src código de scripts/lib/report_interact.mjs
 * @param {{fragment?: boolean}} [opts]
 * @returns {string}
 */
export const withInteract = (html, src, { fragment = false } = {}) => {
  if (/<\/script/i.test(src)) {
    throw new Error('report_interact.mjs contiene una etiqueta de cierre de script: cortaría el informe publicado por la mitad.')
  }
  const inline = `<script type="module">\n${src}\nwireReport(document)\n</script>`
  return fragment ? html + inline : html.replace('</body>', () => `${inline}</body>`)
}

/**
 * @param {Array} results por archivo: { name, fileErrors, issues, stats, curaciones, excludedIds, rows, published, error? }
 * @param {object} [opts]
 * @param {object|null} [opts.registry] registro de países (para el checklist de incorporación)
 * @param {Set<string>|null} [opts.countryBorders] alpha-3 con borde disponible
 * @param {string} [opts.now] marca de tiempo ya formateada
 * @param {boolean} [opts.fragment] emitir sólo <style> + body, sin el documento
 * @param {string|null} [opts.validatorHref] enlace al validador en el navegador. La página del
 *   validador usa este mismo render y ahí el aviso no va: ya estás adentro.
 * @param {Array<{id:string,label:string,html:string}>} [opts.extraSecciones] secciones que aporta el
 *   consumidor, al final y del lado de la referencia. El validador mete acá el instructivo de
 *   subida, que es suyo y no del informe.
 * @returns {string} HTML
 */
export const renderReport = (results, opts = {}) => {
  const {
    registry = null,
    countryBorders = null,
    now = new Date().toISOString().slice(0, 16).replace('T', ' '),
    fragment = false,
    validatorHref = null,
    extraSecciones = []
  } = opts

  const findings = buildFindings(results)
  const multiFile = results.length > 1

  // Conflictos conceptuales Area_EN vs Area_ES (por inversión única), sobre la base cruda.
  const sectorConflicts = []
  for (const r of results) {
    if (!r.rows) continue
    const seen = new Set()
    for (const row of r.rows) {
      const en = String(row.Area_EN ?? '').trim()
      const es = String(row.Area_ES ?? '').trim()
      if (!en || !es) continue
      const concept = conceptOf(es)
      if (concept && concept !== en) {
        const key = `${row.Id_Investment}|${en}|${es}`
        if (seen.has(key)) continue
        seen.add(key)
        sectorConflicts.push({
          file: r.name,
          id: String(row.Id_Investment ?? ''),
          en,
          es,
          concept,
          investor: String(row.Investor ?? '').trim(),
          // "grave" = país que ya está en la base (Area_EN es sector real, no el placeholder Construction)
          grave: en !== 'Construction'
        })
      }
    }
  }

  // Países en incorporación: país RECONOCIDO cuyo archivo todavía no se puede leer.
  const onboarding = results
    .filter((r) => !r.error && !r.stats.passed && !r.fileErrors.some((f) => f.rule === 'archivo/nombre'))
    .map((r) => {
      const a3 = alpha3ForFilename(registry, r.name)
      const hasBorder = !!(a3 && countryBorders && countryBorders.has(a3))
      const blockingRules = new Set(r.issues.filter((x) => x.severity === 'error').map((x) => x.rule))
      const blocking = blockingRules.size + r.fileErrors.filter((f) => f.rule !== 'archivo/sin-borde').length
      const tipos = [...blockingRules].map((rule) => (RULE_HELP[rule] || {}).titulo || rule)
      return { name: r.name, hasBorder, blocking, tipos }
    })

  const totalFiles = results.length
  const ilegibles = results.filter((r) => r.error || !r.stats?.passed).length
  const heldCount = results.filter((r) => !r.error && r.stats?.passed && r.published === false).length
  const totalRows = results.reduce((s, r) => s + (r.stats?.rows ?? 0), 0)
  const totalInvestments = results.reduce((s, r) => s + (r.stats?.investments ?? 0), 0)
  const totalExcluded = results.reduce((s, r) => s + (r.excludedIds?.length ?? 0), 0)
  const totalCuraciones = results.reduce((s, r) => s + (r.stats?.curaciones ?? 0), 0)
  const bloqueantes = findings.filter((f) => f.bloquea).length

  // Un solo veredicto, en una línea. Antes el estado se decía dos veces con
  // palabras distintas (arriba en el estado, abajo en el título de acciones).
  const veredicto = ilegibles
    ? {
        cls: 'bad',
        txt: `${ilegibles} archivo(s) no se pueden leer.`,
        sub: 'Hay que arreglar la estructura antes que nada: por ahora no entra ninguna de sus inversiones.'
      }
    : totalExcluded
      ? {
          cls: 'hold',
          txt: `Los archivos se leen bien. ${n(totalExcluded)} inversión(es) no se publican.`,
          sub: `Todo el resto entra al mapa. No hace falta esperar a tenerlo perfecto: son ${n(bloqueantes)} correccion(es) puntuales.`
        }
      : {
          cls: 'ok',
          txt: 'Todo en orden: los archivos se leen bien y todas las inversiones publican.',
          sub: findings.length ? `Quedan ${n(findings.length)} aviso(s), que no sacan nada del mapa.` : ''
        }

  // ---- Las secciones del documento, en orden ----
  const secciones = []

  if (ilegibles) {
    secciones.push({ id: 'ilegibles', label: 'Archivos que no se pueden leer', html: bloqueIlegibles(results) })
  }
  secciones.push({
    id: 'archivos',
    label: 'Estado por archivo',
    ayudaTip: heldCount ? AYUDA_RETENIDO : null,
    html: tiraArchivos(results)
  })
  if (totalExcluded) {
    secciones.push({
      id: 'excluidas',
      label: 'Inversiones que no publican',
      ayudaTip: AYUDA_ENTERA,
      html: bloqueExcluidas(results)
    })
  }
  secciones.push({
    id: 'revisar',
    label: 'Qué hay que revisar',
    ayudaTip: AYUDA_CATEGORIA,
    html: findings.length
      ? `${controles(findings, { multiFile })}
      <script type="application/json" id="reglas-meta">${JSON.stringify(reglasMeta(findings)).replace(/</g, '\\u003c')}</script>
      <div id="lista"><ul class="hallazgos">
        ${findings.map((f) => findingItem(f, { multiFile })).join('')}
      </ul></div>
      <p class="vacio" id="sin-resultados" hidden>Ningún hallazgo coincide con el filtro.</p>`
      : '<p class="vacio">Nada que revisar: ni un error ni un aviso.</p>'
  })
  if (totalCuraciones) {
    secciones.push({
      id: 'curaciones',
      label: 'Curación aplicada de nuestro lado',
      ayudaTip: AYUDA_CURACION,
      html: bloqueCuraciones(results)
    })
  }
  if (sectorConflicts.length) {
    secciones.push({
      id: 'sector',
      label: 'Sector en conflicto',
      html: `<div class="pending">
        <p>No es un problema de formato. En estas inversiones las dos columnas de sector apuntan a
        categorías <strong>conceptualmente distintas</strong>: una de las dos está mal y no se puede
        saber cuál sin criterio del equipo.</p>
        <div class="overflow"><table>
          <thead><tr><th>Archivo</th><th>Id</th><th>Area_EN</th><th>Area_ES</th><th>Inversor</th></tr></thead>
          <tbody>${sectorConflicts
            .sort((a, b) => Number(b.grave) - Number(a.grave))
            .map(
              (c) =>
                `<tr class="${c.grave ? 'grave' : ''}"><td>${esc(c.file)}</td><td>${esc(c.id)}</td><td>${esc(c.en)}</td><td>${esc(c.es)}</td><td>${esc(c.investor)}</td></tr>`
            )
            .join('')}</tbody>
        </table></div>
        <p class="note">Filas resaltadas = país que ya está en la base (sector real en conflicto). El
        resto son países en incorporación con <code>Area_EN=Construction</code> como marcador
        provisional.</p>
      </div>`
    })
  }
  if (onboarding.length) {
    secciones.push({
      id: 'incorporacion',
      label: 'Países en incorporación',
      html: `<p>Estos países están reconocidos pero todavía no entran al mapa. Para incorporarse
        necesitan dos cosas: la <strong>geometría de borde</strong> (la cargamos nosotros) y el
        <strong>archivo de datos legible</strong>. Cuando ambas estén ✓, el país entra
        automáticamente.</p>
        ${onboarding
          .map(
            (o) => `<div class="onb-card">
            <div class="onb-name">${esc(o.name.replace(/\.xlsx$/, ''))}</div>
            <div class="onb-gate"><span class="box">${o.hasBorder ? '✓' : '☐'}</span> Geometría de país ${o.hasBorder ? '' : '<span class="muted">— falta el borde (lo cargamos nosotros)</span>'}</div>
            <div class="onb-gate"><span class="box">${o.blocking === 0 ? '✓' : '☐'}</span> Archivo legible ${o.blocking === 0 ? '' : `<span class="muted">— ${o.blocking} problema(s) de estructura${o.tipos.length ? ': ' + esc(o.tipos.join(', ')) : ''}</span>`}</div>
          </div>`
          )
          .join('')}`
    })
  }

  // De acá para abajo es referencia: se consulta, no se trabaja. El índice lo
  // separa con una línea, así que está a un clic sin estorbar el trabajo.
  const primeraReferencia = secciones.length
  for (const s of extraSecciones) secciones.push({ ...s, referencia: true })
  secciones.push({
    id: 'leer',
    label: 'Cómo se lee este informe',
    referencia: true,
    html: `<div class="ayuda-sec">
      <h3>Bloquea o avisa</h3>
      ${AYUDA_BLOQUEA}
      <h3>Por qué sale la inversión entera</h3>
      ${AYUDA_ENTERA}
      <h3>La categoría dice de quién es el arreglo</h3>
      ${AYUDA_CATEGORIA}
      <h3>Curación automática</h3>
      ${AYUDA_CURACION}
      <h3>Validar y publicar son cosas distintas</h3>
      ${AYUDA_RETENIDO}
    </div>`
  })

  const indice = `
  <details class="indice" id="indice" open>
    <summary>Índice</summary>
    <nav aria-label="Secciones del informe">
      <ol>
        ${secciones
          .map(
            (s, i) =>
              `${i === primeraReferencia && i > 0 ? '<li class="corte" aria-hidden="true"></li>' : ''}
          <li><a href="#sec-${att(s.id)}" data-ix="${att(s.id)}"><span class="ix-n">${i + 1}</span><span>${esc(s.label)}</span></a></li>`
          )
          .join('')}
      </ol>
    </nav>
  </details>`

  const cuerpo = secciones
    .map(
      (s, i) => `
    <section class="sec" id="sec-${att(s.id)}">
      <div class="sec-tit">
        <span class="sec-n">${i + 1}</span>
        <h2>${esc(s.label)}</h2>
        ${s.ayudaTip ? tip(s.ayudaTip) : ''}
      </div>
      ${s.html}
    </section>`
    )
    .join('')

  const body = `
<div class="wrap" id="informe">
  <h1>Informe de validación de datos</h1>
  <p class="sub">Base por país del repositorio · ${totalFiles} archivo(s) · generado ${now}</p>

  ${
    validatorHref
      ? `<div class="callout">
    <strong>Este informe se genera cuando el archivo ya está en el repositorio</strong>, así que no
    alcanza a avisarte antes de mandarlo. Para revisar el tuyo <em>mientras lo estás editando</em>,
    abrí el <a href="${validatorHref}">validador</a>: es el mismo chequeo, con las mismas reglas, y
    el archivo no se sube a ningún lado, se lee en tu propio navegador.
  </div>`
      : ''
  }

  <div class="veredicto ${veredicto.cls}">${veredicto.txt}${veredicto.sub ? `<span class="det">${veredicto.sub}</span>` : ''}</div>

  <div class="cards">
    <div class="stat"><div class="n">${n(totalInvestments)}</div><div class="l">inversiones</div></div>
    <div class="stat"><div class="n">${n(totalRows)}</div><div class="l">filas</div></div>
    <div class="stat ${totalExcluded ? 'hold' : 'ok'}"><div class="n">${n(totalExcluded)}</div><div class="l">no publican${totalExcluded ? tip(AYUDA_ENTERA) : ''}</div></div>
    ${ilegibles ? `<div class="stat bad"><div class="n">${ilegibles}</div><div class="l">no se pueden leer</div></div>` : ''}
    ${heldCount ? `<div class="stat hold"><div class="n">${heldCount}</div><div class="l">países retenidos${tip(AYUDA_RETENIDO)}</div></div>` : ''}
    ${totalCuraciones ? `<div class="stat"><div class="n">${n(totalCuraciones)}</div><div class="l">curaciones auto${tip(AYUDA_CURACION)}</div></div>` : ''}
  </div>

  <div class="doc">
    ${indice}
    <main class="cuerpo">${cuerpo}</main>
  </div>

  <footer>
    <strong>PASA</strong> = el archivo se lee y entra al mapa · <strong>PASA · PARCIAL</strong> =
    entra, menos las inversiones listadas · <strong>PASA · RETENIDO</strong> = está bien pero ICLAC
    todavía no lo publica · <strong>NO SE PUEDE LEER</strong> = hay que arreglar la estructura antes
    que nada.
  </footer>
</div>`

  return fragment
    ? `<style>${style}</style>${body}`
    : `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Informe de validación de datos</title><link rel="icon" href="${FAVICON}"><style>${style}</style></head><body>${body}</body></html>`
}
