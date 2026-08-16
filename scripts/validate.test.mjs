import { describe, it, expect } from 'vitest'
import { validateRows } from './lib/validate.mjs'
import { parseCountriesCsv } from './lib/countries.mjs'

// Fila válida del contrato v1.2 (CHILE.xlsx). Overrides por test.
const makeRow = (over = {}) => ({
  Id_Investment: 'CHL-0001',
  Id_Seq: 1,
  Coordinates: '-33.45, -70.66',
  Year: 2020,
  Country: 'Chile',
  COUNTRY_ISO_NUM: '152',
  COUNTRY_ISO_ALPHA3: 'CHL',
  Province_ISO: null,
  Investor: 'State Grid',
  Vector: 'Punto',
  Path: 0,
  Area_EN: 'Energy',
  Area_ES: 'Energía',
  Detail_ES: 'Compra de activos',
  Detail_EN: 'Asset acquisition',
  Investment: 100,
  Location: 'Santiago',
  Project_Type: 'Adquisición',
  Joint_Venture: 'No',
  Origin_Of_Seller: null,
  Stake: 50,
  Research: 'No',
  News: 'No',
  Caso1: null,
  Link1: null,
  ...over
})

const run = (rows, opts = {}) => validateRows(rows, { filename: 'CHILE.xlsx', ...opts })
const errorsOf = (r) => r.issues.filter((x) => x.severity === 'error')
const warningsOf = (r) => r.issues.filter((x) => x.severity === 'warning')
const rules = (xs) => xs.map((x) => x.rule)

describe('archivo válido', () => {
  it('puntos + línea Vector multi-fila pasan sin errores', () => {
    const rows = [
      makeRow(),
      makeRow({ Id_Investment: 'CHL-0002', Id_Seq: 2, Coordinates: '-36.8, -73.0' }),
      // línea de 2 vértices: mismo id+path, metadata idéntica
      makeRow({ Id_Investment: 'CHL-0003', Id_Seq: 3, Vector: 'Vector', Path: 1, Coordinates: '-33.0, -71.0' }),
      makeRow({ Id_Investment: 'CHL-0003', Id_Seq: 3, Vector: 'Vector', Path: 1, Coordinates: '-33.1, -71.1' })
    ]
    const r = run(rows)
    expect(r.fileErrors).toEqual([])
    expect(errorsOf(r)).toEqual([])
    expect(r.stats.passed).toBe(true)
    expect(r.stats.validPct).toBe(100)
  })
})

describe('reglas de archivo', () => {
  it('columna prohibida = fileError, falla aunque filas 100% válidas', () => {
    const r = run([makeRow({ Investment_ARREGLADO: 100 })])
    expect(r.fileErrors.some((f) => f.rule === 'archivo/columna-prohibida')).toBe(true)
    expect(r.stats.passed).toBe(false)
  })

  it('columna requerida ausente = fileError', () => {
    const row = makeRow()
    delete row.Year
    const r = run([row])
    expect(r.fileErrors.some((f) => f.rule === 'archivo/columna-requerida' && f.message.includes('Year'))).toBe(true)
  })

  it('nombre de archivo fuera de convención = fileError', () => {
    const r = validateRows([makeRow()], { filename: 'Datos Chile (final).xlsx' })
    expect(r.fileErrors.some((f) => f.rule === 'archivo/nombre')).toBe(true)
  })

  it('nombre en minúscula es aceptado (case-insensitive, v1.4) con curación', () => {
    const r = validateRows([makeRow()], { filename: 'chile.xlsx' })
    expect(r.fileErrors.some((f) => f.rule === 'archivo/nombre')).toBe(false)
    expect(r.curaciones.some((c) => c.rule === 'curacion/nombre-archivo')).toBe(true)
    // y sigue exigiendo país único (nombre canónico match)
    const cross = validateRows([makeRow({ Country: 'Peru', COUNTRY_ISO_NUM: '604', COUNTRY_ISO_ALPHA3: 'PER', Id_Investment: 'PER-0001' })], { filename: 'chile.xlsx' })
    expect(rules(errorsOf(cross))).toContain('fila/pais-archivo')
  })

  it('convención cliente (MAYÚSCULA inglés) es canónica y exige país del archivo', () => {
    const ok = validateRows([makeRow()], { filename: 'CHILE.xlsx' })
    expect(ok.fileErrors.some((f) => f.rule === 'archivo/nombre')).toBe(false)
    const cross = validateRows([makeRow()], { filename: 'BRAZIL.xlsx' })
    expect(rules(errorsOf(cross))).toContain('fila/pais-archivo')
  })

  it('más de una hoja = fileError', () => {
    const r = run([makeRow()], { sheetCount: 2 })
    expect(r.fileErrors.some((f) => f.rule === 'archivo/hojas')).toBe(true)
  })

  it('Id_Seq/News ausentes = warning de archivo (contrato en adopción), no error', () => {
    const row = makeRow()
    delete row.Id_Seq
    delete row.News
    const r = run([row])
    expect(r.fileErrors).toEqual([])
    expect(rules(warningsOf(r))).toContain('archivo/columna-nueva-ausente')
  })

  it('reliability_notes ausente = UN warning de archivo, nunca uno por fila', () => {
    const rows = [
      makeRow(),
      makeRow({ Id_Investment: 'CHL-0002', Id_Seq: 2, Coordinates: '-33.1, -71.1' })
    ]
    const r = run(rows)
    const w = warningsOf(r).filter((x) => x.rule === 'archivo/columna-sugerida-ausente')
    expect(w.map((x) => x.column)).toEqual(['reliability_notes'])
    expect(r.fileErrors).toEqual([])
    expect(r.stats.passed).toBe(true)
    expect(r.stats.validPct).toBe(100)
  })

  it('reliability_notes presente y vacía en casi todas las filas: sin aviso', () => {
    const rows = [
      makeRow({ reliability_notes: 'Dos fuentes confirman el monto.' }),
      makeRow({ Id_Investment: 'CHL-0002', Id_Seq: 2, Coordinates: '-33.1, -71.1', reliability_notes: null })
    ]
    const w = warningsOf(run(rows)).filter((x) => x.rule === 'archivo/columna-sugerida-ausente')
    expect(w).toEqual([])
  })

  it('columna extra desconocida = info, permitida', () => {
    const r = run([makeRow({ Location_ES: 'Santiago' })])
    expect(r.fileErrors).toEqual([])
    expect(r.issues.some((x) => x.severity === 'info' && x.rule === 'archivo/columna-extra')).toBe(true)
  })
})

describe('normalización (v1.4, determinista sin pérdida)', () => {
  it('apóstrofe en COUNTRY_ISO_NUM se limpia y NO es error', () => {
    const r = run([makeRow({ COUNTRY_ISO_NUM: "'152" })])
    expect(rules(errorsOf(r))).not.toContain('fila/iso-num')
    expect(r.curaciones.some((c) => c.rule === 'curacion/iso-apostrofe' && c.count === 1)).toBe(true)
  })

  it('Country en MAYÚSCULAS se canoniza y NO dispara país-desconocido', () => {
    const r = run([makeRow({ Country: 'CHILE' })])
    expect(rules(warningsOf(r))).not.toContain('fila/pais-desconocido')
    expect(r.curaciones.some((c) => c.rule === 'curacion/pais-canonico')).toBe(true)
  })

  it('Brasil/México (variante) se canoniza a Brazil/Mexico', () => {
    const r = validateRows(
      [makeRow({ Country: 'BRASIL', COUNTRY_ISO_NUM: '076', COUNTRY_ISO_ALPHA3: 'BRA', Id_Investment: 'BRA-0001' })],
      { filename: 'BRAZIL.xlsx' }
    )
    expect(rules(errorsOf(r))).not.toContain('fila/pais-archivo')
    expect(r.curaciones.some((c) => c.rule === 'curacion/pais-canonico')).toBe(true)
  })
})

describe('reglas de fila (errores)', () => {
  it('Year fuera de rango', () => {
    const r = run([makeRow({ Year: 1830 }), makeRow({ Id_Investment: 'CHL-0002', Id_Seq: 2, Year: 299 })])
    expect(errorsOf(r).filter((x) => x.rule === 'fila/year')).toHaveLength(2)
  })

  it('coordenadas no parseables o fuera de rango', () => {
    const r = run([makeRow({ Coordinates: 'ver mapa' }), makeRow({ Id_Investment: 'CHL-0002', Id_Seq: 2, Coordinates: '-133, -70' })])
    expect(errorsOf(r).filter((x) => x.rule === 'fila/coordenadas')).toHaveLength(2)
  })

  it('lat/lng invertidas = warning, con la caja de la región como respaldo', () => {
    // La Paz invertida: lng -16.5 queda al este del borde oriental de la región.
    const r = run([makeRow({ Coordinates: '-68.15, -16.5' })])
    expect(rules(warningsOf(r))).toContain('fila/coordenadas-sospechosas')
  })

  describe('la caja es la del PROPIO país, no una ventana regional fija', () => {
    // Cajas reales aproximadas. La regla vieja (lat < 15) marcaba Honduras entero.
    const bounds = { HND: [12.98, 16.51, -89.35, -83.15], CHL: [-55.98, -17.5, -75.64, -66.42] }

    it('Honduras al norte de 15°N ya no es sospechoso', () => {
      const r = run(
        [makeRow({ Id_Investment: 'HND-0001', Country: 'Honduras', COUNTRY_ISO_NUM: '340', COUNTRY_ISO_ALPHA3: 'HND', Coordinates: '15.81, -87.95' })],
        { filename: 'HONDURAS.xlsx', countryBounds: bounds }
      )
      expect(rules(warningsOf(r))).not.toContain('fila/coordenadas-sospechosas')
    })

    it('un punto dentro de la región pero fuera de su país sí avisa, y nombra el país', () => {
      // Punto peruano en un archivo chileno.
      const r = run([makeRow({ Coordinates: '-6.62, -76.88' })], { countryBounds: bounds })
      const w = warningsOf(r).find((x) => x.rule === 'fila/coordenadas-sospechosas')
      expect(w?.message).toContain('Chile')
    })

    it('el margen de 1° deja pasar un punto apenas fuera del borde', () => {
      const r = run([makeRow({ Coordinates: '-17.0, -70.0' })], { countryBounds: bounds })
      expect(rules(warningsOf(r))).not.toContain('fila/coordenadas-sospechosas')
    })

    it('país sin geometría cae a la caja de la región', () => {
      const r = run(
        [makeRow({ Id_Investment: 'BRB-0001', Country: 'Barbados', COUNTRY_ISO_NUM: '052', COUNTRY_ISO_ALPHA3: 'BRB', Coordinates: '13.19, -59.54' })],
        { filename: 'BARBADOS.xlsx', countryBounds: bounds }
      )
      expect(rules(warningsOf(r))).not.toContain('fila/coordenadas-sospechosas')
    })
  })

  it('Area_EN con valor ES, typo o Services, con hint', () => {
    const r = run([
      makeRow({ Area_EN: 'Energía' }),
      makeRow({ Id_Investment: 'CHL-0002', Id_Seq: 2, Area_EN: 'Energy ' }),
      makeRow({ Id_Investment: 'CHL-0003', Id_Seq: 3, Area_EN: 'Services' }),
      makeRow({ Id_Investment: 'CHL-0004', Id_Seq: 4, Area_EN: 'RealEstate', Area_ES: 'Bienes Raíces' })
    ])
    const errs = errorsOf(r).filter((x) => x.rule === 'fila/sector-en')
    expect(errs).toHaveLength(4)
    expect(errs[0].message).toContain('"Energy"') // hint del valor ES
    expect(errs[1].message).toContain('espacios de más')
    expect(errs[2].message).toContain('rechazado por la metodología')
    expect(errs[3].message).toContain('Real Estate')
  })

  it('Area_ES en conflicto CONCEPTUAL con Area_EN = warning (no bloquea, v1.4)', () => {
    // Minería (→Mining) vs Area_EN Energy: sectores distintos → conflicto real
    const r = run([makeRow({ Area_ES: 'Minería' })])
    expect(rules(warningsOf(r))).toContain('fila/sector-conflicto')
    expect(rules(errorsOf(r))).not.toContain('fila/sector-es')
  })

  it('Area_ES no canónica pero MISMO concepto no dispara nada (solo formato)', () => {
    // Agroindustria (→Agroindustry) con Area_EN Agroindustry: mismo sector, casing
    const r = run([makeRow({ Area_EN: 'Agroindustry', Area_ES: 'Agroindustria' })])
    expect(rules(warningsOf(r))).not.toContain('fila/sector-conflicto')
    expect(rules(errorsOf(r))).not.toContain('fila/sector-es')
  })

  it('Project_Type typo con hint', () => {
    const r = run([makeRow({ Project_Type: 'Adquisión' })])
    const err = errorsOf(r).find((x) => x.rule === 'fila/project-type')
    expect(err?.message).toContain('¿quiso decir "Adquisición"?')
  })

  it('Vector/Path inconsistentes', () => {
    const r = run([
      makeRow({ Vector: '0' }),
      makeRow({ Id_Investment: 'CHL-0002', Id_Seq: 2, Path: 3 }), // Punto con Path 3
      makeRow({ Id_Investment: 'CHL-0003', Id_Seq: 3, Vector: 'Vector', Path: 0 })
    ])
    expect(rules(errorsOf(r))).toContain('fila/vector')
    expect(errorsOf(r).filter((x) => x.rule === 'fila/path')).toHaveLength(2)
  })

  it('ISO inconsistente con país', () => {
    const r = run([makeRow({ COUNTRY_ISO_ALPHA3: 'ARG' }), makeRow({ Id_Investment: 'CHL-0002', Id_Seq: 2, COUNTRY_ISO_NUM: '32' })])
    expect(rules(errorsOf(r))).toContain('fila/iso-alpha3')
    expect(rules(errorsOf(r))).toContain('fila/iso-num')
  })

  it('requerido vacío', () => {
    const r = run([makeRow({ Investor: '  ' })])
    expect(rules(errorsOf(r))).toContain('fila/requerido-vacio')
  })

  it('Investment negativo y Stake fuera de rango', () => {
    const r = run([makeRow({ Investment: -5, Stake: 130 })])
    expect(rules(errorsOf(r))).toContain('fila/monto')
    expect(rules(errorsOf(r))).toContain('fila/stake')
  })

  it('país distinto al del archivo (flujo por país)', () => {
    const r = run([makeRow({ Country: 'Peru', COUNTRY_ISO_NUM: '604', COUNTRY_ISO_ALPHA3: 'PER', Id_Investment: 'PER-0001' })])
    expect(rules(errorsOf(r))).toContain('fila/pais-archivo')
  })

  it('archivo agregado (nombre no canónico) no exige país único, sí cadena por fila', () => {
    const r = validateRows(
      [makeRow(), makeRow({ Id_Investment: 'PER-0001', Id_Seq: 1, Country: 'Peru', COUNTRY_ISO_NUM: '604', COUNTRY_ISO_ALPHA3: 'PER' })],
      { filename: 'AUDITADO_COMPLETO.xlsx' }
    )
    expect(rules(errorsOf(r))).not.toContain('fila/pais-archivo')
    // el nombre no canónico igual se reporta como fileError de nombre
    expect(r.fileErrors.some((f) => f.rule === 'archivo/nombre')).toBe(true)
  })
})

describe('ids', () => {
  it('formato legado = warning con strictIds off, error con on', () => {
    const rows = [makeRow({ Id_Investment: '0019155', Id_Seq: null })]
    expect(rules(warningsOf(run(rows)))).toContain('fila/id-formato')
    expect(rules(errorsOf(run(rows, { strictIds: true })))).toContain('fila/id-formato')
  })

  it('prefijo != país = error siempre', () => {
    const r = run([makeRow({ Id_Investment: 'ARG-0001' })])
    expect(rules(errorsOf(r))).toContain('fila/id-prefijo')
  })

  it('Id_Investment inconsistente con Id_Seq', () => {
    const r = run([makeRow({ Id_Seq: 7 })]) // CHL-0001 vs esperado CHL-0007
    expect(rules(errorsOf(r))).toContain('fila/id-seq')
  })

  it('colisión: mismo id en dos países = error siempre (caso 0019100)', () => {
    const r = validateRows(
      [
        makeRow({ Id_Investment: '0019100', Id_Seq: null, Country: 'Colombia', COUNTRY_ISO_NUM: '170', COUNTRY_ISO_ALPHA3: 'COL' }),
        makeRow({ Id_Investment: '0019100', Id_Seq: null, Country: 'Venezuela', COUNTRY_ISO_NUM: '862', COUNTRY_ISO_ALPHA3: 'VEN', Coordinates: '8.5, -66.0' })
      ],
      { filename: 'base.xlsx' }
    )
    expect(rules(errorsOf(r))).toContain('fila/id-colision')
  })

  it('monto distinto entre filas del mismo id = warning sobreconteo', () => {
    const r = run([
      makeRow({ Vector: 'Vector', Path: 1 }),
      makeRow({ Vector: 'Vector', Path: 1, Coordinates: '-33.5, -70.7', Investment: 999 })
    ])
    expect(rules(warningsOf(r))).toContain('fila/monto-inconsistente')
  })

  // El caso que causó la vuelta del 15-08: filas nuevas agregadas al final del
  // archivo reusando un id que ya era de otra inversión del MISMO país. La regla
  // vieja sólo miraba el país, así que no lo veía.
  describe('colisión dentro del mismo país', () => {
    it('inversor Y año distintos bajo el mismo id = error', () => {
      const r = run([
        makeRow({ Investor: 'Maverick Motos', Year: 2007 }),
        makeRow({ Investor: 'Zijin Mining', Year: 2025, Coordinates: '-27.67, -67.62' })
      ])
      expect(rules(errorsOf(r))).toContain('fila/id-colision-intrapais')
      expect(r.excludedIds.has('CHL-0001')).toBe(true)
    })

    it('mismo inversor con tipografía distinta no dispara nada', () => {
      const r = run([
        makeRow({ Investor: 'Compañía  Eléctrica', Year: 2007 }),
        makeRow({ Investor: 'compania electrica', Year: 2025, Coordinates: '-33.5, -70.7' })
      ])
      expect(rules(errorsOf(r))).not.toContain('fila/id-colision-intrapais')
    })

    it('inversor distinto pero MISMO año = warning, no error (caso URY-0002)', () => {
      // Una inversión con el nombre a medio llenar, no dos inversiones: el
      // anillo de transmisión de Uruguay traía "Unidentified" en la primera de
      // sus 26 filas y "CMEC" en el resto. Sin el corte por año, la regla
      // marcaba las 25 filas restantes de un dato correcto.
      const r = run([
        makeRow({ Investor: 'Unidentified', Vector: 'Vector', Path: 1 }),
        makeRow({ Investor: 'CMEC', Vector: 'Vector', Path: 1, Coordinates: '-33.5, -70.7' })
      ])
      expect(rules(errorsOf(r))).not.toContain('fila/id-colision-intrapais')
      expect(rules(warningsOf(r))).toContain('fila/inversor-inconsistente')
      expect(r.excludedIds.size).toBe(0)
    })
  })
})

describe('cancelled (v1.5: la columna que parte mapa / descargable de canceladas)', () => {
  it('ya no se reporta como columna extra que el sistema ignora', () => {
    const r = run([makeRow({ cancelled: 0, cancelled_motivo: null })])
    const extra = r.issues.filter((x) => x.rule === 'archivo/columna-extra').map((x) => x.column)
    expect(extra).not.toContain('cancelled')
    expect(extra).not.toContain('cancelled_motivo')
  })

  it('valor fuera del enum = warning con el significado de 0 y 1', () => {
    const w = warningsOf(run([makeRow({ cancelled: 'Yes' })])).find((x) => x.rule === 'fila/cancelled')
    expect(w?.message).toContain('0 = vigente')
  })

  it('cancelled distinto entre filas de la misma inversión = warning', () => {
    const r = run([
      makeRow({ Vector: 'Vector', Path: 1, cancelled: 0 }),
      makeRow({ Vector: 'Vector', Path: 1, Coordinates: '-33.5, -70.7', cancelled: 1 })
    ])
    expect(rules(warningsOf(r))).toContain('fila/cancelled-inconsistente')
  })

  it('cancelled consistente no dispara nada', () => {
    const r = run([
      makeRow({ Vector: 'Vector', Path: 1, cancelled: 1 }),
      makeRow({ Vector: 'Vector', Path: 1, Coordinates: '-33.5, -70.7', cancelled: 1 })
    ])
    expect(rules(warningsOf(r)).filter((x) => x.startsWith('fila/cancelled'))).toEqual([])
  })
})

describe('registro: nombre de archivo por alias y Province_ISO', () => {
  const registry = parseCountriesCsv(
    [
      'alpha3,alpha2,numeric,name,aliases,filename,publish',
      'CHL,CL,152,Chile,,CHILE,yes',
      'TTO,TT,780,Trinidad and Tobago,Trinidad y Tobago,TRINIDAD_TOBAGO,no'
    ].join('\n')
  )
  const tto = (over = {}) =>
    makeRow({
      Id_Investment: 'TTO-0001', Id_Seq: 1, Country: 'Trinidad and Tobago',
      COUNTRY_ISO_NUM: '780', COUNTRY_ISO_ALPHA3: 'TTO', Coordinates: '10.66, -61.51',
      ...over
    })

  it('el nombre del país sirve de nombre de archivo, con curación en vez de bloqueo', () => {
    // El registro lo llama TRINIDAD_TOBAGO y el archivo llegó como
    // trinidad_and_tobago.xlsx. Rutear no es adivinar, y bloquear una entrega
    // entera por cómo se escribió el nombre era el bloqueo más caro y más barato
    // de sacar.
    const r = validateRows([tto()], { filename: 'trinidad_and_tobago.xlsx', registry })
    expect(r.fileErrors.some((f) => f.rule === 'archivo/nombre')).toBe(false)
    expect(r.curaciones.some((c) => c.rule === 'curacion/nombre-archivo')).toBe(true)
    expect(r.stats.passed).toBe(true)
  })

  it('un nombre que no rutea a ningún país sigue siendo error de archivo', () => {
    const r = validateRows([tto()], { filename: 'Datos finales (v3).xlsx', registry })
    expect(r.fileErrors.some((f) => f.rule === 'archivo/nombre')).toBe(true)
  })

  it('Province_ISO de otro país = warning (caso GUY-0003 con SR-NI)', () => {
    const r = validateRows([tto({ Province_ISO: 'SR-NI' })], { filename: 'TRINIDAD_TOBAGO.xlsx', registry })
    const w = warningsOf(r).find((x) => x.rule === 'fila/provincia-pais')
    expect(w?.message).toContain('"TT-"')
  })

  it('Province_ISO del país propio no dispara nada', () => {
    const r = validateRows([tto({ Province_ISO: 'TT-ARI' })], { filename: 'TRINIDAD_TOBAGO.xlsx', registry })
    expect(rules(warningsOf(r))).not.toContain('fila/provincia-pais')
  })

  it('sin columna alpha2 en el registro, la regla se salta sola', () => {
    const sinA2 = parseCountriesCsv(
      ['alpha3,numeric,name,aliases,filename,publish', 'TTO,780,Trinidad and Tobago,,TRINIDAD_TOBAGO,no'].join('\n')
    )
    const r = validateRows([tto({ Province_ISO: 'SR-NI' })], { filename: 'TRINIDAD_TOBAGO.xlsx', registry: sinA2 })
    expect(rules(warningsOf(r))).not.toContain('fila/provincia-pais')
  })
})

describe('ownership (v1.4, warning en adopción)', () => {
  it('valor del enum no dispara nada', () => {
    const r = run([makeRow({ Ownership: 'Central SOE' })])
    expect(rules(warningsOf(r))).not.toContain('fila/ownership')
  })

  it('SOE (no adoptó Local SOE) = warning con hint', () => {
    const r = run([makeRow({ Ownership: 'SOE' })])
    const w = warningsOf(r).find((x) => x.rule === 'fila/ownership')
    expect(w?.message).toContain('Local SOE')
    expect(rules(errorsOf(r))).not.toContain('fila/ownership') // no bota
  })

  it('SASAC (forma vieja) = warning → Central SOE', () => {
    const r = run([makeRow({ Ownership: 'SASAC' })])
    expect(warningsOf(r).find((x) => x.rule === 'fila/ownership')?.message).toContain('Central SOE')
  })
})

describe('inversor sin mapear (aviso para el steward, nunca bloquea)', () => {
  const map = new Set(['state grid'])

  it('sin investorMap no se chequea', () => {
    const r = run([makeRow({ Investor: 'Empresa Nueva' })])
    expect(rules(warningsOf(r))).not.toContain('fila/inversor-sin-mapear')
  })

  it('inversor conocido no dispara nada (match case-insensitive)', () => {
    const r = run([makeRow({ Investor: 'State Grid' })], { investorMap: map })
    expect(rules(warningsOf(r))).not.toContain('fila/inversor-sin-mapear')
  })

  it('inversor nuevo = warning, no error, y el archivo sigue pasando', () => {
    const r = run([makeRow({ Investor: 'Empresa Nueva' })], { investorMap: map })
    expect(rules(warningsOf(r))).toContain('fila/inversor-sin-mapear')
    expect(rules(errorsOf(r))).not.toContain('fila/inversor-sin-mapear')
    expect(r.stats.passed).toBe(true)
  })

  it('un aviso por nombre distinto, con el conteo de filas', () => {
    const rows = [
      makeRow({ Id_Investment: 'CHL-0001', Id_Seq: 1, Investor: 'Empresa Nueva' }),
      makeRow({ Id_Investment: 'CHL-0001', Id_Seq: 2, Investor: 'Empresa Nueva' }),
      makeRow({ Id_Investment: 'CHL-0002', Id_Seq: 1, Investor: 'Otra Nueva' })
    ]
    const w = warningsOf(run(rows, { investorMap: map })).filter((x) => x.rule === 'fila/inversor-sin-mapear')
    expect(w).toHaveLength(2)
    expect(w.find((x) => x.value === 'Empresa Nueva')?.message).toContain('2 filas')
    expect(w.find((x) => x.value === 'Otra Nueva')?.message).toContain('1 fila')
  })
})

describe('citas Research/News', () => {
  it('CasoN poblado sin Research=Yes ni News=Yes = warning cita invisible', () => {
    const r = run([makeRow({ Caso1: 'Informe CEPAL 2024', Link1: 'https://cepal.org/x' })])
    expect(rules(warningsOf(r))).toContain('fila/cita-invisible')
  })

  it('URL en CasoN = warning', () => {
    const r = run([makeRow({ Caso1: 'https://cepal.org/x', Research: 'Yes' })])
    expect(rules(warningsOf(r))).toContain('fila/caso-url')
  })

  it('Location con URL = warning', () => {
    const r = run([makeRow({ Location: 'https://maps.google.com/xyz' })])
    expect(rules(warningsOf(r))).toContain('fila/location-url')
  })
})

describe('geometría compartida', () => {
  it('2 ids con ≥2 coords idénticas = warning; 1 coord = silencio', () => {
    const shared = run([
      makeRow({ Vector: 'Vector', Path: 1 }),
      makeRow({ Vector: 'Vector', Path: 1, Coordinates: '-33.5, -70.7' }),
      makeRow({ Id_Investment: 'CHL-0002', Id_Seq: 2, Vector: 'Vector', Path: 1 }),
      makeRow({ Id_Investment: 'CHL-0002', Id_Seq: 2, Vector: 'Vector', Path: 1, Coordinates: '-33.5, -70.7' })
    ])
    expect(rules(warningsOf(shared))).toContain('archivo/geometria-compartida')

    const single = run([
      makeRow(),
      makeRow({ Id_Investment: 'CHL-0002', Id_Seq: 2 }) // comparte solo 1 coord
    ])
    expect(rules(warningsOf(single))).not.toContain('archivo/geometria-compartida')
  })
})

describe('confiabilidad (reliability_score, nunca bloquea)', () => {
  const scored = (over = {}) => makeRow({ reliability_score: 4, ...over })

  it('archivo sin la columna: un aviso de archivo, no uno por fila', () => {
    const r = run([makeRow(), makeRow({ Id_Investment: 'CHL-0002', Id_Seq: 2 })])
    const w = warningsOf(r).filter((x) => x.rule === 'archivo/sin-columna-confiabilidad')
    expect(w).toHaveLength(1)
    expect(rules(warningsOf(r))).not.toContain('fila/sin-puntaje-confiabilidad')
    expect(r.stats.passed).toBe(true)
  })

  it('inversión sin puntaje avisa UNA vez, aunque tenga muchos puntos', () => {
    const rows = [
      scored(),
      scored({ Id_Investment: 'CHL-0002', Id_Seq: 2, reliability_score: null, Vector: 'Vector', Path: 1, Coordinates: '-33.0, -71.0' }),
      scored({ Id_Investment: 'CHL-0002', Id_Seq: 2, reliability_score: null, Vector: 'Vector', Path: 1, Coordinates: '-33.1, -71.1' }),
      scored({ Id_Investment: 'CHL-0002', Id_Seq: 2, reliability_score: null, Vector: 'Vector', Path: 1, Coordinates: '-33.2, -71.2' })
    ]
    const w = warningsOf(run(rows)).filter((x) => x.rule === 'fila/sin-puntaje-confiabilidad')
    expect(w).toHaveLength(1)
    expect(w[0].message).toContain('CHL-0002')
  })

  it('el puntaje no bota el archivo ni invalida la fila', () => {
    const r = run([scored({ reliability_score: null })])
    expect(errorsOf(r)).toEqual([])
    expect(r.stats.passed).toBe(true)
    expect(r.stats.validPct).toBe(100)
  })

  it('valor fuera de la rúbrica avisa', () => {
    const r = run([scored({ reliability_score: 7 }), scored({ Id_Investment: 'CHL-0002', Id_Seq: 2, reliability_score: 'alto' })])
    expect(rules(warningsOf(r)).filter((x) => x === 'fila/puntaje-confiabilidad-invalido')).toHaveLength(2)
  })

  it('puntajes distintos entre filas de la misma inversión avisan', () => {
    const rows = [
      scored({ Vector: 'Vector', Path: 1, reliability_score: 4 }),
      scored({ Vector: 'Vector', Path: 1, reliability_score: 2, Coordinates: '-33.1, -71.1' })
    ]
    const w = warningsOf(run(rows)).filter((x) => x.rule === 'fila/puntaje-confiabilidad-inconsistente')
    expect(w).toHaveLength(1)
  })

  it('inversión con puntaje válido no genera aviso', () => {
    const r = run([scored({ reliability_score: 0 }), scored({ Id_Investment: 'CHL-0002', Id_Seq: 2, reliability_score: 5 })])
    expect(rules(warningsOf(r)).some((x) => x.startsWith('fila/puntaje') || x === 'fila/sin-puntaje-confiabilidad')).toBe(false)
  })
})

describe('compuerta: estructural por archivo, contenido por inversión', () => {
  const mk = (n, bad) =>
    Array.from({ length: n }, (_, i) =>
      makeRow({ Id_Investment: `CHL-${String(i + 1).padStart(4, '0')}`, Id_Seq: i + 1, Year: i < bad ? 1800 : 2020 })
    )

  it('el % de filas malas ya NO bota el archivo: se caen las inversiones, no el país', () => {
    // Antes esto era la compuerta: bajo 95% de filas válidas el país entero
    // quedaba fuera del mapa, y una celda vacía bastaba. Ahora `passed` sólo
    // responde "¿se puede leer el archivo?".
    const r = run(mk(50, 40)) // 20% válidas
    expect(r.stats.passed).toBe(true)
    expect(r.stats.validPct).toBe(20)
    expect(r.excludedIds.size).toBe(40)
  })

  it('un problema de estructura sí bota el archivo entero', () => {
    const r = run([makeRow({ Investment_ARREGLADO: 100 })])
    expect(r.stats.passed).toBe(false)
  })

  it('la unidad es la inversión: una fila mala saca TODAS las filas de esa inversión', () => {
    // Un vector de 3 puntos con una coordenada rota. Si se botara sólo la fila,
    // el trazado quedaría mutilado en silencio.
    const vec = (over) => makeRow({ Id_Investment: 'CHL-0009', Id_Seq: 9, Vector: 'Vector', Path: 1, ...over })
    const r = run([
      vec({ Coordinates: '-33.0, -71.0' }),
      vec({ Coordinates: 'no es una coordenada' }),
      vec({ Coordinates: '-33.2, -71.2' }),
      makeRow({ Id_Investment: 'CHL-0010', Id_Seq: 10 })
    ])
    expect([...r.excludedIds]).toEqual(['CHL-0009'])
    expect(r.excludedIds.has('CHL-0010')).toBe(false)
  })

  it('archivo sano no excluye nada y cuenta sus inversiones', () => {
    const r = run([makeRow(), makeRow({ Id_Investment: 'CHL-0002', Id_Seq: 2 })])
    expect(r.excludedIds.size).toBe(0)
    expect(r.stats.investments).toBe(2)
  })

  it('filas en blanco no cuentan al umbral', () => {
    const blank = Object.fromEntries(Object.keys(makeRow()).map((k) => [k, null]))
    const r = run([makeRow(), blank])
    expect(r.stats.consideredRows).toBe(1)
    expect(r.stats.validPct).toBe(100)
  })
})

describe('Joint_Venture (columna legada, opcional, nunca bloquea)', () => {
  // Se conserva como dummy: mal codificada y sin criterio, la app no la usa, pero el
  // dato no se pierde. No hay regla de socio asociada (la propuesta Socio_No_Chino
  // nunca se aprobó).
  it('en Yes no genera ningun aviso ni bota el archivo', () => {
    const r = run([makeRow({ Joint_Venture: 'Yes' })])
    expect(errorsOf(r)).toEqual([])
    expect(r.stats.passed).toBe(true)
    expect(r.stats.validPct).toBe(100)
  })

  it('no sale como columna extra en el informe', () => {
    const r = run([makeRow({ Joint_Venture: 'Yes' })])
    const extra = (r.issues || []).filter((x) => x.rule === 'archivo/columna-extra')
    expect(extra.map((x) => x.column)).not.toContain('Joint_Venture')
  })
})
