// Validador en el navegador. El archivo nunca sale de la máquina de quien lo usa.
//
// La razón de existir: el informe de GitHub Pages sólo puede generarse DESPUÉS de
// que el archivo pasa por nosotros, así que nunca alcanza a atrapar nada antes del
// envío y cada corrección da la vuelta completa por correo. Acá el chequeo ocurre
// mientras el archivo todavía está abierto en Excel.
//
// REGLA: esta página NO reimplementa nada. Importa el mismo núcleo
// (scripts/lib/validate.mjs) y el mismo render (scripts/lib/report_render.mjs) que
// usan el CLI y la CI. Si alguna vez hay dos implementaciones, divergen — este
// repositorio ya pagó esa lección con los dos generadores del mapa de inversores.
import * as XLSX from 'xlsx'
import { validateRows } from '../scripts/lib/validate.mjs'
import { renderReport } from '../scripts/lib/report_render.mjs'
import { alpha3ForFilename } from '../scripts/lib/countries.mjs'
import { buildPendientesWorkbook, nombrePendientes } from '../scripts/lib/pendientes.mjs'
import {
  PRIMERA_VEZ, CADA_VEZ, QUE_NO_TOCAR, RED_DE_SEGURIDAD, urlSubida, urlCarpeta, CARPETA_DATOS
} from './instructivo.js'
import {
  buildRegistry,
  parseInvestorMap,
  countryBoundsFrom,
  countryBordersFrom
} from '../scripts/lib/registry_parse.mjs'

// Los tres archivos de referencia se empaquetan en el bundle en vez de pedirse por
// fetch: así la página es un solo archivo, no puede fallar por un 404 y queda
// congelada en la MISMA versión del registro con la que se construyó el sitio.
import countriesCsv from '../data/schema/countries.csv?raw'
import investorsCsv from '../data/schema/investors_map.csv?raw'
import bordersGeojson from '../data/sources/geo/borders.geojson?raw'

const registry = buildRegistry(countriesCsv)
const investorMap = parseInvestorMap(investorsCsv)
const geo = JSON.parse(bordersGeojson)
const countryBounds = countryBoundsFrom(registry, geo)
const countryBorders = countryBordersFrom(registry, geo)

const $drop = document.getElementById('drop')
const $file = document.getElementById('file')
const $status = document.getElementById('status')
const $files = document.getElementById('files')
const $report = document.getElementById('report')
const $again = document.getElementById('again')
const $reset = document.getElementById('reset')
const $acciones = document.getElementById('acciones')

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const pasos = (items) =>
  `<ol>${items.map((p) => `<li><b>${esc(p.titulo)}</b><span>${esc(p.cuerpo)}</span></li>`).join('')}</ol>`

// Qué mostrar después del informe. El instructivo aparece cuando es accionable, no
// como muro de texto: si el archivo no se puede leer todavía, ofrecer el botón de
// subir sería mandarla a romper el sitio.
const renderAcciones = (results) => {
  const ilegibles = results.filter((r) => r.error || !r.stats?.passed)
  const excluidas = results.reduce((n, r) => n + (r.excludedIds?.length ?? 0), 0)
  const hayPendientes = results.some((r) => (r.issues ?? []).some((i) => i.severity !== 'info') || r.fileErrors?.length)

  const descarga = hayPendientes
    ? '<button type="button" class="secondary" id="bajar-pendientes">Bajar la lista de pendientes</button>'
    : ''

  if (ilegibles.length) {
    $acciones.innerHTML = `
      <h2>Todavía no se puede subir</h2>
      <p class="lede">${ilegibles.length} archivo(s) no se pueden leer. No es que tengan datos malos: es que
        el sistema no puede interpretarlos, así que ninguna de sus inversiones entraría. Eso se arregla
        primero, y está detallado abajo en el informe.</p>
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
      <h2>${titulo}</h2>
      <p class="lede">${lede}</p>
      <div class="cta">
        <a class="primary" href="${urlSubida()}" target="_blank" rel="noopener">Subir a GitHub</a>
        ${descarga}
      </div>
      <p class="nota">${esc(RED_DE_SEGURIDAD)}</p>
      <details>
        <summary>Cómo se sube (la primera vez)</summary>
        ${pasos(PRIMERA_VEZ)}
        <p class="nota">La carpeta es <a href="${urlCarpeta()}" target="_blank" rel="noopener"><code>${CARPETA_DATOS}</code></a>.</p>
      </details>
      <details>
        <summary>Cómo se sube (cada vez)</summary>
        ${pasos(CADA_VEZ)}
      </details>
      <details>
        <summary>Qué conviene no tocar</summary>
        <ul>${QUE_NO_TOCAR.map((t) => `<li>${t}</li>`).join('')}</ul>
      </details>`
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

const setStatus = (msg, isError = false) => {
  $status.textContent = msg
  $status.classList.toggle('err', isError)
}

const run = async (fileList) => {
  const all = [...fileList]
  const xlsx = all.filter((f) => f.name.toLowerCase().endsWith('.xlsx') && !f.name.startsWith('~$'))
  const ignored = all.filter((f) => !xlsx.includes(f))

  $files.innerHTML = ''
  $report.innerHTML = ''
  $again.classList.add('hidden')

  if (xlsx.length === 0) {
    setStatus('Ninguno de esos archivos es un .xlsx. El validador trabaja sobre el archivo por país tal como se entrega.', true)
    return
  }
  if (ignored.length) {
    for (const f of ignored) {
      const li = document.createElement('li')
      li.textContent = `${f.name}: no es un .xlsx, se omite`
      $files.appendChild(li)
    }
  }

  setStatus(`Validando ${xlsx.length} archivo(s)…`)
  // Un respiro para que el navegador pinte el estado antes del trabajo pesado:
  // un país grande son miles de filas y el parseo es sincrónico.
  await new Promise((r) => setTimeout(r, 16))

  const results = []
  for (const f of xlsx) {
    setStatus(`Validando ${f.name}…`)
    await new Promise((r) => setTimeout(r, 0))
    results.push(await validateFile(f))
  }

  $report.innerHTML = renderReport(results, { registry, countryBorders, fragment: true })
  renderAcciones(results)

  const excluidas = results.reduce((n, r) => n + (r.excludedIds?.length ?? 0), 0)
  const ilegibles = results.filter((r) => r.error || !r.stats?.passed).length
  setStatus(
    ilegibles
      ? `${ilegibles} archivo(s) no se pueden leer; el detalle está abajo.`
      : excluidas
        ? `Los archivos se leen bien. ${excluidas} inversión(es) no se publicarían: el detalle está abajo.`
        : 'Todo en orden: los archivos se leen bien y todas las inversiones publican.'
  )
  $again.classList.remove('hidden')
  $report.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
  setStatus('')
  window.scrollTo({ top: 0, behavior: 'smooth' })
})
