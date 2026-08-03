// Cierra los dos huecos que quedaban en investors_map.csv después del pase del 03-08:
//
//   1. Las empresas `unreviewed` para las que sí teníamos base para proponer algo. No
//      haberlas mirado fue omisión nuestra, no falta de evidencia.
//   2. Los consorcios `pending-calculation`: se les anota en `review_note` cuál sería su
//      propiedad calculada desde los miembros. NO se les cambia el valor guardado,
//      porque calcularlo de verdad es adoptar la salida que todavía está en decisión de
//      ICLAC. La nota informa; no compromete.
//
// Uso:
//   node scripts/one-off/propose_remaining.mjs           # dry-run
//   node scripts/one-off/propose_remaining.mjs --write

import { readFileSync, writeFileSync } from 'node:fs'

const CSV = 'data/schema/investors_map.csv'
const write = process.argv.includes('--write')

// Propuestas para las que quedaban sin revisar. La nota va en inglés, como el resto de
// lo que se manda a la revisión externa.
const PROPUESTAS = {
  'afecc': {
    ownership: 'Local SOE',
    controllers: 'Anhui provincial government',
    note: 'ICLAC PROPOSAL, pending external audit: Local SOE. AFECC is the Anhui provincial state construction group; the investment is the Costa Rica national stadium, the kind of turnkey stadium contract it is known for. Rule: central vs local follows the owning state body, and this one is provincial. Never went to external review because Costa Rica is not published yet.',
  },
  'texhong': {
    ownership: 'POE',
    controllers: 'Hong Tianzhu (founder)',
    note: 'ICLAC PROPOSAL, pending external audit: POE. Texhong International Group is Hong Kong listed and founder controlled. PLEASE CHECK: this replaces our earlier "no basis to propose"; we had not looked at the source row, which describes a textile park in Honduras. Never went to external review because Honduras is not published yet.',
  },
  'chaoyang-petroleum': {
    ownership: 'Central SOE',
    controllers: 'SASAC (central), via CNOOC and Sinopec',
    is_jv_vehicle: 'TRUE',
    note: 'ICLAC PROPOSAL, pending external audit: joint venture vehicle of CNOOC and Sinopec, both central SOEs. PLEASE CHECK TWO THINGS: (1) the source text is cut off at "CNOOC (12.5%) and Sinopec (12," so the two of them add up to 25% and we do not know who holds the other 75%. If the rest is non-Chinese, this may not belong in the repository at all. (2) It is registered in the BVI, so the vehicle itself is offshore. Never went to external review because Trinidad and Tobago is not published yet.',
  },
}

// Sin propuesta, y ahora con el motivo real en vez de un genérico.
const SIN_BASE = {
  'american-recycling': 'NO PROPOSAL, and the reason is a data problem, not a research gap: the source text for NIC-0003 is truncated exactly at "La inversión fue realizada por..." so the investor name is missing. "American Recycling" is the name of the plant, and may well be the local target rather than the Chinese investor, the same situation we found with MCM in Panama. Reported to the data team.',
  'danasun-energy': 'NO PROPOSAL. The source row for HND-0003 puts two companies in one investor cell, Texhong and Danasun Energy, and describes a textile park plus a solar plant. Texhong is the textile side; we have nothing on Danasun. The row probably needs splitting into two investments.',
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
const recs = rows.slice(1).filter((r) => r.length > 1)

// Propiedad de cada empresa, para poder calcular la de los consorcios.
const ownById = new Map()
for (const r of recs) {
  const id = (r[i('company_id')] || '').trim()
  if (id && String(r[i('is_consortium')]).toUpperCase() !== 'TRUE') ownById.set(id, (r[i('ownership')] || '').trim())
}
// Las propuestas de esta misma corrida entran al mapa antes de calcular los consorcios:
// si no, un consorcio cuyo miembro se propone acá se calcularía con el valor viejo.
for (const [id, p] of Object.entries(PROPUESTAS)) ownById.set(id, p.ownership)

const cambios = []
const out = [header.map(cell).join(',')]

for (const row of recs) {
  const id = (row[i('company_id')] || '').trim()
  const canon = (row[i('company_canonical')] || '').trim()

  const p = PROPUESTAS[id]
  if (p) {
    row[i('ownership')] = p.ownership
    row[i('ownership_status')] = 'proposed'
    row[i('evidence_source')] = 'iclac-propuesta-2026-08'
    if (p.controllers) row[i('controllers')] = p.controllers
    if (p.is_jv_vehicle) row[i('is_jv_vehicle')] = p.is_jv_vehicle
    row[i('review_note')] = p.note
    cambios.push(`propuesta   ${canon} -> ${p.ownership}`)
  } else if (SIN_BASE[id]) {
    row[i('review_note')] = SIN_BASE[id]
    cambios.push(`sin base    ${canon} (motivo actualizado)`)
  } else if (String(row[i('is_consortium')]).toUpperCase() === 'TRUE') {
    // Anotar la propiedad que saldría de los miembros, sin tocar el valor guardado.
    const miembros = (row[i('members')] || '').split('|').map((s) => s.trim()).filter(Boolean)
    const tipos = miembros.map((m) => ownById.get(m) || null)
    const nota = (row[i('review_note')] || '').replace(/\s*CALCULATED FROM MEMBERS:.*$/, '').trim()
    let calc
    if (!miembros.length) calc = 'no members listed.'
    else if (tipos.some((t) => !t)) {
      const faltan = miembros.filter((m, k) => !tipos[k])
      calc = `cannot be computed yet, no record for ${faltan.join(', ')}.`
    } else {
      const set = [...new Set(tipos.filter((t) => t !== 'UNKNOWN'))]
      calc = tipos.includes('UNKNOWN')
        ? `incomplete, ${miembros.length - tipos.filter((t) => t === 'UNKNOWN').length} of ${miembros.length} members classified.`
        : `${set.join(' + ')} (from ${miembros.length} members).`
    }
    row[i('review_note')] = `${nota} CALCULATED FROM MEMBERS: ${calc}`.trim()
    cambios.push(`consorcio   ${canon.slice(0, 40)} -> ${calc}`)
  }
  out.push(row.map(cell).join(','))
}

console.log(`${write ? '' : '[dry-run] '}${cambios.length} filas tocadas`)
for (const c of cambios) console.log('  ' + c)

if (write) {
  writeFileSync(CSV, out.join('\n') + '\n', 'utf8')
  console.log(`\nCSV reescrito: ${CSV}`)
  console.log('Después: node scripts/build_investors_map.mjs && npm run validate:investors && npm run investors:export')
} else {
  console.log('\nNada escrito. Correr con --write para aplicar.')
}
