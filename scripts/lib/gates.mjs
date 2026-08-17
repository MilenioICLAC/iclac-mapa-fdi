// Las compuertas que deciden si una inversión llega al mapa — PURO, sin I/O.
//
// Existe para que el ETL y el validador contesten LO MISMO. Antes el umbral de
// confiabilidad vivía como constante dentro de `scripts/etl.mjs` y el validador no
// lo conocía, así que la página decía «publica: sí» sobre una inversión con puntaje
// 1 que el sitio manda al anexo. Un número duplicado es un número que va a
// divergir: este repositorio ya lo pagó con los dos generadores del mapa de
// inversores.
//
// Las cuatro compuertas del pipeline están en `.claude/CLAUDE.md`. Acá viven las
// dos últimas, que son las que se pueden contestar mirando las filas:
//
//   · CONFIABILIDAD: `reliability_score` contra `minScore`.
//   · CANCELACIÓN: la columna `cancelled`, que saca la inversión del dataset
//     principal y la manda al anexo.
//
// Las otras dos (estructura y contenido) las contesta `validate.mjs`, y la de
// publicación por país vive en `countries.csv`.

/** Puntaje MÍNIMO que se publica. Sale del sitio todo lo que tenga ≤ 2. */
export const MIN_SCORE_DEFAULT = 3

/** `1` = cancelada. Enum cerrado: cualquier otra cosa se lee como vigente. */
export const isCancelled = (raw) => String(raw ?? '').trim() === '1'

/** Puntaje de una celda: número, o null si no hay (que NO es lo mismo que 0). */
export const scoreOf = (raw) => {
  if (raw === null || raw === undefined || String(raw).trim() === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

/**
 * Una fila pasa la compuerta de confiabilidad si tiene puntaje suficiente o si
 * todavía no fue evaluada. «Sin revisar» no es lo mismo que «revisado y sin
 * evidencia», así que pasa y se cuenta aparte.
 */
export const passesScore = (score, minScore = MIN_SCORE_DEFAULT) =>
  score === null || score >= minScore

/**
 * Por qué una inversión NO llega al mapa, o null si llega.
 *
 * EL ORDEN NO ES ARBITRARIO, y son dos criterios encadenados:
 *
 * 1. El **error de esquema** va primero porque es el único que se arregla editando
 *    el archivo. Decirle a alguien «está cancelada» cuando además tiene una fila
 *    rota lo manda a no hacer nada.
 * 2. Entre los otros tres gana **el que va a seguir siendo cierto** cuando los
 *    demás se resuelvan. Una cancelación es una propiedad del dato y no se va a
 *    mover; el umbral de evidencia se levanta cuando aparecen fuentes; la retención
 *    del país es temporal y editorial, la decide ICLAC y se cae con un `publish=yes`.
 *
 * @param {object} inv
 * @param {boolean} inv.excluida   la sacó la compuerta de contenido (`excludedIds`)
 * @param {boolean} inv.cancelada  alguna de sus filas trae `cancelled = 1`
 * @param {Array<number|null>} inv.scores puntajes vistos en sus filas
 * @param {boolean} [inv.retenido] su país está con `publish=no` en countries.csv
 * @param {{minScore?: number}} [opts]
 * @returns {'contenido'|'cancelada'|'evidencia'|'retenido'|null}
 */
export const exclusionReason = (
  { excluida, cancelada, scores, retenido = false },
  { minScore = MIN_SCORE_DEFAULT } = {}
) => {
  if (excluida) return 'contenido'
  if (cancelada) return 'cancelada'
  // Basta una fila bajo el umbral: el ETL corta por FILA en esta compuerta, así que
  // una inversión con puntajes mezclados ya está perdiendo filas. Medido: los
  // únicos casos con puntajes mezclados son colisiones de id, o sea que la
  // compuerta de contenido los saca antes y esta rama no llega a decidir.
  if (scores.some((s) => !passesScore(s, minScore))) return 'evidencia'
  if (retenido) return 'retenido'
  return null
}

/** Etiqueta corta, para la interfaz y para la planilla. */
export const REASON_LABEL = {
  contenido: 'error de esquema',
  cancelada: 'cancelada',
  evidencia: 'evidencia insuficiente',
  retenido: 'país retenido'
}

/**
 * Los motivos que NO son un error del archivo: no hay nada que corregir en ellos, y
 * son los que la interfaz deja esconder. `contenido` queda fuera a propósito.
 */
export const DECIDED_REASONS = ['cancelada', 'evidencia', 'retenido']

/**
 * Resume cada inversión de un archivo: si publica y, si no, por qué.
 *
 * @param {Array<Record<string, unknown>>} rows filas crudas del xlsx
 * @param {{excludedIds?: Iterable<string>, minScore?: number, retenido?: boolean}} [opts]
 *   `retenido` es del ARCHIVO, no de la fila: el país entero está con `publish=no`.
 * @returns {Map<string, {publica: boolean, motivo: string|null}>}
 */
export const investmentDestinies = (
  rows,
  { excludedIds = [], minScore = MIN_SCORE_DEFAULT, retenido = false } = {}
) => {
  const excluidas = new Set(excludedIds)
  const acc = new Map() // id -> { cancelada, scores }
  for (const row of rows ?? []) {
    const id = String(row?.Id_Investment ?? '').trim()
    if (!id) continue
    if (!acc.has(id)) acc.set(id, { cancelada: false, scores: [] })
    const e = acc.get(id)
    if (isCancelled(row.cancelled)) e.cancelada = true
    e.scores.push(scoreOf(row.reliability_score))
  }

  const out = new Map()
  for (const [id, e] of acc) {
    const motivo = exclusionReason({ excluida: excluidas.has(id), retenido, ...e }, { minScore })
    out.set(id, { publica: motivo === null, motivo })
  }
  return out
}
