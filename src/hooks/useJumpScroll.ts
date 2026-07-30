import { useEffect, useRef } from 'react'

// Trae a la vista la sección de filtros a la que se llegó desde el riel colapsado.
// `jump` es el token del salto (0 = ningún salto); `ready` es "esta sección ya tiene
// su alto definitivo" — en una colapsable, que ya haya abierto.
//
// El scroll lo pide la sección y no el panel, a propósito. Medido: pidiéndolo desde
// el panel en el frame siguiente al clic, el contenido todavía medía lo mismo que la
// caja (scrollHeight 547 == clientHeight 547) porque el acordeón destino abre en su
// propio efecto, y sin nada que scrollear el navegador no hace nada. Esperar a que el
// alto "se estabilice" tampoco sirve: en la primera apertura del panel se queda dos
// frames en 547 antes de crecer, o sea que el heurístico dispara temprano. La sección
// sí sabe cuándo abrió, así que la condición pasa a ser un dato y no un plazo.
export function useJumpScroll<T extends HTMLElement>(jump: number, ready = true) {
  const ref = useRef<T | null>(null)
  useEffect(() => {
    if (!jump || !ready) return
    const el = ref.current
    if (!el) return
    // Un frame para que el commit que abrió la sección quede pintado.
    const frame = requestAnimationFrame(() =>
      el.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
      })
    )
    return () => cancelAnimationFrame(frame)
  }, [jump, ready])
  return ref
}
