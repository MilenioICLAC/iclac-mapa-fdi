import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadRegistry, loadInvestorMap, loadCountryBounds, loadCountryBorders, geoPathInUse } from './lib/load_registry.mjs'
import { buildRegistry, parseInvestorMap, countryBoundsFrom, countryBordersFrom } from './lib/registry_parse.mjs'

// El validador corre en dos lados: en Node (CI, ETL, informe), que lee los
// archivos con fs, y en el navegador (site/validador/), que los recibe como
// texto. Los dos tienen que armar EXACTAMENTE los mismos `opts` para
// validateRows; si no, la página diría una cosa y el repositorio otra, que es
// justo el problema que la página vino a resolver.
//
// Este test compara las dos rutas sobre los archivos reales del repositorio.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(resolve(REPO_ROOT, p), 'utf8')

describe('la ruta del navegador arma los mismos opts que la de Node', () => {
  const nodeRegistry = loadRegistry()
  const webRegistry = buildRegistry(read('data/schema/countries.csv'))
  const geo = JSON.parse(readFileSync(geoPathInUse(), 'utf8'))

  it('registro de países', () => {
    expect(webRegistry.countryIso).toEqual(nodeRegistry.countryIso)
    expect(webRegistry.filenameByAlpha3).toEqual(nodeRegistry.filenameByAlpha3)
    expect(webRegistry.publishByAlpha3).toEqual(nodeRegistry.publishByAlpha3)
    expect(webRegistry.alpha2ByAlpha3).toEqual(nodeRegistry.alpha2ByAlpha3)
    expect([...webRegistry.canonicalFilenames].sort()).toEqual([...nodeRegistry.canonicalFilenames].sort())
    expect([...webRegistry.filenameAliasIndex.entries()].sort()).toEqual(
      [...nodeRegistry.filenameAliasIndex.entries()].sort()
    )
  })

  it('tabla de inversores', () => {
    const web = parseInvestorMap(read('data/schema/investors_map.csv'))
    expect([...web].sort()).toEqual([...loadInvestorMap()].sort())
    expect(web.size).toBeGreaterThan(0)
  })

  it('cajas por país', () => {
    expect(countryBoundsFrom(webRegistry, geo)).toEqual(loadCountryBounds(nodeRegistry))
  })

  it('bordes disponibles', () => {
    const web = countryBordersFrom(webRegistry, geo)
    expect([...web].sort()).toEqual([...loadCountryBorders(nodeRegistry)].sort())
    expect(web.size).toBeGreaterThan(0)
  })
})
