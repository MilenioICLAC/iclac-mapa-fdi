import XLSX from 'xlsx'

const wb = XLSX.readFile(process.argv[2])
const rows = XLSX.utils.sheet_to_json(wb.Sheets['Total'], { defval: null })

console.log(`Total rows: ${rows.length}\n`)

const ptValues = {}
for (const r of rows) {
  const pt = r.Project_Type ?? '(null)'
  ptValues[pt] = (ptValues[pt] || 0) + 1
}
console.log('Project_Type distinct values:')
for (const [k, v] of Object.entries(ptValues).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k}: ${v}`)
}

console.log('\nCross-tab: Project_Type vs boolean flags (count of "Yes")')
const flags = ['Greenfield', 'Acquisition', 'Joint_Venture', 'Construction']
const xt = {}
for (const r of rows) {
  const pt = r.Project_Type ?? '(null)'
  if (!xt[pt]) xt[pt] = { total: 0 }
  xt[pt].total++
  for (const f of flags) {
    if (!xt[pt][f]) xt[pt][f] = 0
    if (r[f] === 'Yes' || r[f] === 'yes' || r[f] === 'YES' || r[f] === 1) xt[pt][f]++
  }
}
console.log(`${'Project_Type'.padEnd(20)} ${'total'.padStart(6)} ${flags.map(f => f.padStart(12)).join(' ')}`)
for (const [pt, row] of Object.entries(xt)) {
  console.log(`${String(pt).padEnd(20)} ${String(row.total).padStart(6)} ${flags.map(f => String(row[f]).padStart(12)).join(' ')}`)
}

console.log('\nMulti-flag rows (more than one Yes among Greenfield/Acquisition/JV/Construction):')
let multi = 0
const examples = []
for (const r of rows) {
  const count = flags.filter(f => r[f] === 'Yes').length
  if (count > 1) {
    multi++
    if (examples.length < 5) examples.push({ id: r.Id_Investment, pt: r.Project_Type, flags: Object.fromEntries(flags.map(f => [f, r[f]])) })
  }
}
console.log(`  count: ${multi} / ${rows.length}`)
for (const e of examples) console.log(`  ex: ${JSON.stringify(e)}`)

console.log('\nResearch distinct values:')
const research = {}
for (const r of rows) {
  const v = r.Research ?? '(null)'
  research[v] = (research[v] || 0) + 1
}
for (const [k, v] of Object.entries(research)) console.log(`  ${k}: ${v}`)

console.log('\nArea_EN distinct values:')
const area = {}
for (const r of rows) {
  const v = r.Area_EN ?? '(null)'
  area[v] = (area[v] || 0) + 1
}
for (const [k, v] of Object.entries(area).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`)
