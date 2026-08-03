// Importa el XLSX editable de vuelta a data/schema/investors_map.csv.
//
// La otra mitad de `investors:export`. Existe porque el ida y vuelta a mano ya nos
// costó tres pérdidas de información con la misma forma: leer una columna e ignorar el
// resto. Los 14 veredictos escritos en filas marcadas "Ok", las marcas de color que no
// leíamos, y las tres empresas en rojo que quedaron como "sin revisar".
//
// Garantías, en este orden:
//   1. Machaca por `company_id`, nunca por posición. Filas reordenadas o columnas
//      agregadas no importan.
//   2. Una fila del editable es una EMPRESA; el CSV tiene una fila por nombre crudo.
//      El cambio se aplica a TODAS las filas de ese company_id, que es justo lo que
//      exige la regla del validador de una sola clasificación por empresa.
//   3. Imprime el diff completo antes de escribir. Sin --write no toca nada.
//   4. Se niega a borrar filas y a crear empresas nuevas salvo bandera explícita.
//   5. No escribe si el resultado no pasa `validateInvestors`.
//   6. Absorbe el destrozo de Excel sin quejarse: VERDADERO/FALSO, apóstrofe inicial,
//      comillas curvas, espacios duros. Nada de eso es error de quien edita.
//
// Uso:
//   npm run investors:import -- docs/investors_table.xlsx            # dry-run
//   npm run investors:import -- docs/investors_table.xlsx --write
//   ... --allow-new        acepta empresas que no existían
//   ... --allow-missing    acepta que falten empresas (las deja como están, no borra)
//   ... --source=texto     qué escribir en evidence_source de lo que cambió

import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { validateInvestors } from './lib/validate_investors.mjs'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const CSV = 'data/schema/investors_map.csv'
const argv = process.argv.slice(2)
const flag = (n) => argv.includes(`--${n}`)
const opt = (n, def) => (argv.find((a) => a.startsWith(`--${n}=`)) || `--${n}=${def}`).split('=').slice(1).join('=')

const XLS = argv.find((a) => !a.startsWith('--'))
const write = flag('write')
const allowNew = flag('allow-new')
const allowMissing = flag('allow-missing')
const hoy = new Date().toISOString().slice(0, 10)
const SOURCE = opt('source', `revision-externa-${hoy}`)

if (!XLS) {
  console.error('Falta el archivo. Uso: npm run investors:import -- docs/investors_table.xlsx')
  process.exit(1)
}

// Columnas que el editable puede cambiar. El resto se ignora aunque venga distinto:
// son generadas o son la llave.
const EDITABLES = [
  'company_canonical', 'ownership', 'ownership_status',
  'chinese_name', 'firm_type', 'controllers', 'control_paths',
  'is_jv_vehicle', 'origin_country', 'review_note',
]
const OWNERSHIP = ['Central SOE', 'Local SOE', 'POE', 'MIXED', 'UNKNOWN']
const STATUS = ['confirmed', 'proposed', 'unreviewed', 'flagged-for-removal', 'derived']

// ---------- limpieza de lo que hace Excel ----------
const limpiar = (v) => {
  if (v == null) return ''
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  let s = String(v)
  s = s.replace(/ /g, ' ')            // espacio duro
  s = s.replace(/[‘’]/g, "'")     // comillas curvas simples
  s = s.replace(/[“”]/g, '"')     // comillas curvas dobles
  s = s.replace(/^'/, '')                   // apóstrofe que Excel antepone al forzar texto
  s = s.replace(/\s+/g, ' ').trim()
  return s
}
const normBool = (v) => {
  const s = limpiar(v).toUpperCase()
  if (['TRUE', 'VERDADERO', 'SI', 'SÍ', 'YES', '1', 'X'].includes(s)) return 'TRUE'
  if (['FALSE', 'FALSO', 'NO', '0'].includes(s)) return 'FALSE'
  return ''
}
// El enum se normaliza sólo por mayúsculas y espacios. Cualquier otra cosa se reporta,
// no se adivina: convertir "SOE" en "Central SOE" sería inventar un dato.
const normEnum = (v, valores) => {
  const s = limpiar(v)
  if (!s) return ''
  const hit = valores.find((x) => x.toLowerCase() === s.toLowerCase())
  return hit ?? null
}

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

const csvRows = parseCsv(readFileSync(CSV, 'utf8').replace(/\r\n/g, '\n').trim())
const header = csvRows[0]
const idx = (n) => header.indexOf(n)
const recs = csvRows.slice(1).filter((r) => r.length > 1)

const iId = idx('company_id')
if (iId < 0) { console.error('El CSV no trae company_id.'); process.exit(1) }

// ---------- editable ----------
const wb = XLSX.readFile(XLS)
const hoja = wb.SheetNames.includes('companies') ? 'companies' : wb.SheetNames.find((n) => n !== 'README')
if (!hoja) { console.error('El archivo no trae una hoja de empresas.'); process.exit(1) }
const entrantes = XLSX.utils.sheet_to_json(wb.Sheets[hoja], { defval: '' })

const problemas = []
const porId = new Map()
for (const [n, e] of entrantes.entries()) {
  const fila = n + 2 // 1 = encabezado
  const id = limpiar(e.company_id)
  if (!id) { problemas.push(`fila ${fila}: sin company_id, se ignora`); continue }
  if (porId.has(id)) { problemas.push(`fila ${fila}: company_id "${id}" repetido en el editable`); continue }
  porId.set(id, { fila, e })
}

// ---------- diff ----------
const idsCsv = new Set(recs.map((r) => limpiar(r[iId])))
const nuevos = [...porId.keys()].filter((id) => !idsCsv.has(id))
const faltantes = [...idsCsv].filter((id) => !porId.has(id))

const cambios = []   // { id, empresa, campo, antes, ahora, filas }
const errores = []

// Agrupar filas del CSV por company_id: el editable trae una fila por empresa.
const filasPorId = new Map()
for (const r of recs) {
  const id = limpiar(r[iId])
  if (!filasPorId.has(id)) filasPorId.set(id, [])
  filasPorId.get(id).push(r)
}

for (const [id, filas] of filasPorId) {
  const entrada = porId.get(id)
  if (!entrada) continue
  const { fila, e } = entrada
  const nombre = limpiar(filas[0][idx('company_canonical')]) || id
  let tocada = false

  for (const campo of EDITABLES) {
    const iC = idx(campo)
    if (iC < 0) continue
    if (!(campo in e)) continue // columna ausente en el editable: no se toca

    let valor
    if (campo === 'is_jv_vehicle') valor = normBool(e[campo])
    else if (campo === 'ownership') {
      valor = normEnum(e[campo], OWNERSHIP)
      if (valor === null) { errores.push(`fila ${fila} (${nombre}): ownership "${limpiar(e[campo])}" no está en el enum`); continue }
    } else if (campo === 'ownership_status') {
      valor = normEnum(e[campo], STATUS)
      if (valor === null) { errores.push(`fila ${fila} (${nombre}): ownership_status "${limpiar(e[campo])}" no es un estado conocido`); continue }
    } else valor = limpiar(e[campo])

    const antes = limpiar(filas[0][iC])
    if (valor === antes) continue

    // company_canonical es la llave visible del validador: cambiarla en una fila y no
    // en las otras rompe el mapeo 1:1. Se aplica a todas, como todo lo demás.
    cambios.push({ id, nombre, campo, antes: antes || '(vacío)', ahora: valor || '(vacío)', filas: filas.length })
    for (const r of filas) r[iC] = valor
    tocada = true
  }

  // Procedencia automática: si alguien cambió algo, la evidencia de esa fila ya no es
  // la que era. Dejarlo manual es cómo se pierde el rastro.
  if (tocada && idx('evidence_source') >= 0) {
    const antes = limpiar(filas[0][idx('evidence_source')])
    if (antes !== SOURCE) {
      cambios.push({ id, nombre, campo: 'evidence_source', antes: antes || '(vacío)', ahora: SOURCE, filas: filas.length, auto: true })
      for (const r of filas) r[idx('evidence_source')] = SOURCE
    }
  }
}

// ---------- informe ----------
const pref = write ? '' : '[dry-run] '
console.log(`${pref}${XLS} → ${CSV}`)
console.log(`  editable: ${entrantes.length} empresas · CSV: ${recs.length} filas, ${filasPorId.size} empresas`)

if (problemas.length) {
  console.log(`\nAvisos del archivo (${problemas.length}):`)
  for (const p of problemas) console.log('  ! ' + p)
}

const porCampo = {}
for (const c of cambios) porCampo[c.campo] = (porCampo[c.campo] || 0) + 1
console.log(`\nCambios: ${cambios.length} en ${new Set(cambios.map((c) => c.id)).size} empresas`)
if (cambios.length) {
  console.log(`  por columna: ${Object.entries(porCampo).map(([k, v]) => `${k}=${v}`).join(' · ')}`)
  for (const c of cambios) {
    const corta = (s) => (s.length > 46 ? s.slice(0, 45) + '…' : s)
    console.log(`  ${c.auto ? '·' : '→'} ${c.nombre.slice(0, 26).padEnd(28)} ${c.campo.padEnd(17)} ${corta(c.antes).padEnd(47)} ${corta(c.ahora)}${c.filas > 1 ? `  (${c.filas} filas)` : ''}`)
  }
}

if (nuevos.length) {
  console.log(`\nEmpresas nuevas en el editable (${nuevos.length}): ${nuevos.join(', ')}`)
  if (!allowNew) errores.push(`Hay ${nuevos.length} empresa(s) que no existen en el CSV. Crear una ficha necesita investor_raw, así que se hace a mano o con --allow-new (que todavía no está implementado).`)
}
if (faltantes.length) {
  console.log(`\nEmpresas del CSV que no vinieron en el editable (${faltantes.length}): ${faltantes.slice(0, 12).join(', ')}${faltantes.length > 12 ? '…' : ''}`)
  if (!allowMissing) errores.push(`Faltan ${faltantes.length} empresa(s) en el editable. No se borra nada nunca; si el archivo es un recorte a propósito, correr con --allow-missing.`)
  else console.log('  (--allow-missing: se dejan como están, no se borran)')
}

// ---------- validación antes de escribir ----------
const comoObjetos = recs.map((r) => Object.fromEntries(header.map((h, k) => [h, r[k]])))
const val = validateInvestors(comoObjetos)
if (!val.stats.passed) {
  console.log(`\nEl resultado NO pasa el validador: ${val.stats.errors} error(es).`)
  for (const i of val.issues.filter((x) => x.severity === 'error').slice(0, 12)) {
    console.log(`  ✗ [${i.rule}] fila ${i.row}: ${i.message}`)
  }
  errores.push('El CSV resultante no pasa validate:investors.')
} else {
  console.log(`\nValidador: ${val.stats.rows} filas · 0 errores · ${val.stats.warnings} advertencia(s) → PASA`)
}

if (errores.length) {
  console.log(`\nNo se escribe nada. Motivos (${errores.length}):`)
  for (const e of errores) console.log('  ✗ ' + e)
  process.exit(1)
}

if (!cambios.length) {
  console.log('\nNada que cambiar.')
  process.exit(0)
}

if (write) {
  const out = [header.map(cell).join(','), ...recs.map((r) => r.map(cell).join(','))]
  writeFileSync(CSV, out.join('\n') + '\n', 'utf8')
  console.log(`\nCSV reescrito: ${CSV}`)
  console.log('Después: node scripts/build_investors_map.mjs && npm run validate:investors')
} else {
  console.log('\nNada escrito. Correr con --write para aplicar.')
}
