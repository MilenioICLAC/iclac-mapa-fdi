// Carga el nombre en chino PROPUESTO por nosotros para algunas de las fichas que
// sembramos el 03-08 (`seed_member_companies.mjs`).
//
// Estos nombres NO salen de un registro: son nuestra propuesta, y existen para que la
// revisión externa parta de un candidato en vez de una celda vacía. Toda la fila ya
// lleva `evidence_source=iclac-propuesta-2026-08`, así que ningún consumidor puede
// confundirlos con los 155 que sí vienen del registro chino; además la nota lo dice.
//
// Solo se cargan las empresas cuyo nombre chino escribiríamos sin dudar. Las demás
// quedan vacías a propósito: un nombre equivocado es peor que un hueco, porque parece
// autoritativo y manda a buscar la empresa que no es.
//
// Uso:
//   node scripts/one-off/set_proposed_chinese_names.mjs           # dry-run
//   node scripts/one-off/set_proposed_chinese_names.mjs --write

import { readFileSync, writeFileSync } from 'node:fs'

const CSV = 'data/schema/investors_map.csv'
const write = process.argv.includes('--write')

const NOMBRES = {
  'sinopharm': '中国医药集团有限公司',
  'xiaomi': '小米集团',
  'jiangtong-group': '江西铜业集团有限公司',
  'taiyuan-iron': '太原钢铁（集团）有限公司',
  'xiamen-cd': '厦门建发集团有限公司',
  'xian-rail-transportation-group': '西安市轨道交通集团有限公司',
}

// Las que NO se cargan, y por qué. Se listan para que la ausencia sea una decisión
// legible y no un olvido.
const OMITIDAS = {
  'baosteel': 'Ambiguo: 宝钢集团 (Baosteel Group) o 中国宝武钢铁集团 (Baowu) según a qué entidad se refiera la fila.',
  'mmg': 'MMG Limited está registrada en Hong Kong; su nombre chino depende de si se apunta a la cotizada o a 五矿资源.',
  'guoxin': 'Hay varias entidades "Guoxin"; sin el registro no se puede elegir.',
  'camce': 'CAMCE y CAMC se confunden en las fuentes en inglés.',
  'cneec': 'Sigla ambigua entre varias filiales de Sinomach.',
  'china-united-engineering': 'Probable 中国联合工程有限公司, pero no lo daría por cierto.',
  'hopu-investments': 'Probable 厚朴投资, sin confirmar la razón social exacta.',
  'zhongrong-xinda': 'Probable 中融新大集团, sin confirmar.',
  'texhong': 'La ficha dice "Texhong International Group" y la cotizada es 天虹纺织集团; no está claro si son la misma entidad.',
  'andes-petroleum': 'Sociedad registrada en Ecuador; su nombre chino sería una traducción, no una razón social.',
  'danasun-energy': 'No la identificamos.',
  'tongling-nonferrous': 'Probable 铜陵有色金属集团, pero el grupo tiene varias entidades con nombre parecido.',
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
const iId = header.indexOf('company_id')
const iZh = header.indexOf('chinese_name')
const iSrc = header.indexOf('evidence_source')
const iNote = header.indexOf('review_note')
if (iId < 0 || iZh < 0 || iSrc < 0) {
  console.error('Faltan columnas. Correr antes add_evidence_columns.mjs.')
  process.exit(1)
}

const NOTA = 'Nombre en chino PROPUESTO por nosotros, sin verificar en registro: confirmarlo o corregirlo.'
let tocadas = 0
const out = [header.map(cell).join(',')]
for (const row of rows.slice(1)) {
  if (row.length <= 1) continue
  const id = (row[iId] || '').trim()
  const zh = NOMBRES[id]
  if (zh && !row[iZh]) {
    // Guarda: no pisar nada que venga del registro externo.
    if ((row[iSrc] || '').startsWith('revision-externa')) {
      console.error(`  ! ${id} viene de la revisión externa; no se toca.`)
    } else {
      row[iZh] = zh
      if (iNote >= 0 && !String(row[iNote]).includes(NOTA)) row[iNote] = `${row[iNote]} ${NOTA}`.trim()
      tocadas++
    }
  }
  out.push(row.map(cell).join(','))
}

console.log(`${write ? '' : '[dry-run] '}Nombres chinos propuestos cargados: ${tocadas} de ${Object.keys(NOMBRES).length}`)
for (const [id, zh] of Object.entries(NOMBRES)) console.log(`  ${id.padEnd(32)} ${zh}`)
console.log(`\nSe dejan vacías a propósito (${Object.keys(OMITIDAS).length}):`)
for (const [id, why] of Object.entries(OMITIDAS)) console.log(`  ${id.padEnd(28)} ${why}`)

if (write) {
  writeFileSync(CSV, out.join('\n') + '\n', 'utf8')
  console.log(`\nCSV reescrito: ${CSV}`)
} else {
  console.log('\nNada escrito. Correr con --write para aplicar.')
}
