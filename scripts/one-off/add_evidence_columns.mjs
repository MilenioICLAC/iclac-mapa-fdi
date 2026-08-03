// Agrega a data/schema/investors_map.csv las columnas de evidencia que devolvió la
// revisión externa de propiedad, y las carga desde el xlsx de esa revisión.
//
// Por qué: esa evidencia —nombre en chino, forma jurídica del registro chino y la
// cadena de control con porcentajes— es lo único que respalda las clasificaciones que
// muestra el sitio, y hoy vive SOLO dentro de un xlsx en docs/, que está en el
// gitignore. Si ese archivo se pierde, no queda cómo defender ninguna clasificación.
//
// Las 34 columnas controller1..17 / path1..17 del xlsx se colapsan en dos, separadas
// por "|". Verificado antes de escribir: ningún path contiene "|", coma ni salto de
// línea, así que el colapso es sin pérdida.
//
// Uso:
//   node scripts/one-off/add_evidence_columns.mjs            # dry-run, imprime el diff
//   node scripts/one-off/add_evidence_columns.mjs --write
//
// Después: node scripts/build_investors_map.mjs && npm run validate:investors

import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const CSV = 'data/schema/investors_map.csv'
const XLS = 'docs/sprint_5/ownership_review_ywedits.xlsx'
const write = process.argv.includes('--write')

// Columnas nuevas, en el orden en que se agregan al final del CSV.
const NUEVAS = [
  'ownership_status', // confirmed | unreviewed | proposed
  'evidence_source',  // de dónde salió la evidencia de esta fila
  'chinese_name',
  'firm_type',        // forma jurídica del registro chino
  'controllers',      // controladores últimos, separados por |
  'control_paths',    // cadenas de control con porcentaje, separadas por |
  'is_jv_vehicle',    // TRUE si la empresa es un vehículo conjunto
]

const SEP = '|'
const FUENTE = 'revision-externa-2026-07'

// ---------- CSV ----------
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

// ---------- entrada ----------
const raw = readFileSync(CSV, 'utf8')
const rows = parseCsv(raw.replace(/\r\n/g, '\n').trim())
const header = rows[0]

for (const c of NUEVAS) {
  if (header.includes(c)) {
    console.error(`La columna "${c}" ya existe en el CSV. Nada que hacer.`)
    process.exit(1)
  }
}

const iCanon = header.indexOf('company_canonical')
const iOwn = header.indexOf('ownership')
if (iCanon < 0 || iOwn < 0) {
  console.error('El CSV no trae company_canonical / ownership.')
  process.exit(1)
}

// ---------- revisión externa ----------
const wb = XLSX.readFile(XLS, { cellStyles: true })
const sheet = wb.Sheets['companies']
const review = XLSX.utils.sheet_to_json(sheet)

// Las marcas de color no viajan en el valor de la celda: amarillo = vehículo JV
// recién identificado, rojo = empresa que la revisión sugiere eliminar. Se leyeron
// una vez con los estilos porque de otro modo son invisibles para el pipeline.
const JV_FILL = 'FFEB9C'
const DROP_FILL = 'FFC7CE'
const fillOf = (addr) => {
  const c = sheet[addr]
  return c?.s?.fgColor?.rgb || c?.s?.patternType && c?.s?.bgColor?.rgb || null
}
const range = XLSX.utils.decode_range(sheet['!ref'])
const colCompany = (() => {
  for (let c = range.s.c; c <= range.e.c; c++) {
    const h = sheet[XLSX.utils.encode_cell({ r: range.s.r, c })]
    if (h && String(h.v).trim() === 'company') return c
  }
  return -1
})()
const marca = new Map() // company -> 'jv' | 'drop'
if (colCompany >= 0) {
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: colCompany })
    const v = sheet[addr]?.v
    if (!v) continue
    const f = (fillOf(addr) || '').toUpperCase()
    if (f.includes(JV_FILL)) marca.set(String(v).trim(), 'jv')
    else if (f.includes(DROP_FILL)) marca.set(String(v).trim(), 'drop')
  }
}

const s = (v) => (v == null ? '' : String(v).trim())
const clean = (v) => { const t = s(v); return t === '-' ? '' : t }

const evidencia = new Map()
for (const r of review) {
  const company = s(r.company)
  if (!company) continue

  // controllers_all ya viene colapsado en la planilla; si falta, se arma desde
  // controller1..17 quitando repetidos (una empresa puede tener varias cadenas que
  // llegan al mismo controlador último).
  let controllers = clean(r.controllers_all)
  if (!controllers) {
    const list = []
    for (let i = 1; i <= 17; i++) { const c = clean(r['controller' + i]); if (c && !list.includes(c)) list.push(c) }
    controllers = list.join(SEP)
  }
  const paths = []
  for (let i = 1; i <= 17; i++) { const p = clean(r['path' + i]); if (p) paths.push(p) }

  const veredicto = clean(r['your verdict (OK / WRONG / UNSURE)'])
  evidencia.set(company, {
    ownership_status: veredicto ? 'confirmed' : 'unreviewed',
    evidence_source: FUENTE,
    chinese_name: clean(r['Chinese firm name']),
    firm_type: clean(r.firm_type),
    controllers,
    control_paths: paths.join(SEP),
    is_jv_vehicle: marca.get(company) === 'jv' ? 'TRUE' : '',
    _drop: marca.get(company) === 'drop',
  })
}

// ---------- salida ----------
const out = [[...header, ...NUEVAS].map(cell).join(',')]
const stats = { conEvidencia: 0, sinEvidencia: 0, jv: [], drop: [], porStatus: {} }

for (const row of rows.slice(1)) {
  if (row.length <= 1) continue
  const canon = s(row[iCanon])
  const e = evidencia.get(canon)
  const vals = e
    ? NUEVAS.map((c) => e[c] ?? '')
    : ['unreviewed', '', '', '', '', '', '']

  if (e) { stats.conEvidencia++; if (e.is_jv_vehicle) stats.jv.push(canon); if (e._drop) stats.drop.push(canon) }
  else stats.sinEvidencia++
  const st = vals[0]
  stats.porStatus[st] = (stats.porStatus[st] || 0) + 1

  out.push([...row, ...vals].map(cell).join(','))
}

console.log(`${write ? '' : '[dry-run] '}Columnas nuevas: ${NUEVAS.join(', ')}`)
console.log(`Filas con evidencia cargada: ${stats.conEvidencia} · sin evidencia: ${stats.sinEvidencia}`)
console.log(`ownership_status: ${Object.entries(stats.porStatus).map(([k, v]) => `${k}=${v}`).join(' · ')}`)
console.log(`Vehículos JV marcados en la revisión (${[...new Set(stats.jv)].length}): ${[...new Set(stats.jv)].join(' | ') || '-'}`)
console.log(`Propuestas de eliminación (${[...new Set(stats.drop)].length}): ${[...new Set(stats.drop)].join(' | ') || '-'}`)
console.log('  (las propuestas de eliminación NO se aplican acá: son una decisión, no un dato)')

if (write) {
  writeFileSync(CSV, out.join('\n') + '\n', 'utf8')
  console.log(`\nCSV reescrito: ${CSV}`)
  console.log('Después: node scripts/build_investors_map.mjs && npm run validate:investors')
} else {
  console.log('\nNada escrito. Correr con --write para aplicar.')
}
