import XLSX from 'xlsx'

const path = process.argv[2]
if (!path) {
  console.error('usage: node inspect_xlsx.mjs <file.xlsx>')
  process.exit(1)
}

const wb = XLSX.readFile(path)
console.log(`workbook: ${path}`)
console.log(`sheets: ${wb.SheetNames.join(', ')}\n`)

for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name]
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null })
  console.log(`=== ${name} (${rows.length} rows) ===`)
  if (rows.length === 0) { console.log('  (empty)\n'); continue }
  const cols = Object.keys(rows[0])
  console.log(`  columns (${cols.length}): ${cols.join(' | ')}`)
  console.log(`  first row:`)
  console.log(JSON.stringify(rows[0], null, 2).split('\n').map(l => '    ' + l).join('\n'))
  console.log()
}
