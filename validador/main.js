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
  $again.classList.add('hidden')
  setStatus('')
  window.scrollTo({ top: 0, behavior: 'smooth' })
})
