#!/usr/bin/env node
// Aplica a investors_map.csv las propiedades que la revisión externa resolvió para
// las empresas que nos habían quedado en UNKNOWN.
//
// Por qué hace falta un segundo pase: `rebuild_investors_map_ownership.mjs` (23-07)
// solo miró los veredictos `WRONG`. Las empresas UNKNOWN volvieron marcadas `Ok`
// —nuestra clasificación «no está mal», simplemente no había clasificación— pero con
// la respuesta escrita igual en `corrected ownership`, más el nombre chino y el tipo
// de sociedad. Esas 14 respuestas quedaron sin cargar durante una semana.
//
// Conservador a propósito: **solo toca filas que hoy están en UNKNOWN**. No revisa ni
// reabre ninguna otra clasificación.
//
// Uso: node scripts/one-off/apply_ownership_unknown_verdicts.mjs [--dry-run]
import XLSX from 'xlsx'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..', '..')
const CSV = resolve(REPO_ROOT, 'data/schema/investors_map.csv')
const REVIEW = resolve(REPO_ROOT, 'docs/sprint_5/ownership_review_ywedits.xlsx')
const dryRun = process.argv.includes('--dry-run')

const OWNERSHIP_ENUM = new Set(['Central SOE', 'Local SOE', 'POE', 'MIXED', 'UNKNOWN'])
const clean = (v) => (v == null ? '' : String(v).trim())

// CSV con comillas (members y review_note llevan comas).
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
const writeCell = (v) => (/[",\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : String(v))

// ---- Respuestas de la revisión, por empresa ----
const companies = XLSX.utils.sheet_to_json(XLSX.readFile(REVIEW).Sheets.companies, { defval: null })
const answer = new Map()
for (const r of companies) {
  const company = clean(r.company)
  const corrected = clean(r['corrected ownership'])
  if (!company || !corrected || corrected === 'UNKNOWN') continue
  answer.set(company, {
    ownership: corrected,
    zh: clean(r['Chinese firm name']),
    firmType: clean(r.firm_type),
    comments: clean(r.comments)
  })
}

// ---- Reescritura ----
const lines = readFileSync(CSV, 'utf8').replace(/\r\n/g, '\n').trim().split('\n')
const header = parseLine(lines[0])
const iCanon = header.indexOf('company_canonical')
const iOwn = header.indexOf('ownership')
const iNote = header.indexOf('review_note')
if (iCanon < 0 || iOwn < 0 || iNote < 0) {
  console.error('El CSV no trae company_canonical / ownership / review_note')
  process.exit(1)
}

const applied = []
const stillUnknown = []
const out = [lines[0]]
for (const line of lines.slice(1)) {
  const cells = parseLine(line)
  const company = clean(cells[iCanon])
  if (clean(cells[iOwn]) !== 'UNKNOWN') { out.push(line); continue }

  const a = answer.get(company)
  if (!a) { stillUnknown.push(company); out.push(line); continue }
  if (!OWNERSHIP_ENUM.has(a.ownership)) {
    console.error(`  ! "${company}": "${a.ownership}" no está en el enum, se deja en UNKNOWN`)
    stillUnknown.push(company)
    out.push(line)
    continue
  }

  // La nota deja la procedencia: quién lo resolvió y con qué identificó a la empresa.
  const detalle = [a.zh, a.firmType && a.firmType !== '-' ? a.firmType : null].filter(Boolean).join(' · ')
  cells[iOwn] = a.ownership
  cells[iNote] = `Propiedad confirmada en la revisión externa de inversores (planilla ownership_review_ywedits.xlsx, 31-07)${detalle ? `: ${detalle}` : ''}.`
  applied.push({ company, ownership: a.ownership, zh: a.zh })
  out.push(cells.map(writeCell).join(','))
}

if (!dryRun) writeFileSync(CSV, out.join('\n') + '\n', 'utf8')

const uniq = (xs) => [...new Set(xs)]
console.log(`${dryRun ? '[dry-run] ' : ''}${applied.length} fila(s) actualizadas · ${uniq(applied.map((a) => a.company)).length} empresas`)
for (const a of applied) console.log(`  ${a.company.padEnd(38)} UNKNOWN → ${a.ownership}${a.zh ? `  (${a.zh})` : ''}`)
if (stillUnknown.length) {
  console.log(`\nSiguen en UNKNOWN (${uniq(stillUnknown).length}): ${uniq(stillUnknown).join(' | ')}`)
}
console.log(`\n${dryRun ? 'Nada escrito.' : `CSV reescrito: ${CSV}`}`)
console.log('Después: node scripts/build_investors_map.mjs && npm run validate:investors')
