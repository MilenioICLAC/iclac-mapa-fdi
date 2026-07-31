import { intlLocale } from './countries'

/**
 * Formato único de montos del sitio.
 *
 * La base guarda `Investment` en **millones de USD** (ver `data/schema/schema.md`), y
 * hasta ahora la interfaz mostraba ese número crudo con el sufijo «MM». Dos problemas
 * distintos, reportados juntos por el cliente:
 *
 * 1. «MM» es jerga: en Chile es millones, pero un lector en inglés lo lee como mil
 *    millones y el chino tenía 百万 (= un millón) pegado a totales de once dígitos.
 * 2. El total de la región son 229.022 millones. Nadie lee eso sin contar dígitos.
 *
 * Se arregla escalando a la unidad que corresponda y **escribiendo la palabra**, que es
 * lo único que no se puede malinterpretar. `Intl` con `compactDisplay: 'long'` ya sabe
 * la convención de cada idioma, así que no hay que elegir la unidad a mano: en inglés
 * «229.02 billion», en español «229,02 mil millones» y en chino «2290.22亿» — que es la
 * agrupación real del chino (10^8), no una traducción del corte occidental de 10^9.
 *
 * `maximumFractionDigits: 2` es el compromiso: mantiene ~5 cifras significativas, así
 * que 1.250 millones sigue siendo exacto («1.25 billion») en vez de redondear a 1,3.
 *
 * `intlLocale` traduce nuestra etiqueta interna `cn` al tag BCP-47 `zh`, que es el que
 * `Intl` conoce (ver `lib/countries.ts`).
 */
const cache = new Map<string, Intl.NumberFormat>()

const formatter = (lang: string): Intl.NumberFormat => {
  const loc = intlLocale(lang)
  let fmt = cache.get(loc)
  if (!fmt) {
    fmt = new Intl.NumberFormat(loc, {
      notation: 'compact',
      compactDisplay: 'long',
      maximumFractionDigits: 2
    })
    cache.set(loc, fmt)
  }
  return fmt
}

/** Monto en millones de USD -> «US$ 229.02 billion». `null` = la base no trae monto. */
export const formatUsd = (musd: number | null | undefined, lang: string): string =>
  musd === null || musd === undefined ? '—' : `US$ ${formatter(lang).format(musd * 1e6)}`
