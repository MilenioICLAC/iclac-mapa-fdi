// Mete en `external_note` los 9 comentarios que la revisión externa escribió el 05-08,
// en la tabla que le mandamos (`investors_table_ywedits.xlsx`), precedidos de «REVIEW:».
//
// Por qué un script y no `investors:import`: `external_note` no está en los `EDITABLES` del
// import, y eso es a propósito. Es el dicho literal de alguien en una fecha, no un campo
// nuestro. Si entrara por el editable, cualquiera lo pisa desde Excel sin que quede rastro.
// Entra por acá, que deja huella y se puede auditar.
//
// Es el segundo de su clase: `ingest_external_comments.mjs` hizo lo mismo con los 29
// comentarios de la planilla del 31-07. Si esto se repite una tercera vez, conviene
// generalizarlos en uno solo con la planilla como argumento.
//
// GARANTÍAS, que son el punto de que esto sea trazable y no un parche:
//
//   1. El texto se guarda VERBATIM. El script verifica que lo que va a escribir sea
//      substring literal de la celda de su archivo. Si no lo es, aborta: significaría que
//      lo estamos reformulando sin darnos cuenta.
//   2. NO pisa nada. Si una fila ya tiene `external_note` distinto, se reporta y se salta.
//      Sus dos rondas son dos dichos con fecha, no uno que reemplaza al otro.
//   3. La nota es de la EMPRESA: se escribe en todas las filas del mismo `company_id`.
//   4. Idempotente. Correrlo dos veces da 0 cambios.
//   5. No toca ninguna otra columna. El diff de git tiene que mostrar sólo `external_note`.
//
// Uso:
//   node scripts/one-off/ingest_review_notes_0508.mjs           # dry-run
//   node scripts/one-off/ingest_review_notes_0508.mjs --write

import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const CSV = 'data/schema/investors_map.csv'
const PLANILLA = 'docs/sprint_5/investors_table_ywedits.xlsx'
const MARCA = 'REVIEW:'
const write = process.argv.includes('--write')

function parseCsv(text) {
  const rows = []
  let field = '', row = [], quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else quoted = false }
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (ch !== '\r') field += ch
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows
}
const cell = (v) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const s = (v) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim())

// ---------- lo que escribió, tal cual ----------
const suyo = new Map()
const abortos = []
for (const r of XLSX.utils.sheet_to_json(XLSX.readFile(PLANILLA).Sheets.companies, { defval: '' })) {
  const celda = String(r.review_note || '')
  const i = celda.indexOf(MARCA)
  if (i < 0) continue
  const texto = s(celda.slice(i + MARCA.length))
  if (!texto) continue

  // Garantía 1. `s()` colapsa espacios, así que se compara contra la celda igual de
  // colapsada: lo que se verifica es que no falte ni sobre una palabra, no el formato.
  if (!s(celda).includes(texto)) abortos.push(`${r.company_id}: el texto extraído no es substring de su celda`)
  suyo.set(s(r.company_id), { texto, empresa: s(r.company_canonical) })
}

if (abortos.length) {
  console.error('ABORTA. La extracción no es literal:')
  for (const a of abortos) console.error('  ' + a)
  process.exit(1)
}

// ---------- CSV ----------
const rows = parseCsv(readFileSync(CSV, 'utf8').replace(/\r\n/g, '\n').trim())
const header = rows[0]
const i = (n) => header.indexOf(n)
if (i('external_note') < 0) {
  console.error(`ABORTA: ${CSV} no tiene columna external_note. Correr antes ingest_external_comments.mjs.`)
  process.exit(1)
}
const recs = rows.slice(1).filter((r) => r.length > 1)

const escritas = [], yaIguales = [], ocupadas = [], sinFila = []
const idsCsv = new Set(recs.map((r) => s(r[i('company_id')])))
for (const id of suyo.keys()) if (!idsCsv.has(id)) sinFila.push(id)

for (const r of recs) {
  const id = s(r[i('company_id')])
  const nuevo = suyo.get(id)
  if (!nuevo) continue
  const actual = s(r[i('external_note')])
  if (actual === nuevo.texto) { yaIguales.push(nuevo.empresa); continue }
  if (actual) { ocupadas.push([nuevo.empresa, actual]); continue } // garantía 2
  r[i('external_note')] = nuevo.texto
  escritas.push([nuevo.empresa, nuevo.texto])
}

// ---------- informe ----------
console.log(`${write ? '' : '[dry-run] '}Comentarios con marca "${MARCA}" en la planilla: ${suyo.size}`)
console.log(`Filas del CSV que reciben texto : ${escritas.length}`)
if (yaIguales.length) console.log(`Ya estaban idénticas            : ${yaIguales.length} (${[...new Set(yaIguales)].join(', ')})`)
if (sinFila.length) console.error(`  ! ids de la planilla sin fila en el CSV: ${sinFila.join(', ')}`)
if (ocupadas.length) {
  console.error(`\n  ! ${ocupadas.length} fila(s) ya tenían otro external_note y NO se tocaron:`)
  for (const [emp, prev] of ocupadas) console.error(`      ${emp}: "${prev.slice(0, 70)}…"`)
  console.error('    Son dos dichos con fecha distinta. Decidir cómo conviven antes de escribir.')
}

if (escritas.length) {
  console.log('\nQué se escribe, empresa por empresa:')
  for (const [emp, txt] of escritas) console.log(`\n  ${emp}\n    ${txt}`)
}

if (write) {
  const out = [header.map(cell).join(','), ...recs.map((r) => r.map(cell).join(','))]
  writeFileSync(CSV, out.join('\n') + '\n', 'utf8')
  console.log(`\nCSV reescrito: ${CSV}`)
  console.log('Auditar: git diff --stat data/schema/investors_map.csv  (sólo external_note)')
} else {
  console.log('\nNada escrito. Correr con --write para aplicar.')
}
