#!/usr/bin/env node
// Instrumento para pedirle a la revisión externa lo que falta para dejar de tratar
// MIXED como relleno en los consorcios.
//
// El pedido anterior (planilla del 14-07) traía una sola línea en el README —«their
// MIXED is a structural placeholder, review the member list instead»— y una columna de
// veredicto. Volvió en blanco, con razón: decía que la etiqueta era un relleno, pero no
// qué debía ser en su lugar ni dónde escribirlo.
//
// Acá el pedido es concreto y son dos cosas:
//   1. `members_to_classify` — las empresas que aparecen como miembro de un consorcio y
//      NO tienen ficha propia en investors_map.csv. Sin ellas no se puede calcular la
//      composición de 15 de los 21 consorcios.
//   2. `consortiums` — los 21, con el diagnóstico que sí se puede hacer hoy y una
//      columna para elegir cómo debe verse un consorcio en la dimensión de propiedad.
//
// Uso: node scripts/one-off/build_consortium_review.mjs [salida.xlsx]
import XLSX from 'xlsx'
import { readFileSync, readdirSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..', '..')
const CSV = resolve(REPO_ROOT, 'data/schema/investors_map.csv')
const COUNTRIES = resolve(REPO_ROOT, 'data/sources/countries')
const outPath = resolve(process.argv[2] ?? resolve(REPO_ROOT, 'docs/sprint_5/consortium_review_31072026.xlsx'))

const parseLine = (line) => {
  const cells = []
  let cur = ''
  let q = false
  for (const ch of line) {
    if (ch === '"') q = !q
    else if (ch === ',' && !q) { cells.push(cur); cur = '' }
    else cur += ch
  }
  cells.push(cur)
  return cells
}

// Los ids de miembro que no tienen ficha propia solo existen como slug: se muestran
// legibles para que la revisora reconozca la empresa, y el id crudo va al lado para
// que el mapeo de vuelta sea exacto.
const ACRONYMS = new Set(['mmg', 'cneec', 'camce', 'mcm', 'cd', 'citic', 'cnpc', 'cnooc'])
const humanize = (id) =>
  id.split('-').map((w) => (ACRONYMS.has(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(' ')

// ---- Tabla de inversores ----
const lines = readFileSync(CSV, 'utf8').replace(/\r\n/g, '\n').trim().split('\n')
const header = parseLine(lines[0])
const col = (name) => header.indexOf(name)
const rows = lines.slice(1).map(parseLine)
const byId = new Map()
const rawByCompany = new Map()
for (const c of rows) {
  const id = c[col('company_id')]
  if (!byId.has(id)) {
    byId.set(id, {
      id,
      name: c[col('company_canonical')],
      ownership: c[col('ownership')],
      isConsortium: String(c[col('is_consortium')]).toLowerCase() === 'true',
      members: (c[col('members')] ?? '').split('|').map((s) => s.trim()).filter(Boolean)
    })
  }
  if (!rawByCompany.has(id)) rawByCompany.set(id, new Set())
  rawByCompany.get(id).add(c[col('investor_raw')])
}

// ---- Peso de cada consorcio en la base (inversiones y monto, deduplicado por id) ----
const weight = new Map() // investor_raw -> { n, musd }
for (const f of readdirSync(COUNTRIES).filter((x) => x.endsWith('.xlsx') && !x.startsWith('~$'))) {
  const wb = XLSX.readFile(resolve(COUNTRIES, f))
  const seen = new Set()
  for (const r of XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null })) {
    const id = String(r.Id_Investment ?? '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    const raw = String(r.Investor ?? '').trim()
    if (!weight.has(raw)) weight.set(raw, { n: 0, musd: 0 })
    const w = weight.get(raw)
    w.n++
    w.musd += Number(r.Investment) || 0
  }
}
const weightOf = (companyId) => {
  let n = 0
  let musd = 0
  for (const raw of rawByCompany.get(companyId) ?? []) {
    const w = weight.get(raw)
    if (w) { n += w.n; musd += w.musd }
  }
  return { n, musd: Math.round(musd) }
}

// ---- Hoja 1: miembros sin ficha ----
const consortiums = [...byId.values()].filter((e) => e.isConsortium)
const missing = new Map() // memberId -> Set(consorcios)
for (const c of consortiums) {
  for (const m of c.members) {
    if (byId.has(m)) continue
    if (!missing.has(m)) missing.set(m, new Set())
    missing.get(m).add(c.name)
  }
}
const memberRows = [...missing.entries()]
  .map(([id, inCons]) => {
    const cons = [...inCons]
    const w = cons.reduce((acc, name) => {
      const c = consortiums.find((x) => x.name === name)
      const cw = c ? weightOf(c.id) : { n: 0, musd: 0 }
      return { n: acc.n + cw.n, musd: acc.musd + cw.musd }
    }, { n: 0, musd: 0 })
    return {
      company: humanize(id),
      company_id: id,
      appears_in: cons.join(' ; '),
      investments_via_consortium: w.n,
      total_musd_via_consortium: w.musd,
      'ownership (Central SOE / Local SOE / POE / MIXED / UNKNOWN)': '',
      'Chinese firm name': '',
      comments: ''
    }
  })
  .sort((a, b) => b.total_musd_via_consortium - a.total_musd_via_consortium)

// ---- Hoja 2: los consorcios ----
const consRows = consortiums
  .map((c) => {
    const owns = c.members.map((m) => byId.get(m)?.ownership ?? null)
    const known = owns.filter(Boolean)
    const uniq = [...new Set(known)]
    const diagnosis =
      known.length === 0
        ? 'cannot tell: no member is classified yet'
        : known.length < c.members.length
          ? `cannot tell: ${c.members.length - known.length} member(s) unclassified`
          : uniq.length === 1
            ? `all members are ${uniq[0]} -> MIXED looks wrong`
            : `genuinely mixed: ${uniq.join(' + ')}`
    const w = weightOf(c.id)
    return {
      consortium: c.name,
      members: c.members.map((m) => byId.get(m)?.name ?? humanize(m)).join(' ; '),
      ownership_today: c.ownership,
      members_classified: `${known.length}/${c.members.length}`,
      what_we_can_tell_today: diagnosis,
      investments: w.n,
      total_musd: w.musd,
      'member list correct? (OK / WRONG)': '',
      'if WRONG, the members should be': '',
      comments: ''
    }
  })
  .sort((a, b) => b.total_musd - a.total_musd)

// ---- README ----
const readme = [
  ['ICLAC investor base — consortiums and the MIXED label', null],
  [null, null],
  ['What this is', 'A follow-up to the ownership review of 14 July. That file asked you to "review the member list" of the consortiums and said their MIXED label was a structural placeholder. It never said what the label should be instead, or gave you anywhere to write it. That is on us, and this file is the concrete version of the question.'],
  ['Why it matters', `Consortiums are ${consRows.length} of the entries in the table and they carry US$${consRows.reduce((a, r) => a + r.total_musd, 0).toLocaleString('en-US')} M. Every one of them is labelled MIXED today, so on the site a joint venture of two central SOEs looks the same as a genuinely mixed-ownership firm.`],
  [null, null],
  ['Question 1', 'Sheet "members_to_classify": these companies appear as members of a consortium but have no entry of their own in our table, so we cannot work out what any of those consortiums is made of. Please fill "ownership" (and the Chinese name if you have it).'],
  ['Question 2', 'Sheet "consortiums": all of them, with what we can already tell from the members we do have classified. Please confirm the member list, and correct it where it is wrong.'],
  ['Question 3', 'How should a consortium appear in the ownership dimension of the site? Pick one and write it below: (A) keep it as MIXED, as today. (B) give consortiums their own category, so MIXED means only genuinely mixed-ownership firms. (C) classify each consortium by its members: all members alike -> that ownership, members of different types -> MIXED.'],
  ['Your answer to Question 3', ''],
  [null, null],
  ['Categories', 'Central SOE = central state-owned (SASAC and other central state entities) · Local SOE = provincial or municipal state-owned, state banks, sovereign funds · POE = privately owned · MIXED = genuinely mixed ownership · UNKNOWN = cannot be determined with confidence. Classification is by ultimate control, not immediate shareholder.'],
  ['What we do NOT plan to do', 'Split a consortium amount between its members. We have no stake data, and the site deliberately keeps the amount on the consortium rather than reattributing it.'],
  ['Generated', `${new Date().toISOString().slice(0, 10)} from data/schema/investors_map.csv`]
]

mkdirSync(dirname(outPath), { recursive: true })
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(readme), 'README')
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(memberRows), 'members_to_classify')
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(consRows), 'consortiums')
XLSX.writeFile(wb, outPath)

console.log(`consorcios: ${consRows.length} · miembros sin ficha: ${memberRows.length}`)
for (const r of consRows) console.log(`  ${r.consortium.slice(0, 44).padEnd(46)} ${r.members_classified}  ${r.what_we_can_tell_today}`)
console.log(`→ ${outPath}`)
