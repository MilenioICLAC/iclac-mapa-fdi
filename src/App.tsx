import { Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import MapView from '@/views/MapView'
import SankeyView from '@/views/SankeyView'
import MethodologyView from '@/views/MethodologyView'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<MapView />} />
        <Route path="sankey" element={<SankeyView />} />
        <Route path="methodology" element={<MethodologyView />} />
      </Route>
    </Routes>
  )
}
