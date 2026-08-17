// Render del informe de validación — PURO, sin I/O.
//
// Vive aparte de scripts/build_validation_report.mjs (que es la cáscara que lee
// los xlsx y escribe el archivo) para que la página del validador que corre en el
// navegador use ESTE mismo render y no una copia parecida. Un informe con dos
// implementaciones diverge, y este repositorio ya pagó esa lección con los dos
// generadores del mapa de inversores.
//
// FORMA: una LISTA DE HALLAZGOS, no un acordeón por país. La estructura por país
// venía de la CI, donde lo normal son 17 archivos de una; quien valida abre uno.
// Y con la compuerta por inversión el país dejó de ser la unidad de nada: la
// unidad de la acción es la fila y la de la consecuencia es la inversión. Agrupar
// es un CONTROL, no la estructura.
//
// Se emite la vista por defecto ya armada en HTML y el JavaScript sólo mejora
// (filtra, reagrupa, arma las pestañas). Sin JS esto sigue siendo un documento
// legible e imprimible, que es la mitad de la razón de ser del informe publicado.
import { alpha3ForFilename } from './countries.mjs'
import { SECTOR_PAIRS } from './validate.mjs'
import { RULE_HELP, tipoBadge } from './rules_help.mjs'
import { buildFindings } from './findings.mjs'

// Por encima de esto la lista arranca agrupada por regla, porque una lista plana
// de miles de renglones no se navega. No se recorta nada: el JS sólo la pliega, y
// sin JS salen todos igual.
const AUTOGROUP_OVER = 1000

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

// ---- Hallazgos ----

const sevPill = (bloquea) =>
  bloquea
    ? '<span class="pill block" title="Saca del mapa la inversión de esta fila; el resto del archivo se publica igual">Bloquea</span>'
    : '<span class="pill warn" title="No saca nada del mapa: es algo a revisar">Aviso</span>'

/**
 * Un hallazgo. La línea de arriba es densa y de un renglón, y el detalle (qué
 * pasa y cómo se corrige) va adentro de un <details>: repetir el mismo "cómo se
 * corrige" en las 70 filas de un mismo error es el muro de texto que esta vista
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
        data-buscar="${att(buscar)}">
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

const controles = (findings, { multiFile }) => {
  const bloqueantes = findings.filter((f) => f.bloquea).length
  return `
  <div class="controles" data-total="${findings.length}" data-bloqueantes="${bloqueantes}">
    <label class="ctl-check"><input type="checkbox" id="solo-bloqueantes"> Solo bloqueantes
      <span class="ctl-n">(${n(bloqueantes)})</span></label>
    <label class="ctl-buscar"><span class="vh">Buscar</span>
      <input type="search" id="buscar" placeholder="Buscar por id, fila, columna…"></label>
    <div class="ctl-agrupar" role="group" aria-label="Agrupar hallazgos">
      <span class="ctl-lab">Agrupar:</span>
      <button type="button" data-group="nada" class="on">Nada</button>
      <button type="button" data-group="regla">Regla</button>
      <button type="button" data-group="id">Inversión</button>
      ${multiFile ? '<button type="button" data-group="pais">País</button>' : ''}
    </div>
    <p class="ctl-conteo" id="conteo">${n(findings.length)} hallazgo(s)</p>
  </div>`
}

// ---- Bloques que sobreviven del informe viejo ----

// `corto` es para el resumen plegado: ahí los rótulos van separados por " · " y
// los largos ya traen un " · " adentro, así que "7 PASA · PARCIAL · 10 PASA"
// no se puede leer.
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
  <details class="tira-plegada">
    <summary><b>${results.length} archivos</b> <span class="tira-res">${esc(resumen)}</span></summary>
    <div class="tira">${filas}</div>
  </details>`
}

const bloqueIlegibles = (results) => {
  const malos = results.filter((r) => r.error || !r.stats?.passed)
  if (!malos.length) return ''
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
  if (!conExcluidas.length) return ''
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
    <p class="fix">Sale la inversión entera y no sólo la fila con el problema: una inversión son
    varios puntos, y publicar la mitad de un trazado o perder la fila que trae el monto sería una
    pérdida que no se ve.</p>
  </div>`
}

const bloqueCuraciones = (results) => {
  const conCuraciones = results.filter((r) => r.curaciones?.length)
  if (!conCuraciones.length) return ''
  return `
  <div class="curaciones">
    <strong>Curación aplicada de nuestro lado</strong> (automática, sin pérdida, y listada acá porque
    se corrige a la vista y no a escondidas):
    ${conCuraciones
      .map(
        (r) =>
          `<ul><li><b>${esc(r.name)}</b><ul>${r.curaciones.map((c) => `<li>${esc(c.message)}</li>`).join('')}</ul></li></ul>`
      )
      .join('')}
  </div>`
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
  .wrap { max-width:1040px; margin:0 auto; padding:32px 20px 80px; }
  h1 { font-size:26px; margin:0 0 4px; }
  h2 { font-size:19px; margin:32px 0 12px; padding-bottom:6px; border-bottom:1px solid var(--border); }
  .sub { color:var(--muted); margin:0 0 20px; }
  .vh { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }

  .veredicto { font-size:17px; font-weight:600; border-radius:10px; padding:14px 18px; margin:0 0 16px;
    border:1px solid var(--border); border-left:4px solid var(--muted); background:var(--card); }
  .veredicto.ok { border-left-color:var(--ok); }
  .veredicto.hold { border-left-color:var(--warn); }
  .veredicto.bad { border-left-color:var(--bad); }
  .veredicto span { display:block; font-size:14px; font-weight:400; color:var(--muted); margin-top:4px; }

  .cards { display:flex; gap:12px; flex-wrap:wrap; margin:0 0 20px; }
  .stat { background:var(--card); border:1px solid var(--border); border-radius:10px;
    padding:12px 16px; min-width:110px; }
  .stat .n { font-size:24px; font-weight:700; }
  .stat .l { color:var(--muted); font-size:13px; }
  .stat.ok { border-left:3px solid var(--ok); } .stat.ok .n { color:var(--ok); }
  .stat.bad { border-left:3px solid var(--bad); } .stat.bad .n { color:var(--bad); }
  .stat.hold { border-left:3px solid var(--warn); } .stat.hold .n { color:var(--warn); }

  .tabs { display:flex; gap:4px; border-bottom:1px solid var(--border); margin:0 0 18px; flex-wrap:wrap; }
  .tabs button { font:inherit; font-size:14px; font-weight:600; background:none; cursor:pointer;
    border:1px solid transparent; border-bottom:none; border-radius:8px 8px 0 0;
    padding:9px 16px; color:var(--muted); margin-bottom:-1px; }
  .tabs button:hover { color:var(--accent); }
  .tabs button[aria-selected="true"] { color:var(--fg); background:var(--bg);
    border-color:var(--border); }
  .tabs button:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
  .panel > h2:first-child { margin-top:0; }

  .controles { display:flex; gap:14px; align-items:center; flex-wrap:wrap; margin:0 0 12px;
    padding:10px 14px; background:var(--card); border:1px solid var(--border); border-radius:10px; }
  .controles label { font-size:13.5px; }
  .ctl-n { color:var(--muted); }
  .ctl-buscar input { font:inherit; font-size:13.5px; padding:5px 10px; min-width:15rem;
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
  .autogroup { background:color-mix(in srgb,var(--accent) 8%,transparent); border:1px solid var(--border);
    border-radius:8px; padding:10px 14px; margin:0 0 12px; font-size:13.5px; }
  .vacio { color:var(--muted); font-style:italic; padding:14px 0; }

  .tira-plegada { margin:0 0 18px; border:1px solid var(--border); border-radius:10px; }
  .tira-plegada > summary { cursor:pointer; padding:10px 14px; font-size:13.5px; list-style:none;
    display:flex; gap:10px; align-items:center; }
  .tira-plegada > summary::-webkit-details-marker { display:none; }
  .tira-plegada > summary::before { content:"▸"; color:var(--muted); font-size:11px; }
  .tira-plegada[open] > summary::before { content:"▾"; }
  .tira-plegada > summary:hover { background:var(--card); border-radius:9px; }
  .tira-res { color:var(--muted); }
  .tira-plegada .tira { margin:0; padding:0 12px 12px; }
  .tira { display:flex; flex-direction:column; gap:4px; margin:0 0 18px; }
  .tira-f { display:flex; align-items:center; gap:10px; flex-wrap:wrap; font-size:13.5px;
    padding:7px 12px; border:1px solid var(--border); border-radius:8px; }
  .tira-f.ok { border-left:3px solid var(--ok); }
  .tira-f.bad { border-left:3px solid var(--bad); }
  .tira-f.hold { border-left:3px solid var(--warn); }
  .tira-f .fname { font-weight:600; }
  .tira-det { color:var(--muted); margin-left:auto; }

  .curaciones { background:color-mix(in srgb,var(--ok) 8%,transparent); border-radius:8px;
    padding:10px 14px; margin:14px 0; font-size:13.5px; }
  .curaciones ul { margin:6px 0 0; padding-left:18px; color:var(--muted); }
  .excluidas { background:color-mix(in srgb,var(--warn) 10%,transparent); border-left:4px solid var(--warn);
    border-radius:8px; padding:10px 14px; margin:14px 0; font-size:13.5px; }
  .excluidas .ids { margin:6px 0 0; line-height:1.9; }
  .excluidas .ids-pais { color:var(--muted); }
  .excluidas .ids code { background:var(--bg); border:1px solid var(--border); border-radius:4px; padding:1px 6px; }
  .excluidas .fix { margin:8px 0 0; color:var(--muted); font-size:13px; }
  .callout { background:var(--card); border-left:4px solid var(--accent); border-radius:6px;
    padding:14px 18px; margin:16px 0; }
  .pending { background:color-mix(in srgb,var(--warn) 9%,transparent); border:1px solid var(--border);
    border-left:4px solid var(--warn); border-radius:8px; padding:6px 20px 16px; margin:18px 0; }
  .pending tr.grave td { background:color-mix(in srgb,var(--bad) 12%,transparent); font-weight:600; }
  .pending .note { color:var(--muted); font-size:13px; margin:8px 0 0; }
  .onboarding { background:color-mix(in srgb,var(--accent) 7%,transparent); border:1px solid var(--border);
    border-left:4px solid var(--accent); border-radius:8px; padding:6px 20px 16px; margin:18px 0; }
  .onb-card { background:var(--bg); border:1px solid var(--border); border-radius:8px;
    padding:12px 16px; margin:10px 0; }
  .onb-name { font-weight:700; font-size:15px; margin-bottom:6px; }
  .onb-gate { font-size:14px; margin:3px 0; }
  .onb-gate .box { font-family:monospace; font-weight:700; margin-right:6px; }
  .onb-gate .muted { color:var(--muted); }
  .file-errors { background:color-mix(in srgb,var(--bad) 8%,transparent); border-left:4px solid var(--bad);
    border-radius:8px; padding:10px 14px; margin:0 0 16px; font-size:14px; }
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
  footer { margin-top:40px; color:var(--muted); font-size:12px; border-top:1px solid var(--border); padding-top:16px; }

  /* Pasos del instructivo. Los estilos viven acá y no en el validador porque el
     panel lo dibuja este render: el consumidor aporta el contenido, no el CSS. */
  .pasos { margin:12px 0 0; padding-left:20px; font-size:14px; }
  .pasos li { margin:0 0 10px; }
  .pasos li b { display:block; }
  .pasos li span { color:var(--muted); }
  .nota { font-size:13px; color:var(--muted); }

  @media (max-width:640px) {
    .wrap { padding:20px 14px 60px; }
    .controles { gap:10px; }
    .ctl-conteo { margin-left:0; }
    .ctl-buscar input { min-width:0; width:100%; }
    .ctl-buscar { flex:1 1 100%; }
    .h-meta { margin-left:0; }
    .h-val { max-width:100%; }
    .tira-det { margin-left:0; flex:1 1 100%; }
  }
`

/**
 * Mete el módulo de interacción adentro del informe, para que el archivo publicado
 * sea autocontenido. Vive acá y no en la cáscara del CLI porque tiene dos trampas
 * que ya se pagaron y no se ven al leer el resultado:
 *
 *  · `String.replace` con una CADENA de reemplazo interpreta `$$` como un `$`
 *    literal, así que el `$$` del módulo llegaba corrompido y el informe quedaba
 *    sin pestañas ni filtros, sin decir nada. Va con función de reemplazo.
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
 * @param {Array<{id:string,label:string,html:string}>} [opts.extraTabs] pestañas que aporta el
 *   consumidor. El validador mete acá el instructivo de subida, que es suyo y no del informe.
 * @returns {string} HTML
 */
export const renderReport = (results, opts = {}) => {
  const {
    registry = null,
    countryBorders = null,
    now = new Date().toISOString().slice(0, 16).replace('T', ' '),
    fragment = false,
    validatorHref = null,
    extraTabs = []
  } = opts

  const findings = buildFindings(results)
  const multiFile = results.length > 1
  const autoGroup = findings.length > AUTOGROUP_OVER

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

  const tabs = [
    { id: 'resultado', label: 'Resultado' },
    ...extraTabs.map((t) => ({ id: t.id, label: t.label })),
    { id: 'leer', label: 'Cómo se lee esto' }
  ]

  const panelResultado = `
  ${bloqueIlegibles(results)}
  ${tiraArchivos(results)}
  ${bloqueExcluidas(results)}

  <h2>Qué hay que revisar</h2>
  ${
    findings.length
      ? `${
          autoGroup
            ? `<p class="autogroup">Son ${n(findings.length)} hallazgos, así que la lista arranca
               plegada por regla. No se recortó ninguno: cada grupo se abre y muestra todos sus casos.</p>`
            : ''
        }
      ${controles(findings, { multiFile })}
      <script type="application/json" id="reglas-meta">${JSON.stringify(reglasMeta(findings)).replace(/</g, '\\u003c')}</script>
      <div id="lista"><ul class="hallazgos" data-autogroup="${autoGroup ? 1 : 0}">
        ${findings.map((f) => findingItem(f, { multiFile })).join('')}
      </ul></div>
      <p class="vacio" id="sin-resultados" hidden>Ningún hallazgo coincide con el filtro.</p>`
      : '<p class="vacio">Nada que revisar: ni un error ni un aviso.</p>'
  }

  ${bloqueCuraciones(results)}

  ${
    sectorConflicts.length
      ? `<div class="pending">
    <h2 style="border:0;margin-top:8px">Para revisar: sector en conflicto (Area_EN ≠ Area_ES)</h2>
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
      : ''
  }

  ${
    onboarding.length
      ? `<div class="onboarding">
    <h2 style="border:0;margin-top:8px">Países en incorporación</h2>
    <p>Estos países están reconocidos pero todavía no entran al mapa. Para incorporarse necesitan
    dos cosas: la <strong>geometría de borde</strong> (la cargamos nosotros) y el <strong>archivo de
    datos legible</strong>. Cuando ambas estén ✓, el país entra automáticamente.</p>
    ${onboarding
      .map(
        (o) => `<div class="onb-card">
        <div class="onb-name">${esc(o.name.replace(/\.xlsx$/, ''))}</div>
        <div class="onb-gate"><span class="box">${o.hasBorder ? '✓' : '☐'}</span> Geometría de país ${o.hasBorder ? '' : '<span class="muted">— falta el borde (lo cargamos nosotros)</span>'}</div>
        <div class="onb-gate"><span class="box">${o.blocking === 0 ? '✓' : '☐'}</span> Archivo legible ${o.blocking === 0 ? '' : `<span class="muted">— ${o.blocking} problema(s) de estructura${o.tipos.length ? ': ' + esc(o.tipos.join(', ')) : ''}</span>`}</div>
      </div>`
      )
      .join('')}
  </div>`
      : ''
  }`

  // Todo el texto explicativo vive acá, en su propia pestaña. Antes eran cuatro
  // callouts apilados arriba del resultado, unos cuarenta renglones idénticos en
  // cada validación, que es lo que hace que un texto deje de leerse.
  const panelLeer = `
  <h2>Bloquea o avisa</h2>
  <p>Cada hallazgo es <span class="pill block">Bloquea</span> o <span class="pill warn">Aviso</span>.
  Un bloqueante <strong>no bota el archivo</strong>: saca del mapa la <em>inversión</em> a la que
  pertenece esa fila, y el resto del archivo se publica igual. Los avisos no sacan nada.</p>

  <h2>Por qué sale la inversión entera</h2>
  <p>Una inversión son varias filas, una por punto en el mapa. Botar sólo la fila con el problema
  publicaría medio trazado, o perdería la fila que trae el monto, las dos en silencio. Por eso la
  unidad es la inversión.</p>

  <h2>Lo único que bota un archivo entero</h2>
  <p>No poder interpretarlo: un nombre que no corresponde a ningún país del proyecto, más de una
  hoja, o una columna obligatoria que no está. Nada de lo que digan las celdas bota un archivo.</p>

  <h2>La categoría dice de quién es el arreglo</h2>
  <p><span class="badge b-formato">Formato</span> es cómo está escrito el dato;
  <span class="badge b-contenido">Contenido</span> es qué dice, y necesita criterio;
  <span class="badge b-revisar">Revisar</span> pide mirar la fuente;
  <span class="badge b-nuestro">Lo resolvemos nosotros</span> no requiere acción de tu lado;
  <span class="badge b-inversores">Encargado de la tabla de inversores</span> es la cola de ese rol.
  <strong>No dice si bloquea</strong>: esa es la otra pregunta, y confundirlas hace que el informe se
  lea como una lista de culpas.</p>

  <h2>Curación automática</h2>
  <p>Los problemas de <strong>formato</strong> deterministas y sin pérdida se arreglan de nuestro
  lado: el apóstrofe en <code>COUNTRY_ISO_NUM</code>, el país en MAYÚSCULAS, y el nombre del archivo
  (vale el nombre del país o cualquiera de sus variantes, así que no hay que renombrarlo). Cada
  arreglo queda listado en el resultado: se corrige a la vista, no a escondidas.</p>

  <h2>Pasar el validador y publicarse son cosas distintas</h2>
  <p>Un archivo puede cumplir el esquema y aun así no salir en el mapa, porque el país está marcado
  como retenido en <code>data/schema/countries.csv</code>. Es una decisión editorial de ICLAC, no un
  problema del archivo.${heldCount ? ` Hoy hay ${heldCount} en esa situación.` : ''}</p>`

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

  <div class="veredicto ${veredicto.cls}">${veredicto.txt}${veredicto.sub ? `<span>${veredicto.sub}</span>` : ''}</div>

  <div class="cards">
    <div class="stat"><div class="n">${n(totalInvestments)}</div><div class="l">inversiones</div></div>
    <div class="stat"><div class="n">${n(totalRows)}</div><div class="l">filas</div></div>
    <div class="stat ${totalExcluded ? 'hold' : 'ok'}"><div class="n">${n(totalExcluded)}</div><div class="l">no publican</div></div>
    ${ilegibles ? `<div class="stat bad"><div class="n">${ilegibles}</div><div class="l">no se pueden leer</div></div>` : ''}
    ${heldCount ? `<div class="stat hold"><div class="n">${heldCount}</div><div class="l">países retenidos</div></div>` : ''}
    ${totalCuraciones ? `<div class="stat"><div class="n">${n(totalCuraciones)}</div><div class="l">curaciones auto</div></div>` : ''}
  </div>

  <div class="tabs" role="tablist">
    ${tabs
      .map(
        (t, i) =>
          `<button type="button" role="tab" data-tab="${att(t.id)}" aria-selected="${i === 0}" aria-controls="panel-${att(t.id)}">${esc(t.label)}</button>`
      )
      .join('')}
  </div>

  <section class="panel" id="panel-resultado" data-panel="resultado" role="tabpanel">${panelResultado}</section>
  ${extraTabs
    .map(
      (t) =>
        `<section class="panel" id="panel-${att(t.id)}" data-panel="${att(t.id)}" role="tabpanel">${t.html}</section>`
    )
    .join('')}
  <section class="panel" id="panel-leer" data-panel="leer" role="tabpanel">${panelLeer}</section>

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
