#!/usr/bin/env node
import XLSX from 'xlsx'
import { writeFileSync, mkdirSync, readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { canonCountry } from './lib/normalize.mjs'
import { validateRows } from './lib/validate.mjs'
import { loadRegistry, loadCountryBorders, loadCountryBounds } from './lib/load_registry.mjs'

const registry = loadRegistry()
const countryBorders = registry ? loadCountryBorders(registry) : null
const countryBounds = registry ? loadCountryBounds(registry) : null
const canonIndex = registry?.canonIndex

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')

// Base viva: entrega por país de Flo (repo cliente → data/sources/countries/).
// Modo directorio: ingiere solo los países que PASAN validación (decisión 23-07).
// La base legada single-file (data/source/entrega1_inversiones.xlsx) sigue
// leyéndose si se pasa como argumento explícito.
const DEFAULT_INPUT = resolve(REPO_ROOT, 'data/sources/countries')
const DEFAULT_OUTPUT = resolve(REPO_ROOT, 'public/data/investments.json')

// Los posicionales se leen SALTANDO las banderas: `npm run etl -- --include-unpublished`
// deja la bandera en argv[2] y, tomándola como ruta, el ETL intentaba abrir un archivo
// llamado `--include-unpublished`.
const positionals = process.argv.slice(2).filter(a => !a.startsWith('--'))
const inputPath = positionals[0] || DEFAULT_INPUT
const outputPath = positionals[1] || DEFAULT_OUTPUT

// Umbral de confiabilidad (metodología ICLAC, guía de reliability score del 31-07):
// el puntaje es el número de fuentes independientes más uno, y "todo lo que quede en
// 0, 1 o 2 debe volver a revisarse antes de publicarse". El corte es ése: **sale del
// sitio todo lo que tenga score ≤ 2**, o sea lo que no llega a dos fuentes confiables
// independientes, y esas inversiones se publican aparte en el anexo de evidencia
// limitada. `minScore` es el puntaje MÍNIMO que se publica, así que ≤2 fuera = 3.
// Configurable porque el corte es editorial: `--min-score=0` apaga el filtro.
const MIN_SCORE_DEFAULT = 3
const minScoreArg = process.argv.find(a => a.startsWith('--min-score='))
const minScore = minScoreArg ? Number(minScoreArg.split('=')[1]) : MIN_SCORE_DEFAULT
if (!Number.isFinite(minScore)) {
  console.error(`--min-score espera un número; recibí "${minScoreArg}"`)
  process.exit(1)
}

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

const titleCase = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

// Curación de casing (convención "documentar, no parchear" — casing es excepción
// legítima): la entrega por país de Flo trae Location en MAYÚSCULAS ("SALTA").
// Canoniza a Title Case, con conectores en español en minúscula ("Provincia de
// Buenos Aires"). NO toca URLs (deficiencia documentada, se renderiza cruda).
const SPANISH_MINOR = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'en', 'da', 'do'])
const titleCaseLocation = s => {
  if (!s) return s
  if (/https?:\/\/|www\./i.test(s)) return s
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && SPANISH_MINOR.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
}

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

const RESEARCH_YES = new Set(['Yes', 'yes', 'YES'])
const RESEARCH_NO = new Set(['No', 'no', 'NO'])

const stats = {
  totalRows: 0,
  rowsKept: 0,
  rowsDroppedNoId: 0,
  rowsDroppedNoCoords: 0,
  rowsDroppedNoProjectType: 0,
  projectTypeTypos: 0,
  areaTrimmed: 0,
  areaCaseFixed: 0,
  researchCitationsRescued: 0,
  researchNullDefaultedNo: 0,
  researchCasesDeduped: 0,
  researchDoiResolved: 0,
  researchLinkNotUrl: 0,
  groupsTotal: 0,
  groupsAsPoint: 0,
  groupsAsLine: 0,
  maxWaypoints: 0,
  vectorUnresolvedDefaultedToPoint: 0,
  ownershipFromMap: 0,
  ownershipUnknownNoMatch: 0,
  locationTitleCased: 0,
  // Confiabilidad. `rowsNoScore` son filas sin puntaje asignado: NO se retienen,
  // porque "sin revisar" no es lo mismo que "revisado y sin evidencia".
  rowsBelowMinScore: 0,
  rowsNoScore: 0,
  annexInvestments: 0
}

const resolveVector = (rawVector) => {
  // `Vector` lo exige el esquema y lo valida la CI, así que la fila llega con el
  // valor bueno. Hubo un overlay que reparaba esta columna desde el proyecto
  // anterior; se retiró al quedar en cero usos, porque dependía de una carpeta
  // que no se versiona (en el build de producción cargaba vacío en silencio).
  if (rawVector === 'Punto' || rawVector === 'Vector') return rawVector
  stats.vectorUnresolvedDefaultedToPoint++
  return 'Punto'
}

const sectorMap = new Map()

// --- Investor canonical map (ownership source of truth, schema §5.1) ---
// Keyed by investor_raw AND company_canonical (client base may use either as
// Investor). Loaded up front so cleanRow can derive ownership per investor
// instead of trusting the raw Ownership column of the base (which lags the
// Yifang verdicts — client base only applied SASAC→Central SOE, never Local SOE
// nor the 30 reclassifications). See docs next_steps C10.
const parseCsvLine = line => {
  const cells = []
  let cur = ''
  let quoted = false
  for (const ch of line) {
    if (ch === '"') quoted = !quoted
    else if (ch === ',' && !quoted) { cells.push(cur); cur = '' }
    else cur += ch
  }
  cells.push(cur)
  return cells
}

const investorsCsvPath = resolve(REPO_ROOT, 'data/schema/investors_map.csv')
const loadInvestorMap = path => {
  const csvRows = readFileSync(path, 'utf8').trim().split(/\r?\n/)
  const header = parseCsvLine(csvRows[0])
  const col = name => header.indexOf(name)
  const [iRaw, iId, iCanon, iCons, iOwn, iMembers] =
    ['investor_raw', 'company_id', 'company_canonical', 'is_consortium', 'ownership', 'members'].map(col)
  const map = {}
  for (const line of csvRows.slice(1)) {
    const c = parseCsvLine(line)
    const entry = {
      company_id: c[iId],
      company_canonical: c[iCanon],
      ownership: c[iOwn],
      // TRUE/FALSE en mayúsculas en el CSV: sin toLowerCase el flag sale siempre
      // false y el Sankey nunca expande el consorcio a sus miembros.
      is_consortium: String(c[iCons] ?? '').trim().toLowerCase() === 'true'
    }
    const members = (c[iMembers] ?? '').split('|').map(s => s.trim()).filter(Boolean)
    if (members.length) entry.members = members
    map[c[iRaw]] = entry
    // También por canónico: la base del cliente usa el nombre canónico como Investor.
    if (c[iCanon] && !(c[iCanon] in map)) map[c[iCanon]] = entry
  }
  return map
}
const investorMap = existsSync(investorsCsvPath) ? loadInvestorMap(investorsCsvPath) : {}
if (!Object.keys(investorMap).length) console.warn(`WARN: ${investorsCsvPath} missing — ownership will default to UNKNOWN`)

// Ownership comes from the investor map, not the base row. Missing investor →
// UNKNOWN (elegant degradation; check_investor_coverage.mjs lists the gaps for
// the steward to classify). Tracked to catch coverage regressions.
const ownershipFor = investor => {
  const own = investor ? investorMap[investor]?.ownership : null
  if (own) { stats.ownershipFromMap++; return own }
  stats.ownershipUnknownNoMatch++
  return 'UNKNOWN'
}

// El 9% de los `LinkN` no son URLs. De esos, la mayoría son DOIs pelados
// (`10.3969/j.issn.1006-2610.2017.03.027`), que resuelven de forma determinista a
// doi.org: misma clase de curación que el trim o el Title Case, no juicio de contenido.
// El punto final es puntuación de la cita, no parte del DOI.
// Lo que NO se toca: códigos de accesión CNKI y las citas pegadas en la columna Link
// (deficiencias reales de la base → van a auditoría, ver convención "documentar, no
// parchear"). Esos quedan tal cual y el frontend simplemente no los enlaza (studyHref).
const DOI_RE = /^(?:doi:\s*)?(10\.\d{4,9}\/\S+?)\.?$/i
const normalizeLink = raw => {
  if (!raw) return raw
  const s = String(raw).trim()
  if (/^https?:\/\//i.test(s)) return s
  const m = s.match(DOI_RE)
  if (m) { stats.researchDoiResolved++; return `https://doi.org/${m[1]}` }
  stats.researchLinkNotUrl++
  return s
}

// Clave canónica de citación para deduplicar estudios.
//
// La misma cita llega con variantes tipográficas entre filas de un mismo vector: la
// coma dentro o fuera de la comilla de cierre, espacios dobles, guiones distintos. El
// dedup comparaba el string crudo, así que esas variantes pasaban y la ficha mostraba
// el estudio repetido (BOL-0012 listaba 10 entradas para 5 estudios; hallazgo Margaret
// 17-07). Se compara una forma canónica: minúsculas, sin puntuación, espacios
// colapsados. Cae dentro de las curaciones legítimas de la convención "documentar, no
// parchear" — es normalización de forma, no corrección de contenido.
const citationKey = s =>
  String(s ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

// Se keyea SOLO por título, nunca por link: las filas de un vector suelen repetir el
// mismo estudio con un link autoincremental de arrastre de Excel (.../4211, .../4212),
// así que el link distingue lo que no debería. Se conserva el primer link visto.
const dedupCases = cases => {
  const seen = new Set()
  const out = []
  for (const c of cases) {
    const key = citationKey(c.caso)
    // Sin título no hay con qué comparar: pasa sin deduplicar antes que perderse.
    if (!key) { out.push(c); continue }
    if (seen.has(key)) { stats.researchCasesDeduped++; continue }
    seen.add(key)
    out.push(c)
  }
  return out
}

const cleanRow = row => {
  stats.totalRows++

  const id = cleanStr(row.Id_Investment)
  if (!id) { stats.rowsDroppedNoId++; return null }

  const projectTypeRaw = cleanStr(row.Project_Type)
  if (projectTypeRaw && projectTypeRaw !== PROJECT_TYPE_CANONICAL[projectTypeRaw] && PROJECT_TYPE_CANONICAL[projectTypeRaw]) {
    stats.projectTypeTypos++
  }
  const projectType = projectTypeRaw ? PROJECT_TYPE_CANONICAL[projectTypeRaw] : null
  if (!projectType || !VALID_PROJECT_TYPES.has(projectType)) { stats.rowsDroppedNoProjectType++; return null }

  const coords = parseCoordinates(row.Coordinates)
  if (!coords) { stats.rowsDroppedNoCoords++; return null }

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
  const inlineCitation = []

  if (researchRaw !== null && researchRaw !== undefined && researchRaw !== '') {
    const s = String(researchRaw).trim()
    if (RESEARCH_YES.has(s)) hasResearch = true
    else if (RESEARCH_NO.has(s)) hasResearch = false
    else if (s.length > 10) {
      inlineCitation.push({ caso: s, link: null })
      hasResearch = true
      stats.researchCitationsRescued++
    }
  } else {
    stats.researchNullDefaultedNo++
  }

  const rawCases = [...inlineCitation]
  for (let i = 1; i <= 14; i++) {
    const caso = cleanStr(row[`Caso${i}`])
    const link = normalizeLink(cleanStr(row[`Link${i}`]))
    if (caso) rawCases.push({ caso, link })
  }
  // Dedup ya acá: una fila puede repetir el mismo estudio entre Caso1..Caso14.
  const cases = dedupCases(rawCases)
  if (cases.length > 0) hasResearch = true

  const investor = cleanStr(row.Investor) ?? cleanStr(row.investor)
  // Las fuentes son atributo de la inversión, no del punto: constantes en todas las
  // filas de un id (verificado, 0 ids con variación). Se leen hasta 5 porque la guía
  // de confiabilidad las contempla, aunque la base hoy trae 3 columnas.
  const sources = []
  for (let i = 1; i <= 5; i++) {
    const s = cleanStr(row[`source${i}`])
    if (s) sources.push(s)
  }
  const jointVentureFlag =
    (row.Joint_Venture ?? row['Joint Venture']) === 'Yes' ||
    (row.Joint_Venture ?? row['Joint Venture']) === 'yes'

  stats.rowsKept++

  return {
    id,
    coords,
    year: parseNumber(row.Year),
    country: canonCountry(row.Country, canonIndex).value ?? null,
    investor,
    area_en: areaEn,
    area_es: areaEs,
    detail_es: cleanStr(row.Detail_ES),
    detail_en: cleanStr(row.Detail_EN),
    investment_musd: parseNumber(row.Investment),
    location: (() => {
      const raw = cleanStr(row.Location)
      const cased = titleCaseLocation(raw)
      if (raw !== null && cased !== raw) stats.locationTitleCased++
      return cased
    })(),
    project_type: projectType,
    is_construction: projectType === 'Construcción',
    is_joint_venture: jointVentureFlag,
    // Socio no chino: nombre y país. Schema v1.6, opcionales y todavía sin llenar.
    // Van a las descargas pero NO a investments.json: hoy no las usa ninguna vista, y
    // el JSON del sitio se sirve entero en cada carga.
    socio_no_chino: cleanStr(row.Socio_No_Chino),
    socio_pais: cleanStr(row.Socio_Pais),
    // Renombrada a Origin_Of_Seller (v1.2); fallback al nombre viejo por si llega base legada.
    origin_of_seller: cleanStr(row.Origin_Of_Seller) ?? cleanStr(row['Origin of seller']),
    // Derivada del investor map (schema §5.1), NO de row.Ownership. Ver ownershipFor.
    ownership: ownershipFor(investor),
    stake: parseNumber(row.Stake),
    has_research: hasResearch,
    research_cases: cases,
    vector_raw: row.Vector ?? null,
    vector_resolved: resolveVector(row.Vector),
    path_raw: row.Path ?? null,
    // Sólo para las descargas y el filtro de confiabilidad: no viajan a
    // investments.json, que lo carga cada visitante.
    reliability_score: parseNumber(row.reliability_score),
    reliability_notes: cleanStr(row.reliability_notes),
    sources,
    province_iso: cleanStr(row.Province_ISO),
    has_news: RESEARCH_YES.has(String(row.News ?? '').trim())
  }
}

// Lee las filas de un xlsx. Prefiere la hoja 'Total' (base legada agregada); si
// no existe, usa la primera hoja (flujo por país: 'Datos'/'Sheet1').
const readWorkbook = (file) => {
  const wb = XLSX.readFile(file)
  const sheet = wb.Sheets['Total'] ?? wb.Sheets[wb.SheetNames[0]]
  return { rows: XLSX.utils.sheet_to_json(sheet, { defval: null }), sheetCount: wb.SheetNames.length }
}

let rawRows = []
if (existsSync(inputPath) && statSync(inputPath).isDirectory()) {
  // Flujo por país: un xlsx por país. DOS COMPUERTAS, deliberadamente separadas:
  //
  //   1. Validación (decisión 23-07): solo entra el país cuyo archivo PASA.
  //      Responde "¿el dato está bien?" y la contesta el validador.
  //   2. Publicación (`publish` en countries.csv): el país puede estar impecable
  //      y el cliente aún no querer mostrarlo. Responde "¿lo publicamos?" y la
  //      contesta ICLAC, editando el CSV. Sin esto, arreglar un archivo lo
  //      publicaba de inmediato, sin que nadie lo decidiera.
  //
  // `--no-filter` salta la primera; `--include-unpublished` la segunda.
  const files = readdirSync(inputPath)
    .filter((f) => f.endsWith('.xlsx') && !f.startsWith('~$'))
    .sort()
  const noFilter = process.argv.includes('--no-filter')
  const includeUnpublished = process.argv.includes('--include-unpublished')
  // filename canónico (MAYÚSCULA, sin .xlsx) -> ¿publica?
  const publishByFilename = {}
  for (const [a3, fn] of Object.entries(registry?.filenameByAlpha3 ?? {})) {
    publishByFilename[fn.toUpperCase()] = registry.publishByAlpha3?.[a3] !== false
  }
  const flags = [noFilter && 'sin filtro', includeUnpublished && 'incluye retenidos'].filter(Boolean)
  console.log(`Reading dir: ${inputPath} (${files.length} archivos)${flags.length ? ` [${flags.join(', ')}]` : ''}`)
  for (const f of files) {
    const stem = f.slice(0, -'.xlsx'.length).toUpperCase()
    if (!includeUnpublished && publishByFilename[stem] === false) {
      console.log(`  ${f}: RETENIDO — countries.csv lo tiene con publish=no`)
      continue
    }
    const { rows, sheetCount } = readWorkbook(resolve(inputPath, f))
    if (!noFilter) {
      const { stats } = validateRows(rows, { filename: f, registry, countryBorders, countryBounds, sheetCount })
      if (!stats.passed) {
        console.log(`  ${f}: OMITIDO — no pasa validación (${stats.validPct}% válidas, ${stats.errors} errores)`)
        continue
      }
    }
    console.log(`  ${f}: ${rows.length} filas ✓`)
    rawRows.push(...rows)
  }
} else {
  console.log(`Reading: ${inputPath}`)
  rawRows = readWorkbook(inputPath).rows
}

const cleaned = []
for (const r of rawRows) {
  const c = cleanRow(r)
  if (c) cleaned.push(c)
}

// --- Compuerta de confiabilidad. Es la TERCERA compuerta del pipeline, después de
// validación y publicación, y responde otra pregunta: "¿la evidencia alcanza?".
// La contesta la metodología (rúbrica 0-5), no el validador ni el cliente.
// Fila sin puntaje = todavía no revisada: pasa, y se cuenta aparte.
const passesScore = r => r.reliability_score === null || r.reliability_score >= minScore
const cleanedMain = []
const cleanedAnnex = []
for (const r of cleaned) {
  if (r.reliability_score === null) stats.rowsNoScore++
  if (passesScore(r)) cleanedMain.push(r)
  else { cleanedAnnex.push(r); stats.rowsBelowMinScore++ }
}

// Agrupa filas → registros de geometría. Una fila `Punto` es un registro; las filas
// `Vector` con el mismo `id|Path` son los waypoints de una línea. `countStats` deja
// fuera del contador global al anexo, que se arma con el mismo código.
const buildOutput = (rows, { countStats = true } = {}) => {
  const pointOnlyRows = rows.filter(r => r.vector_resolved === 'Punto')
  const groupableRows = rows.filter(r => r.vector_resolved === 'Vector')

  const candidateGroups = new Map()
  for (const r of groupableRows) {
    const key = `${r.id}|${r.path_raw ?? ''}`
    if (!candidateGroups.has(key)) candidateGroups.set(key, [])
    candidateGroups.get(key).push(r)
  }

  // Las columnas que no dependen de la geometría se copian de la primera fila del grupo.
  const record = (r, extra) => ({
    id: r.id,
    year: r.year,
    country: r.country,
    investor: r.investor,
    area_en: r.area_en,
    area_es: r.area_es,
    detail_es: r.detail_es,
    detail_en: r.detail_en,
    investment_musd: r.investment_musd,
    location: r.location,
    project_type: r.project_type,
    is_construction: r.is_construction,
    is_joint_venture: r.is_joint_venture,
    socio_no_chino: r.socio_no_chino,
    socio_pais: r.socio_pais,
    origin_of_seller: r.origin_of_seller,
    ownership: r.ownership,
    stake: r.stake,
    has_research: r.has_research,
    research_cases: r.research_cases,
    vector_raw: r.vector_raw,
    reliability_score: r.reliability_score,
    reliability_notes: r.reliability_notes,
    sources: r.sources,
    province_iso: r.province_iso,
    has_news: r.has_news,
    ...extra
  })

  const out = []

  for (const r of pointOnlyRows) {
    if (countStats) { stats.groupsTotal++; stats.groupsAsPoint++ }
    out.push(record(r, { geometry_type: 'point', coordinates: r.coords }))
  }

  for (const [, groupRows] of candidateGroups) {
    if (groupRows.length === 1) {
      const r = groupRows[0]
      if (countStats) { stats.groupsTotal++; stats.groupsAsPoint++ }
      out.push(record(r, { geometry_type: 'point', coordinates: r.coords }))
      continue
    }

    if (countStats) {
      stats.groupsTotal++
      stats.groupsAsLine++
      if (groupRows.length > stats.maxWaypoints) stats.maxWaypoints = groupRows.length
    }

    const first = groupRows[0]
    let mergedHasResearch = false
    const allCases = []
    for (const r of groupRows) {
      if (r.has_research) mergedHasResearch = true
      allCases.push(...r.research_cases)
    }
    // Cada waypoint del vector repite las citaciones de la inversión: acá es donde más
    // duplicados aparecen. Misma regla que en cleanRow (ver citationKey).
    const mergedCases = dedupCases(allCases)

    out.push(
      record(first, {
        has_research: mergedHasResearch,
        research_cases: mergedCases,
        geometry_type: 'line',
        coordinates: groupRows.map(r => r.coords)
      })
    )
  }

  return out
}

const output = buildOutput(cleanedMain)
const annexOutput = buildOutput(cleanedAnnex, { countStats: false })
stats.annexInvestments = new Set(annexOutput.map(r => r.id)).size

// Estudios de caso por inversión, deduplicados. Se juntan los de TODOS los grupos de
// geometría del mismo id: una inversión con dos tramos puede traer citas distintas en
// cada uno, y quedarse con las del primer grupo perdía las del resto.
const casesById = records => {
  const byId = new Map()
  for (const row of records) {
    if (!row.has_research || !Array.isArray(row.research_cases) || !row.research_cases.length) continue
    if (!byId.has(row.id)) byId.set(row.id, [])
    byId.get(row.id).push(...row.research_cases)
  }
  const out = {}
  for (const [id, cases] of byId) out[id] = dedupCases(cases)
  return out
}

// Split payload: research_cases is heavy (~13 MB, 71% of the file) and repeats
// across the multi-site rows of each investment. Strip it from investments.json
// (map/sankey never render it) and emit it deduped-by-id in research.json, which
// the Fichas panel / popups load and join on id. See docs/generales/pipeline_datos.md.
const researchById = casesById(output)
// Las columnas de procedencia (puntaje, fuentes, notas) son de las descargas: en el
// JSON del sitio serían peso muerto para cada visitante, porque no se renderizan.
const leanOutput = output.map(
  ({ research_cases, reliability_score, reliability_notes, sources, province_iso, has_news,
     socio_no_chino, socio_pais, ...rest }) => rest
)
const researchPath = resolve(dirname(outputPath), 'research.json')

mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, JSON.stringify(leanOutput), 'utf8')
writeFileSync(researchPath, JSON.stringify(researchById), 'utf8')
console.log(`Research: ${researchPath} (${Object.keys(researchById).length} investments, ${(JSON.stringify(researchById).length / 1024).toFixed(1)} KB)`)

console.log('=== ETL stats ===')
for (const [k, v] of Object.entries(stats)) console.log(`  ${k}: ${v}`)
console.log('\n=== Sector distribution (Area_EN) ===')
for (const [k, v] of [...sectorMap.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k}: ${v}`)
}
console.log(`\nOutput: ${outputPath}`)
console.log(`File size: ${(JSON.stringify(leanOutput).length / 1024).toFixed(1)} KB`)

// --- Descargas públicas en XLSX. Se arman acá, en build, y no en el navegador: los datos
// ya están unidos en memoria, el cliente se ahorra ~430 KB de SheetJS en el bundle y el
// archivo que baja el público es exactamente el que produjo este ETL.
//
// TRES HOJAS DE DATOS, UNA UNIDAD CADA UNA (cambio del 31-07). Antes `investments` traía
// una fila por punto —6.920 filas para 450 inversiones, una sola de ellas con 5.144—, así
// que sumar la columna de monto sin deduplicar daba una cifra inflada, y las 70 inversiones
// de traza lineal salían con lat/lng vacíos porque `coordinates[0]` era un par anidado.
// Ahora: `investments` una fila por inversión, `sites` la geometría completa (12.446
// vértices en vez de 6.754 coordenadas publicadas), `case_studies` los estudios. Se unen
// por `id`. De paso el archivo pesa la mitad: los textos largos dejan de repetirse.
const CITATION =
  'Francisco Urdinez and Margaret Myers (2024) "Regional Repository of Chinese Investments in Latin America", ICLAC and Inter-American Dialogue.'

const buildWorkbook = (records, { readmeExtras = [] } = {}) => {
  const byId = new Map()
  const siteRows = []
  for (const r of records) {
    if (!byId.has(r.id)) {
      byId.set(r.id, {
        id: r.id,
        year: r.year,
        country: r.country,
        investor: r.investor,
        ownership: r.ownership,
        area_en: r.area_en,
        area_es: r.area_es,
        detail_es: r.detail_es,
        detail_en: r.detail_en,
        investment_musd: r.investment_musd,
        location: r.location,
        province_iso: r.province_iso,
        project_type: r.project_type,
        is_construction: r.is_construction,
        is_joint_venture: r.is_joint_venture,
        socio_no_chino: r.socio_no_chino,
        socio_pais: r.socio_pais,
        origin_of_seller: r.origin_of_seller,
        stake: r.stake,
        has_research: r.has_research,
        has_news: r.has_news,
        reliability_score: r.reliability_score,
        source1: r.sources[0] ?? null,
        source2: r.sources[1] ?? null,
        source3: r.sources[2] ?? null,
        source4: r.sources[3] ?? null,
        source5: r.sources[4] ?? null,
        reliability_notes: r.reliability_notes,
        geometry_type: r.geometry_type,
        n_sites: 0
      })
    }
    const inv = byId.get(r.id)
    inv.has_research = inv.has_research || r.has_research
    // Una inversión con un tramo lineal y puntos sueltos no es ninguno de los dos.
    if (inv.geometry_type !== r.geometry_type) inv.geometry_type = 'mixed'
    inv.n_sites++
    const vertices = r.geometry_type === 'line' ? r.coordinates : [r.coordinates]
    vertices.forEach(([lat, lng], i) => {
      siteRows.push({ id_investment: r.id, site_n: inv.n_sites, vertex_n: i + 1, lat, lng })
    })
  }
  const invRows = [...byId.values()]

  // Columnas que quedarían enteras en blanco (source4-5 hoy, notas en la base principal)
  // se sacan: una planilla con columnas vacías se lee como dato faltante y no como
  // columna que no aplica.
  const emptyCols = Object.keys(invRows[0] ?? {}).filter(k => invRows.every(r => r[k] === null || r[k] === undefined))
  const trimmed = invRows.map(r => {
    const o = {}
    for (const [k, v] of Object.entries(r)) if (!emptyCols.includes(k)) o[k] = v
    return o
  })

  const caseRows = []
  for (const [id, cases] of Object.entries(casesById(records))) {
    for (const c of cases) caseRows.push({ id_investment: id, case_study: c.caso ?? '', link: c.link ?? '' })
  }

  const readme = [
    { field: 'dataset', value: 'Regional Repository of Chinese Investments in Latin America' },
    { field: 'source', value: 'ICLAC + Inter-American Dialogue' },
    { field: 'generated', value: new Date().toISOString().slice(0, 10) },
    ...readmeExtras,
    { field: 'investments', value: trimmed.length },
    { field: 'sites', value: siteRows.length },
    { field: 'case_studies', value: caseRows.length },
    { field: 'citation', value: CITATION },
    {
      field: 'structure',
      value:
        'Sheet "investments": one row per investment (id is unique, amounts are safe to sum). Sheet "sites": one row per mapped coordinate, join on id_investment. Sheet "case_studies": one row per study, join on id_investment.'
    },
    {
      field: 'reliability_score',
      value:
        'Ordinal 0-5: number of independent reliable sources confirming the investment, plus one. 5 = four or more primary sources; 2 = one reliable source; 0 = doubtful. ICLAC methodology.'
    },
    { field: 'investment_musd', value: 'Investment amount in millions of USD.' }
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(readme), 'README')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trimmed), 'investments')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(siteRows), 'sites')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(caseRows), 'case_studies')
  return { wb, investments: trimmed.length, sites: siteRows.length, cases: caseRows.length }
}

const xlsxPath = resolve(dirname(outputPath), 'iclac_inversiones_china_latam.xlsx')
const main = buildWorkbook(output, {
  readmeExtras: [
    {
      field: 'scope',
      value: `Investments with reliability_score >= ${minScore}, or not yet scored. Those below the threshold are published separately in the limited-evidence annex.`
    }
  ]
})
XLSX.writeFile(main.wb, xlsxPath)
console.log(`XLSX público: ${xlsxPath} (${main.investments} inversiones · ${main.sites} sitios · ${main.cases} estudios)`)

// --- Anexo de evidencia limitada. Mismas hojas y mismas columnas que la base principal,
// para que se puedan concatenar. Se emite siempre, aunque quede vacío: un archivo que
// desaparece del sitio cuando no hay filas rompe el enlace publicado.
const annexPath = resolve(dirname(outputPath), 'iclac_anexo_evidencia_limitada.xlsx')
const annex = buildWorkbook(annexOutput, {
  readmeExtras: [
    {
      field: 'scope',
      value: `Investments recorded in the ICLAC base whose documentary evidence falls below the repository threshold (reliability_score < ${minScore}): no independent source confirms the amount or the type of transaction. Published for traceability. NOT included in the main dataset, the map, or the aggregate figures.`
    }
  ]
})
XLSX.writeFile(annex.wb, annexPath)
console.log(`XLSX anexo: ${annexPath} (${annex.investments} inversiones · ${annex.sites} sitios · ${annex.cases} estudios)`)

// --- investors_map.json: emit the map already loaded above (source of truth for
// both the Sankey and the ownership derived into investments.json). Keyed by
// investor_raw + company_canonical. Regenerated here so it never drifts from CSV.
const investorsJsonPath = resolve(dirname(outputPath), 'investors_map.json')
if (Object.keys(investorMap).length) {
  writeFileSync(investorsJsonPath, JSON.stringify(investorMap), 'utf8')
  console.log(`Investor map: ${Object.keys(investorMap).length} entries -> ${investorsJsonPath}`)
} else {
  console.warn(`WARN: skipped investors_map.json (no CSV loaded)`)
}
