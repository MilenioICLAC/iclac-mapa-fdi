#!/usr/bin/env node
// Genera el informe HTML de la validación de los xlsx por país. Público: quien
// sube y verifica los datos. Autocontenido.
//
// Uso:
//   node scripts/build_validation_report.mjs <dir|archivos...> [--out ruta.html] [--fragment]
//   --fragment  emite solo el contenido de <body> (para publicar como Artifact)
//
// Esto es SÓLO la cáscara de I/O: leer los xlsx, validar y escribir el archivo.
// El render vive en scripts/lib/report_render.mjs, puro, y lo comparte con la
// página del validador que corre en el navegador (site/validador/). Si el informe
// tuviera dos implementaciones, divergirían.
import XLSX from 'xlsx'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { basename, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateRows } from './lib/validate.mjs'
import { alpha3ForFilename } from './lib/countries.mjs'
import { renderReport, withInteract } from './lib/report_render.mjs'
import { loadRegistry, loadCountryBorders, loadInvestorMap, loadCountryBounds } from './lib/load_registry.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

const rawArgs = process.argv.slice(2)
let outPath = null
let fragment = false
const inputs = []
for (let i = 0; i < rawArgs.length; i++) {
  const a = rawArgs[i]
  if (a === '--out') outPath = rawArgs[++i]
  else if (a === '--fragment') fragment = true
  else inputs.push(a)
}

// Resolver lista de archivos xlsx.
let files = []
for (const inp of inputs) {
  const p = resolve(process.cwd(), inp)
  if (existsSync(p) && statSync(p).isDirectory()) {
    files.push(
      ...readdirSync(p)
        .filter((f) => f.endsWith('.xlsx') && !f.startsWith('~$'))
        .map((f) => resolve(p, f))
    )
  } else {
    files.push(p)
  }
}
if (files.length === 0) {
  console.error('No hay archivos xlsx que validar.')
  process.exit(1)
}

const registry = loadRegistry()
const countryBorders = registry ? loadCountryBorders(registry) : null
const countryBounds = registry ? loadCountryBounds(registry) : null
const investorMap = loadInvestorMap()

// Compuerta de publicación (`publish` en countries.csv), independiente de la
// validación: el archivo puede estar impecable y el país no publicarse todavía.
// Se muestra aparte para que no se lea como un fallo del archivo.
const isPublished = (fileName) => {
  const a3 = alpha3ForFilename(registry, fileName)
  return a3 ? registry.publishByAlpha3?.[a3] !== false : true
}

const results = []
for (const file of files) {
  const name = basename(file)
  let wb
  try {
    wb = XLSX.readFile(file)
  } catch (err) {
    results.push({ name, error: err.message })
    continue
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
  results.push({
    name, fileErrors, issues, stats,
    curaciones: curaciones ?? [],
    excludedIds: [...(excludedIds ?? [])].sort(),
    rows,
    published: isPublished(name)
  })
}

// El validador se publica junto al informe, en site/validador/.
const html = renderReport(results, { registry, countryBorders, fragment, validatorHref: './validador/' })

// La interacción (pestañas, filtros, agrupación) va INLINEADA desde el mismo
// módulo que importa la página del validador, no reescrita acá. Como módulo, no
// como script clásico: así el `export` del archivo es legal y no hay que tocarle
// una línea. Leer disco es legítimo en la cáscara de I/O; el render sigue puro.
const interact = readFileSync(resolve(__dirname, 'lib', 'report_interact.mjs'), 'utf8')
const conScript = withInteract(html, interact, { fragment })

const dest = outPath ? resolve(process.cwd(), outPath) : resolve(__dirname, '..', 'validation_report.html')
// El directorio de salida puede no existir (site/ está ignorado y no se versiona).
mkdirSync(dirname(dest), { recursive: true })
writeFileSync(dest, conScript, 'utf8')

const totalRows = results.reduce((s, r) => s + (r.stats?.rows ?? 0), 0)
const totalExcluded = results.reduce((s, r) => s + (r.excludedIds?.length ?? 0), 0)
const noLeibles = results.filter((r) => r.error || !r.stats.passed).length
console.log(`Informe: ${dest}`)
console.log(`Archivos: ${results.length} · ilegibles: ${noLeibles} · filas: ${totalRows} · inversiones que no publican: ${totalExcluded}`)
