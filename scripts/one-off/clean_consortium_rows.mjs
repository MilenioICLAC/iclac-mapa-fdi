// Limpia las filas de consorcio de investors_map.csv de tres cosas que quedaron viejas
// al vaciar su `ownership` y pasar la propiedad a calcularse desde los miembros.
//
// 1. `ownership_status = pending-calculation` -> `derived`. «Pendiente» prometía un
//    estado futuro que no va a llegar: la propiedad de un consorcio NO se guarda nunca,
//    se resuelve al leerla. `derived` le dice a quien edita que la celda vacía no es un
//    hueco por llenar.
// 2. Fuera el sufijo `CALCULATED FROM MEMBERS: …` de las notas. Es un cálculo pegado en
//    la fuente, que se desactualiza en cuanto un miembro cambie de clasificación. Es el
//    mismo error que ya pagamos con `_count` y `_musd`.
// 3. Fuera «Definir atribucion de monto» (20 filas) y «aunque enum=MIXED» (1). La
//    atribución está resuelta —el monto se queda en la operación y nunca se reparte
//    entre los miembros, ver `scopeInvestments`— y el enum ya no es MIXED. Dejarlas
//    haría creer que hay preguntas abiertas que no existen.
//
// Lo que NO se toca: la evidencia. Los porcentajes de Las Bambas, las fuentes citadas y
// la composición de cada consorcio se quedan enteras.
//
// Uso:
//   node scripts/one-off/clean_consortium_rows.mjs           # dry-run
//   node scripts/one-off/clean_consortium_rows.mjs --write

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
const iCons = i('is_consortium'), iSt = i('ownership_status'), iNote = i('review_note'), iCanon = i('company_canonical')

const stats = { estado: 0, calculated: 0, atribucion: 0, enumMixed: 0 }
const out = [header.map(cell).join(',')]
const muestras = []

for (const r of rows.slice(1)) {
  if (r.length <= 1) continue
  if (String(r[iCons]).trim().toUpperCase() === 'TRUE') {
    if ((r[iSt] || '').trim() === 'pending-calculation') { r[iSt] = 'derived'; stats.estado++ }

    const antes = (r[iNote] || '').trim()
    let n = antes
    if (/CALCULATED FROM MEMBERS:/.test(n)) { n = n.replace(/\s*CALCULATED FROM MEMBERS:.*$/, ''); stats.calculated++ }
    if (/Definir atribuci[oó]n/i.test(n)) { n = n.replace(/\s*Definir atribuci[oó]n(\s+de\s+monto)?\.?/gi, ''); stats.atribucion++ }
    if (/aunque enum=MIXED/i.test(n)) { n = n.replace(/\s*aunque enum=MIXED/gi, ''); stats.enumMixed++ }
    n = n.replace(/\s{2,}/g, ' ').replace(/\s+([;.,])/g, '$1').replace(/[;,]\s*$/, '').trim()
    if (n !== antes) { r[iNote] = n; if (muestras.length < 3) muestras.push([(r[iCanon] || '').trim(), antes, n]) }
  }
  out.push(r.map(cell).join(','))
}

console.log(`${write ? '' : '[dry-run] '}Filas de consorcio tocadas`)
console.log(`  ownership_status pending-calculation → derived : ${stats.estado}`)
console.log(`  notas con "CALCULATED FROM MEMBERS" limpiadas  : ${stats.calculated}`)
console.log(`  notas con "Definir atribucion" limpiadas       : ${stats.atribucion}`)
console.log(`  notas con "aunque enum=MIXED" limpiadas        : ${stats.enumMixed}`)
console.log('\nAntes y después:')
for (const [n, a, b] of muestras) {
  console.log(`\n  ${n}`)
  console.log(`    antes:   ${a}`)
  console.log(`    después: ${b}`)
}

if (write) {
  writeFileSync(CSV, out.join('\n') + '\n', 'utf8')
  console.log(`\nCSV reescrito: ${CSV}`)
} else {
  console.log('\nNada escrito. Correr con --write para aplicar.')
}
