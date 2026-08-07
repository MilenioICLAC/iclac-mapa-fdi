// Rescata la columna `comments` de la revisión externa, que nunca se leyó, y corrige el
// único valor que se perdió con ella.
//
// Qué pasó: el ingest de la planilla devuelta se armó para leer **qué celdas cambiaron un
// valor** (veredicto, `corrected ownership`, nombre chino, controladores, rutas). Tres
// cosas del archivo no cambian ningún valor —las filas con veredicto «ok», los colores y
// los comentarios— y las tres se cayeron, una por vez, por el mismo motivo.
//
// Las 29 filas con comentario tienen hoy `evidence_source = revision-externa-2026-07` y
// una `review_note` escrita **por nosotros**, citando su planilla. Eso es peor que un
// hueco: es un hueco que parece lleno. Una fila que dice «confirmado en la revisión
// externa» con prosa nuestra encima se lee como si tuviéramos su fundamento.
//
// Por eso el texto suyo va a una columna propia y no mezclado en `review_note`:
//
//   review_note   -> lo que escribimos nosotros (curación, propuestas, PLEASE CHECK)
//   external_note -> lo que escribió la revisión externa, literal
//
// `external_note` es de SOLO LECTURA en el ciclo de edición: sale en el export y el
// import la ignora. Es el registro de lo que alguien dijo en una fecha. Si cambia de
// opinión, eso es una nota nueva, no una edición de la anterior.
//
// Y corrige Hubei Energy. Él puso `Central SOE` con motivo («Secondarily controlled by
// State Council SASAC due to its subsidiary status with Three Gorges») pero su veredicto
// en esa fila era «Not Sure», ni OK ni WRONG, así que el filtro saltó la fila y quedó
// `Local SOE`. Es el único de los 155 valores suyos que no llegó. Está publicado en
// PER-0071, Perú, US$78 MM.
//
// Uso:
//   node scripts/one-off/ingest_external_comments.mjs           # dry-run
//   node scripts/one-off/ingest_external_comments.mjs --write

import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const CSV = 'data/schema/investors_map.csv'
const PLANILLA = 'docs/sprint_5/ownership_review_ywedits.xlsx'
const COL = 'external_note'
const write = process.argv.includes('--write')

// El valor que se perdió, y de dónde sale. No se toca ningún otro: los otros 154 ya están.
const CORRECCION = { canonical: 'Hubei Energy', de: 'Local SOE', a: 'Central SOE' }

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
const s = (v) => (v == null ? '' : String(v).trim())

// ---------- lo que dijo la revisión externa ----------
const filas = XLSX.utils.sheet_to_json(
  XLSX.readFile(PLANILLA).Sheets.companies, { defval: '' }
)
const comentario = new Map()
for (const f of filas) {
  const txt = s(f.comments).replace(/\s+/g, ' ')
  if (txt) comentario.set(s(f.company), txt)
}

// ---------- CSV ----------
const rows = parseCsv(readFileSync(CSV, 'utf8').replace(/\r\n/g, '\n').trim())
let header = rows[0]
const recs = rows.slice(1).filter((r) => r.length > 1)

const yaTiene = header.includes(COL)
if (!yaTiene) header = [...header, COL]
const i = (n) => header.indexOf(n)
const anchas = recs.map((r) => (r.length < header.length ? [...r, ''] : r))

// La nota es de la EMPRESA, no del nombre crudo: una empresa con cuatro `investor_raw`
// recibe el mismo texto en sus cuatro filas, igual que `ownership`.
const idsDe = new Map()
for (const r of anchas) {
  const canon = s(r[i('company_canonical')])
  if (!idsDe.has(canon)) idsDe.set(canon, new Set())
  idsDe.get(canon).add(s(r[i('company_id')]))
}

const sinPareja = []
const idsConNota = new Map()
for (const [canon, txt] of comentario) {
  const ids = idsDe.get(canon)
  if (!ids) { sinPareja.push(canon); continue }
  for (const id of ids) idsConNota.set(id, txt)
}

let escritas = 0, yaIguales = 0
for (const r of anchas) {
  const txt = idsConNota.get(s(r[i('company_id')]))
  if (!txt) continue
  if (s(r[i(COL)]) === txt) { yaIguales++; continue }
  r[i(COL)] = txt
  escritas++
}

// ---------- la corrección de valor ----------
let corregidas = 0, estadoCorreccion = 'no encontrada'
for (const r of anchas) {
  if (s(r[i('company_canonical')]) !== CORRECCION.canonical) continue
  const actual = s(r[i('ownership')])
  if (actual === CORRECCION.a) { estadoCorreccion = 'ya estaba corregida'; continue }
  if (actual !== CORRECCION.de) { estadoCorreccion = `INESPERADO: dice "${actual}", no "${CORRECCION.de}"`; continue }
  r[i('ownership')] = CORRECCION.a
  corregidas++
  estadoCorreccion = `${CORRECCION.de} -> ${CORRECCION.a}`
}

// ---------- informe ----------
console.log(`${write ? '' : '[dry-run] '}Columna "${COL}": ${yaTiene ? 'ya existía' : 'agregada'}`)
console.log(`Comentarios en la planilla externa : ${comentario.size}`)
console.log(`Filas del CSV que reciben texto    : ${escritas}${yaIguales ? ` (${yaIguales} ya iguales)` : ''}`)
console.log(`Empresas de la planilla sin fila   : ${sinPareja.length}${sinPareja.length ? ' -> ' + sinPareja.join(', ') : ''}`)
console.log(`Corrección ${CORRECCION.canonical.padEnd(18)}: ${estadoCorreccion}${corregidas ? ` (${corregidas} fila${corregidas > 1 ? 's' : ''})` : ''}`)

if (sinPareja.length) console.error('\n  ! Hay comentarios que no cayeron en ninguna fila. Revisar antes de escribir.')

if (write) {
  const out = [header.map(cell).join(','), ...anchas.map((r) => r.map(cell).join(','))]
  writeFileSync(CSV, out.join('\n') + '\n', 'utf8')
  console.log(`\nCSV reescrito: ${CSV}`)
  console.log('Después: node scripts/build_investors_map.mjs && npm run etl')
} else {
  console.log('\nNada escrito. Correr con --write para aplicar.')
}
