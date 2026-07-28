import XLSX from 'xlsx'

const wb = XLSX.readFile(process.argv[2])
const rows = XLSX.utils.sheet_to_json(wb.Sheets['Total'], { defval: null })

const byVector = {}
for (const r of rows) {
  const v = r.Vector ?? '(null)'
  byVector[v] = (byVector[v] || 0) + 1
}
console.log('Vector distinct:')
for (const [k, v] of Object.entries(byVector)) console.log(`  ${k}: ${v}`)

console.log('\nVector=Vector — group by Id_Investment, count waypoints per id:')
const groups = new Map()
for (const r of rows) {
  if (r.Vector !== 'Vector') continue
  const k = r.Id_Investment
  if (!groups.has(k)) groups.set(k, [])
  groups.get(k).push({ path: r.Path, coords: r.Coordinates, year: r.Year, area: r.Area_EN, investor: r.Investor })
}
console.log(`  distinct line projects (by Id_Investment): ${groups.size}`)
const sizes = [...groups.values()].map(g => g.length).sort((a,b)=>b-a)
console.log(`  waypoints per project — min:${sizes[sizes.length-1]} max:${sizes[0]} avg:${(sizes.reduce((a,b)=>a+b,0)/sizes.length).toFixed(1)}`)
console.log(`  top 3:`)
const top = [...groups.entries()].sort((a,b)=>b[1].length-a[1].length).slice(0,3)
for (const [id, segs] of top) {
  console.log(`    ${id}: ${segs.length} waypoints — ${segs[0].investor} (${segs[0].area})`)
  console.log(`      Path values: ${segs.map(s=>s.path).slice(0,10).join(',')}${segs.length>10?'...':''}`)
}

console.log('\nVector=Punto with non-null Path (legacy ignores Path for points):')
let puntoWithPath = 0
for (const r of rows) {
  if (r.Vector === 'Punto' && r.Path !== null && r.Path !== undefined) puntoWithPath++
}
console.log(`  count: ${puntoWithPath}`)
