#!/usr/bin/env node
// Emite la planilla de pendientes: qué falta arreglar, cortado por dueño.
//
// Es la versión CLI de lo que la página del validador ofrece como descarga, y usa
// el MISMO constructor (scripts/lib/pendientes.mjs). Sirve para generarla sin
// abrir el navegador y para comprobar que las dos salidas coinciden.
//
// Uso: node scripts/build_pendientes.mjs <dir|archivos...> [--out ruta.xlsx]
import XLSX from 'xlsx'
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { basename, resolve, dirname } from 'node:path'
import { validateRows } from './lib/validate.mjs'
import { alpha3ForFilename } from './lib/countries.mjs'
import { buildPendientesWorkbook, nombrePendientes } from './lib/pendientes.mjs'
import { loadRegistry, loadCountryBorders, loadInvestorMap, loadCountryBounds } from './lib/load_registry.mjs'

const args = process.argv.slice(2)
const outIdx = args.indexOf('--out')
const outArg = outIdx >= 0 ? args[outIdx + 1] : null
const inputs = args.filter((a, i) => !a.startsWith('--') && i !== outIdx + 1)

let files = []
for (const inp of inputs) {
  const p = resolve(process.cwd(), inp)
  if (existsSync(p) && statSync(p).isDirectory()) {
    files.push(...readdirSync(p).filter((f) => f.endsWith('.xlsx') && !f.startsWith('~$')).map((f) => resolve(p, f)))
  } else {
    files.push(p)
  }
}
if (!files.length) {
  console.error('Uso: node scripts/build_pendientes.mjs <dir|archivos...> [--out ruta.xlsx]')
  process.exit(1)
}

const registry = loadRegistry()
const countryBorders = registry ? loadCountryBorders(registry) : null
const countryBounds = registry ? loadCountryBounds(registry) : null
const investorMap = loadInvestorMap()

const isPublished = (name) => {
  const a3 = alpha3ForFilename(registry, name)
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
    filename: name, sheetCount: wb.SheetNames.length, registry, countryBorders, countryBounds, investorMap
  })
  results.push({
    name, fileErrors, issues, stats,
    curaciones: curaciones ?? [],
    excludedIds: [...(excludedIds ?? [])].sort(),
    rows,
    published: isPublished(name)
  })
}

const fecha = new Date().toISOString().slice(0, 10)
const out = buildPendientesWorkbook(results, { fecha })

if (!out) {
  console.log('No hay pendientes: nada que encargar.')
  process.exit(0)
}

const dest = outArg ? resolve(process.cwd(), outArg) : resolve(process.cwd(), nombrePendientes(fecha))
mkdirSync(dirname(dest), { recursive: true })
XLSX.writeFile(out.wb, dest)
console.log(`Planilla de pendientes: ${dest}`)
console.log(`  ${out.total} cosa(s) por revisar · hojas: ${out.wb.SheetNames.join(', ')}`)
