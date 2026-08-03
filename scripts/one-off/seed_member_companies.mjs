// Crea la ficha de las empresas que hoy aparecen SOLO como miembro de un consorcio y
// no existen como fila en data/schema/investors_map.csv.
//
// Por qué: 21 consorcios apuntan a miembros que no existen, así que la propiedad de un
// consorcio no se puede calcular desde sus partes y el Sankey arma el nombre desde el
// slug ("Xiamen CD" en vez de "Xiamen C&D"). Es una referencia colgando.
//
// La propiedad que se escribe acá es UNA PROPUESTA NUESTRA, no un dato verificado:
// sale de las notas que ya estaban en las filas de los consorcios, aplicando las reglas
// del esquema §5.1 (la propiedad es la del controlador último; central vs local se
// decide por quién es el dueño estatal). Por eso van con ownership_status=propuesto y
// evidence_source=iclac. La revisión externa las audita, no las escribe desde cero.
//
// Las columnas de evidencia de registro chino (chinese_name, firm_type, control_paths)
// se dejan VACÍAS a propósito. Su valor es que vienen de un registro; llenarlas con
// nuestras conjeturas destruiría lo único que las hace confiables. El hueco es el
// entregable: es lo que la revisión externa tiene que completar.
//
// Uso:
//   node scripts/one-off/seed_member_companies.mjs           # dry-run
//   node scripts/one-off/seed_member_companies.mjs --write

import { readFileSync, writeFileSync } from 'node:fs'

const CSV = 'data/schema/investors_map.csv'
const write = process.argv.includes('--write')
const FUENTE = 'iclac-propuesta-2026-08'

// company_id -> propuesta. `nota` cita la evidencia de la que salió y `regla` dice cómo
// se pasó de esa evidencia al enum. `controller` es el controlador último en alfabeto
// latino: la revisión externa lo reemplaza por el nombre del registro, en chino.
const PROPUESTAS = {
  'sinopharm': {
    canon: 'Sinopharm', own: 'Central SOE', controller: 'SASAC (central)',
    nota: 'Nota del consorcio CAMCE+Sinopharm: «Sinopharm (SASAC central)».', regla: 'directa',
  },
  'baosteel': {
    canon: 'Baosteel', own: 'Central SOE', controller: 'SASAC (central), vía China Baowu',
    nota: 'Nota del consorcio Taiyuan Iron+CITIC+Baosteel: «Baosteel/Baowu (SASAC central)».', regla: 'directa',
  },
  'camce': {
    canon: 'CAMCE Engineering', own: 'Central SOE', controller: 'SASAC (central), vía Sinomach',
    nota: 'Notas de dos consorcios: «CAMCE (filial Sinomach, SASAC)».', regla: 'controlador último',
  },
  'cneec': {
    canon: 'China National Electric Engineering Company', own: 'Central SOE', controller: 'SASAC (central), vía Sinomach',
    nota: 'Nota del consorcio CNEEC+CMEC: «filial Sinomach» (ambas del mismo grupo).', regla: 'controlador último',
  },
  'china-united-engineering': {
    canon: 'China United Engineering', own: 'Central SOE', controller: 'SASAC (central), vía Sinomach',
    nota: 'Nota del consorcio con Dongfang Turbine: «China United Engineering (filial Sinomach, SASAC)».', regla: 'controlador último',
  },
  'mmg': {
    canon: 'MMG', own: 'Central SOE', controller: 'SASAC (central), vía China Minmetals',
    nota: 'Nota de Las Bambas: «MMG 62.5% … todos estatales». Fuente citada: minmetals.com.', regla: 'controlador último',
    duda: 'La nota dice «estatal» sin precisar central. El «central» lo agregamos nosotros porque Minmetals es SASAC. Si fuera local, Las Bambas pasa de estatal central a estatal central + local: sigue siendo enteramente estatal.',
  },
  'guoxin': {
    canon: 'Guoxin', own: 'Central SOE', controller: 'SASAC (central), vía China Reform / Guoxin',
    nota: 'Nota de Las Bambas: «Guoxin 22.5% … todos estatales».', regla: 'controlador último',
    duda: 'Misma duda que MMG: la nota dice «estatal», no «central».',
  },
  'xian-rail-transportation-group': {
    canon: "Xi'an Rail Transportation Group", own: 'Local SOE', controller: 'Municipio de Xi’an',
    nota: 'Nota del consorcio con CHEC: «Xi’an Rail Transp. Group = SOE municipal Xi’an».', regla: 'directa',
  },
  'tongling-nonferrous': {
    canon: 'Tongling Nonferrous', own: 'Local SOE', controller: 'Provincia de Anhui',
    nota: 'Notas de dos consorcios: «Tongling Nonferrous (SOE Anhui)».', regla: 'directa',
  },
  'xiamen-cd': {
    canon: 'Xiamen C&D', own: 'Local SOE', controller: 'Municipio de Xiamen',
    nota: 'Nota del consorcio Zijin+Tongling+Xiamen C&D: «Xiamen C&D (SOE Xiamen)».', regla: 'directa',
  },
  'jiangtong-group': {
    canon: 'Jiangtong Group', own: 'Local SOE', controller: 'Provincia de Jiangxi',
    nota: 'Nota del consorcio con Zhongrong Xinda: «Jiangtong/Jiangxi Copper (SOE provincial)».', regla: 'directa',
  },
  'taiyuan-iron': {
    canon: 'Taiyuan Iron', own: 'Local SOE', controller: 'Provincia de Shanxi',
    nota: 'Nota del consorcio: «TISCO (SOE Shanxi)».', regla: 'directa',
    duda: 'LA MÁS DÉBIL DE LAS 19. TISCO se integró a China Baowu, que es SASAC central. Si el controlador último hoy es Baowu, corresponde Central SOE y la nota está desactualizada.',
  },
  'hopu-investments': {
    canon: 'Hopu Investments', own: 'POE', controller: 'Privado (Fang Fenglei)',
    nota: 'Nota del consorcio con COFCO: «Hopu Investments (fondo PE privado, Fang Fenglei)».', regla: 'directa',
  },
  'zhongrong-xinda': {
    canon: 'Zhongrong Xinda', own: 'POE', controller: 'Privado',
    nota: 'Nota del consorcio con Jiangtong: «Zhongrong Xinda (privada)».', regla: 'directa',
  },
  'xiaomi': {
    canon: 'Xiaomi', own: 'POE', controller: 'Privado (Lei Jun)',
    nota: 'Nota del consorcio con COSCO: «Xiaomi (privada, Lei Jun)».', regla: 'directa',
  },
  'andes-petroleum': {
    canon: 'Andes Petroleum', own: 'Central SOE', controller: 'SASAC (central), vía CNPC y CNOOC',
    nota: 'Nota del consorcio en Ecuador: «Andes Petroleum = JV CNPC+CNOOC».', regla: 'vehículo conjunto',
    jv: true,
    duda: 'No es una empresa por clasificar: es un vehículo conjunto de dos estatales centrales. Se marca is_jv_vehicle=TRUE.',
  },
  'texhong': {
    canon: 'Texhong International Group', own: 'UNKNOWN', controller: '',
    nota: 'Sin diagnóstico. La nota solo dice «capital chino-hongkonés, definir el control último».', regla: 'sin propuesta',
    duda: 'No tenemos base para proponer nada. Queda entera para la revisión externa.',
  },
  'danasun-energy': {
    canon: 'Danasun Energy', own: 'UNKNOWN', controller: '',
    nota: 'Sin diagnóstico. Misma nota que Texhong.', regla: 'sin propuesta',
    duda: 'No tenemos base para proponer nada.',
  },
}

// MCM queda deliberadamente fuera: la nota del consorcio dice «MCM (socio local)», o
// sea que no es una empresa china y no corresponde que esté en un registro de
// inversores chinos. Es un caso de socio no chino mal cargado como miembro. Sacarlo de
// members del consorcio PAN-0015 es una corrección de datos aparte, no una ficha nueva.
const EXCLUIDA = { mcm: 'La nota dice «MCM (socio local)»: no es empresa china. No corresponde ficha; hay que sacarla de members.' }

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

const raw = readFileSync(CSV, 'utf8').replace(/\r\n/g, '\n').trim()
const rows = parseCsv(raw)
const header = rows[0]
const idx = (n) => header.indexOf(n)
for (const c of ['ownership_status', 'evidence_source', 'controllers', 'is_jv_vehicle']) {
  if (idx(c) < 0) { console.error(`Falta la columna "${c}". Correr antes add_evidence_columns.mjs.`); process.exit(1) }
}

const recs = rows.slice(1).filter((r) => r.length > 1)
const existentes = new Set(recs.map((r) => (r[idx('company_id')] || '').trim()))
const rawSeen = new Set(recs.map((r) => (r[idx('investor_raw')] || '').trim()))

// Verificación: los ids que vamos a sembrar tienen que estar realmente referenciados
// como miembro por algún consorcio, y no existir ya.
const referenciados = new Set()
for (const r of recs) {
  if (String(r[idx('is_consortium')] || '').toUpperCase() !== 'TRUE') continue
  for (const m of (r[idx('members')] || '').split('|')) if (m.trim()) referenciados.add(m.trim())
}

const nuevas = []
const saltadas = []
for (const [id, p] of Object.entries(PROPUESTAS)) {
  if (existentes.has(id)) { saltadas.push(`${id}: ya existe`); continue }
  if (!referenciados.has(id)) { saltadas.push(`${id}: ningún consorcio lo referencia`); continue }
  // investor_raw es obligatorio y único. Estas empresas nunca aparecen solas como
  // inversor en la base, así que se usa el nombre canónico: significa "si algún día
  // aparece este nombre en un archivo por país, mapea a esta empresa".
  if (rawSeen.has(p.canon)) { saltadas.push(`${id}: investor_raw "${p.canon}" ya en uso`); continue }

  const nota = [
    p.own === 'UNKNOWN' ? 'SIN PROPUESTA.' : `PROPUESTA ICLAC, pendiente de auditoría externa: ${p.own}.`,
    p.nota,
    p.regla !== 'sin propuesta' ? `Regla: ${p.regla} (esquema §5.1).` : null,
    p.duda ? `DUDA: ${p.duda}` : null,
    'Empresa sin inversiones propias: aparece solo como miembro de consorcio.',
  ].filter(Boolean).join(' ')

  const row = header.map(() => '')
  row[idx('investor_raw')] = p.canon
  row[idx('company_id')] = id
  row[idx('company_canonical')] = p.canon
  row[idx('is_consortium')] = 'FALSE'
  row[idx('members')] = ''
  row[idx('ownership')] = p.own
  row[idx('review_note')] = nota
  if (idx('_count') >= 0) row[idx('_count')] = '0'
  if (idx('_musd') >= 0) row[idx('_musd')] = '0'
  row[idx('ownership_status')] = p.own === 'UNKNOWN' ? 'unreviewed' : 'proposed'
  row[idx('evidence_source')] = FUENTE
  row[idx('controllers')] = p.controller || ''
  if (p.jv) row[idx('is_jv_vehicle')] = 'TRUE'

  nuevas.push({ id, p, row })
  rawSeen.add(p.canon)
}

// ---------- informe ----------
console.log(`${write ? '' : '[dry-run] '}Fichas nuevas: ${nuevas.length}`)
const porOwn = {}
for (const n of nuevas) porOwn[n.p.own] = (porOwn[n.p.own] || 0) + 1
console.log(`  ${Object.entries(porOwn).map(([k, v]) => `${k}=${v}`).join(' · ')}`)
for (const n of nuevas) {
  console.log(`  ${n.id.padEnd(32)} ${n.p.own.padEnd(12)} ${n.p.duda ? '⚠ con duda' : ''}`)
}
if (saltadas.length) console.log(`\nSaltadas (${saltadas.length}): ${saltadas.join(' · ')}`)
console.log(`\nNo se siembra: ${Object.entries(EXCLUIDA).map(([k, v]) => `${k} — ${v}`).join(' · ')}`)
console.log('\nDudas que la auditoría externa tiene que resolver:')
for (const n of nuevas) if (n.p.duda) console.log(`  · ${n.id}: ${n.p.duda}`)

if (write) {
  const out = [header.map(cell).join(','), ...recs.map((r) => r.map(cell).join(',')), ...nuevas.map((n) => n.row.map(cell).join(','))]
  writeFileSync(CSV, out.join('\n') + '\n', 'utf8')
  console.log(`\nCSV reescrito: ${CSV}`)
  console.log('Después: node scripts/build_investors_map.mjs && npm run validate:investors')
} else {
  console.log('\nNada escrito. Correr con --write para aplicar.')
}
