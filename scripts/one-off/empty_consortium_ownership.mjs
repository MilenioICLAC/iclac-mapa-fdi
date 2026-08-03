// Vacía `ownership` en las filas de consorcio de data/schema/investors_map.csv.
//
// Un consorcio es un acuerdo entre empresas, no una empresa: no tiene dueño, lo tienen
// sus partes. El valor guardado (MIXED en 20 filas, UNKNOWN en 1) afirmaba un hecho que
// no puede ser cierto, y era lo que el filtro de propiedad leía.
//
// A partir de acá el vacío está RESERVADO para marcar «esto no es una empresa»: si de
// una empresa no se conoce la propiedad va UNKNOWN, no vacío. El validador lo exige en
// las dos direcciones (fila/consorcio-con-ownership y fila/ownership-vacio) y el
// frontend resuelve la propiedad de un consorcio desde sus miembros (`ownershipsOf`).
//
// Uso:
//   node scripts/one-off/empty_consortium_ownership.mjs           # dry-run
//   node scripts/one-off/empty_consortium_ownership.mjs --write

import { readFileSync, writeFileSync } from 'node:fs'

const CSV = 'data/schema/investors_map.csv'
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

const rows = parseCsv(readFileSync(CSV, 'utf8').replace(/\r\n/g, '\n').trim())
const header = rows[0]
const i = (n) => header.indexOf(n)
const iOwn = i('ownership'), iCons = i('is_consortium'), iCanon = i('company_canonical'), iMem = i('members')

const tocadas = []
const out = [header.map(cell).join(',')]
for (const r of rows.slice(1)) {
  if (r.length <= 1) continue
  if (String(r[iCons]).trim().toUpperCase() === 'TRUE' && (r[iOwn] || '').trim()) {
    tocadas.push({ n: (r[iCanon] || '').trim(), antes: r[iOwn].trim(), miembros: (r[iMem] || '').split('|').filter(Boolean).length })
    r[iOwn] = ''
  }
  out.push(r.map(cell).join(','))
}

console.log(`${write ? '' : '[dry-run] '}Filas de consorcio con ownership: ${tocadas.length}`)
const porValor = {}
for (const t of tocadas) porValor[t.antes] = (porValor[t.antes] || 0) + 1
console.log(`  valores que se van: ${Object.entries(porValor).map(([k, v]) => `${k}=${v}`).join(' · ')}`)
const sinMiembros = tocadas.filter((t) => !t.miembros)
if (sinMiembros.length) console.error(`  ! ${sinMiembros.length} sin members: quedarían sin forma de resolver la propiedad`)
for (const t of tocadas) console.log(`  ${t.n.slice(0, 52).padEnd(54)} ${t.antes} → (vacío), ${t.miembros} miembros`)

if (write) {
  writeFileSync(CSV, out.join('\n') + '\n', 'utf8')
  console.log(`\nCSV reescrito: ${CSV}`)
} else {
  console.log('\nNada escrito. Correr con --write para aplicar.')
}
