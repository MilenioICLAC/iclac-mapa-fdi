// Guardia de caída brusca — PURO, sin I/O.
//
// Subir a `main` es publicar en producción: Netlify construye desde ahí. Las
// compuertas del validador atrapan el archivo ilegible y las inversiones malas,
// pero un archivo LEGIBLE Y EQUIVOCADO —200 filas borradas sin querer, el archivo
// de otro país con el nombre cambiado— pasa entero y hace desaparecer inversiones
// del mapa sin que nadie se entere. Esto es la red para eso.
//
// La línea base se versiona en data/schema/expected_counts.csv y se actualiza a
// propósito (`npm run counts:update`), en el mismo commit que el cambio de datos.
// Es la única forma de distinguir "borré 200 filas sin querer" de "este país
// legítimamente encogió": la diferencia no está en los datos, está en la intención,
// y la intención se declara.

/** Caída relativa que se considera accidente. Generoso a propósito: un validador
 *  que grita sobre datos correctos deja de leerse. */
export const DROP_THRESHOLD = 0.3

/** Dónde vive la línea base, relativo a la raíz del repositorio. */
export const COUNTS_PATH_REL = 'data/schema/expected_counts.csv'

/**
 * Inversiones distintas en las filas de un archivo. Se cuenta sobre el ORIGEN, no
 * sobre lo que termina publicándose: así un cambio de umbral de confiabilidad o de
 * las compuertas no dispara la guardia, que existe para vigilar el archivo.
 * @param {Array<Record<string, unknown>>} rows
 */
export const countInvestments = (rows) => {
  const ids = new Set()
  for (const r of rows ?? []) {
    const id = String(r?.Id_Investment ?? '').trim()
    if (id) ids.add(id)
  }
  return ids.size
}

/**
 * @param {string} text contenido de expected_counts.csv
 * @returns {Record<string, number>} alpha3 -> inversiones
 */
export const parseExpectedCounts = (text) => {
  const out = {}
  const lines = String(text ?? '').trim().split(/\r?\n/)
  if (!lines.length || !lines[0]) return out
  const header = lines[0].split(',').map((h) => h.trim())
  const iA3 = header.indexOf('alpha3')
  const iN = header.indexOf('investments')
  if (iA3 < 0 || iN < 0) return out
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue
    const c = line.split(',')
    const a3 = (c[iA3] ?? '').trim().toUpperCase()
    const n = Number((c[iN] ?? '').trim())
    if (a3 && Number.isFinite(n)) out[a3] = n
  }
  return out
}

/**
 * @param {Record<string, number>} counts alpha3 -> inversiones
 * @returns {string} CSV listo para escribir, ordenado para que el diff sea legible
 */
export const formatExpectedCounts = (counts) =>
  ['alpha3,investments', ...Object.keys(counts).sort().map((a3) => `${a3},${counts[a3]}`)].join('\n') + '\n'

/**
 * Compara lo que hay contra la línea base.
 *
 * Sólo mira países que YA estaban en la línea base. Un país nuevo no dispara nada
 * (no hay con qué compararlo) y uno del registro que nunca tuvo archivo tampoco:
 * el registro lleva 32 países y sólo 17 tienen datos, así que chequear "publica y
 * no tiene archivo" marcaría quince países correctos.
 *
 * @param {Record<string, number>} baseline
 * @param {Record<string, number>} actual
 * @param {object} [opts]
 * @param {number} [opts.threshold] caída relativa que se considera accidente
 * @returns {{problems: Array<{alpha3, kind, before, after, message}>, nuevos: string[]}}
 */
export const checkCounts = (baseline, actual, opts = {}) => {
  const { threshold = DROP_THRESHOLD } = opts
  const problems = []

  for (const [a3, before] of Object.entries(baseline)) {
    const after = actual[a3]

    if (after === undefined) {
      problems.push({
        alpha3: a3, kind: 'archivo-ausente', before, after: 0,
        message: `${a3}: había un archivo con ${before} inversiones y ahora no hay ninguno. ¿Se borró, o se subió con otro nombre?`
      })
      continue
    }
    if (before > 0 && after === 0) {
      problems.push({
        alpha3: a3, kind: 'vacio', before, after,
        message: `${a3}: el archivo está pero quedó sin inversiones (antes ${before}).`
      })
      continue
    }
    if (before > 0 && after < before * (1 - threshold)) {
      const caida = Math.round((1 - after / before) * 100)
      problems.push({
        alpha3: a3, kind: 'caida', before, after,
        message: `${a3}: pasó de ${before} a ${after} inversiones, una caída del ${caida}% (el límite es ${Math.round(threshold * 100)}%).`
      })
    }
  }

  const nuevos = Object.keys(actual).filter((a3) => !(a3 in baseline)).sort()
  return { problems, nuevos }
}

/** Texto del error, escrito para quien lo va a leer primero: quien subió el archivo. */
export const explainProblems = (problems) =>
  [
    '',
    '✗ El build se detuvo: los datos cambiaron mucho más de lo esperado.',
    '',
    ...problems.map((p) => `  · ${p.message}`),
    '',
    '  El sitio NO se actualizó y sigue mostrando los datos anteriores, así que no se perdió nada.',
    '',
    '  Si esto fue un accidente (un archivo incompleto, o subido con otro nombre), volvé a subir',
    '  el archivo correcto y el sitio se reconstruye solo.',
    '',
    '  Si el cambio es correcto y los datos de verdad son menos, hay que declararlo:',
    '  correr `npm run counts:update` y subir data/schema/expected_counts.csv junto al cambio.',
    ''
  ].join('\n')
