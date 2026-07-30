import { useEffect, useState } from 'react'

// Subscribes to a CSS media query. Initial value reads synchronously (lazy
// initializer) so components mount in the correct state — no flash of the
// desktop layout on a phone before the first effect runs.
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

// < md (Tailwind default breakpoint 768px). One place to change the phone cutoff.
// Gobierna lo que solo el teléfono cambia: el cromo del mapa apoyado en su barra de
// acciones y los márgenes del Sankey.
export const useIsMobile = (): boolean => useMediaQuery('(max-width: 767px)')

// < lg (1024px): teléfono Y tablet. Gobierna quién puede quedarse con ancho propio.
// El panel de filtros (288px) y el listado (384–512px) juntos se comen dos tercios de
// una tablet de 800px y dejan el mapa en una tira, así que hasta 1023px los dos son
// capas sobre el mapa y arrancan cerrados.
//
// Es un corte distinto de `useIsMobile`, no un reemplazo: el cromo del mapa (leyenda,
// Puntos/Agregado, botón del listado) SÍ cabe flotando en una tablet y ahí se comporta
// como en escritorio. Son dos preguntas — "¿quién roba ancho?" y "¿qué cabe
// flotando?" — y contestarlas con un solo umbral fue lo que hizo que la tablet
// heredara mal una mitad de cada layout.
export const useIsCompact = (): boolean => useMediaQuery('(max-width: 1023px)')
