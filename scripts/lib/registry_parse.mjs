// Parseo del registro, la tabla de inversores y la geometría — PURO, sin I/O.
//
// Existe para que el navegador pueda armar exactamente los mismos `opts` que le
// pasa el CLI a validateRows: la página del validador hace fetch del texto y llama
// estas funciones, y scripts/lib/load_registry.mjs es el mismo código con
// readFileSync delante. Ninguna lógica vive en los dos lados.
import { parseCountriesCsv } from './countries.mjs'
import { buildCountryCanonIndex } from './normalize.mjs'

// Quita diacríticos y baja a minúscula para comparar sin importar tildes/caso.
const fold = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()

/**
 * Registro listo para validateRows (incluye canonIndex prearmado).
 * @param {string} text contenido de countries.csv
 */
export const buildRegistry = (text) => {
  const parsed = parseCountriesCsv(text)
  return { ...parsed, canonIndex: buildCountryCanonIndex(parsed.countryIso, parsed.canonicalByAlpha3) }
}

/**
 * Set de nombres conocidos de la tabla de inversores, en minúsculas:
 * `investor_raw` y `company_canonical` (la base usa cualquiera de los dos como
 * `Investor`). null si el CSV no trae la columna esperada.
 * @param {string} text contenido de investors_map.csv
 */
export const parseInvestorMap = (text) => {
  const lines = String(text).trim().split(/\r?\n/)
  const parseLine = (line) => {
    const out = []
    let cur = ''
    let q = false
    for (const ch of line) {
      if (ch === '"') q = !q
      else if (ch === ',' && !q) { out.push(cur); cur = '' }
      else cur += ch
    }
    out.push(cur)
    return out
  }
  const header = parseLine(lines[0] ?? '')
  const iRaw = header.indexOf('investor_raw')
  const iCanon = header.indexOf('company_canonical')
  if (iRaw < 0) return null
  const names = new Set()
  for (const line of lines.slice(1)) {
    const c = parseLine(line)
    for (const i of [iRaw, iCanon]) {
      const v = (c[i] ?? '').trim()
      if (v) names.add(v.toLowerCase())
    }
  }
  return names
}

// alpha-3 de un feature del geojson: por props ISO, o por nombre contra el registro.
const alpha3OfFeature = (f, nameToA3) => {
  const p = f.properties ?? {}
  const a3 = String(p.iso_a3 || p.ISO_A3 || p.ISO_A3_EH || '').toUpperCase()
  if (a3.length === 3 && a3 !== '-99') return a3
  const nm = p.name || p.NAME || p.admin || p.ADMIN
  return (nm && nameToA3.get(fold(nm))) || null
}

const nameIndex = (registry) => {
  const m = new Map()
  for (const [name, info] of Object.entries(registry?.countryIso ?? {})) m.set(fold(name), info.alpha3)
  return m
}

/**
 * Caja envolvente por país: alpha-3 → `[minLat, maxLat, minLng, maxLng]`. La usa
 * el chequeo de coordenadas para preguntar "¿este punto cae dentro de SU país?"
 * en vez de contra una ventana regional fija.
 * @param {object} registry
 * @param {object} gj geojson ya parseado
 */
export const countryBoundsFrom = (registry, gj) => {
  if (!gj) return null
  const nameToA3 = nameIndex(registry)
  const bounds = {}
  for (const f of gj.features ?? []) {
    const a3 = alpha3OfFeature(f, nameToA3)
    if (!a3 || !f.geometry?.coordinates) continue
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity
    const walk = (c) => {
      if (typeof c[0] === 'number') {
        const [lng, lat] = c // GeoJSON va lng,lat
        if (lat < minLat) minLat = lat
        if (lat > maxLat) maxLat = lat
        if (lng < minLng) minLng = lng
        if (lng > maxLng) maxLng = lng
        return
      }
      for (const x of c) walk(x)
    }
    walk(f.geometry.coordinates)
    if (!Number.isFinite(minLat)) continue
    const prev = bounds[a3]
    bounds[a3] = prev
      ? [Math.min(prev[0], minLat), Math.max(prev[1], maxLat), Math.min(prev[2], minLng), Math.max(prev[3], maxLng)]
      : [minLat, maxLat, minLng, maxLng]
  }
  return Object.keys(bounds).length ? bounds : null
}

/**
 * Set de alpha-3 con borde de país disponible en el geojson.
 * @param {object} registry
 * @param {object} gj geojson ya parseado
 */
export const countryBordersFrom = (registry, gj) => {
  if (!gj) return null
  const nameToA3 = nameIndex(registry)
  const borders = new Set()
  for (const f of gj.features ?? []) {
    const a3 = alpha3OfFeature(f, nameToA3)
    if (a3) borders.add(a3)
  }
  return borders
}
