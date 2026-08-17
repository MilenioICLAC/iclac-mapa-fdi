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
 * Por qué una inversión NO llega al mapa, o null si llega. El orden es el del
 * pipeline y no es arbitrario: la compuerta de contenido va primero porque es la
 * única que se arregla editando el archivo, y decirle a alguien «está cancelada»
 * cuando además tiene una fila rota lo manda a no hacer nada.
 *
 * @param {object} inv
 * @param {boolean} inv.excluida   la sacó la compuerta de contenido (`excludedIds`)
 * @param {boolean} inv.cancelada  alguna de sus filas trae `cancelled = 1`
 * @param {Array<number|null>} inv.scores puntajes vistos en sus filas
 * @param {{minScore?: number}} [opts]
 * @returns {'contenido'|'cancelada'|'evidencia'|null}
 */
export const exclusionReason = ({ excluida, cancelada, scores }, { minScore = MIN_SCORE_DEFAULT } = {}) => {
  if (excluida) return 'contenido'
  if (cancelada) return 'cancelada'
  // Basta una fila bajo el umbral: el ETL corta por FILA en esta compuerta, así que
  // una inversión con puntajes mezclados ya está perdiendo filas. Medido: los
  // únicos casos con puntajes mezclados son colisiones de id, o sea que la
  // compuerta de contenido los saca antes y esta rama no llega a decidir.
  if (scores.some((s) => !passesScore(s, minScore))) return 'evidencia'
  return null
}

/** Etiqueta corta, para la interfaz y para la planilla. */
export const REASON_LABEL = {
  contenido: 'error de esquema',
  cancelada: 'cancelada',
  evidencia: 'evidencia bajo el umbral'
}

/**
 * Resume cada inversión de un archivo: si publica y, si no, por qué.
 *
 * @param {Array<Record<string, unknown>>} rows filas crudas del xlsx
 * @param {{excludedIds?: Iterable<string>, minScore?: number}} [opts]
 * @returns {Map<string, {publica: boolean, motivo: string|null}>}
 */
export const investmentDestinies = (rows, { excludedIds = [], minScore = MIN_SCORE_DEFAULT } = {}) => {
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
    const motivo = exclusionReason({ excluida: excluidas.has(id), ...e }, { minScore })
    out.set(id, { publica: motivo === null, motivo })
  }
  return out
}
