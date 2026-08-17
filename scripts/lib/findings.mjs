// Modelo de hallazgos — PURO, sin I/O.
//
// Aplana lo que devuelve validateRows por archivo a UNA lista de hallazgos, con
// campos de máquina. Es lo que consumen los dos lados:
//
//   · scripts/lib/report_render.mjs  → la lista navegable (informe y validador)
//   · scripts/lib/pendientes.mjs     → la planilla, que sólo lo viste con nombres
//                                      de columna en español y lo corta por dueño
//
// Existía a medias adentro de pendientes.mjs, mezclado con los nombres de columna
// del xlsx. Separarlo es lo que permite que la pantalla y la descarga muestren lo
// MISMO sin tener dos cálculos: si divergen, divergen en el render y no en el dato.
//
// La unidad es el HALLAZGO, o sea una celda con un problema. No confundir con las
// otras dos unidades del sistema: la INVERSIÓN es la unidad de la consecuencia
// (lo que sale del mapa) y el ARCHIVO es la unidad de la estructura.
import { RULE_HELP } from './rules_help.mjs'

const tipoDe = (regla) => RULE_HELP[regla]?.tipo ?? 'contenido'

/**
 * @typedef {object} Finding
 * @property {string} archivo   nombre del xlsx tal como llegó
 * @property {string} pais      el archivo sin extensión, que es como se nombra al país en pantalla
 * @property {string} id        Id_Investment de la fila, '' si el hallazgo es de archivo
 * @property {number} fila      fila de Excel (1 = encabezado); 0 si es de archivo
 * @property {string|null} columna
 * @property {string} regla
 * @property {string} titulo    de RULE_HELP; cae a la regla cruda si no está documentada
 * @property {string} causa
 * @property {string} fix
 * @property {string} tipo      dueño del arreglo (RULE_HELP[].tipo)
 * @property {'error'|'warning'} severidad
 * @property {boolean} bloquea  severidad error: saca del mapa la inversión de esa fila
 * @property {boolean|null} publicaHoy  null cuando el hallazgo no cuelga de una inversión
 * @property {string} valor     lo que dice la celda
 * @property {string} mensaje
 * @property {string} inversor
 */

/**
 * Orden de trabajo: bloqueantes primero, después por país y por fila. Se lee de
 * arriba hacia abajo sin tener que ordenar a mano, y es el mismo orden en la
 * pantalla y en la planilla.
 *
 * A propósito SIN desempate final: `sort` es estable, así que los empates
 * conservan el orden de emisión (los problemas de archivo antes que los de fila,
 * y dentro de una fila el orden en que las reglas corrieron). Agregar un
 * desempate por regla reordenaría la planilla sin que nadie lo haya pedido.
 */
const porPrioridad = (a, b) =>
  Number(b.bloquea) - Number(a.bloquea) ||
  a.pais.localeCompare(b.pais, 'es') ||
  a.fila - b.fila

/**
 * @param {Array} results lo que devuelve validateRows por archivo, con `rows` y `excludedIds`
 * @returns {Finding[]}
 */
export const buildFindings = (results) => {
  const out = []

  for (const r of results ?? []) {
    // Un archivo que no se pudo ni abrir no tiene hallazgos: tiene un error de
    // lectura, que se muestra aparte. Meterlo acá lo disfrazaría de problema de
    // dato, que es justo la distinción que las compuertas hacen.
    if (r.error) continue

    const archivo = String(r.name ?? '')
    const pais = archivo.replace(/\.xlsx$/i, '')
    const excluidas = new Set(r.excludedIds ?? [])

    // Los problemas de archivo no tienen fila ni columna. Van igual, con fila 0:
    // son los que hay que resolver ANTES que nada, porque sin eso no entra
    // ninguna inversión del archivo.
    const items = [
      ...(r.fileErrors ?? []).map((fe) => ({ ...fe, severity: 'error', row: 0, column: null, value: null })),
      // Los `info` quedan fuera a propósito: son columnas extra permitidas y
      // cosas que el sistema ignora. Meterlas convierte la lista en ruido.
      ...(r.issues ?? []).filter((it) => it.severity === 'error' || it.severity === 'warning')
    ]

    for (const it of items) {
      const help = RULE_HELP[it.rule] ?? {}
      // La fila de Excel arranca en 1 y la 1 es el encabezado, así que la fila N
      // es el índice N-2 del arreglo de datos.
      const fila = it.row > 0 ? r.rows?.[it.row - 2] : null
      const id = String(fila?.Id_Investment ?? '').trim()

      out.push({
        archivo,
        pais,
        id,
        fila: it.row > 0 ? it.row : 0,
        columna: it.column ?? null,
        regla: it.rule,
        titulo: help.titulo ?? it.rule,
        causa: help.causa ?? '',
        fix: help.fix ?? '',
        tipo: tipoDe(it.rule),
        severidad: it.severity,
        bloquea: it.severity === 'error',
        // Lo que de verdad importa para priorizar: si esto ya está sacando la
        // inversión del mapa o es sólo un aviso sobre algo que sí se publica.
        publicaHoy: id ? !excluidas.has(id) : null,
        valor: it.value === null || it.value === undefined ? '' : String(it.value),
        mensaje: it.message ?? '',
        inversor: String(fila?.Investor ?? '').trim()
      })
    }
  }

  out.sort(porPrioridad)
  return out
}

/** Corta una lista de hallazgos por dueño del arreglo, respetando un orden dado. */
export const groupByTipo = (findings, orden) => {
  const m = new Map()
  for (const f of findings ?? []) {
    if (!m.has(f.tipo)) m.set(f.tipo, [])
    m.get(f.tipo).push(f)
  }
  if (!orden) return m
  const out = new Map()
  for (const tipo of orden) if (m.has(tipo)) out.set(tipo, m.get(tipo))
  // Un tipo nuevo que nadie declaró en el orden no se pierde en silencio.
  for (const [tipo, fs] of m) if (!out.has(tipo)) out.set(tipo, fs)
  return out
}
