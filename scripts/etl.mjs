#!/usr/bin/env node
import XLSX from 'xlsx'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')

const DEFAULT_INPUT = resolve(REPO_ROOT, 'data/source/entrega1_inversiones.xlsx')
const DEFAULT_OUTPUT = resolve(REPO_ROOT, 'public/data/investments.json')

const inputPath = process.argv[2] || DEFAULT_INPUT
const outputPath = process.argv[3] || DEFAULT_OUTPUT

const PROJECT_TYPE_CANONICAL = {
  'Adquisición': 'Adquisición',
  'Adquisión': 'Adquisición',
  'Adquisicón': 'Adquisición',
  'Greenfield': 'Greenfield',
  'Construcción': 'Construcción'
}

const VALID_PROJECT_TYPES = new Set(['Adquisición', 'Greenfield', 'Construcción'])

const cleanStr = v => {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

const titleCase = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s

const parseCoordinates = s => {
  if (!s) return null
  const parts = String(s).split(',').map(p => p.trim())
  if (parts.length !== 2) return null
  const lat = Number.parseFloat(parts[0])
  const lng = Number.parseFloat(parts[1])
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return [lat, lng]
}

const parseNumber = v => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const RESEARCH_KEYWORDS = new Set(['Yes', 'No', 'yes', 'no', 'YES', 'NO'])

const stats = {
  totalRows: 0,
  written: 0,
  droppedNoId: 0,
  droppedNoCoords: 0,
  droppedNoProjectType: 0,
  projectTypeTypos: 0,
  areaTrimmed: 0,
  areaCaseFixed: 0,
  researchCitationsRescued: 0,
  researchNullDefaultedNo: 0,
  invalidCoordinates: 0
}

const sectorMap = new Map()

const transform = (row, sheetName) => {
  stats.totalRows++

  const id = cleanStr(row.Id_Investment)
  if (!id) { stats.droppedNoId++; return null }

  let projectTypeRaw = cleanStr(row.Project_Type)
  if (projectTypeRaw && projectTypeRaw !== PROJECT_TYPE_CANONICAL[projectTypeRaw]) {
    if (PROJECT_TYPE_CANONICAL[projectTypeRaw]) stats.projectTypeTypos++
  }
  const projectType = projectTypeRaw ? PROJECT_TYPE_CANONICAL[projectTypeRaw] : null
  if (!projectType || !VALID_PROJECT_TYPES.has(projectType)) { stats.droppedNoProjectType++; return null }

  const coords = parseCoordinates(row.Coordinates)
  if (!coords) {
    stats.invalidCoordinates++
    stats.droppedNoCoords++
    return null
  }

  const rawAreaEn = row.Area_EN ? String(row.Area_EN) : null
  let areaEn = cleanStr(rawAreaEn)
  if (rawAreaEn !== null && rawAreaEn !== rawAreaEn.trim()) stats.areaTrimmed++
  if (areaEn && areaEn[0] !== areaEn[0].toUpperCase()) {
    areaEn = titleCase(areaEn)
    stats.areaCaseFixed++
  }
  const areaEs = cleanStr(row.Area_ES)

  if (areaEn) sectorMap.set(areaEn, (sectorMap.get(areaEn) || 0) + 1)

  const researchRaw = row.Research
  let hasResearch = false
  const cases = []

  if (researchRaw && !RESEARCH_KEYWORDS.has(String(researchRaw).trim())) {
    const s = String(researchRaw).trim()
    if (s.length > 10) {
      cases.push({ caso: s, link: null })
      hasResearch = true
      stats.researchCitationsRescued++
    }
  } else if (researchRaw === 'Yes' || researchRaw === 'yes' || researchRaw === 'YES') {
    hasResearch = true
  } else if (researchRaw === null || researchRaw === undefined || researchRaw === '') {
    hasResearch = false
    stats.researchNullDefaultedNo++
  }

  for (let i = 1; i <= 14; i++) {
    const caso = cleanStr(row[`Caso${i}`])
    const link = cleanStr(row[`Link${i}`])
    if (caso) cases.push({ caso, link })
  }
  if (cases.length > 0) hasResearch = true

  const investment = parseNumber(row.Investment)
  const investor = cleanStr(row.Investor) ?? cleanStr(row.investor)
  const jointVentureFlag = (row.Joint_Venture ?? row['Joint Venture']) === 'Yes'

  const out = {
    id,
    year: parseNumber(row.Year),
    country: cleanStr(row.Country),
    investor,
    vector: cleanStr(row.Vector),
    path: cleanStr(row.Path),
    area_en: areaEn,
    area_es: areaEs,
    detail_es: cleanStr(row.Detail_ES),
    detail_en: cleanStr(row.Detail_EN),
    investment_musd: investment,
    location: cleanStr(row.Location),
    project_type: projectType,
    is_construction: projectType === 'Construcción',
    is_joint_venture: jointVentureFlag,
    origin_of_seller: cleanStr(row['Origin of seller']),
    stake: parseNumber(row.Stake),
    has_research: hasResearch,
    research_cases: cases,
    coordinates: coords
  }

  stats.written++
  return out
}

console.log(`Reading: ${inputPath}`)
const wb = XLSX.readFile(inputPath)
console.log(`Sheets: ${wb.SheetNames.join(', ')}\n`)

const totalSheet = wb.Sheets['Total']
if (!totalSheet) {
  console.error('No "Total" sheet found')
  process.exit(1)
}

const rows = XLSX.utils.sheet_to_json(totalSheet, { defval: null })
const transformed = []
for (const r of rows) {
  const out = transform(r, 'Total')
  if (out) transformed.push(out)
}

mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, JSON.stringify(transformed), 'utf8')

console.log('=== ETL stats ===')
for (const [k, v] of Object.entries(stats)) console.log(`  ${k}: ${v}`)
console.log('\n=== Sector distribution (Area_EN) ===')
for (const [k, v] of [...sectorMap.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k}: ${v}`)
}
console.log(`\nOutput: ${outputPath}`)
console.log(`File size: ${(JSON.stringify(transformed).length / 1024).toFixed(1)} KB`)
