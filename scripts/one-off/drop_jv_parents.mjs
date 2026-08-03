// Elimina la columna `jv_parents` de data/schema/investors_map.csv.
//
// Por qué: duplica `controllers`. En las dos únicas filas que la tenían llena decía lo
// mismo dos veces —Andes Petroleum: controllers «SASAC (central), vía CNPC y CNOOC» y
// jv_parents «CNPC|CNOOC»—, y en los tres vehículos JV que marcó la revisión externa
// quedaba vacía **por diseño**, porque sus socios son personas naturales y la columna
// solo admitía empresas. Una columna vacía en la mayoría de sus casos está mal pensada.
//
// `is_jv_vehicle` se queda: dice algo que no se deduce de `controllers` (esta empresa
// existe porque varias partes la crearon) y está verificado que tampoco se deduce del
// número de controladores: de 10 empresas con más de uno, 8 no son vehículos conjuntos
// sino empresas familiares.
//
// Verificado antes de correr: el dato de las dos filas sobrevive en `controllers` y en
// `review_note`, así que no se pierde nada.
//
// Uso:
//   node scripts/one-off/drop_jv_parents.mjs           # dry-run
//   node scripts/one-off/drop_jv_parents.mjs --write

import { readFileSync, writeFileSync } from 'node:fs'

const CSV = 'data/schema/investors_map.csv'
const COL = 'jv_parents'
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
const i = header.indexOf(COL)
if (i < 0) { console.error(`La columna "${COL}" no existe. Nada que hacer.`); process.exit(1) }

const iCanon = header.indexOf('company_canonical')
const iCtrl = header.indexOf('controllers')

// Guarda: no soltar un valor que no esté reflejado en controllers.
const conValor = []
for (const r of rows.slice(1)) {
  if (r.length <= 1) continue
  const v = (r[i] || '').trim()
  if (!v) continue
  const ctrl = (r[iCtrl] || '').trim()
  const partes = v.split('|').map((s) => s.trim()).filter(Boolean)
  const cubierto = partes.every((p) => ctrl.toLowerCase().includes(p.toLowerCase()))
  conValor.push({ empresa: (r[iCanon] || '').trim(), v, ctrl, cubierto })
}

console.log(`${write ? '' : '[dry-run] '}Eliminar "${COL}" de ${CSV}`)
console.log(`Filas con valor: ${conValor.length}`)
for (const c of conValor) {
  console.log(`  ${c.cubierto ? '✔' : '✗'} ${c.empresa.padEnd(22)} ${c.v.padEnd(16)} controllers: ${c.ctrl}`)
}
const perdidos = conValor.filter((c) => !c.cubierto)
if (perdidos.length) {
  console.error(`\n${perdidos.length} valor(es) NO están reflejados en controllers. No se elimina: primero hay que moverlos.`)
  process.exit(1)
}
console.log('\nTodos los valores están reflejados en controllers: no se pierde nada.')

const out = rows
  .filter((r) => r.length > 1 || r === header)
  .map((r) => r.filter((_, k) => k !== i).map(cell).join(','))

console.log(`Columnas: ${header.length} → ${header.length - 1}`)

if (write) {
  writeFileSync(CSV, out.join('\n') + '\n', 'utf8')
  console.log(`\nCSV reescrito: ${CSV}`)
} else {
  console.log('\nNada escrito. Correr con --write para aplicar.')
}
