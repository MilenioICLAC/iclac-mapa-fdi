// Exporta data/schema/investors_map.csv a un XLSX editable, en inglés.
//
// NO es un instrumento de revisión: es la tabla. Mismas columnas, mismos valores, para
// que quien la complete vea la estructura real y lo que devuelva se pueda importar sin
// interpretación. Las columnas que se agreguen o el orden que se cambie no importan:
// `investors:import` machaca por company_id.
//
// Sale FUERA del repositorio (a docs/, que está en el gitignore). Si el editable se
// versiona, alguien va a editar ese y subirlo, y perdemos el CSV como fuente.
//
// Una fila por EMPRESA, no por nombre crudo. La tabla en disco tiene 240 filas y 201
// empresas porque varios `investor_raw` apuntan a la misma: editar la propiedad cuatro
// veces invita a que queden inconsistentes, y el validador ya tiene una regla contra eso.
// Los nombres crudos viajan juntos en `investor_raw_all`, de solo lectura.
//
// Por defecto DEJA FUERA las empresas que solo invierten en países todavía no
// publicados. Sus bases no están cerradas, así que pedirle a alguien de afuera que las
// clasifique es hacerle trabajo sobre un dato que puede cambiar. Con `--all` salen todas.
//
// Uso:
//   npm run investors:export
//   npm run investors:export -- --all
//   npm run investors:export -- docs/otra_ruta.xlsx

import { readFileSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const CSV = 'data/schema/investors_map.csv'
const DATA = 'public/data/investments.json'
const DIR_PAISES = 'data/sources/countries'
const OUT = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'docs/investors_table.xlsx'
const TODAS = process.argv.includes('--all')

// Orden de columnas del editable: primero lo que se edita, después lo generado.
const EDITABLE = [
  'company_canonical', 'ownership', 'ownership_status',
  'chinese_name', 'firm_type', 'controllers', 'control_paths',
  'is_jv_vehicle', 'origin_country', 'review_note',
]
const GENERADAS = ['company_id', 'investor_raw_all', 'is_consortium', 'members', 'evidence_source', 'in_the_site', 'investments', 'total_musd']

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
const s = (v) => (v == null ? '' : String(v).trim())

const rows = parseCsv(readFileSync(CSV, 'utf8').replace(/\r\n/g, '\n').trim())
const header = rows[0]
const recs = rows.slice(1).filter((r) => r.length > 1).map((r) => Object.fromEntries(header.map((k, i) => [k, r[i]])))

// Recuento de inversiones y monto: se calcula acá, no se guarda en el CSV. Estuvo
// guardado y llegó a tener 66 de 240 filas desactualizadas.
const inv = JSON.parse(readFileSync(DATA, 'utf8'))
const mapaSitio = JSON.parse(readFileSync('public/data/investors_map.json', 'utf8'))
const porInversion = new Map()
for (const r of inv) if (!porInversion.has(r.id)) porInversion.set(r.id, r)
const uso = new Map()
for (const r of porInversion.values()) {
  const e = uso.get(r.investor) || { n: 0, m: 0 }
  e.n++; e.m += Number(r.investment_musd) || 0
  uso.set(r.investor, e)
}

// Qué empresas se ven en el sitio. No alcanza con "tiene inversión propia publicada":
// una empresa puede estar sólo como miembro de un consorcio que sí está publicado, y
// entonces está en el sitio aunque nunca invierta sola (Andes Petroleum es el caso).
// Sin esta columna, `investments = 0` se lee como fila muerta, y hoy hay 26 así.
const enElSitio = new Set()
for (const r of porInversion.values()) {
  const e = mapaSitio[r.investor]
  if (!e) continue
  enElSitio.add(e.company_id)
  for (const m of e.members ?? []) enElSitio.add(m)
}

// Colapsar a una fila por empresa.
const empresas = new Map()
for (const r of recs) {
  const id = s(r.company_id)
  if (!id) continue
  const u = uso.get(s(r.investor_raw)) || { n: 0, m: 0 }
  const prev = empresas.get(id)
  if (!prev) {
    empresas.set(id, { ...r, _raws: [s(r.investor_raw)], _n: u.n, _m: u.m })
  } else {
    prev._raws.push(s(r.investor_raw)); prev._n += u.n; prev._m += u.m
  }
}

// Empresas que solo aparecen en países retenidos. Se derivan de los datos, no de una
// lista fija: si mañana se publica Costa Rica, AFECC entra sola.
const paisesRetenidos = new Set()
{
  const cr = parseCsv(readFileSync('data/schema/countries.csv', 'utf8').replace(/\r\n/g, '\n').trim())
  const h = cr[0], iF = h.indexOf('filename'), iP = h.indexOf('publish')
  for (const r of cr.slice(1)) {
    if (r.length > 1 && s(r[iP]).toLowerCase() === 'no') paisesRetenidos.add(`${s(r[iF]).toLowerCase()}.xlsx`)
  }
}
const soloRetenidos = new Set()
if (!TODAS && paisesRetenidos.size) {
  const XL = XLSX
  const idPorRaw = new Map(recs.map((r) => [s(r.investor_raw), s(r.company_id)]))
  const donde = new Map()
  for (const f of readdirSync(DIR_PAISES).filter((x) => /\.xlsx$/i.test(x))) {
    const wb = XL.readFile(`${DIR_PAISES}/${f}`)
    const vistos = new Set()
    for (const sn of wb.SheetNames) {
      for (const row of XL.utils.sheet_to_json(wb.Sheets[sn])) {
        const id = row.Id_Investment
        if (!id || vistos.has(id)) continue
        vistos.add(id)
        const cid = idPorRaw.get(String(row.Investor ?? '').trim())
        if (!cid) continue
        if (!donde.has(cid)) donde.set(cid, new Set())
        donde.get(cid).add(f.toLowerCase())
      }
    }
  }
  for (const [cid, archivos] of donde) {
    if ([...archivos].every((f) => paisesRetenidos.has(f))) soloRetenidos.add(cid)
  }
  // Y los miembros que sólo sirven a un consorcio que ya queda fuera.
  for (const r of recs) {
    if (s(r.is_consortium).toUpperCase() !== 'TRUE') continue
    if (!soloRetenidos.has(s(r.company_id))) continue
    for (const m of s(r.members).split('|').map((x) => x.trim()).filter(Boolean)) {
      if (!donde.has(m)) soloRetenidos.add(m)
    }
  }
}

const orden = { 'proposed': 0, 'unreviewed': 1, 'flagged-for-removal': 2, 'derived': 3, 'confirmed': 4 }
const falta = (e) => (s(e.chinese_name) ? 0 : 1) + (s(e.firm_type) ? 0 : 1) + (s(e.controllers) ? 0 : 1)

const excluidas = [...empresas.values()].filter((e) => soloRetenidos.has(s(e.company_id)))
const filas = [...empresas.values()]
  .filter((e) => !soloRetenidos.has(s(e.company_id)))
  .sort((a, b) => (orden[s(a.ownership_status)] ?? 3) - (orden[s(b.ownership_status)] ?? 3)
    || falta(b) - falta(a)
    || b._m - a._m
    || s(a.company_canonical).localeCompare(s(b.company_canonical)))
  .map((e) => ({
    company_canonical: s(e.company_canonical),
    ownership: s(e.ownership),
    ownership_status: s(e.ownership_status),
    chinese_name: s(e.chinese_name),
    firm_type: s(e.firm_type),
    controllers: s(e.controllers),
    control_paths: s(e.control_paths),
    is_jv_vehicle: s(e.is_jv_vehicle),
    origin_country: s(e.origin_country),
    review_note: s(e.review_note),
    company_id: s(e.company_id),
    investor_raw_all: e._raws.join(' | '),
    is_consortium: s(e.is_consortium),
    members: s(e.members),
    evidence_source: s(e.evidence_source),
    in_the_site: enElSitio.has(s(e.company_id)) ? 'yes' : 'no',
    investments: e._n,
    total_musd: Math.round(e._m),
  }))

const cuenta = (f) => filas.filter(f).length
const readme = [
  ['ICLAC investors table — editable copy'],
  [''],
  ['WHAT THIS IS'],
  ['This is the actual investors table, not a review form. Same columns, same values, one row per'],
  ['company. Whatever you send back is imported straight into the table, matched by company_id.'],
  [''],
  ['So you do not need to be careful with the file:'],
  ['  · Reorder rows, sort, filter, add your own columns. Nothing is matched by position.'],
  ['  · Delete rows you are not working on. We never delete from the table on import.'],
  ['  · TRUE/FALSE in your language, stray apostrophes and curly quotes are all handled.'],
  ['  · One thing we cannot guess: if you put a value in "ownership" that is not one of the five,'],
  ['    the import stops and tells us which row. Better than silently turning it into something else.'],
  [''],
  ['WHAT WE NEED'],
  [`  ${cuenta((f) => f.ownership_status === 'proposed')} rows marked "proposed": ownership we proposed ourselves. Please confirm or correct.`],
  [`  ${cuenta((f) => f.ownership_status === 'unreviewed')} rows marked "unreviewed": never went through external review.`],
  [`  ${cuenta((f) => f.ownership_status === 'flagged-for-removal')} rows marked "flagged-for-removal": you marked these in red last time. We have not removed`],
  ['    them: dropping a company from the repository is an editorial call, and it is with ICLAC.'],
  [`  ${cuenta((f) => f.ownership_status === 'derived')} rows marked "derived": consortiums. Nothing to fill, see below.`],
  [`  ${cuenta((f) => f.ownership_status === 'confirmed')} rows marked "confirmed": your earlier verdicts, already applied. No action needed.`],
  [`  ${cuenta((f) => !f.chinese_name)} rows have no Chinese name, ${cuenta((f) => !f.controllers)} have no ultimate controller.`],
  ['Rows are sorted so everything that needs work comes first.'],
  [''],
  ['COLUMNS YOU EDIT'],
  ['  ownership          Central SOE | Local SOE | POE | MIXED | UNKNOWN'],
  ['  ownership_status   set to "confirmed" once you have checked the row. Other values we use:'],
  ['                     proposed, unreviewed, flagged-for-removal, derived'],
  ['  chinese_name       registered name in Chinese'],
  ['  firm_type          legal form as it appears in the Chinese registry'],
  ['  controllers        ultimate controller(s), separated by |'],
  ['  control_paths      control chains with ownership percentages, separated by |'],
  ['  is_jv_vehicle      TRUE if the company itself is a jointly owned vehicle. Who its owners are'],
  ['                     goes in controllers, like for any other company.'],
  ['  origin_country     leave empty for Chinese companies, which is almost everything here. Fill it'],
  ['                     only for a NON-Chinese partner in a deal: then ownership does not apply and'],
  ['                     stays empty, because the ownership enum describes Chinese capital structure.'],
  ['  review_note        free text: why this classification, and your sources'],
  [''],
  ['COLUMNS WE GENERATE — please do not edit'],
  ['  company_id         our stable key. Everything is matched by this.'],
  ['  investor_raw_all   every spelling of this company found in the country files.'],
  ['  is_consortium      TRUE means this row is a group of companies acting together, not a company.'],
  ['  members            the company_ids that make up that consortium.'],
  ['  evidence_source    where the evidence in this row came from.'],
  ['  in_the_site        yes if this company appears on the published map, either with its own'],
  ['                     investments or as a member of a published consortium. A "no" does not mean'],
  ['                     the company is unused: its investments may sit in the limited-evidence annex,'],
  ['                     or in a country we have not published yet. Both still need classifying.'],
  ['  investments        how many PUBLISHED investments use this name. Zero with in_the_site = no is'],
  ['                     the case above, not an empty row.'],
  ['  total_musd         their combined amount, in US$ millions, published only.'],
  [''],
  ['CONSORTIUMS'],
  ['  A consortium is several companies on one deal, not a company. It has no owner of its own: its'],
  ['  parts do. So its ownership cell is empty on purpose and stays empty — the site resolves it from'],
  ['  the members every time it filters. That is what "derived" means: nothing to complete here.'],
  [`  ${cuenta((f) => f.is_consortium === 'TRUE')} rows are consortiums. Their ownership is CALCULATED from their members, so you do not`],
  ['  need to set it: reviewing the member companies is what fixes them. They are listed so you can'],
  ['  see which companies feed which deal.'],
  [''],
  ['WHERE OUR PROPOSALS CAME FROM'],
  ['We applied the same rules you used:'],
  ['  1. Ownership follows the ultimate controller, not the immediate subsidiary.'],
  ['  2. Central vs local depends on which state body owns it: central SASAC is Central SOE;'],
  ['     province, municipality or county is Local SOE.'],
  ['  3. A private company or private fund is POE.'],
  ['  4. A listed company with a state controller follows the controller, not the free float.'],
  ['The review_note column says which evidence each proposal came from. Notes that start with'],
  ['"PLEASE CHECK" are the ones we are least sure about.'],
  [''],
  ...(excluidas.length ? [
    ['WHAT WE LEFT OUT ON PURPOSE'],
    [`  ${excluidas.length} companies are missing from this file, and it is not an oversight. Every investment they`],
    ['  have sits in a country we have not published yet, so those country files are still open and'],
    ['  could change. Classifying them now would be work on a moving target. They come back in the'],
    ['  next round, once the country is closed:'],
    ...excluidas.map((e) => [`    ${s(e.company_canonical)}`]),
    [''],
  ] : []),
  ['A NOTE ON LANGUAGE'],
  ['Every note on a row we are asking you about is in English. The notes still in Spanish are on'],
  ['rows you already ruled on: they are our own record of why we classified something back in June'],
  ['and July, kept for provenance. Nothing there needs your attention.'],
  [''],
  ['ONE NOTE ON THE CHINESE NAMES'],
  ['Six of them are our proposal, not registry data, and the note says so. The rest are blank on'],
  ['purpose: without registry access a wrong name is worse than an empty cell.'],
]

const wb = XLSX.utils.book_new()
const wsR = XLSX.utils.aoa_to_sheet(readme)
wsR['!cols'] = [{ wch: 100 }]
XLSX.utils.book_append_sheet(wb, wsR, 'README')

const ws = XLSX.utils.json_to_sheet(filas, { header: [...EDITABLE, ...GENERADAS] })
ws['!cols'] = [{ wch: 34 }, { wch: 13 }, { wch: 16 }, { wch: 24 }, { wch: 30 }, { wch: 30 },
  { wch: 46 }, { wch: 13 }, { wch: 15 }, { wch: 70 },
  { wch: 30 }, { wch: 40 }, { wch: 13 }, { wch: 34 }, { wch: 24 }, { wch: 12 }, { wch: 12 }, { wch: 12 }]
ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: filas.length, c: EDITABLE.length + GENERADAS.length - 1 } }) }
ws['!freeze'] = { xSplit: 1, ySplit: 1 }
XLSX.utils.book_append_sheet(wb, ws, 'companies')

mkdirSync(dirname(OUT), { recursive: true })
try {
  XLSX.writeFile(wb, OUT)
} catch (err) {
  // Pasa siempre: el editable queda abierto en Excel y Windows bloquea el archivo.
  // Un volcado de pila acá no le dice a nadie qué hacer.
  if (err.code === 'EBUSY' || err.code === 'EPERM') {
    console.error(`No se pudo escribir ${OUT}: el archivo está abierto en Excel.`)
    console.error('Cerralo y volvé a correr, o pasá otra ruta: npm run investors:export -- docs/otro.xlsx')
    process.exit(1)
  }
  throw err
}

console.log(OUT)
console.log(`${filas.length} empresas (${recs.length} filas en el CSV, colapsadas por company_id)`)
console.log(`  proposed ${cuenta((f) => f.ownership_status === 'proposed')} · unreviewed ${cuenta((f) => f.ownership_status === 'unreviewed')} · flagged-for-removal ${cuenta((f) => f.ownership_status === 'flagged-for-removal')} · derived ${cuenta((f) => f.ownership_status === 'derived')} · confirmed ${cuenta((f) => f.ownership_status === 'confirmed')}`)
console.log(`  sin nombre chino ${cuenta((f) => !f.chinese_name)} · sin controlador ${cuenta((f) => !f.controllers)} · consorcios ${cuenta((f) => f.is_consortium === 'TRUE')}`)
