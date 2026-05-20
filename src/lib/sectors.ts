export const SECTOR_COLORS: Record<string, string> = {
  Energy: 'rgba(153,17,17,1)',
  Manufacturing: 'rgba(95,25,58,1)',
  Mining: 'rgba(9,49,77,1)',
  'Real Estate': 'rgba(53,107,126,1)',
  RealEstate: 'rgba(53,107,126,1)',
  ICT: 'rgba(12,202,188,1)',
  Infrastructure: 'rgba(255,169,42,1)',
  Agroindustry: 'rgba(245,106,14,1)',
  Finance: 'rgba(173,77,14,1)'
}

export const DEFAULT_SECTOR_COLOR = 'rgba(120,120,120,1)'

export const sectorColor = (areaEn: string | null): string =>
  (areaEn && SECTOR_COLORS[areaEn]) || DEFAULT_SECTOR_COLOR
