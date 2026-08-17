// Planilla de pendientes — PURA, sin I/O.
//
// Convierte los `results` de validateRows en hojas listas para un xlsx, cortadas
// **por dueño del arreglo**. Los pendientes no son una pila: las coordenadas y las
// provincias son de quien hace la geografía, la propiedad y los inversores son de
// la revisión externa, los montos y la atribución son del equipo de investigación.
// El eje ya existe y no hay que calcularlo: es `RULE_HELP[regla].tipo`.
//
// Es un ENCARGO DE TRABAJO, no un archivo para volver a subir. Partir el xlsx del
// país en "validado" y "pendiente" forkearía la fuente —un dato, un lugar— y
// además ya no hace falta: con la compuerta por inversión, lo bueno del archivo se
// publica solo aunque el resto esté mal.
// Namespace y no default: el build ESM de `xlsx` no exporta default, así que
// `import XLSX from 'xlsx'` funciona en Node pero rompe el bundle del navegador.
// Esta forma anda en los dos, que es lo que este módulo necesita.
import * as XLSX from 'xlsx'
import { RULE_HELP } from './rules_help.mjs'

// Nombre de hoja por dueño. Excel corta los nombres de hoja en 31 caracteres, así
// que "Encargado de la tabla de inversores" (35) no cabe y va abreviado.
// El orden es el de a quién le toca primero.
export const HOJAS_POR_DUENO = [
  { tipo: 'contenido', hoja: 'Contenido', quien: 'Equipo de investigación: son decisiones sobre el dato en sí.' },
  { tipo: 'formato', hoja: 'Formato', quien: 'Quien edita la planilla: es cómo está escrito el dato, no qué dice.' },
  { tipo: 'revisar', hoja: 'Revisar', quien: 'Quien conoce el caso: hay que mirar la fuente para saber cuál de las dos versiones es la buena.' },
  { tipo: 'tabla-inversores', hoja: 'Tabla de inversores', quien: 'Quien mantiene la tabla de inversores. No requiere tocar la planilla del país.' },
  { tipo: 'a-resolver-nuestro-lado', hoja: 'Lo vemos nosotros', quien: 'Nuestro. Está acá para que se vea que no se perdió, no porque haya que hacer algo.' }
]

const COLUMNAS = [
  'País', 'Id_Investment', 'Fila', 'Inversor', 'Bloquea', '¿Publica hoy?',
  'Problema', 'Qué dice la celda', 'Qué pasa', 'Cómo se corrige', 'Corregido'
]

const tipoDe = (regla) => RULE_HELP[regla]?.tipo ?? 'contenido'

/**
 * @param {Array} results lo que devuelve validateRows por archivo, con `rows` y `excludedIds`
 * @returns {{hojas: Array<{nombre: string, filas: Array<Record<string, unknown>>}>, total: number}}
 */
export const buildPendientes = (results) => {
  const porTipo = new Map()

  for (const r of results ?? []) {
    if (r.error) continue
    const pais = String(r.name ?? '').replace(/\.xlsx$/i, '')
    const excluidas = new Set(r.excludedIds ?? [])

    // Los problemas de archivo no tienen fila; van igual, con la fila en blanco:
    // son los que hay que resolver ANTES que nada, porque sin eso el archivo
    // entero no entra.
    const items = [
      ...(r.fileErrors ?? []).map((fe) => ({ ...fe, severity: 'error', row: 0 })),
      // `info` queda fuera a propósito: son columnas extra permitidas y cosas que
      // el sistema ignora. Meterlas convierte el encargo en ruido.
      ...(r.issues ?? []).filter((it) => it.severity === 'error' || it.severity === 'warning')
    ]

    for (const it of items) {
      const help = RULE_HELP[it.rule] ?? {}
      const fila = it.row > 0 ? r.rows?.[it.row - 2] : null
      const id = String(fila?.Id_Investment ?? '').trim()

      const registro = {
        'País': pais,
        'Id_Investment': id,
        'Fila': it.row > 0 ? it.row : '',
        'Inversor': String(fila?.Investor ?? '').trim(),
        'Bloquea': it.severity === 'error' ? 'Sí' : 'No',
        // Lo que de verdad importa para priorizar: si esto ya está sacando la
        // inversión del mapa o es sólo un aviso.
        '¿Publica hoy?': id ? (excluidas.has(id) ? 'No' : 'Sí') : '',
        'Problema': help.titulo ?? it.rule,
        'Qué dice la celda': it.value === null || it.value === undefined ? '' : String(it.value),
        'Qué pasa': it.message ?? '',
        'Cómo se corrige': help.fix ?? '',
        'Corregido': ''
      }

      const tipo = tipoDe(it.rule)
      if (!porTipo.has(tipo)) porTipo.set(tipo, [])
      porTipo.get(tipo).push(registro)
    }
  }

  const hojas = []
  let total = 0
  for (const { tipo, hoja } of HOJAS_POR_DUENO) {
    const filas = porTipo.get(tipo)
    if (!filas?.length) continue
    // Bloqueantes primero, después por país y fila: se trabaja de arriba hacia
    // abajo sin tener que ordenar a mano.
    filas.sort(
      (a, b) =>
        (a.Bloquea === b.Bloquea ? 0 : a.Bloquea === 'Sí' ? -1 : 1) ||
        String(a['País']).localeCompare(String(b['País']), 'es') ||
        (Number(a.Fila) || 0) - (Number(b.Fila) || 0)
    )
    hojas.push({ nombre: hoja, filas })
    total += filas.length
  }

  return { hojas, total, columnas: COLUMNAS }
}

/**
 * Hoja de portada. Existe para que el archivo se entienda solo: quien lo recibe
 * puede no haber visto nunca el informe, y lo primero que hay que evitar es que
 * lo suba de vuelta al repositorio creyendo que es la base corregida.
 */
export const buildLeeme = (results, { fecha = '' } = {}) => {
  const archivos = (results ?? []).filter((r) => !r.error).map((r) => r.name)
  const { hojas, total } = buildPendientes(results)
  return [
    { ' ': 'Planilla de pendientes del Repositorio de Inversiones Chinas en América Latina' },
    { ' ': '' },
    { ' ': `Generada el ${fecha} a partir de: ${archivos.join(', ')}` },
    { ' ': `${total} cosa(s) por revisar, repartidas en ${hojas.length} hoja(s).` },
    { ' ': '' },
    { ' ': 'ESTO NO ES LA BASE DE DATOS. Es una lista de trabajo.' },
    { ' ': 'No hay que subir este archivo al repositorio: las correcciones se hacen sobre la' },
    { ' ': 'planilla del país y se sube esa.' },
    { ' ': '' },
    { ' ': 'Una hoja por dueño del arreglo. Cada quien tiene la suya y no necesita filtrar:' },
    ...HOJAS_POR_DUENO.filter(({ hoja }) => hojas.some((h) => h.nombre === hoja)).map(({ hoja, quien }) => ({
      ' ': `  · ${hoja}: ${quien}`
    })),
    { ' ': '' },
    { ' ': 'Columnas:' },
    { ' ': '  Bloquea = si impide que esa inversión se publique.' },
    { ' ': '  ¿Publica hoy? = si la inversión está entrando al mapa en este momento.' },
    { ' ': '  Corregido = para marcar; la planilla no se lee de vuelta, es para ustedes.' },
    { ' ': '' },
    { ' ': 'Una inversión sale del mapa ENTERA, no por filas: son varios puntos, y publicar' },
    { ' ': 'medio trazado o perder la fila del monto sería una pérdida que no se ve.' }
  ]
}

/**
 * Arma el workbook. Sin I/O: devuelve el objeto, y cada lado lo escribe como
 * quiera — el CLI con XLSX.writeFile, el navegador con XLSX.write + Blob. Es el
 * mismo constructor para los dos, igual que el render del informe.
 * @returns {{wb: object, total: number} | null} null si no hay nada pendiente
 */
export const buildPendientesWorkbook = (results, { fecha = '' } = {}) => {
  const { hojas, total, columnas } = buildPendientes(results)
  if (!total) return null

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildLeeme(results, { fecha })), 'LÉEME')
  for (const { nombre, filas } of hojas) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas, { header: columnas }), nombre)
  }
  return { wb, total }
}

/** Nombre sugerido del archivo, con fecha para que no se pisen entre tandas. */
export const nombrePendientes = (fecha = new Date().toISOString().slice(0, 10)) =>
  `pendientes_iclac_${fecha}.xlsx`
