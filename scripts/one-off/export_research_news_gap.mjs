#!/usr/bin/env node
// Planilla adjunta del punto C14: las inversiones donde los flags Research/News y
// las columnas source1..3 no cuentan la misma historia.
//
// Dos poblaciones, en dos hojas:
//   sin_marca_con_fuente — Research=No Y News=No, pero con al menos una source.
//   marca_sin_fuente     — Research=Yes o News=Yes, y ninguna source.
//
// Una fila por INVERSIÓN, no por punto: los flags y las fuentes son constantes
// dentro de un Id_Investment, así que repetirlos por coordenada sería ruido.
//
// Uso: node scripts/one-off/export_research_news_gap.mjs [dirEntrada] [salida.xlsx]
import XLSX from 'xlsx'
import { readdirSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..', '..')

const inDir = resolve(process.argv[2] ?? resolve(REPO_ROOT, 'data/sources/countries'))
const outPath = resolve(process.argv[3] ?? resolve(REPO_ROOT, 'docs/sprint_5/research_news_vs_sources_31072026.xlsx'))

const clean = v => (v === null || v === undefined ? null : String(v).trim() || null)
const isYes = v => String(v ?? '').trim().toLowerCase() === 'yes'

// --- Carga: una entrada por inversión, con el archivo de origen para trazar.
const byId = new Map()
for (const f of readdirSync(inDir).filter(x => x.endsWith('.xlsx') && !x.startsWith('~$')).sort()) {
  const wb = XLSX.readFile(resolve(inDir, f))
  for (const r of XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null })) {
    const id = clean(r.Id_Investment)
    if (!id) continue
    if (!byId.has(id)) {
      byId.set(id, {
        archivo: f,
        Id_Investment: id,
        Country: clean(r.Country),
        Investor: clean(r.Investor),
        Year: r.Year ?? null,
        Investment: r.Investment ?? null,
        Area_EN: clean(r.Area_EN),
        Project_Type: clean(r.Project_Type),
        Research: clean(r.Research),
        News: clean(r.News),
        reliability_score: r.reliability_score ?? null,
        source1: clean(r.source1),
        source2: clean(r.source2),
        source3: clean(r.source3),
        casos: 0,
        filas: 0
      })
    }
    const e = byId.get(id)
    e.filas++
    // Los CasoN pueden estar repartidos entre las filas de la misma inversión.
    for (let i = 1; i <= 14; i++) if (clean(r[`Caso${i}`])) e.casos++
  }
}

const all = [...byId.values()]
const nSources = e => [e.source1, e.source2, e.source3].filter(Boolean).length

const sheetRow = e => ({
  Id_Investment: e.Id_Investment,
  Country: e.Country,
  Investor: e.Investor,
  Year: e.Year,
  Investment_MUSD: e.Investment,
  Area_EN: e.Area_EN,
  Project_Type: e.Project_Type,
  Research: e.Research,
  News: e.News,
  reliability_score: e.reliability_score,
  n_fuentes: nSources(e),
  n_casos: e.casos,
  source1: e.source1,
  source2: e.source2,
  source3: e.source3,
  archivo: e.archivo
})

const sinMarca = all
  .filter(e => !isYes(e.Research) && !isYes(e.News) && nSources(e) > 0)
  .sort((a, b) => (Number(b.Investment) || 0) - (Number(a.Investment) || 0))
  .map(sheetRow)

const marcaSinFuente = all
  .filter(e => (isYes(e.Research) || isYes(e.News)) && nSources(e) === 0)
  .sort((a, b) => (Number(b.Investment) || 0) - (Number(a.Investment) || 0))
  .map(sheetRow)

// Resumen por país de la primera hoja, que es la grande.
const porPais = new Map()
for (const r of sinMarca) {
  const k = r.Country ?? '(sin país)'
  if (!porPais.has(k)) porPais.set(k, { Country: k, inversiones: 0, monto_MUSD: 0 })
  const e = porPais.get(k)
  e.inversiones++
  e.monto_MUSD += Number(r.Investment_MUSD) || 0
}
const resumen = [...porPais.values()]
  .sort((a, b) => b.inversiones - a.inversiones)
  .map(r => ({ ...r, monto_MUSD: Math.round(r.monto_MUSD * 10) / 10 }))

const montoTotal = Math.round(sinMarca.reduce((a, r) => a + (Number(r.Investment_MUSD) || 0), 0))
const readme = [
  { campo: 'Qué es', valor: 'Inversiones donde los flags Research/News y las columnas source1..3 no coinciden.' },
  { campo: 'Fecha', valor: new Date().toISOString().slice(0, 10) },
  { campo: 'Base', valor: `${inDir.split(/[\\/]/).slice(-3).join('/')} — ${all.length} inversiones` },
  { campo: 'Alcance', valor: `Los ${new Set(all.map(e => e.archivo)).size} archivos por país, incluidos los cuatro que todavía no se publican (Costa Rica, Honduras, Nicaragua y Trinidad y Tobago).` },
  { campo: 'Unidad', valor: 'Una fila por inversión (Id_Investment). Los flags y las fuentes son constantes entre los puntos de una misma inversión.' },
  { campo: 'Hoja sin_marca_con_fuente', valor: `${sinMarca.length} inversiones con Research=No Y News=No que igual tienen fuentes cargadas (US$${montoTotal.toLocaleString('es-CL')} MM).` },
  { campo: 'Hoja marca_sin_fuente', valor: `${marcaSinFuente.length} inversiones marcadas Research=Yes o News=Yes que no tienen ninguna source.` },
  { campo: 'Por qué importa', valor: 'El filtro "con estudios" y la marca de las fichas del sitio leen solo Research/News y CasoN, no source1..3: hoy esas inversiones se ven sin respaldo documental aunque lo tengan.' },
  { campo: 'Qué se pide', valor: 'Definir si una URL en source1..3 cuenta como noticia o como estudio para efectos de Research/News, o si son dimensiones distintas. Nada se modificó de nuestro lado.' }
]

mkdirSync(dirname(outPath), { recursive: true })
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(readme), 'README')
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sinMarca), 'sin_marca_con_fuente')
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(marcaSinFuente), 'marca_sin_fuente')
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), 'resumen_por_pais')
XLSX.writeFile(wb, outPath)

console.log(`${all.length} inversiones leídas de ${inDir}`)
console.log(`  sin_marca_con_fuente: ${sinMarca.length} (US$${montoTotal.toLocaleString('es-CL')} MM)`)
console.log(`  marca_sin_fuente: ${marcaSinFuente.length}`)
console.log(`  resumen_por_pais: ${resumen.length} países`)
console.log(`→ ${outPath}`)
