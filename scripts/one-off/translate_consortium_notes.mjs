// Pasa a inglés las notas de las 21 filas de consorcio de investors_map.csv.
//
// Mismo argumento que con las 18 fichas sembradas: el editable va a la revisión externa
// y una nota que el lector no puede leer no sirve de nada. Estas notas son la evidencia
// de con qué empresas está armado cada consorcio, que es justo lo que hay que auditar.
//
// Se conserva todo lo que es dato —los porcentajes de Las Bambas, las fuentes citadas,
// la composición— y se marcan con PLEASE CHECK las cuatro que traen una pregunta real.
//
// Uso:
//   node scripts/one-off/translate_consortium_notes.mjs           # dry-run
//   node scripts/one-off/translate_consortium_notes.mjs --write

import { readFileSync, writeFileSync } from 'node:fs'

const CSV = 'data/schema/investors_map.csv'
const write = process.argv.includes('--write')

const NOTES = {
  'mmg-guoxin-and-citic-metal-company':
    'CONSORTIUM, Las Bambas (MMG 62.5% / Guoxin 22.5% / CITIC Metal 15%); all three state-owned. Source: MMG / Minmetals press, minmetals.com.',
  'china-harbour-engineering-company-and-xi':
    'CONSORTIUM. CHEC is a CCCC subsidiary (central SASAC). Xi\'an Rail Transportation Group is a municipal SOE of Xi\'an.',
  'zijin-tongling-and-xiamen-c-d':
    'CONSORTIUM. Zijin (SOE), Tongling Nonferrous (Anhui SOE), Xiamen C&D (Xiamen SOE).',
  'taiyuan-iron-citic-and-baosteel':
    'CONSORTIUM. TISCO (Shanxi SOE), CITIC (central SOE), Baosteel / Baowu (central SASAC).',
  'cccc-crcc-consortium':
    'CONSORTIUM. CCCC and CRCC, both central SASAC.',
  'cofco-and-hopu-investments':
    'CONSORTIUM. COFCO (SASAC) and Hopu Investments (private PE fund, Fang Fenglei).',
  'cccc-chec-consortium':
    'CONSORTIUM on paper. PLEASE CHECK: CHEC is a subsidiary of CCCC, so both sides belong to the same group. Is this a real consortium, or are we double counting a parent and its subsidiary as two investors?',
  'china-national-petroleum-corporation-and':
    'CONSORTIUM. CNPC and CNOOC, two different central SASAC groups.',
  'china-railway-construction-corporation-a':
    'CONSORTIUM. CRCC (SASAC) and Tongling Nonferrous (Anhui SOE).',
  'china-national-electric-engineering-comp':
    'CONSORTIUM on paper. PLEASE CHECK: CNEEC and CMEC are both Sinomach subsidiaries (central SASAC), so this may be the same group counted twice rather than two investors.',
  'camc-and-sinopharm':
    'CONSORTIUM. CAMCE (Sinomach subsidiary, SASAC) and Sinopharm (central SASAC).',
  'camce-engineering-and-china-national-ele':
    'CONSORTIUM. CAMCE (Sinomach subsidiary, SASAC) and CEIEC (CETC subsidiary, SASAC).',
  'china-united-engineering-and-dongfang-tu':
    'CONSORTIUM. China United Engineering (Sinomach subsidiary, SASAC) and Dongfang Turbine (Dongfang Electric subsidiary, SASAC).',
  'china-construction-america-and-mcm':
    'CONSORTIUM. CCA is a CSCEC subsidiary (SASAC). PLEASE CHECK: our note says MCM is the local partner, which would mean it is not a Chinese company and does not belong in this registry at all. If confirmed, MCM comes out of members and the deal keeps only CCA.',
  'baiyin-and-shougang':
    'CONSORTIUM. Baiyin Nonferrous (Gansu SOE) and Shougang (Beijing SOE).',
  'zhongrong-xinda-and-jiangtong-group':
    'CONSORTIUM. Zhongrong Xinda (private) and Jiangtong / Jiangxi Copper (provincial SOE).',
  'china-three-gorges-and-china-internation':
    'CONSORTIUM on paper. PLEASE CHECK: CWE is a subsidiary of CTG, so both sides are the same SASAC group. Same parent-subsidiary doubt as CCCC + CHEC.',
  'china-national-petroleum-corporation-sin':
    'CONSORTIUM. CNPC and Sinopec (SASAC). Andes Petroleum, the third member, is itself a CNPC + CNOOC joint venture vehicle.',
  'cosco-and-xiaomi':
    'CONSORTIUM. COSCO (SASAC) and Xiaomi (private, Lei Jun).',
  'texhong-danasun-consortium':
    'PLEASE CHECK, we could not resolve this one. The source row puts two companies in a single investor cell, Texhong and Danasun Energy, described as Chinese-Hong Kong capital. We need to know whether this is really a consortium and who ultimately controls each side.',
  'cnooc-sinopec-consortium':
    'CONSORTIUM. CNOOC and Sinopec, both central SASAC. Same reading as the CNPC + CNOOC one.',
}

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
const i = (n) => header.indexOf(n)
const iId = i('company_id'), iCons = i('is_consortium'), iNote = i('review_note')

let n = 0
const sinTraducir = []
const out = [header.map(cell).join(',')]
for (const r of rows.slice(1)) {
  if (r.length <= 1) continue
  if (String(r[iCons]).trim().toUpperCase() === 'TRUE') {
    const id = (r[iId] || '').trim()
    if (NOTES[id]) { r[iNote] = NOTES[id]; n++ }
    else sinTraducir.push(id)
  }
  out.push(r.map(cell).join(','))
}

console.log(`${write ? '' : '[dry-run] '}Notas traducidas: ${n} de ${Object.keys(NOTES).length}`)
if (sinTraducir.length) console.error(`  ! sin traducción: ${sinTraducir.join(', ')}`)
console.log(`Marcadas PLEASE CHECK: ${Object.values(NOTES).filter((v) => v.includes('PLEASE CHECK')).length}`)

if (write) {
  writeFileSync(CSV, out.join('\n') + '\n', 'utf8')
  console.log(`\nCSV reescrito: ${CSV}`)
} else {
  console.log('\nNada escrito. Correr con --write para aplicar.')
}
