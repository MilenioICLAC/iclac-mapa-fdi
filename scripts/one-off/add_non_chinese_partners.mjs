// Abre la tabla de inversores a los socios NO chinos, y crea la primera fila: MCM.
//
// Hasta ahora tratábamos distinto dos cosas que son la misma. Un miembro chino de un
// consorcio es una fila de `investors_map`, referenciada desde `members`. Un socio no
// chino era texto suelto dentro de la prosa de `Detail`. Los dos son «otra empresa que
// participó en la operación».
//
// Columna nueva: `origin_country`. **Vacía significa China**, que es el default correcto
// para un registro de inversores chinos. El olvido no pasa desapercibido: una fila sin
// `ownership` y sin `origin_country` ya es error del validador.
//
// La propiedad NO aplica a un socio no chino: el enum (Central SOE / Local SOE / POE /
// MIXED) describe estructura de capital china. Así que su `ownership` va vacío, igual
// que en un consorcio. El vacío pasa a significar «no aplica», con dos razones posibles
// —relación o empresa no china— que se distinguen por `is_consortium` y `origin_country`.
//
// MCM se queda como miembro del consorcio de Panamá. No se borra de `members`: sí
// participó. Lo que cambia es que ahora la derivación de propiedad la salta, así que
// PAN-0015 pasa de UNKNOWN a la propiedad de CCA.
//
// Uso:
//   node scripts/one-off/add_non_chinese_partners.mjs           # dry-run
//   node scripts/one-off/add_non_chinese_partners.mjs --write

import { readFileSync, writeFileSync } from 'node:fs'

const CSV = 'data/schema/investors_map.csv'
const write = process.argv.includes('--write')
const COL = 'origin_country'

// Sólo los socios cuyo nombre y país podemos sostener. Los otros 28 que aparecen en la
// prosa salen de una extracción por texto sin confirmar: crearles ficha ahora sería
// inventar. Entran cuando el equipo de datos devuelva la planilla del socio no chino.
const SOCIOS = [
  {
    investor_raw: 'MCM',
    company_id: 'mcm',
    company_canonical: 'MCM',
    origin_country: 'Panama',
    note: 'PROPOSED, pending confirmation: non-Chinese partner. Our note on the Ciudad de Esperanza consortium (PAN-0015) describes MCM as the local partner of China Construction America. It stays listed as a member of that deal because it did take part, but ownership does not apply to it: the ownership enum describes Chinese capital structure. PLEASE CHECK the name and that it is indeed Panamanian.',
  },
]

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

const rows = parseCsv(readFileSync(CSV, 'utf8').replace(/\r\n/g, '\n').trim())
let header = rows[0]
const recs = rows.slice(1).filter((r) => r.length > 1)

const yaTiene = header.includes(COL)
if (!yaTiene) header = [...header, COL]
const i = (n) => header.indexOf(n)

const existentes = new Set(recs.map((r) => (r[i('company_id')] || '').trim()))
const rawSeen = new Set(recs.map((r) => (r[i('investor_raw')] || '').trim()))

const nuevas = []
for (const s of SOCIOS) {
  if (existentes.has(s.company_id)) { console.error(`  ! ${s.company_id} ya existe, se salta`); continue }
  if (rawSeen.has(s.investor_raw)) { console.error(`  ! investor_raw "${s.investor_raw}" ya en uso, se salta`); continue }
  const row = header.map(() => '')
  row[i('investor_raw')] = s.investor_raw
  row[i('company_id')] = s.company_id
  row[i('company_canonical')] = s.company_canonical
  row[i('is_consortium')] = 'FALSE'
  row[i('ownership')] = '' // no aplica
  row[i('ownership_status')] = '' // tampoco hay clasificación que revisar
  row[i('evidence_source')] = 'iclac-propuesta-2026-08'
  row[i(COL)] = s.origin_country
  row[i('review_note')] = s.note
  nuevas.push(row)
}

// Verificación: el socio tiene que estar referenciado por algún consorcio, si no la fila
// queda colgando sin que nadie la use.
const referenciados = new Set()
for (const r of recs) {
  for (const m of (r[i('members')] || '').split('|')) if (m.trim()) referenciados.add(m.trim())
}
for (const s of SOCIOS) {
  if (!referenciados.has(s.company_id)) console.error(`  ! ${s.company_id} no lo referencia ningún consorcio`)
}

console.log(`${write ? '' : '[dry-run] '}Columna "${COL}": ${yaTiene ? 'ya existía' : 'agregada'}`)
console.log(`Filas nuevas: ${nuevas.length}`)
for (const s of SOCIOS) console.log(`  ${s.company_canonical.padEnd(12)} ${s.origin_country.padEnd(12)} referenciado por un consorcio: ${referenciados.has(s.company_id) ? 'sí' : 'NO'}`)
console.log(`Columnas: ${rows[0].length} → ${header.length}`)

if (write) {
  const out = [
    header.map(cell).join(','),
    ...recs.map((r) => [...r, ...(yaTiene ? [] : [''])].map(cell).join(',')),
    ...nuevas.map((r) => r.map(cell).join(',')),
  ]
  writeFileSync(CSV, out.join('\n') + '\n', 'utf8')
  console.log(`\nCSV reescrito: ${CSV}`)
} else {
  console.log('\nNada escrito. Correr con --write para aplicar.')
}
