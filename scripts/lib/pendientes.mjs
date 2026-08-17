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
import { buildFindings, groupByTipo } from './findings.mjs'
import { REASON_LABEL } from './gates.mjs'

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
  'País', 'Id_Investment', 'Fila', 'Inversor', 'Bloquea', '¿Publica hoy?', 'Por qué no publica',
  'Problema', 'Qué dice la celda', 'Qué pasa', 'Cómo se corrige', 'Corregido'
]

/**
 * Un hallazgo, vestido con los nombres de columna que ve quien abre el xlsx. El
 * cálculo no vive acá: viene hecho de findings.mjs, y esto es sólo la traducción
 * a la planilla. Así la pantalla y la descarga no pueden mostrar cosas distintas.
 */
const registroDe = (f) => ({
  'País': f.pais,
  'Id_Investment': f.id,
  'Fila': f.fila > 0 ? f.fila : '',
  'Inversor': f.inversor,
  'Bloquea': f.bloquea ? 'Sí' : 'No',
  // La respuesta sobre las CUATRO compuertas, no sólo la de contenido. Decía «Sí»
  // para inversiones que el sitio manda al anexo, y con esta planilla en la mano
  // alguien iba a corregir filas de una inversión cancelada.
  '¿Publica hoy?': f.publicaHoy === null ? '' : f.publicaHoy ? 'Sí' : 'No',
  // Un «No» sin motivo no dice si hay algo que arreglar o si es una decisión ya
  // tomada, que es justo lo que decide si vale la pena tocar la fila.
  'Por qué no publica': f.motivoNoPublica ? REASON_LABEL[f.motivoNoPublica] ?? f.motivoNoPublica : '',
  'Problema': f.titulo,
  'Qué dice la celda': f.valor,
  'Qué pasa': f.mensaje,
  'Cómo se corrige': f.fix,
  'Corregido': ''
})

/**
 * @param {Array} results lo que devuelve validateRows por archivo, con `rows` y `excludedIds`
 * @returns {{hojas: Array<{nombre: string, filas: Array<Record<string, unknown>>}>, total: number}}
 */
export const buildPendientes = (results) => {
  // buildFindings ya ordena bloqueantes primero, después por país y por fila, que
  // es el orden en que se trabaja la planilla de arriba hacia abajo.
  const porTipo = groupByTipo(buildFindings(results), HOJAS_POR_DUENO.map((h) => h.tipo))

  const hojas = []
  let total = 0
  for (const { tipo, hoja } of HOJAS_POR_DUENO) {
    const findings = porTipo.get(tipo)
    if (!findings?.length) continue
    hojas.push({ nombre: hoja, filas: findings.map(registroDe) })
    total += findings.length
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
    { ' ': '  Por qué no publica = "error de esquema" se arregla editando el archivo; "cancelada" y' },
    { ' ': '    "evidencia bajo el umbral" son decisiones ya tomadas, y ahí no hay nada que corregir.' },
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
