// Genera una PROPUESTA de tabla de inversores con las notas limpias, para revisar.
//
// NO toca `data/schema/investors_map.csv`. Escribe un XLSX aparte, en docs/sprint_5/.
// Si la propuesta se aprueba, recién ahí se convierte en un script que escriba el CSV.
//
// Por qué: `review_note` acumuló cuatro capas de trabajo —investigación web nuestra,
// correcciones desde un dataset legado que ya no tratamos como fuente, historia de fusión
// de ids, y preguntas a la revisión externa— y las cuatro quedaron pegadas en la misma
// celda, en dos idiomas. Hay notas que **nombran un ownership distinto al que la fila
// tiene hoy**: Lenovo dice «CORREGIDO a POE» y el valor es MIXED. Una nota que contradice
// su propia fila es peor que una vacía.
//
// La regla que ordena todo: **si el dato ya vive en una columna, no se repite en la nota.**
// El nombre chino está en `chinese_name`, la forma jurídica en `firm_type`, la propiedad en
// `ownership`, la procedencia en `evidence_source`, y la historia de ids en el README.
// La nota es para lo que no cabe en una columna.
//
// Uso:
//   node scripts/one-off/build_clean_investors_table.mjs

import { readFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
// xlsx-js-style, no xlsx: SheetJS community lee rellenos de celda pero no los escribe.
const XLSX = require('xlsx-js-style')

const CSV = 'data/schema/investors_map.csv'
const YW = 'docs/sprint_5/investors_table_ywedits.xlsx'
const OUT = 'docs/sprint_5/investors_table_limpia.xlsx'

function parseCsv(text) {
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
const s = (v) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim())

// ---------- lo que devolvió la revisión externa ----------
const yw = new Map()
for (const r of XLSX.utils.sheet_to_json(XLSX.readFile(YW).Sheets.companies, { defval: '' })) {
  yw.set(s(r.company_id), r)
}

// ---------- CSV ----------
const rows = parseCsv(readFileSync(CSV, 'utf8').replace(/\r\n/g, '\n').trim())
const header = rows[0]
const recs = rows.slice(1).filter((r) => r.length > 1).map((r) => Object.fromEntries(header.map((k, i) => [k, r[i]])))

// Una fila por empresa. Los nombres crudos viajan juntos.
const porId = new Map()
for (const r of recs) {
  const id = s(r.company_id)
  if (!porId.has(id)) porId.set(id, { ...r, investor_raw_all: [] })
  porId.get(id).investor_raw_all.push(s(r.investor_raw))
}

// ============================================================================
// REGLAS DE LIMPIEZA
// Cada una deja rastro en la hoja de auditoría. Ninguna borra un hecho que no
// esté ya guardado en otra columna.
// ============================================================================

const REGLAS = []
const regla = (id, desc, fn) => { REGLAS.push({ id, desc, fn }) }

// R1 · La nota de la revisión externa era el nombre chino y la forma jurídica, que hoy
// tienen columna propia. Repetirlos en prosa fue lo que hizo que 29 filas parecieran
// tener fundamento externo cuando lo que tenían era una frase nuestra.
regla('R1', 'nota de revisión externa redundante con chinese_name + firm_type', (n) =>
  /^Propiedad confirmada en la revisi[óo]n externa/i.test(n) ? '' : n
)

// R2 · La cola del dataset legado. Nombra un ownership que en varias filas ya no es el
// que tiene la fila, así que además de vieja, miente. La procedencia real está en
// `evidence_source`; las dos filas que SOLO se sostienen ahí se tratan en R7.
regla('R2', 'cola "OWNERSHIP CORREGIDO ... segun legacy/data/latam.json"', (n) =>
  n.replace(/\s*->\s*OWNERSHIP CORREGIDO[\s\S]*$/i, '').trim()
)

// R3 · La historia de fusión de ids vive en investors_map.README.md, sección «Ids
// retirados». En la nota de la empresa sobreviviente no le sirve a nadie.
regla('R3', 'cola "-> FUSIONADO ..." (historia de id)', (n) =>
  n.replace(/\s*->\s*(FUSIONADO|Fila '[^']+' fusionada)[\s\S]*$/i, '').trim()
)

// R4 · «Verificar» suelto era nuestra marca de trabajo pendiente. En una fila `confirmed`
// ya no pide nada: quedó como ruido que hace dudar de un dato que sí está cerrado.
regla('R4', '"Verificar" colgando en fila confirmed', (n, r) =>
  s(r.ownership_status) === 'confirmed'
    ? n.replace(/[.;]?\s*Verificar( pertinencia como inversor chino| nivel de participacion estatal local| [ée]poca de inversion)?\s*\.?\s*$/i, '').trim()
    : n
)

// R5 · El boilerplate de la propuesta duplica la columna `ownership_status`.
regla('R5', '"ICLAC PROPOSAL, pending external audit:" -> "ICLAC PROPOSAL:"', (n) =>
  n.replace(/ICLAC PROPOSAL, pending external audit:/gi, 'ICLAC PROPOSAL:')
   .replace(/PROPOSED, pending confirmation:/gi, 'ICLAC PROPOSAL:')
)

// R6 · Explicación del proceso editorial, repetida en tres filas. Es conocimiento del
// proyecto, no un hecho de la empresa: vive en el README.
regla('R6', 'explicación del proceso editorial en las filas marcadas para eliminación', (n) =>
  n.replace(/\s*That is not an ownership verdict: it is a proposal to drop the company, and the decision sits with ICLAC\.?/gi, '')
   .replace(/\s*;?\s*that decision sits with ICLAC\.?/gi, '.')
   .trim()
)

// R7 · Las preguntas que la revisión externa ya contestó el 05-08 se retiran; las que
// siguen abiertas se renombran a OPEN, que dice que espera respuesta y no que el dato
// esté mal.
const CONTESTADAS = new Set(['guoxin', 'mmg', 'taiyuan-iron', 'andes-petroleum', 'mcm'])
regla('R7', 'PLEASE CHECK contestado se retira; el resto pasa a OPEN', (n, r) => {
  if (CONTESTADAS.has(s(r.company_id))) {
    return n.replace(/\s*PLEASE CHECK[^.]*\.?\s*/gi, ' ').replace(/\s{2,}/g, ' ').trim()
  }
  return n.replace(/PLEASE CHECK TWO THINGS:/gi, 'OPEN, two questions:')
           .replace(/PLEASE CHECK:?/gi, 'OPEN:')
           .replace(/OPEN:s*,s*/g, 'OPEN: ')
})

// R8 · Traducción de las notas formulaicas de investigación. Sólo frases de forma fija:
// lo que no cae en el glosario se deja en español y se lista para revisión a mano, en vez
// de traducirlo a medias.
const GLOSARIO = [
  [/^Privada:\s*/i, 'Private: '],
  [/^Estructura de propiedad opaca historicamente/i, 'Historically opaque ownership structure'],
  [/\bSOE municipal\b/gi, 'Municipal SOE'],
  [/\bSOE provincial\b/gi, 'Provincial SOE'],
  [/\bFuente:\s*/gi, 'Source: '],
  [/\bfilial de\b/gi, 'subsidiary of'],
  [/\bFilial de\b/g, 'Subsidiary of'],
  [/\bFilial USA de\b/g, 'US subsidiary of'],
  [/\bFilial Brasil\b/g, 'Brazil subsidiary'],
  [/\bcontrolad[ao] por\b/gi, 'controlled by'],
  [/\bcotizada\b/gi, 'listed'],
  [/\bcotizado\b/gi, 'listed'],
  [/\bmatriz estatal\b/gi, 'state parent'],
  [/\bmatriz china no confirmada\b/gi, 'Chinese parent not confirmed'],
  [/\bmatriz\b/gi, 'parent'],
  [/\bfundador\b/gi, 'founder'],
  [/\bfundada por\b/gi, 'founded by'],
  [/\bPropiedad mixta\b/g, 'Mixed ownership'],
  [/\bpropiedad mixta\b/g, 'mixed ownership'],
  [/\bcontrol ultimo no confirmado\b/gi, 'ultimate control not confirmed'],
  [/\bControl ultimo no confirmado\b/g, 'Ultimate control not confirmed'],
  [/\bControl no confirmado\b/g, 'Control not confirmed'],
  [/\bcon reforma de gestion mixta\b/gi, 'with mixed-management reform'],
  [/\bcon reforma mixta\b/gi, 'with mixed reform'],
  [/\borigen SOE\b/gi, 'originally an SOE'],
  [/\bHOMONIMO: NO fusionar con\b/g, 'HOMONYM: do NOT merge with'],
  [/\bFALSO 'and'\b/g, "FALSE 'and'"],
  [/\bnombre legitimo\b/gi, 'legitimate name'],
  [/\bBanco estatal Big Four\b/g, 'Big Four state bank'],
  [/\bcontrol via\b/gi, 'controlled via'],
  [/\bControl estatal de facto\b/g, 'De facto state control'],
  [/\bMayor accionista\b/g, 'Largest shareholder'],
  [/\bmayor accionista\b/g, 'largest shareholder'],
  [/\baunque con participaciones estatales minoritarias\b/gi, 'though with minority state stakes'],
  [/\bpropiedad de empleados via\b/gi, 'employee-owned via'],
  [/\bAeroespacial\b/g, 'Aerospace'],
  [/\bAutomotriz privada\b/g, 'Private carmaker'],
  [/\bDesde 2021 bajo\b/g, 'Since 2021 under'],
  [/\bfusion con\b/gi, 'merger with'],
  [/\bcolapso y reestructuracion\b/gi, 'collapse and restructuring'],
  [/\bDejo UNKNOWN\b/g, 'Left as UNKNOWN'],
  [/\bel raw mezcla\b/gi, 'the raw name mixes'],
  [/\bclasificado como\b/gi, 'classified as'],
  [/\bPosible mismo nodo que\b/g, 'Possibly the same node as'],
  [/\bNota:\s*/g, 'Note: '],
  [/\by privados\b/g, 'and private holders'],
  [/\bhistoria de fraude\b/gi, 'history of fraud'],
]
const ESPANOL = /[áéíóúñ¿¡]|\b(el|la|los|las|un|una|de la|del|con|por|para|segun|según|empresa|empresas|estatal|privad[ao]s?|gobierno|equipos|maquinaria|servicios|productos|reciclaje|seguros|parcialmente|mineria|minero|aisladores|piensos|molienda|acuicolas|inmobiliario|agroquimicos|sindicato|farma|pesca|no fusionar|nivel de|nombre de)\b/i

// **Todo o nada.** Una nota mitad inglés mitad español es peor que una entera en español:
// la segunda se ve y se manda a traducir, la primera parece terminada. Si después del
// glosario queda rastro de español, se descarta la traducción y la nota va a la hoja
// `sin_traducir` para hacerla a mano.
regla('R8', 'traducción de notas formulaicas al inglés (atómica: o entera, o nada)', (n) => {
  if (!ESPANOL.test(n)) return n
  let out = n
  for (const [re, to] of GLOSARIO) out = out.replace(re, to)
  return ESPANOL.test(out) ? n : out
})


// R10 · La misma oscilación, escrita en inglés. R2 y R3 sólo cazaban la española.
// El lector de la tabla no necesita saber qué creímos antes de mirar la fila.
regla('R10', 'narración de lo que creíamos antes (en inglés)', (n) =>
  n.replace(/(OPEN|PLEASE CHECK):?\s*this replaces our earlier "[^"]*";?\s*we had not looked at the source row,\s*which describes/gi, 'The source row describes')
   .replace(/\s*Never went to external review because [^.]*\./gi, '')
   .replace(/\s{2,}/g, ' ')
   .trim()
)

// ============================================================================
// R9 · APLICAR LA REVISIÓN EXTERNA
//
// Su comentario casi nunca es una descripción de la empresa: es el matiz que corrige
// nuestra clasificación («Wuhu SASAC only holds 19.93%»). Así que reemplazar nuestra nota
// por la suya pierde el qué-es-la-empresa, y dejar la nuestra deja una nota en español que
// contradice el valor. Se reescriben integrando las dos, en inglés, y su texto literal
// sigue intacto en `external_note`.
//
// Fuera de acá quedan Taiyuan Iron y Andes Petroleum: las dos preguntas enviadas el 05-08.
// ============================================================================
const FLOTA =
  'CONSORTIUM, and a real one. The parent conglomerate leading a project alongside its own ' +
  'subsidiaries is a documented going-out strategy of Chinese SOEs, known as a "fleet" (舰队), ' +
  'confirmed by the external review on 2026-08-05. It is not one investor counted twice, so the ' +
  'members stay separate. Source: https://www.yicai.com/news/5287516.html'

const NOTAS_FINALES = {
  // — de la planilla del 31-07, donde su comentario nunca se aplicó a la nota —
  'xinjiang-tbea-group': 'Private electrical-equipment maker from Xinjiang. Kept as POE, but the external review flags that government-backed funds have held a majority share since 2015.',
  chery: 'Wuhu SASAC holds only 19.93% of Chery, which is why the external review classifies it as mixed ownership rather than a municipal SOE.',
  joyvio: 'Subsidiary of Legend Holdings. Mixed because the Chinese Academy of Sciences holds part of the equity in Legend.',
  yutong: 'Zhengzhou Yutong, formerly held through the Zhengzhou municipal government via Yutong Group. The external review states it is fully privately owned after the reform.',
  gree: 'Privately owned since Hillhouse became the largest shareholder in 2019. Gree Group, from which it detached that year, is an SOE.',
  nuctech: 'Grew out of Tsinghua University through Tsinghua Tongfang. Mixed because the State Council retains some control over the equity in Tongfang.',
  lenovo: 'Largest shareholder is Legend Holdings, where the Chinese Academy of Sciences holds equity alongside private holders. Hence mixed.',
  'china-development-bank': 'Policy bank controlled by the Ministry of Finance. Central SOE under the criterion that control by a ministry or by Huijin counts as central, not only SASAC control.',
  // Su comentario del 31-07 que nunca se registró en ninguna parte, y que es una señal de
  // eliminación que no llegó a marcar en rojo.
  'fubao-food-company': 'OPEN: the external review describes Fubao Food as an Argentinian company with no clear relation to any Chinese parent, possibly an individual investment. It was not marked for removal, but the description is the same one given for the three companies that were. Its POE label predates that comment.',
  'hubei-energy': 'Provincial group in Hubei, but controlled indirectly by State Council SASAC through its subsidiary relationship with China Three Gorges, which is why the external review classifies it as a central SOE rather than a provincial one.',
  'taiyuan-iron': 'Central SOE. TISCO has been controlled by China Baowu since 2020 and is therefore under State Council SASAC, not the Shanxi provincial government. The external review confirmed on 2026-08-05 that our earlier Local SOE was wrong.',
  'andes-petroleum': 'Central SOE. Joint venture between CNPC (55%) and Sinopec (45%), both central SOEs. Corrected on 2026-08-05: our note said CNOOC, and the external review pointed to CNPC official documents (cnpc.com.cn, CNPC in Latin America).',
  'taiyuan-iron-citic-and-baosteel': 'CONSORTIUM. TISCO, CITIC and Baosteel/Baowu, all three central SOEs. TISCO was recorded as a Shanxi provincial SOE until the external review confirmed on 2026-08-05 that Baowu controls it, so this consortium no longer resolves as local.',
  // — de la planilla del 05-08 —
  mmg: 'Central SOE, under the supervision of State Council SASAC through China Minmetals.',
  guoxin: 'Central SOE, under the auspices of State Council SASAC.',
  // Los tres consorcios matriz + filial. Misma nota: la duda era la misma y la respuesta
  // también, y es criterio, no dato de fila.
  'cccc-chec-consortium': FLOTA,
  'china-national-electric-engineering-comp': FLOTA,
  'china-three-gorges-and-china-internation': FLOTA,
  'china-construction-america-and-mcm':
    'CONSORTIUM. MCM is the Panamanian subsidiary of Munilla Construction Management, a US company, so ownership does not apply to it and the consortium resolves through China Construction America alone. The external review suggests dropping MCM from the company registry while keeping it as a member here; pending decision, because a member with no row of its own contributes UNKNOWN.',
  mcm: 'Panamanian subsidiary of Munilla Construction Management (US). Not a Chinese company, so ownership does not apply. The external review suggests removing it from the registry but keeping it as a member of the Ciudad de Esperanza consortium (PAN-0015). OPEN: dropping the row while leaving it in members would send PAN-0015 back to UNKNOWN.',
}

// ---- Traducción a mano de las notas que el glosario no pudo cerrar (2026-08-05).
// Se hacen a mano porque son prosa, no formulario. Donde la nota traducida contradice
// el valor de la fila, se dice: callarlo sería volver al problema que estamos limpiando.
const TRADUCIDAS = {
  zijin: 'Ultimate controller: Minxi Xinghang State-owned Assets (Shanghang county government), around 23%. A local/provincial SOE, not central SASAC. Source: Wikipedia/Zijin',
  sinomach: 'SASAC central SOE. Note: the raw name mixes the Sinomach parent with its subsidiary CMEC; classified here as the parent. Source: SASAC/Wikipedia Sinomach',
  'shandong-kerui': 'Private oilfield-equipment maker (Shandong Kerui Group).',
  'shandong-gold': 'Provincial SOE, controlled by the Shandong provincial government. Source: Wikipedia Shandong Gold',
  'citic-guoan': 'Recapitalised in 2014: CITIC Group holds only 20.95% and the rest is private capital. Neither clearly state-owned nor a controlled subsidiary, so it is kept separate from CITIC. Source: Wikipedia CITIC Guoan',
  'shanghai-pengxin': 'Private: real-estate and agribusiness conglomerate (Jiang Zhaobai). Source: Bloomberg/Wikipedia',
  'fosun-international': 'Private: the largest private conglomerate in China, founded by Guo Guangchang. Source: Wikipedia Fosun',
  hna: 'Historically opaque ownership structure (foundations and employee holdings). After the 2021 collapse it was restructured under Liaoning Fangda, a private group, which is the basis for the POE recorded here. Our earlier reading had left it UNKNOWN.',
  'beijing-construction-engineering-group': 'Municipal SOE, controlled by the Beijing municipal government (BCEG).',
  huawei: 'Private: employee-owned through the trade union holding, Huawei Investment & Holding (Ren Zhengfei, founder). Source: Wikipedia Huawei',
  'china-investment-corporation': 'State sovereign wealth fund, under the Ministry of Finance and the State Council rather than SASAC. Source: Wikipedia CIC',
  'shanghai-shemar-power': 'Private: manufacturer of composite insulators.',
  'jchx-mining-management': 'Private: Shanghai-listed mining services company.',
  'china-communications-bank': "State bank (Bank of Communications / BoCom); the Ministry of Finance is its largest shareholder. Source: Wikipedia BoCom. OPEN: under the external review's own criterion, control by the Ministry of Finance makes a company a central SOE, which does not match the Local SOE recorded here.",
  'silk-road-fund': 'State BRI fund (SAFE 65% / CIC 15% / EXIM 15% / CDB 5%). Source: Wikipedia Silk Road Fund',
  'noble-group': 'Singapore-listed commodities trader, not a Chinese state company; founded by Richard Elman. OPEN: whether it belongs in a registry of Chinese investors at all.',
  'tcl-corporation': 'Originally a Huizhou SOE; mixed-ownership reform with private management (Li Dongsheng). Source: Wikipedia TCL',
  'dalian-huafeng-aquatic-products': 'Private: aquaculture products, Dalian.',
  'nanjing-red-sun': 'Nanjing Red Sun, a listed agrochemicals maker. Recorded as a local SOE; our earlier research had read it as private.',
  junefield: 'Private: Junefield, mining and jewellery, Hong Kong.',
  'shanghai-fisheries-general-corporation': 'Municipal SOE in Shanghai (fisheries; part of Bright Food, under Shanghai SASAC).',
  'chongqing-huapont-pharm-co-ltd': 'Private: listed pharmaceutical and agrochemical company, Chongqing.',
  zhengchang: 'Private: feed machinery (Jiangsu Zhengchang).',
  'yangtze-optical-fibre-and-cable': "FALSE 'and'. YOFC is a joint venture with state shareholders (China Huaxin) and private/foreign ones (Draka). Mixed ownership.",
  'hebei-huatong-wires-and-cables': "FALSE 'and'. Private cable manufacturer in Hebei.",
  zoomlion: 'Originally a Changsha SOE (a state research institute); mixed-ownership reform with dispersed shareholding. Source: Wikipedia Zoomlion',
  'sanxing-electric': 'Private: electrical equipment. OPEN: ultimate control not confirmed.',
  aihuishou: 'Private: NYSE-listed electronics recycling (ATRenew).',
  'ebaotech-corporation': 'Private: insurance software, Shanghai.',
  'china-natural-resources': 'Private: Nasdaq-listed mining holding (Feize Zhang).',
  pingle: 'Private: milling machinery (Hebei Pingle).',
  'export-import-bank-of-china': 'State policy bank, 100% State Council. Source: Wikipedia EXIM Bank',
  'dashang-group': 'Dalian Dashang: originally a municipal SOE, mixed-ownership reform (retail).',
}
Object.assign(NOTAS_FINALES, TRADUCIDAS)

// El detector de español no distingue un nombre propio ("Las Bambas") ni una cita
// deliberada del texto fuente. Estas dos están en inglés y se quedan como están.
const NO_ES_ESPANOL = new Set(['mmg-guoxin-and-citic-metal-company', 'american-recycling'])

// Filas que pasan de propuesta a confirmada por la revisión del 05-08.
const CONFIRMADAS = new Set(['mmg', 'guoxin', 'taiyuan-iron', 'andes-petroleum'])

// Respuesta del 05-08 a las dos preguntas que quedaban. Las dos corrigen un dato nuestro,
// no uno suyo.
//
// Taiyuan Iron mueve un total publicado: es miembro del consorcio con CITIC y Baosteel, y
// esa inversión (BRA-0037, Brasil 2011, US$1.950 MM) era la que aportaba al filtro
// «estatal local» desde ese consorcio. Con los tres miembros centrales, el consorcio deja
// de aparecer ahí. Central SOE no se mueve: ya entraba por CITIC y Baosteel.
//
// Andes Petroleum: el CNOOC era nuestro. Él lo dijo dos veces —en su nota y en el nombre
// chino que llenó— y la tercera celda decía CNOOC porque editó nuestro texto para agregar
// los porcentajes sin tocar el error de abajo.
const CORRECCIONES = {
  'taiyuan-iron': { ownership: 'Central SOE', controllers: 'SASAC (central), via China Baowu' },
  'andes-petroleum': { controllers: 'SASAC (central), via CNPC (55%) and Sinopec (45%)' },
}

// R11 · `controllers` quedó a medio traducir: las filas que sembramos nosotros están en
// español y las que vinieron del registro chino, en inglés. La columna la lee la revisión
// externa, así que va entera en inglés.
const CONTROLADORES_EN = [
  [/\bvía\b/g, 'via'],
  [/^Municipio de (.+)$/, '$1 municipal government'],
  [/^Provincia de (.+)$/, '$1 provincial government'],
  [/^Privado \((.+)\)$/, 'Private ($1)'],
  [/^Privado$/, 'Private'],
]
const traducirControladores = (v) => {
  let out = s(v)
  for (const [re, to] of CONTROLADORES_EN) out = out.replace(re, to)
  return out.replace(/’/g, "'")
}

// ---------- aplicación ----------
const auditoria = []
const sinTraducir = []
const contradicciones = []
const salida = []

for (const [id, r] of porId) {
  const original = s(r.review_note)
  let nota = original
  const aplicadas = []
  for (const R of REGLAS) {
    const antes = nota
    nota = s(R.fn(nota, r))
    if (nota !== antes) aplicadas.push(R.id)
  }
  nota = nota.replace(/\s*[.;,]\s*$/, (m) => (m.includes('.') ? '.' : '')).trim()

  // R9 gana sobre las reglas de limpieza: es la nota final escrita a mano.
  let estado = s(r.ownership_status)
  let fuente = s(r.evidence_source)
  if (NOTAS_FINALES[id]) { nota = NOTAS_FINALES[id]; aplicadas.push('R9') }
  if (CONFIRMADAS.has(id)) { estado = 'confirmed'; fuente = 'revision-externa-2026-08'; aplicadas.push('R9') }
  const corr = CORRECCIONES[id]
  if (corr) { Object.assign(r, corr); aplicadas.push('R9') }

  // ¿la nota original nombraba un ownership distinto al de la fila?
  const m = /OWNERSHIP CORREGIDO a ([A-Za-z ]+?) segun/i.exec(original)
  if (m) {
    const dicho = m[1].trim().toUpperCase()
    const actual = s(r.ownership).toUpperCase()
    const equiv = { SASAC: 'CENTRAL SOE', SOE: 'CENTRAL SOE' }
    const norm = equiv[dicho] || dicho
    if (actual && norm !== actual) contradicciones.push([r.company_canonical, m[1].trim(), s(r.ownership)])
  }

  const e = yw.get(id)
  let externa = ''
  if (e) {
    const t = s(e.review_note)
    const i = t.indexOf('REVIEW:')
    if (i >= 0) externa = t.slice(i + 7).trim()
  }

  // Datos que trajo la revisión externa y no teníamos. Hubei Energy NO se toca: su
  // archivo es más viejo que el CSV en ese campo, no más nuevo.
  const chino = s(r.chinese_name) || (e ? s(e.chinese_name).replace(/｜/g, '|') : '')

  if (nota && ESPANOL.test(nota) && !NO_ES_ESPANOL.has(id)) sinTraducir.push([r.company_canonical, nota])
  if (original !== nota) auditoria.push({ company: r.company_canonical, reglas: aplicadas.join(' '), antes: original, despues: nota })

  salida.push({
    company_canonical: r.company_canonical,
    ownership: r.ownership,
    ownership_status: estado,
    chinese_name: chino,
    firm_type: r.firm_type,
    controllers: traducirControladores(r.controllers),
    control_paths: r.control_paths,
    is_jv_vehicle: r.is_jv_vehicle,
    origin_country: r.origin_country,
    review_note: nota,
    external_note: externa || s(r.external_note),
    company_id: id,
    investor_raw_all: r.investor_raw_all.join(' | '),
    is_consortium: r.is_consortium,
    members: r.members,
    evidence_source: fuente,
  })
}

// ---------- informe ----------
const largoAntes = [...porId.values()].reduce((a, r) => a + s(r.review_note).length, 0)
const largoDespues = salida.reduce((a, r) => a + r.review_note.length, 0)
console.log(`Empresas            : ${salida.length}`)
console.log(`Notas modificadas   : ${auditoria.length}`)
console.log(`Notas que quedan vacías: ${salida.filter((r) => !r.review_note).length}`)
console.log(`Caracteres de nota  : ${largoAntes} -> ${largoDespues} (${Math.round(100 - (largoDespues / largoAntes) * 100)}% menos)`)
console.log(`external_note llenas: ${salida.filter((r) => r.external_note).length}`)
console.log(`Quedan en español   : ${sinTraducir.length}`)
console.log(`\nNotas que nombraban un ownership distinto al de su fila: ${contradicciones.length}`)
for (const c of contradicciones) console.log(`   ${String(c[0]).padEnd(32)} la nota decía ${String(c[1]).padEnd(12)} la fila dice ${c[2]}`)

// ============================================================================
// MARCADO PARA REVISIÓN
//
// Color **y** columna `flag`. El color solo no basta: no sobrevive a copiar y pegar, no
// se puede filtrar cómodamente y deja fuera a quien no distingue el rosa del amarillo.
// La columna dice lo mismo en texto y es la que manda.
//
// Una fila lleva una sola marca. Si califica para varias, gana la de más arriba.
// ============================================================================
const MARCAS = [
  ['CONTRADICE', 'FFC7CE', 'La nota nombraba un ownership distinto al de la fila. El valor de la fila es el bueno; la nota estaba vieja.'],
  ['ESPERA-RESPUESTA', 'BDD7EE', 'Pregunta enviada a la revisión externa el 05-08, sin aplicar hasta que conteste.'],
  ['ABIERTA', 'FFEB9C', 'Pregunta nuestra sin resolver, marcada OPEN en la nota.'],
  ['NOTA-VACIADA', 'C6EFCE', 'La nota decía lo que ya dicen chinese_name y firm_type. Vacía es el estado honesto, pero conviene confirmarlo.'],
]
const idsContradicen = new Set(contradicciones.map(([nombre]) => nombre))
// Vacío desde el 05-08: las dos preguntas están contestadas y aplicadas en CORRECCIONES.
const ESPERA = new Set()

for (const r of salida) {
  r.flag =
    idsContradicen.has(r.company_canonical) ? 'CONTRADICE'
      : ESPERA.has(r.company_id) ? 'ESPERA-RESPUESTA'
        : /\bOPEN\b/.test(r.review_note) ? 'ABIERTA'
          : !r.review_note ? 'NOTA-VACIADA'
            : ''
}
// `flag` primero: es lo que se mira al abrir.
const salidaConFlag = salida.map(({ flag, ...resto }) => ({ flag, ...resto }))

const pintar = (ws, filas) => {
  const cols = Object.keys(filas[0])
  const letra = (i) => { let s = '', n = i; while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1 } return s }
  // Además del flag se pinta la celda que hay que mirar, que no es la misma en cada caso.
  const foco = { CONTRADICE: 'ownership', 'ESPERA-RESPUESTA': 'controllers', ABIERTA: 'review_note', 'NOTA-VACIADA': 'review_note' }
  filas.forEach((r, i) => {
    if (!r.flag) return
    const color = MARCAS.find(([n]) => n === r.flag)[1]
    const fill = { fill: { patternType: 'solid', fgColor: { rgb: color } } }
    for (const c of ['flag', foco[r.flag]]) {
      const ref = letra(cols.indexOf(c)) + (i + 2)
      if (ws[ref]) ws[ref].s = fill
      else ws[ref] = { t: 's', v: '', s: fill }
    }
  })
}

const readme = [
  { field: 'file', value: 'PROPUESTA de limpieza de review_note. No es la tabla en uso.' },
  { field: 'generated', value: new Date().toISOString().slice(0, 10) },
  { field: 'source', value: 'data/schema/investors_map.csv + docs/sprint_5/investors_table_ywedits.xlsx' },
  { field: 'principio', value: 'Si el dato ya vive en una columna, no se repite en la nota.' },
  ...REGLAS.map((R) => ({ field: R.id, value: R.desc })),
  { field: 'external_note', value: 'Texto literal de la revisión externa. Separado de review_note, que es prosa nuestra.' },
  { field: 'Hubei Energy', value: 'Se mantiene Central SOE. El archivo devuelto dice Local SOE porque su export es anterior a la corrección del 04-08.' },
  { field: 'Andes Petroleum', value: 'controllers sigue diciendo CNOOC; su nota y su chinese_name dicen Sinopec. Pregunta enviada, sin aplicar.' },
  { field: 'R9', value: 'Notas finales escritas a mano donde la revisión externa cambió la sustancia. Su texto literal sigue en external_note.' },
  ...MARCAS.map(([n, color, desc]) => ({ field: 'flag ' + n + ' (' + color + ')', value: desc })),
  { field: 'R11', value: 'controllers traducido al inglés: estaba mitad en español (filas sembradas por nosotros) y mitad en inglés (registro chino).' },
  { field: 'auditoría', value: 'La hoja note_changes trae el antes y el después de cada nota tocada, con las reglas aplicadas.' },
]

mkdirSync('docs/sprint_5', { recursive: true })
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(readme), 'README')
const wsComp = XLSX.utils.json_to_sheet(salidaConFlag)
pintar(wsComp, salidaConFlag)
XLSX.utils.book_append_sheet(wb, wsComp, 'companies')
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(auditoria), 'note_changes')
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sinTraducir.map(([company, note]) => ({ company, note }))), 'sin_traducir')
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(contradicciones.map(([company, nota_decia, fila_dice]) => ({ company, nota_decia, fila_dice }))), 'contradicciones')
XLSX.writeFile(wb, OUT)
console.log(`\n${OUT}`)
