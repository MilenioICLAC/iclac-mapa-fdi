// One-off, idempotent merge of country polygons into the main map geojson.
// Adds Panama (from legacy/data/america.geojson) and Mexico (from public/data/mx.json)
// to public/data/south-america.geojson, normalizing properties to { name, iso_a3 }.
// Re-running is safe: a country already present (by name) is skipped.

import { readFileSync, writeFileSync } from 'node:fs'

const MAIN = 'public/data/south-america.geojson'
const LEGACY_AMERICA = 'legacy/data/america.geojson'
const MX = 'public/data/mx.json'

const main = JSON.parse(readFileSync(MAIN, 'utf8'))
const existing = new Set(main.features.map(f => f.properties?.name))

const additions = []

if (!existing.has('Panama')) {
  const america = JSON.parse(readFileSync(LEGACY_AMERICA, 'utf8'))
  const pan = america.features.find(f => f.properties?.name === 'Panama')
  if (!pan) throw new Error('Panama not found in legacy america.geojson')
  additions.push({
    type: 'Feature',
    properties: { name: 'Panama', iso_a3: 'PAN' },
    geometry: pan.geometry
  })
}

if (!existing.has('Mexico')) {
  const mx = JSON.parse(readFileSync(MX, 'utf8'))
  const feat = mx.features?.[0] ?? mx
  if (!feat?.geometry) throw new Error('Mexico geometry not found in mx.json')
  additions.push({
    type: 'Feature',
    properties: { name: 'Mexico', iso_a3: 'MEX' },
    geometry: feat.geometry
  })
}

if (additions.length === 0) {
  console.log('Nothing to add — Panama and Mexico already present.')
  process.exit(0)
}

main.features.push(...additions)
writeFileSync(MAIN, JSON.stringify(main))
console.log(`Added: ${additions.map(f => f.properties.name).join(', ')}`)
console.log(`Total features now: ${main.features.length}`)
