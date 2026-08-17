// Validador en el navegador. El archivo nunca sale de la máquina de quien lo usa.
//
// La razón de existir: el informe de GitHub Pages sólo puede generarse DESPUÉS de
// que el archivo pasa por nosotros, así que nunca alcanza a atrapar nada antes del
// envío y cada corrección da la vuelta completa por correo. Acá el chequeo ocurre
// mientras el archivo todavía está abierto en Excel.
//
// REGLA: esta página NO reimplementa nada. Importa el mismo núcleo
// (scripts/lib/validate.mjs), el mismo render (scripts/lib/report_render.mjs) y la
// misma interacción (scripts/lib/report_interact.mjs) que usan el CLI y la CI. Si
// alguna vez hay dos implementaciones, divergen — este repositorio ya pagó esa
// lección con los dos generadores del mapa de inversores.
import * as XLSX from 'xlsx'
import { validateRows } from '../scripts/lib/validate.mjs'
import { renderReport } from '../scripts/lib/report_render.mjs'
import { wireReport } from '../scripts/lib/report_interact.mjs'
import { alpha3ForFilename } from '../scripts/lib/countries.mjs'
import { buildPendientesWorkbook, nombrePendientes } from '../scripts/lib/pendientes.mjs'
import { parseExpectedCounts, countInvestments, checkCounts } from '../scripts/lib/count_guard.mjs'
import {
  PRIMERA_VEZ, CADA_VEZ, QUE_NO_TOCAR, RED_DE_SEGURIDAD, urlSubida, urlCarpeta, CARPETA_DATOS
} from './instructivo.js'
import {
  buildRegistry,
  parseInvestorMap,
  countryBoundsFrom,
  countryBordersFrom
} from '../scripts/lib/registry_parse.mjs'

// Los archivos de referencia se empaquetan en el bundle en vez de pedirse por
// fetch: así la página es un solo archivo, no puede fallar por un 404 y queda
// congelada en la MISMA versión del registro con la que se construyó el sitio.
import countriesCsv from '../data/schema/countries.csv?raw'
import investorsCsv from '../data/schema/investors_map.csv?raw'
import expectedCountsCsv from '../data/schema/expected_counts.csv?raw'
import bordersGeojson from '../data/sources/geo/borders.geojson?raw'

const registry = buildRegistry(countriesCsv)
const investorMap = parseInvestorMap(investorsCsv)
const geo = JSON.parse(bordersGeojson)
const countryBounds = countryBoundsFrom(registry, geo)
const countryBorders = countryBordersFrom(registry, geo)
const expectedCounts = parseExpectedCounts(expectedCountsCsv)

const $drop = document.getElementById('drop')
const $file = document.getElementById('file')
const $cargando = document.getElementById('cargando')
const $files = document.getElementById('files')
const $report = document.getElementById('report')
const $again = document.getElementById('again')
const $reset = document.getElementById('reset')
const $acciones = document.getElementById('acciones')

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const pasos = (items) =>
  `<ol class="pasos">${items.map((p) => `<li><b>${esc(p.titulo)}</b><span>${esc(p.cuerpo)}</span></li>`).join('')}</ol>`

// El instructivo es una PESTAÑA del informe, no un bloque más en la página. Antes
// vivía en <details> debajo de las acciones y se releía entero en cada validación.
// El contenido es del validador; la pestaña la dibuja el render compartido.
const panelSubida = () => `
  <h2>La primera vez</h2>
  ${pasos(PRIMERA_VEZ)}
  <p class="nota">La carpeta es <a href="${urlCarpeta()}" target="_blank" rel="noopener"><code>${CARPETA_DATOS}</code></a>.</p>
  <h2>Cada vez</h2>
  ${pasos(CADA_VEZ)}
  <h2>Qué conviene no tocar</h2>
  <ul>${QUE_NO_TOCAR.map((t) => `<li>${t}</li>`).join('')}</ul>
  <h2>La red de seguridad</h2>
  <p>${esc(RED_DE_SEGURIDAD)}</p>`

// ---- Guardia de caída brusca, movida a ANTES de subir ----
//
// El accidente que esto atrapa —soltar un archivo con pocas inversiones creyendo
// que se suman a las que ya hay— pasa las cuatro compuertas: el dato es válido,
// sólo que hay menos. Hasta ahora lo detectaba el build, o sea después de haber
// publicado, y el aviso era un log de CI que alguien tenía que ir a leer.
const problemasDeCaida = (results) => {
  const actual = {}
  for (const r of results) {
    if (r.error) continue
    const a3 = alpha3ForFilename(registry, r.name)
    if (a3) actual[a3] = countInvestments(r.rows)
  }
  // Acotar la línea base a lo que se soltó. Sin esto, validar UN archivo marcaría
  // los otros dieciséis países como "archivo ausente", que es exactamente el
  // validador que grita sobre datos correctos y deja de leerse.
  const base = {}
  for (const a3 of Object.keys(actual)) if (a3 in expectedCounts) base[a3] = expectedCounts[a3]
  return checkCounts(base, actual).problems
}

const nombreDe = (a3, results) => {
  const r = results.find((x) => !x.error && alpha3ForFilename(registry, x.name) === a3)
  return r ? r.name.replace(/\.xlsx$/i, '') : a3
}

const avisoCaida = (problems, results) => {
  if (!problems.length) return ''
  return `
  <div class="caida">
    <strong>Ojo: esto saca inversiones que hoy están publicadas.</strong>
    <ul>${problems
      .map((p) => {
        const pais = esc(nombreDe(p.alpha3, results))
        const quedan = p.after === 1 ? 'quedaría 1' : `quedarían ${p.after}`
        const trae = p.after === 1 ? 'trae 1' : `trae ${p.after}`
        return `<li><b>${pais}</b> tiene hoy ${p.before} inversiones en el repositorio y este archivo
          ${trae}. Subirlo <strong>reemplaza</strong> el archivo: ${quedan}.</li>`
      })
      .join('')}</ul>
    <p class="que-hacer">Si querés <strong>agregar</strong> inversiones, el archivo que subís tiene que
    traer también las que ya estaban: la subida reemplaza, no suma. Si el archivo de verdad es más
    chico porque así lo decidieron, hay que avisarnos para declarar la línea base nueva; si no, el
    build se detiene y el sitio se queda con los datos anteriores.</p>
  </div>`
}

// Qué mostrar después del informe. El instructivo aparece cuando es accionable, no
// como muro de texto: si el archivo no se puede leer todavía, ofrecer el botón de
// subir sería mandarla a romper el sitio.
const renderAcciones = (results) => {
  const ilegibles = results.filter((r) => r.error || !r.stats?.passed)
  const excluidas = results.reduce((n, r) => n + (r.excludedIds?.length ?? 0), 0)
  const hayPendientes = results.some((r) => (r.issues ?? []).some((i) => i.severity !== 'info') || r.fileErrors?.length)
  const caidas = ilegibles.length ? [] : problemasDeCaida(results)

  const descarga = hayPendientes
    ? '<button type="button" class="secondary" id="bajar-pendientes">Bajar la lista de pendientes</button>'
    : ''

  if (ilegibles.length) {
    $acciones.innerHTML = `
      <h2>Todavía no se puede subir</h2>
      <p class="lede">${ilegibles.length} archivo(s) no se pueden leer, así que ninguna de sus inversiones
        entraría. Eso se arregla primero; el detalle está abajo.</p>
      <div class="cta">${descarga}</div>
      <p class="nota">Los otros archivos, si los hay, sí se pueden subir.</p>`
  } else {
    const titulo = excluidas ? 'Se puede subir' : 'Listo para subir'
    const lede = excluidas
      ? `El archivo se lee bien. <strong>${excluidas} inversión(es) no se van a publicar</strong> hasta que
         se corrijan sus filas, y todo el resto sí entra al mapa. No hace falta esperar a tenerlo perfecto:
         subilo y corregí esas después.`
      : 'No quedó nada pendiente. Al subirlo, el informe se regenera y el mapa se reconstruye solos.'
    $acciones.innerHTML = `
      ${avisoCaida(caidas, results)}
      <h2>${titulo}</h2>
      <p class="lede">${lede}</p>
      <div class="cta">
        <a class="primary" href="${urlSubida()}" target="_blank" rel="noopener">Subir a GitHub</a>
        ${descarga}
      </div>
      <p class="nota">${esc(RED_DE_SEGURIDAD)} Los pasos están en la pestaña <strong>Cómo se sube</strong>.</p>`
  }

  $acciones.classList.remove('hidden')

  const $bajar = document.getElementById('bajar-pendientes')
  if ($bajar) $bajar.addEventListener('click', () => bajarPendientes(results))
}

// El archivo se arma en el navegador y se baja con un Blob: igual que la
// validación, nada sale de la máquina.
const bajarPendientes = (results) => {
  const fecha = new Date().toISOString().slice(0, 10)
  const out = buildPendientesWorkbook(results, { fecha })
  if (!out) return
  const buf = XLSX.write(out.wb, { type: 'array', bookType: 'xlsx' })
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombrePendientes(fecha)
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const isPublished = (name) => {
  const a3 = alpha3ForFilename(registry, name)
  return a3 ? registry.publishByAlpha3?.[a3] !== false : true
}

const readFile = (file) =>
  new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result)
    fr.onerror = () => reject(fr.error ?? new Error('no se pudo leer el archivo'))
    fr.readAsArrayBuffer(file)
  })

// Mismo tratamiento que scripts/build_validation_report.mjs: primera hoja,
// sheet_to_json con defval null. Cambiar esto acá y no allá es exactamente la
// divergencia que la página existe para no tener.
const validateFile = async (file) => {
  const name = file.name
  let wb
  try {
    wb = XLSX.read(await readFile(file), { type: 'array' })
  } catch (err) {
    return { name, error: err?.message ?? String(err) }
  }
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null })
  const { fileErrors, issues, stats, curaciones, excludedIds } = validateRows(rows, {
    filename: name,
    sheetCount: wb.SheetNames.length,
    registry,
    countryBorders,
    countryBounds,
    investorMap
  })
  return {
    name,
    fileErrors,
    issues,
    stats,
    curaciones: curaciones ?? [],
    excludedIds: [...(excludedIds ?? [])].sort(),
    rows,
    published: isPublished(name)
  }
}

// Sólo progreso. El VEREDICTO lo da el informe, en una línea, y una sola vez:
// antes el estado de acá y el título de acciones decían lo mismo con palabras
// distintas y no siempre coincidían.
const setCargando = (msg) => {
  $cargando.textContent = msg
}

const run = async (fileList) => {
  const all = [...fileList]
  const xlsx = all.filter((f) => f.name.toLowerCase().endsWith('.xlsx') && !f.name.startsWith('~$'))
  const ignored = all.filter((f) => !xlsx.includes(f))

  $files.innerHTML = ''
  $report.innerHTML = ''
  $again.classList.add('hidden')

  if (xlsx.length === 0) {
    setCargando('Ninguno de esos archivos es un .xlsx. El validador trabaja sobre el archivo por país tal como se entrega.')
    return
  }
  if (ignored.length) {
    for (const f of ignored) {
      const li = document.createElement('li')
      li.textContent = `${f.name}: no es un .xlsx, se omite`
      $files.appendChild(li)
    }
  }

  setCargando(`Validando ${xlsx.length} archivo(s)…`)
  // Un respiro para que el navegador pinte el estado antes del trabajo pesado:
  // un país grande son miles de filas y el parseo es sincrónico.
  await new Promise((r) => setTimeout(r, 16))

  const results = []
  for (const f of xlsx) {
    setCargando(`Validando ${f.name}…`)
    await new Promise((r) => setTimeout(r, 0))
    results.push(await validateFile(f))
  }

  $report.innerHTML = renderReport(results, {
    registry,
    countryBorders,
    fragment: true,
    extraTabs: [{ id: 'subir', label: 'Cómo se sube', html: panelSubida() }]
  })
  // Un <script> inyectado con innerHTML NO se ejecuta, así que la interacción se
  // engancha llamando a la función. Es el mismo módulo que el informe estático
  // lleva inlineado.
  wireReport($report)
  renderAcciones(results)

  setCargando('')
  $again.classList.remove('hidden')
  // Al bloque de acciones, no al informe: el informe está DEBAJO, así que llevar
  // el foco ahí hacía pasar de largo el botón de subir y la descarga.
  $acciones.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

$file.addEventListener('change', (e) => {
  if (e.target.files?.length) run(e.target.files)
})

for (const ev of ['dragenter', 'dragover']) {
  $drop.addEventListener(ev, (e) => {
    e.preventDefault()
    $drop.classList.add('over')
  })
}
for (const ev of ['dragleave', 'drop']) {
  $drop.addEventListener(ev, (e) => {
    e.preventDefault()
    $drop.classList.remove('over')
  })
}
$drop.addEventListener('drop', (e) => {
  if (e.dataTransfer?.files?.length) run(e.dataTransfer.files)
})

$reset.addEventListener('click', () => {
  $file.value = ''
  $files.innerHTML = ''
  $report.innerHTML = ''
  $acciones.innerHTML = ''
  $acciones.classList.add('hidden')
  $again.classList.add('hidden')
  setCargando('')
  window.scrollTo({ top: 0, behavior: 'smooth' })
})
