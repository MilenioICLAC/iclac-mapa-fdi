// Registro de países del proyecto (pure, sin I/O). Fuente: data/schema/countries.csv
// (semilla pre-cargada por nosotros con toda LATAM + Centroamérica + Caribe).
//
// Vuelve el alcance de países un DATO editable en vez de constantes hardcodeadas
// en validate.mjs. El validador y el ETL lo cargan por `opts`, así el cliente
// puede sumar un país (o nosotros la semilla) sin tocar código.
//
// México NO está en la semilla a propósito (exclusión metodológica 14-07): no es
// un país del proyecto, así que un mexico.xlsx cae como "fuera de la lista".

/**
 * Forma comparable de un nombre de archivo de país: sin tildes, en MAYÚSCULA y
 * con los separadores colapsados a "_". Es lo que permite reconocer
 * `trinidad_and_tobago.xlsx` cuando el registro lo llama `TRINIDAD_TOBAGO`: las
 * dos formas se indexan y apuntan al mismo país.
 *
 * Vive acá (módulo sin imports) para que normalize.mjs la use sin crear un ciclo.
 */
export const filenameKey = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[\s\-.]+/g, '_')

/**
 * alpha-3 del país al que rutea un nombre de archivo, aceptando el nombre
 * canónico, el del país y sus alias. Un solo lugar para esta búsqueda: el ETL y
 * el validador la necesitan igual, y tenerla dos veces garantiza que diverjan
 * (fue justo lo que pasó con los dos generadores del mapa de inversores).
 * @param {object|null} registry salida de parseCountriesCsv
 * @param {string} filename nombre del archivo, con o sin .xlsx
 * @returns {string|null}
 */
export const alpha3ForFilename = (registry, filename) => {
  if (!registry) return null
  const stem = String(filename ?? '').replace(/\.xlsx$/i, '')
  if (!stem) return null
  const up = stem.toUpperCase()
  const canonical = registry.canonicalFilenames?.has(up)
    ? up
    : registry.filenameAliasIndex?.get(filenameKey(stem)) ?? null
  if (!canonical) return null
  return Object.keys(registry.filenameByAlpha3 ?? {}).find((a3) => registry.filenameByAlpha3[a3] === canonical) ?? null
}

/**
 * Parsea el CSV del registro a las estructuras que consumen validador y ETL.
 * @param {string} text contenido de countries.csv
 * @returns {{
 *   countryIso: Record<string,{alpha3:string,num:string}>,
 *   filenameByAlpha3: Record<string,string>,
 *   canonicalFilenames: Set<string>,
 *   filenameAliasIndex: Map<string,string>,
 *   canonicalByAlpha3: Record<string,string>,
 *   alpha2ByAlpha3: Record<string,string>,
 *   publishByAlpha3: Record<string,boolean>,
 *   list: Array<{alpha3:string,alpha2:string,num:string,name:string,aliases:string[],filename:string,publish:boolean}>
 * }}
 */
export const parseCountriesCsv = (text) => {
  const lines = text.trim().split(/\r?\n/)
  const header = lines[0].split(',').map((h) => h.trim())
  const col = (n) => header.indexOf(n)
  const [iA3, iA2, iNum, iName, iAlias, iFile, iPub] =
    ['alpha3', 'alpha2', 'numeric', 'name', 'aliases', 'filename', 'publish'].map(col)

  const countryIso = {}
  const filenameByAlpha3 = {}
  const canonicalByAlpha3 = {}
  const alpha2ByAlpha3 = {}
  const publishByAlpha3 = {}
  // Toda forma escrita que rutea a un país -> su nombre de archivo canónico.
  const filenameAliasIndex = new Map()
  const list = []

  for (const line of lines.slice(1)) {
    if (!line.trim()) continue
    const c = line.split(',')
    const alpha3 = (c[iA3] ?? '').trim()
    const num = (c[iNum] ?? '').trim()
    const name = (c[iName] ?? '').trim()
    if (!alpha3 || !name) continue
    const aliases = (c[iAlias] ?? '').split('|').map((s) => s.trim()).filter(Boolean)
    const filename = ((c[iFile] ?? '').trim() || name.toUpperCase().replace(/\s+/g, '_'))
    // Compuerta de publicación, separada de la de validación: un archivo puede
    // estar impecable y el cliente aún no querer publicarlo. Sin columna, o con
    // la celda vacía, publica (el default no puede ser "retener" o una versión
    // vieja del CSV apagaría el mapa entero).
    const publish = !['no', 'false', '0'].includes((c[iPub] ?? '').trim().toLowerCase())

    const alpha2 = (c[iA2] ?? '').trim().toUpperCase()

    countryIso[name] = { alpha3, num }
    for (const a of aliases) countryIso[a] = { alpha3, num }
    filenameByAlpha3[alpha3] = filename
    canonicalByAlpha3[alpha3] = name
    if (alpha2) alpha2ByAlpha3[alpha3] = alpha2
    publishByAlpha3[alpha3] = publish
    // El nombre del archivo lo escribe una persona: se acepta el canónico, el
    // nombre del país y cualquier alias. La diferencia se reporta como curación,
    // no como bloqueo — un renombre no es un problema de datos.
    for (const form of [filename, name, ...aliases]) {
      const k = filenameKey(form)
      if (k && !filenameAliasIndex.has(k)) filenameAliasIndex.set(k, filename)
    }
    list.push({ alpha3, alpha2, num, name, aliases, filename, publish })
  }

  return {
    countryIso,
    filenameByAlpha3,
    canonicalFilenames: new Set(Object.values(filenameByAlpha3)),
    filenameAliasIndex,
    canonicalByAlpha3,
    alpha2ByAlpha3,
    publishByAlpha3,
    list
  }
}
