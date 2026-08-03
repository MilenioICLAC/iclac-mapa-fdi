// Dos limpiezas sobre data/schema/investors_map.csv, después de que la tabla pasó a ser
// trabajo oficial nuestro.
//
// 1. Saca `_count` y `_musd`. No son dato: son un recuento de inversiones pegado a mano
//    en alguna auditoría vieja, que ningún script mantiene. Medido: 66 de 240 filas
//    estaban desactualizadas, así que la tabla mentía sobre sí misma. Se calculan al
//    exportar, desde investments.json, que es donde vive la verdad.
//
// 2. Reescribe en inglés las notas de las 18 fichas que sembramos el 03-08. Con la
//    revisión externa nos comunicamos en inglés, y esas notas son justamente la
//    evidencia que tiene que auditar: una nota que el lector no puede leer no sirve de
//    nada. El resto de las notas queda como está (son internas y viejas).
//
// Uso:
//   node scripts/one-off/normalize_seeded_notes.mjs           # dry-run
//   node scripts/one-off/normalize_seeded_notes.mjs --write

import { readFileSync, writeFileSync } from 'node:fs'

const CSV = 'data/schema/investors_map.csv'
const write = process.argv.includes('--write')
const DROP = ['_count', '_musd']

// company_id -> nota en inglés. Misma información que la versión en español: la
// evidencia de la que salió, la regla aplicada y la duda si la hay.
const NOTES = {
  'sinopharm': 'ICLAC PROPOSAL, pending external audit: Central SOE. From the consortium note "CAMCE + Sinopharm (SASAC central)". Rule: direct. Company with no investments of its own: appears only as a consortium member.',
  'baosteel': 'ICLAC PROPOSAL, pending external audit: Central SOE. From the consortium note "Baosteel/Baowu (SASAC central)". Rule: ultimate controller. Company with no investments of its own.',
  'camce': 'ICLAC PROPOSAL, pending external audit: Central SOE. From two consortium notes: "CAMCE (Sinomach subsidiary, SASAC)". Rule: ultimate controller. Company with no investments of its own.',
  'cneec': 'ICLAC PROPOSAL, pending external audit: Central SOE. From the CNEEC + CMEC consortium note: both are Sinomach subsidiaries. Rule: ultimate controller. Company with no investments of its own.',
  'china-united-engineering': 'ICLAC PROPOSAL, pending external audit: Central SOE. From the consortium note with Dongfang Turbine: "China United Engineering (Sinomach subsidiary, SASAC)". Rule: ultimate controller. Company with no investments of its own.',
  'mmg': 'ICLAC PROPOSAL, pending external audit: Central SOE. From the Las Bambas note: "MMG 62.5% ... all state-owned", citing minmetals.com. Rule: ultimate controller (China Minmetals). PLEASE CHECK: the note says "state-owned" without specifying central. We added "central" because Minmetals is SASAC. If it were local, Las Bambas becomes central + local SOE, so still fully state-owned. This drives US$7,000M.',
  'guoxin': 'ICLAC PROPOSAL, pending external audit: Central SOE. From the Las Bambas note: "Guoxin 22.5% ... all state-owned". Rule: ultimate controller. PLEASE CHECK: same doubt as MMG, the note says "state-owned", not "central".',
  'xian-rail-transportation-group': 'ICLAC PROPOSAL, pending external audit: Local SOE. From the consortium note with CHEC: "Xi\'an Rail Transportation Group = Xi\'an municipal SOE". Rule: direct. Company with no investments of its own.',
  'tongling-nonferrous': 'ICLAC PROPOSAL, pending external audit: Local SOE. From two consortium notes: "Tongling Nonferrous (Anhui SOE)". Rule: direct. Company with no investments of its own.',
  'xiamen-cd': 'ICLAC PROPOSAL, pending external audit: Local SOE. From the Zijin + Tongling + Xiamen C&D note: "Xiamen C&D (Xiamen SOE)". Rule: direct. Company with no investments of its own.',
  'jiangtong-group': 'ICLAC PROPOSAL, pending external audit: Local SOE. From the consortium note with Zhongrong Xinda: "Jiangtong / Jiangxi Copper (provincial SOE)". Rule: direct. Company with no investments of its own.',
  'taiyuan-iron': 'ICLAC PROPOSAL, pending external audit: Local SOE. From the consortium note: "TISCO (Shanxi SOE)". Rule: direct. PLEASE CHECK FIRST, THIS IS OUR WEAKEST CALL: TISCO was absorbed into China Baowu, which is central SASAC. If the ultimate controller today is Baowu, this should be Central SOE and our note is out of date.',
  'hopu-investments': 'ICLAC PROPOSAL, pending external audit: POE. From the consortium note with COFCO: "Hopu Investments (private PE fund, Fang Fenglei)". Rule: direct. Company with no investments of its own.',
  'zhongrong-xinda': 'ICLAC PROPOSAL, pending external audit: POE. From the consortium note with Jiangtong: "Zhongrong Xinda (private)". Rule: direct. Company with no investments of its own.',
  'xiaomi': 'ICLAC PROPOSAL, pending external audit: POE. From the consortium note with COSCO: "Xiaomi (private, Lei Jun)". Rule: direct. Company with no investments of its own.',
  'andes-petroleum': 'ICLAC PROPOSAL, pending external audit: Central SOE. From the Ecuador consortium note: "Andes Petroleum = CNPC + CNOOC JV". PLEASE CHECK: we do not think this is a company to classify, we think it is a joint venture vehicle of two central SOEs, so we flagged is_jv_vehicle = TRUE; its parents are in controllers.',
  'texhong': 'NO PROPOSAL. The only note we have says "Chinese-Hong Kong capital, ultimate control to be determined". We have no basis to propose anything: this one is entirely for the external review.',
  'danasun-energy': 'NO PROPOSAL. Same note as Texhong. We have no basis to propose anything.',
}

const NOTE_ZH = 'Chinese name is an ICLAC PROPOSAL, not taken from a registry: please confirm or correct it.'

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
const header = rows[0]
const keep = header.map((h, i) => ({ h, i })).filter(({ h }) => !DROP.includes(h))
const iId = header.indexOf('company_id')
const iNote = header.indexOf('review_note')
const iZh = header.indexOf('chinese_name')

let notas = 0
const out = [keep.map(({ h }) => cell(h)).join(',')]
for (const row of rows.slice(1)) {
  if (row.length <= 1) continue
  const id = (row[iId] || '').trim()
  if (NOTES[id]) {
    row[iNote] = (row[iZh] || '').trim() ? `${NOTES[id]} ${NOTE_ZH}` : NOTES[id]
    notas++
  }
  out.push(keep.map(({ i }) => cell(row[i])).join(','))
}

console.log(`${write ? '' : '[dry-run] '}Columnas eliminadas: ${DROP.join(', ')}`)
console.log(`Notas reescritas en inglés: ${notas}`)
console.log(`Columnas resultantes (${keep.length}): ${keep.map(({ h }) => h).join(', ')}`)

if (write) {
  writeFileSync(CSV, out.join('\n') + '\n', 'utf8')
  console.log(`\nCSV reescrito: ${CSV}`)
} else {
  console.log('\nNada escrito. Correr con --write para aplicar.')
}
