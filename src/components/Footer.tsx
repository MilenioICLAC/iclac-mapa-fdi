import { useState } from 'react'
import { useTranslation } from 'react-i18next'

type Logo = { src: string; alt: string; href?: string }

// ICLAC logo lives in the header; the footer carries only partner logos.
// Image assets live in /public/icons/ — supplied from the legacy project.
//
// MinCiencia + ANID reemplaza al logo anterior (Ministerio de Economía + milenio,
// 2026-07-30): el ministerio que lo firmaba ya no es el que corresponde. La marca
// «milenio» sale del pie con él, porque el archivo institucional nuevo no la trae.
//
// De las tres variantes que entrega ANID se usa `PLUMA`, la monocroma en #1c335a.
// La de color traía el único bloque sólido saturado de la fila (medido: 95% de píxeles
// cromáticos, igual que CECHAP, pero en rojo pleno en vez de texto azul) y se llevaba
// la vista. La salida NO es teñir la de color con `filter: grayscale()`: eso altera un
// logo institucional, y el manual de estas marcas no lo permite. La propia agencia
// publica la variante monocroma justamente para este caso.
//
// `PLUMA-BLANCO` es la tercera y no sirve acá: es blanca entera (`fill: #fff`) sobre
// un pie blanco. Está pensada para fondos oscuros.
const PARTNERS: Logo[] = [
  { src: '/icons/theDialogue.webp', alt: 'The Dialogue', href: 'https://www.thedialogue.org/' },
  { src: '/icons/cechap.webp', alt: 'CECHAP', href: 'https://cechap.up.edu.pe/' },
  {
    src: '/icons/minciencia-anid.svg',
    alt: 'Ministerio de Ciencia, Tecnología, Conocimiento e Innovación · ANID',
    href: 'https://anid.cl/'
  },
  { src: '/icons/ceach.webp', alt: 'CEACH' },
  { src: '/icons/camaraArgentinaChina.webp', alt: 'Cámara Argentino China' },
  { src: '/icons/camaraColombiaChina.webp', alt: 'Cámara Colombo China' }
]

function LogoImg({ logo, className }: { logo: Logo; className: string }) {
  const img = (
    <img
      src={logo.src}
      alt={logo.alt}
      className={`w-auto object-contain ${className}`}
    />
  )
  return logo.href ? (
    <a href={logo.href} target="_blank" rel="noopener noreferrer" className="shrink-0">
      {img}
    </a>
  ) : (
    <span className="shrink-0">{img}</span>
  )
}

export default function Footer() {
  const { t } = useTranslation()
  // Los seis logos ocupan 133 px de alto en un teléfono: 21% de una pantalla de 640,
  // permanentes, sobre las dos herramientas que se miran a pantalla completa. En móvil
  // el crédito parte como una línea y los logos se despliegan a demanda; en escritorio
  // no cambia nada.
  const [open, setOpen] = useState(false)

  return (
    <footer className="border-t border-gray-200 px-4 py-2 sm:px-6 sm:py-3">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-brand-dark md:hidden"
      >
        {t('footer.partners')}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          className={`h-4 w-4 transition-transform ${open ? '' : 'rotate-180'}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 15 6-6 6 6" />
        </svg>
      </button>
      <div
        className={`${open ? 'mt-2 flex' : 'hidden'} flex-wrap items-center justify-center gap-x-6 gap-y-1 sm:gap-x-8 sm:gap-y-2 md:mt-0 md:flex`}
      >
        <span className="hidden text-xs font-semibold uppercase tracking-wide text-gray-500 md:inline">
          {t('footer.partners')}
        </span>
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
          {PARTNERS.map(l => (
            <LogoImg key={l.src} logo={l} className="h-7 sm:h-9" />
          ))}
        </div>
      </div>
    </footer>
  )
}
