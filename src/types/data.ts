import type { FeatureCollection, Geometry } from 'geojson'

export type CountryProperties = {
  name?: string
  NAME?: string
  iso_a3?: string
  ADM0_A3?: string
}

export type CountryFeatureCollection = FeatureCollection<Geometry, CountryProperties>

export type LocaleCode = 'es' | 'en' | 'cn'
