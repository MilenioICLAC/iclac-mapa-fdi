import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet'
import type { Feature, Geometry } from 'geojson'
import type { LatLngExpression, Layer, LeafletMouseEvent, Path, PathOptions } from 'leaflet'
import type { CountryFeatureCollection, CountryProperties } from '@/types/data'

const LATAM_CENTER: LatLngExpression = [-15, -60]
const INITIAL_ZOOM = 3

const baseCountryStyle: PathOptions = {
  fillColor: '#d4d4d8',
  weight: 1,
  color: '#52525b',
  fillOpacity: 0.6
}

const hoverCountryStyle: PathOptions = {
  fillColor: '#a1a1aa',
  weight: 2,
  color: '#27272a',
  fillOpacity: 0.85
}

export default function MapView() {
  const [geo, setGeo] = useState<CountryFeatureCollection | null>(null)

  useEffect(() => {
    fetch('/data/south-america.geojson')
      .then(r => r.json())
      .then((data: CountryFeatureCollection) => setGeo(data))
      .catch(err => console.error('GeoJSON load failed', err))
  }, [])

  const onEachFeature = (feature: Feature<Geometry, CountryProperties>, layer: Layer) => {
    layer.on({
      mouseover: (e: LeafletMouseEvent) => (e.target as Path).setStyle(hoverCountryStyle),
      mouseout: (e: LeafletMouseEvent) => (e.target as Path).setStyle(baseCountryStyle),
      click: () => {
        const name = feature.properties?.name ?? feature.properties?.NAME ?? 'unknown'
        console.log('clicked:', name)
      }
    })
  }

  return (
    <div className="h-[calc(100vh-7rem)] w-full">
      <MapContainer center={LATAM_CENTER} zoom={INITIAL_ZOOM} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        {geo && <GeoJSON data={geo} style={baseCountryStyle} onEachFeature={onEachFeature} />}
      </MapContainer>
    </div>
  )
}
