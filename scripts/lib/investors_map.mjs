// Núcleo del mapa de inversores: `investors_map.csv` -> el objeto que se sirve como
// `public/data/investors_map.json` y que leen el filtro de propiedad y Tendencias.
//
// **Por qué existe este archivo.** El mapa se construía en DOS lugares con código copiado:
// `scripts/etl.mjs`, que corre en cada build de Netlify, y `scripts/build_investors_map.mjs`,
// que sirve para regenerar sin correr el ETL entero. Divergieron: el 03-08 se agregó
// `non_chinese` al segundo y no al primero, así que el JSON publicado no lo llevaba y el
// modelo del socio no chino sólo funcionaba corriendo el script a mano. Es la tercera vez en
// el repositorio que un hecho vive en dos lados y se separan. Un dato, un lugar.
//
// El núcleo es **puro**: recibe el texto del CSV y no toca disco, igual que
// `scripts/lib/validate.mjs`. Quien lee el archivo es el que llama.

// Parser CSV completo, el mismo criterio que `investors_import.mjs`. Los dos scripts
// traían uno propio que partía el archivo por líneas ANTES de parsear y se comía las
// comillas de adentro de los campos (medido: 23 celdas distintas en `review_note` y
// `external_note`). Hoy no rompía el mapa porque esas dos columnas no se leen acá, pero
// un salto de línea dentro de una nota —Alt+Enter en Excel— partía la fila en dos.
export function parseCsv(text) {
  const rows = []
  let field = '', row = [], quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else quoted = false }
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (ch !== '\r') field += ch
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows
}

/**
 * @param {string} csvText contenido de data/schema/investors_map.csv
 * @returns {Record<string, object>} entradas por `investor_raw` y por `company_canonical`
 */
export function buildInvestorMap(csvText) {
  const rows = parseCsv(String(csvText).replace(/\r\n/g, '\n').trim())
  if (!rows.length) return {}

  const header = rows[0]
  const idx = (name) => header.indexOf(name)
  const iRaw = idx('investor_raw')
  const iId = idx('company_id')
  const iCanon = idx('company_canonical')
  const iCons = idx('is_consortium')
  const iOwn = idx('ownership')
  const iMembers = idx('members')
  const iOrigen = idx('origin_country')

  const map = {}
  for (const c of rows.slice(1)) {
    if (c.length <= 1) continue
    const entry = {
      company_id: c[iId],
      company_canonical: c[iCanon],
      ownership: c[iOwn],
      // El CSV escribe TRUE/FALSE en mayúsculas: comparar en minúsculas o el flag sale
      // siempre false y el Sankey nunca expande el consorcio a sus miembros.
      is_consortium: String(c[iCons] ?? '').trim().toLowerCase() === 'true'
    }
    const members = (c[iMembers] ?? '').split('|').map((s) => s.trim()).filter(Boolean)
    if (members.length) entry.members = members

    // Socio no chino: la propiedad no le aplica, así que la derivación de un consorcio
    // tiene que saltarlo en vez de contarlo como desconocido. Sólo viaja cuando aplica,
    // para no engordar el JSON que se sirve en cada carga.
    const origen = iOrigen >= 0 ? String(c[iOrigen] ?? '').trim() : ''
    if (origen && origen.toLowerCase() !== 'china') entry.non_chinese = true

    map[c[iRaw]] = entry
    // También por nombre canónico: la base del cliente usa el canónico como `Investor`,
    // y sin esta segunda clave la mitad de las filas caía a UNKNOWN.
    if (c[iCanon] && !(c[iCanon] in map)) map[c[iCanon]] = entry
  }
  return map
}
