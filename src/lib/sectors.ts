/**
 * Paleta categórica de sectores. **No se toca a ojo**: los ocho colores son un conjunto
 * validado, y mover uno solo rompe el conjunto.
 *
 * La anterior no pasaba los chequeos de una paleta categórica, y no solo por daltonismo:
 * Energy y Finance quedaban a ΔE 11,4 en visión normal, bajo el piso de 15, o sea que un
 * lector con visión de color completa tampoco los distinguía. Bajo protanopia, Energy,
 * Agroindustry, Finance e Infrastructure colapsaban a un mismo verde oliva.
 *
 * Esta se generó buscando el conjunto que maximiza la separación del par más parecido,
 * sujeto a: banda de luminosidad OKLCH 0,43–0,77 · croma ≥ 0,10 · contraste ≥ 3:1 contra
 * el basemap · y ΔE ≥ 15 contra `brand` (#00A89C), para que ningún sector se confunda con
 * el resaltado del hover. Resultado: peor par 9,5 bajo daltonismo y 15,7 en visión normal.
 *
 * Seis de las ocho familias salen de la paleta institucional de ICLAC; verde y lila son
 * extensiones, porque la marca no las tiene y ocho categorías necesitan ocho posiciones.
 * Que la paleta cargue al azul es forzado: bajo daltonismo el arco cálido colapsa y solo
 * aguanta dos o tres sectores.
 *
 * Procedencia y alternativas descartadas en `docs/generales/devlog.md`.
 */
export const SECTOR_COLORS: Record<string, string> = {
  Energy: 'rgba(198,42,75,1)', // carmín
  Manufacturing: 'rgba(125,46,103,1)', // vino
  Mining: 'rgba(5,115,160,1)', // azul
  'Real Estate': 'rgba(60,57,182,1)', // índigo
  RealEstate: 'rgba(60,57,182,1)',
  ICT: 'rgba(81,124,254,1)', // azul brillante
  Infrastructure: 'rgba(221,119,75,1)', // terracota
  Agroindustry: 'rgba(24,108,5,1)', // verde
  Finance: 'rgba(176,129,197,1)' // lila
}

export const DEFAULT_SECTOR_COLOR = 'rgba(120,120,120,1)'

export const sectorColor = (areaEn: string | null): string =>
  (areaEn && SECTOR_COLORS[areaEn]) || DEFAULT_SECTOR_COLOR
