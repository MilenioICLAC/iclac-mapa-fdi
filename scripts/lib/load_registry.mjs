// Carga desde disco del registro de países, la tabla de inversores y la
// geometría. Es la cáscara de I/O: toda la lógica vive en registry_parse.mjs,
// pura, y la comparte con la página del validador que corre en el navegador
// (que hace fetch en vez de readFileSync). Los scripts CLI (validate_data,
// build_validation_report, etl) usan esto para pasarle `registry`,
// `countryBorders`, `countryBounds` e `investorMap` a validateRows.
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildRegistry, parseInvestorMap, countryBoundsFrom, countryBordersFrom } from './registry_parse.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..', '..')

const DEFAULT_CSV = resolve(REPO_ROOT, 'data/schema/countries.csv')
// Semilla de bordes DISPONIBLES (todos los países del registro con geometría,
// generada por build_borders.mjs). Es la base del chequeo "sin borde": refleja
// qué países PODEMOS dibujar, no cuáles están hoy en el mapa filtrado. Fallback
// al geojson del mapa si la semilla aún no se generó.
const SEED_GEO = resolve(REPO_ROOT, 'data/sources/geo/borders.geojson')
const MAP_GEO = resolve(REPO_ROOT, 'public/data/south-america.geojson')
const DEFAULT_GEO = existsSync(SEED_GEO) ? SEED_GEO : MAP_GEO
const DEFAULT_INVESTORS = resolve(REPO_ROOT, 'data/schema/investors_map.csv')

/** Ruta del geojson que alimenta los chequeos geográficos (para copiarlo al sitio). */
export const geoPathInUse = () => DEFAULT_GEO

const readJson = (path) => {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

/** Registro de países desde countries.csv. null si el archivo no existe. */
export const loadRegistry = (csvPath = DEFAULT_CSV) =>
  existsSync(csvPath) ? buildRegistry(readFileSync(csvPath, 'utf8')) : null

/**
 * Nombres conocidos de la tabla de inversores. null si el CSV no está — el repo
 * del cliente todavía no lo lleva y el chequeo se salta solo en vez de romper.
 */
export const loadInvestorMap = (csvPath = DEFAULT_INVESTORS) =>
  existsSync(csvPath) ? parseInvestorMap(readFileSync(csvPath, 'utf8')) : null

/** Caja envolvente por país (alpha-3 → [minLat,maxLat,minLng,maxLng]). */
export const loadCountryBounds = (registry, geoPath = DEFAULT_GEO) =>
  countryBoundsFrom(registry, readJson(geoPath))

/** Set de alpha-3 con borde de país disponible. */
export const loadCountryBorders = (registry, geoPath = DEFAULT_GEO) =>
  countryBordersFrom(registry, readJson(geoPath))
