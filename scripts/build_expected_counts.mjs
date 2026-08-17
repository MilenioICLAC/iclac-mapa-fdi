#!/usr/bin/env node
// Regenera la línea base de la guardia de caída brusca
// (data/schema/expected_counts.csv): cuántas inversiones tiene hoy el archivo de
// cada país.
//
// Se corre A PROPÓSITO, cuando el cambio de datos es legítimo, y el CSV resultante
// va en el MISMO commit que el cambio. Ese es todo el mecanismo: la diferencia
// entre "borré filas sin querer" y "este país encogió de verdad" no está en los
// datos, está en la intención, y así queda declarada y con fecha.
//
// Uso: node scripts/build_expected_counts.mjs [dirDatos] [--out ruta.csv]
//
// `--out` existe porque el destino por defecto es la línea base REAL del
// repositorio: apuntar el script a un directorio de prueba y que igual pisara el
// archivo bueno es un accidente fácil de cometer (pasó al escribir esto).
import XLSX from 'xlsx'
import { writeFileSync, readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadRegistry } from './lib/load_registry.mjs'
import { alpha3ForFilename } from './lib/countries.mjs'
import {
  COUNTS_PATH_REL, countInvestments, formatExpectedCounts, parseExpectedCounts, checkCounts
} from './lib/count_guard.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')

const args = process.argv.slice(2)
const outIdx = args.indexOf('--out')
const outArg = outIdx >= 0 ? args[outIdx + 1] : null
const positionals = args.filter((a, i) => !a.startsWith('--') && i !== outIdx + 1)

const dir = resolve(process.cwd(), positionals[0] || resolve(REPO_ROOT, 'data/sources/countries'))
const dest = outArg ? resolve(process.cwd(), outArg) : resolve(REPO_ROOT, COUNTS_PATH_REL)

if (!existsSync(dir) || !statSync(dir).isDirectory()) {
  console.error(`counts:update: no existe el directorio ${dir}`)
  process.exit(1)
}

const registry = loadRegistry()
const counts = {}
for (const f of readdirSync(dir).filter((f) => f.endsWith('.xlsx') && !f.startsWith('~$'))) {
  const a3 = alpha3ForFilename(registry, f)
  if (!a3) {
    console.warn(`  aviso: "${f}" no corresponde a ningún país del registro, no entra a la línea base`)
    continue
  }
  const wb = XLSX.readFile(resolve(dir, f))
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null })
  counts[a3] = countInvestments(rows)
}

// Se muestra el diff contra lo que había: quien corre esto tiene que ver qué está
// declarando antes de commitearlo.
const antes = existsSync(dest) ? parseExpectedCounts(readFileSync(dest, 'utf8')) : {}
const { problems, nuevos } = checkCounts(antes, counts)

writeFileSync(dest, formatExpectedCounts(counts), 'utf8')

console.log(`Línea base actualizada: ${dest}`)
console.log(`  ${Object.keys(counts).length} países · ${Object.values(counts).reduce((a, b) => a + b, 0)} inversiones`)
if (nuevos.length) console.log(`  países nuevos: ${nuevos.join(', ')}`)
if (problems.length) {
  console.log('  cambios que la guardia habría frenado, y que quedan declarados con este commit:')
  for (const p of problems) console.log(`    · ${p.message}`)
}
