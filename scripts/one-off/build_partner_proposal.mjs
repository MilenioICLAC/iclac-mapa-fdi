// Instrumento para proponerle al equipo de datos una columna nueva en los archivos por
// país: quién es el socio no chino de la operación, cuando lo hay.
//
// Por qué: hoy ese nombre vive SOLO en la prosa de `Detail` («in Joint Venture With
// Electroingeniería»), así que no se puede filtrar ni contar. Y la columna que debería
// marcarlo, `Joint_Venture`, está en 3 filas de 386 y se llenó con un criterio que el
// esquema no define: los 3 marcados y los 39 que lo describen en el texto son conjuntos
// disjuntos.
//
// La propuesta llega PRELLENADA: extraemos el socio del texto para las que se puede y
// ellos confirman. Es el patrón que funcionó con la revisión de propiedad (159 empresas
// contestadas) y que falló cuando preguntamos abierto (hoja de consorcios, en blanco).
//
// Uso: node scripts/one-off/build_partner_proposal.mjs [salida.xlsx]

import { readFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const OUT = process.argv[2] || 'docs/sprint_5/socio_no_chino_03082026.xlsx'
const COL = 'Socio_No_Chino'

const inv = JSON.parse(readFileSync('public/data/investments.json', 'utf8'))
const map = JSON.parse(readFileSync('public/data/investors_map.json', 'utf8'))

const byId = new Map()
for (const r of inv) if (!byId.has(r.id)) byId.set(r.id, r)

// Países de la región, para separar socio local de socio de un tercer país. La lista
// sale de los datos, no de una constante: si entra un país nuevo, entra solo.
const paises = new Set([...byId.values()].map((r) => r.country))

// País de cada socio. IMPORTANTE: esto NO tiene fuente documental, es conocimiento
// general nuestro y va en la planilla marcado como propuesta. El origen no se puede
// deducir del nombre ni de ningún dato que tengamos: quien investigó la operación es
// quien sabe que Electroingeniería es argentina y Bombardier canadiense. Por eso la
// columna Socio_Pais existe y por eso se pide que la confirmen.
const ORIGEN = {
  'Jemse': 'Argentina', 'Electroingeniería': 'Argentina', 'Pandedile': 'Argentina',
  'Newsan': 'Argentina', 'Radio Victoria': 'Argentina',
  'The Empresa Nacional De Electricidad': 'Bolivia', 'La Empresa Nacional De Electricidad': 'Bolivia',
  'Litio Boliviano (Ylb)': 'Bolivia', 'Grupo Psinet': 'Chile', 'Volcan': 'Peru',
  'The Venezuelan Government': 'Venezuela',
  'General Electric': 'Estados Unidos', 'Carrier': 'Estados Unidos',
  'Exxon And Hess': 'Estados Unidos', 'Renault And Aramco': 'Francia y Arabia Saudita',
  'Mainstream Renewable Power': 'Irlanda', 'Soventix': 'Alemania',
  'Edp Renewables': 'Portugal', 'Edp': 'Portugal', 'Adama': 'Israel',
  'Ongc Videsh': 'India', 'Bombardier': 'Canadá', 'Jan De Nul': 'Bélgica',
}

const txt = (r) => (r.detail_en || '') + ' ' + (r.detail_es || '')
const en = (r) => (r.detail_en || '').replace(/\s+/g, ' ')

const filas = []
for (const r of byId.values()) {
  if (!/joint venture|\bJV\b|consorti/i.test(txt(r))) continue

  const esConsorcio = !!(map[r.investor] || {}).is_consortium
  // El socio puede estar nombrado en cualquiera de los dos textos, y no siempre en los
  // dos: CHL-0044 lo nombra solo en español («en Joint Venture Con Puente y Calzadas»).
  const m = en(r).match(/joint venture (?:with|between)\s+([^,.;]{2,60})/i)
    || (r.detail_es || '').replace(/\s+/g, ' ').match(/joint venture con\s+([^,.;]{2,60})/i)
  const socio = m ? m[1].trim() : ''

  let tipo, propuesta, nota
  if (socio && socio.toLowerCase() === 'cca') {
    tipo = 'REVISAR'
    propuesta = ''
    nota = 'El texto dice «joint venture with CCA», pero CCA es la propia empresa inversora. Parece un error del dato.'
  } else if (socio) {
    const pais = ORIGEN[socio] || ''
    tipo = !pais ? 'socio, origen por confirmar' : paises.has(pais) ? 'socio del país de la inversión' : 'socio de un tercer país'
    propuesta = socio
    nota = 'Extraído del texto de Detail. Confirmar la grafía y que sea el socio y no un vendedor.'
  } else if (esConsorcio) {
    tipo = 'sin socio no chino'
    propuesta = ''
    nota = 'La operación conjunta es entre las empresas chinas del consorcio. No corresponde socio acá.'
  } else {
    tipo = 'REVISAR'
    propuesta = ''
    nota = 'El texto menciona una operación conjunta pero no nombra al socio. Hay que leer la fuente.'
  }

  filas.push({
    Id_Investment: r.id,
    Pais: r.country,
    Inversor: r.investor,
    Joint_Venture_hoy: r.is_joint_venture ? 'Yes' : 'No',
    [COL]: propuesta,
    Socio_Pais: propuesta ? (ORIGEN[socio] || '') : '',
    Tipo: tipo,
    'Confirman? (OK / CORREGIR)': '',
    [`${COL} corregido`]: '',
    'Socio_Pais corregido': '',
    Comentario: '',
    Nota_nuestra: nota,
    Detalle: en(r).slice(0, 220),
  })
}

// Las 3 que hoy tienen la marca en verdadero y no describen nada en el texto: van
// igual, porque son justamente las que hay que entender.
for (const r of byId.values()) {
  if (!r.is_joint_venture) continue
  if (filas.some((f) => f.Id_Investment === r.id)) continue
  filas.push({
    Id_Investment: r.id,
    Pais: r.country,
    Inversor: r.investor,
    Joint_Venture_hoy: 'Yes',
    [COL]: '',
    Socio_Pais: '',
    Tipo: 'REVISAR',
    'Confirman? (OK / CORREGIR)': '',
    [`${COL} corregido`]: '',
    'Socio_Pais corregido': '',
    Comentario: '',
    Nota_nuestra: 'Marcada como joint venture pero el texto no describe ninguna operación conjunta. ¿Con qué criterio se marcó?',
    Detalle: en(r).slice(0, 220),
  })
}

filas.sort((a, b) => (a.Tipo === b.Tipo ? a.Id_Investment.localeCompare(b.Id_Investment) : a.Tipo.localeCompare(b.Tipo)))

const conteo = {}
for (const f of filas) conteo[f.Tipo] = (conteo[f.Tipo] || 0) + 1

const readme = [
  ['Propuesta: guardar al socio no chino en la base, con nombre'],
  [''],
  ['QUÉ PROPONEMOS'],
  [`Dos columnas nuevas en los archivos por país: "${COL}", con el NOMBRE del socio cuando la`],
  ['operación se hizo con una empresa que no es china, y "Socio_Pais" con su país. Varios socios se'],
  ['separan con el signo | y los países van en el mismo orden.'],
  ['Las dos ya están definidas en el esquema (v1.6) y el validador las reconoce: si las agregan a un'],
  ['archivo, el informe deja de tratarlas como "columna extra que el sistema ignora". Están vacías.'],
  [''],
  ['POR QUÉ'],
  ['Hoy ese nombre vive solo dentro del texto de Detail, así que no se puede filtrar, contar ni cruzar.'],
  ['Con socio o sin socio separa una filial enteramente china de una sociedad con capital de fuera, y'],
  ['esa es una distinción de investigación, no de mantención.'],
  [''],
  ['QUÉ REEMPLAZA'],
  ['A la columna Joint_Venture, que se puede retirar. La presencia de un nombre ES la marca, así que'],
  ['no hace falta un booleano aparte que mantener sincronizado.'],
  ['Motivo: hoy Joint_Venture está en Yes en 3 inversiones de 386, y otras 39 describen una operación'],
  ['conjunta en el texto. Los dos conjuntos no se tocan: ninguna de las 39 está marcada. No es una'],
  ['columna incompleta, es una columna que se llenó con otro criterio, y el esquema no define cuál.'],
  [''],
  ['QUÉ NO CAMBIA, Y ES IMPORTANTE'],
  ['1. No toca la atribución del monto. La metodología imputa el total al inversor chino. Registrar'],
  ['   quién más participó no implica repartir la cifra.'],
  ['2. No toca el filtro de propiedad del sitio. Un socio brasileño no tiene tipo de propiedad china;'],
  ['   ese filtro sigue siendo sobre el capital chino.'],
  ['3. No pedimos datos nuevos: 29 de los 39 casos ya están en el texto y vienen prellenados abajo.'],
  [''],
  ['POR QUÉ "NO CHINO" Y NO "LOCAL"'],
  ['De los 29 socios que pudimos extraer, 13 son del país de la inversión (Jemse, Electroingeniería,'],
  ['Newsan, ENDE, YLB, Volcan) y 15 son de terceros países (General Electric, Carrier, Renault, Aramco,'],
  ['EDP, Exxon, Bombardier, Jan De Nul, ONGC Videsh). Llamarla "local" etiquetaría mal la mitad.'],
  ['Local contra tercer país se puede derivar después, a partir del nombre.'],
  [''],
  ['DE DÓNDE SALE EL PAÍS DEL SOCIO'],
  ['De ustedes. No se puede deducir del nombre ni de ningún dato que tengamos: quien investigó la'],
  ['operación es quien sabe que Electroingeniería es argentina y Bombardier canadiense.'],
  [`La columna Socio_Pais de este archivo trae una propuesta nuestra, pero es conocimiento general`],
  ['sin fuente documental, así que hay que confirmarla una por una. Es la única columna del archivo'],
  ['que no sale de los datos.'],
  [''],
  ['CÓMO SE LLENA'],
  [`Las columnas "${COL}" y "Socio_Pais" traen nuestra propuesta. Ustedes ponen OK o CORREGIR en la`],
  ['columna de confirmación y, si corrigen, escriben el valor bueno en las columnas de al lado.'],
  ['Si la operación tuvo varios socios, van en una sola celda separados por el signo |, y los países'],
  ['en el mismo orden.'],
  ['Las filas marcadas REVISAR son las que no pudimos resolver y necesitan que alguien lea la fuente.'],
  [''],
  ['UN CASO SUELTO'],
  ['PAN-0015 (Ciudad de Esperanza, Panamá) tiene a MCM cargado como si fuera una empresa china miembro'],
  ['del consorcio. Según la nota, MCM es el socio local. Si se confirma, MCM sale de ahí y pasa a esta'],
  ['columna, que es donde siempre correspondió.'],
  [''],
  ['RESUMEN DE ESTE ARCHIVO'],
  ...Object.entries(conteo).sort((a, b) => b[1] - a[1]).map(([k, v]) => [`  ${k}: ${v}`]),
  [`  TOTAL: ${filas.length}`],
]

const wb = XLSX.utils.book_new()
const wsR = XLSX.utils.aoa_to_sheet(readme)
wsR['!cols'] = [{ wch: 104 }]
XLSX.utils.book_append_sheet(wb, wsR, 'README')

const ws = XLSX.utils.json_to_sheet(filas)
ws['!cols'] = [{ wch: 11 }, { wch: 11 }, { wch: 26 }, { wch: 9 }, { wch: 26 }, { wch: 16 },
  { wch: 26 }, { wch: 22 }, { wch: 26 }, { wch: 16 }, { wch: 26 }, { wch: 58 }, { wch: 62 }]
ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: filas.length, c: 12 } }) }
ws['!freeze'] = { xSplit: 1, ySplit: 1 }
XLSX.utils.book_append_sheet(wb, ws, 'socios')

mkdirSync(dirname(OUT), { recursive: true })
XLSX.writeFile(wb, OUT)

console.log(`${OUT}`)
console.log(`${filas.length} filas`)
for (const [k, v] of Object.entries(conteo).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(3)}  ${k}`)
