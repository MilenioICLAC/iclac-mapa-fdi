import { useEffect, useState, type ReactNode } from 'react'
import { useJumpScroll } from '@/hooks/useJumpScroll'

// Sidebar collapsible section. Starts collapsed; the header carries a summary of
// the current state ("Todos" / "3 seleccionados") so the collapsed row is both
// informative and clearly expandable — the affordance the old ad-hoc pattern lacked.
//
// `jump` es el salto que viene del riel de filtros: cambia a un token nuevo cuando el
// usuario tocó el ícono de ESTA sección con el panel cerrado. Abre la sección (llegar
// a un acordeón cerrado no responde lo que se preguntó) y hace guiñar su ícono.
export default function CollapsibleSection({
  label,
  summary,
  defaultOpen = false,
  Icon,
  jump = 0,
  sectionKey,
  children
}: {
  label: string
  summary: string
  defaultOpen?: boolean
  Icon?: (p: { className?: string }) => ReactNode
  jump?: number
  /** Destino del salto desde el riel; queda como `data-filter-key` en el <section>. */
  sectionKey?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  // Abre, no alterna: el salto pide ver la sección, y si ya estaba abierta cerrarla
  // sería exactamente lo contrario de lo pedido.
  useEffect(() => {
    if (jump) setOpen(true)
  }, [jump])
  // El scroll espera a `open`: hasta que la sección no abrió, su alto no es el final.
  const ref = useJumpScroll<HTMLElement>(jump, open)
  return (
    <section ref={ref} data-filter-key={sectionKey}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="-mx-1 flex w-[calc(100%+0.5rem)] items-center gap-1.5 rounded px-1 py-1.5 text-left hover:bg-brand hover:text-gray-900"
      >
        {Icon && (
          // key remonta el svg: sin remontar, la animación no vuelve a correr al
          // tocar dos veces el mismo ícono del riel.
          <span key={jump} className={`shrink-0 ${jump ? 'filtro-guino' : 'text-gray-500'}`}>
            <Icon className="h-4 w-4" />
          </span>
        )}
        <span className="shrink-0 text-xs font-medium text-gray-600">{label}</span>
        <span className="min-w-0 flex-1 truncate text-right text-xs text-gray-400">{summary}</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && <div className="mt-1">{children}</div>}
    </section>
  )
}
