import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.markercluster'
import { useTranslation } from 'react-i18next'
import type { Feature, Geometry } from 'geojson'
import type { LatLngExpression, Layer, LeafletMouseEvent, Path, PathOptions } from 'leaflet'
import type { CountryFeatureCollection, CountryProperties, Investment } from '@/types/data'
import { sectorColor } from '@/lib/sectors'
import { applyFilters, distinctCountries, distinctSectors, yearBounds } from '@/lib/filter'
import { useFilters } from '@/hooks/useFilters'
import FilterPanel from '@/components/FilterPanel'

const LATAM_CENTER: LatLngExpression = [-15, -60]
const INITIAL_ZOOM = 3

const baseCountryStyle: PathOptions = {
  fillColor: '#d4d4d8',
  weight: 1,
  color: '#52525b',
  fillOpacity: 0.2
}

const hoverCountryStyle: PathOptions = {
  fillColor: '#a1a1aa',
  weight: 2,
  color: '#27272a',
  fillOpacity: 0.4
}

function InvestmentMarkers({ investments, cluster }: { investments: Investment[]; cluster: boolean }) {
  const map = useMap()

  useEffect(() => {
    if (investments.length === 0) return

    const lineLayer = L.layerGroup()
    const pointLayer = cluster
      ? L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 50, disableClusteringAtZoom: 9 })
      : L.layerGroup()
    const svgRenderer = L.svg()

    for (const inv of investments) {
      const color = sectorColor(inv.area_en)

      const tooltipHtml = `<div style="font-size:12px">
        <strong>${inv.investor ?? 'Unknown'}</strong><br/>
        ${inv.country ?? ''} · ${inv.year ?? ''}<br/>
        ${inv.area_en ?? ''} · ${inv.project_type}<br/>
        ${inv.investment_musd ? `US$ ${inv.investment_musd} MM` : ''}
      </div>`

      const onClick = () => console.log('clicked investment:', inv.id, inv)

      if (inv.geometry_type === 'point') {
        const [lat, lng] = inv.coordinates
        const marker = L.circleMarker([lat, lng], {
          radius: 4,
          color,
          fillColor: color,
          fillOpacity: 0.7,
          weight: 1,
          opacity: 0.9
        })
        marker.bindTooltip(tooltipHtml, { sticky: true })
        marker.on('click', onClick)
        pointLayer.addLayer(marker)
      } else {
        const polyline = L.polyline(inv.coordinates, {
          color,
          weight: 3,
          opacity: 0.9,
          dashArray: '5, 5',
          renderer: svgRenderer
        })
        polyline.bindTooltip(tooltipHtml, { sticky: true })
        polyline.on('click', onClick)
        polyline.addTo(lineLayer)
      }
    }

    pointLayer.addTo(map)
    lineLayer.addTo(map)
    return () => {
      map.removeLayer(pointLayer)
      map.removeLayer(lineLayer)
    }
  }, [investments, map, cluster])

  return null
}

export default function MapView() {
  const { t } = useTranslation()
  const [geo, setGeo] = useState<CountryFeatureCollection | null>(null)
  const [investments, setInvestments] = useState<Investment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cluster, setCluster] = useState(true)
  const { filters } = useFilters()

  useEffect(() => {
    Promise.all([
      fetch('/data/south-america.geojson').then(r => r.json()),
      fetch('/data/investments.json').then(r => {
        if (!r.ok) throw new Error(`investments.json fetch failed: ${r.status}`)
        return r.json()
      })
    ])
      .then(([g, inv]: [CountryFeatureCollection, Investment[]]) => {
        setGeo(g)
        setInvestments(inv)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setError(String(err))
        setLoading(false)
      })
  }, [])

  const countries = useMemo(() => distinctCountries(investments), [investments])
  const sectors = useMemo(() => distinctSectors(investments), [investments])
  const [yearMin, yearMax] = useMemo(() => yearBounds(investments), [investments])
  const filtered = useMemo(() => applyFilters(investments, filters), [investments, filters])

  const filteredGeo = useMemo<CountryFeatureCollection | null>(() => {
    if (!geo) return null
    if (filters.countries.length === 0) return geo
    return {
      ...geo,
      features: geo.features.filter(f => {
        const name = f.properties?.name ?? f.properties?.NAME
        return name ? filters.countries.includes(name) : false
      })
    }
  }, [geo, filters.countries])

  const onEachFeature = (feature: Feature<Geometry, CountryProperties>, layer: Layer) => {
    layer.on({
      mouseover: (e: LeafletMouseEvent) => (e.target as Path).setStyle(hoverCountryStyle),
      mouseout: (e: LeafletMouseEvent) => (e.target as Path).setStyle(baseCountryStyle),
      click: () => {
        const name = feature.properties?.name ?? feature.properties?.NAME ?? 'unknown'
        console.log('clicked country:', name)
      }
    })
  }

  const pointsCount = filtered.filter(i => i.geometry_type === 'point').length
  const linesCount = filtered.filter(i => i.geometry_type === 'line').length

  return (
    <div className="flex h-[calc(100vh-7rem)] w-full">
      {!loading && !error && (
        <FilterPanel countries={countries} sectors={sectors} yearMin={yearMin} yearMax={yearMax} />
      )}
      <div className="relative flex-1">
        {loading && (
          <div className="absolute top-2 right-2 z-[1000] bg-white px-3 py-1 rounded shadow text-sm">
            {t('common.loading')}
          </div>
        )}
        {error && (
          <div className="absolute top-2 right-2 z-[1000] bg-red-100 text-red-800 px-3 py-1 rounded shadow text-sm">
            {error}
          </div>
        )}
        {!loading && !error && (
          <div className="absolute top-2 right-2 z-[1000] flex flex-col items-end gap-2">
            <div className="bg-white px-3 py-1 rounded shadow text-sm">
              {t('filter.investments_count', { count: filtered.length })}
              <span className="text-gray-500 ml-2">
                ({t('filter.points_lines', { points: pointsCount, lines: linesCount })})
              </span>
            </div>
            <label className="bg-white px-3 py-1 rounded shadow text-sm flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={cluster} onChange={e => setCluster(e.target.checked)} />
              {t('filter.cluster')}
            </label>
          </div>
        )}
        <MapContainer
          center={LATAM_CENTER}
          zoom={INITIAL_ZOOM}
          scrollWheelZoom
          preferCanvas
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          {filteredGeo && (
            <GeoJSON
              key={filters.countries.join(',') || 'all'}
              data={filteredGeo}
              style={baseCountryStyle}
              onEachFeature={onEachFeature}
            />
          )}
          {filtered.length > 0 && <InvestmentMarkers investments={filtered} cluster={cluster} />}
        </MapContainer>
      </div>
    </div>
  )
}
