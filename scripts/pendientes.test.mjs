import { describe, it, expect } from 'vitest'
import { buildPendientes, HOJAS_POR_DUENO } from './lib/pendientes.mjs'
import { RULE_HELP } from './lib/rules_help.mjs'

const resultado = (over = {}) => ({
  name: 'argentina.xlsx',
  fileErrors: [],
  issues: [],
  stats: { passed: true, investments: 2, rows: 3 },
  curaciones: [],
  excludedIds: [],
  rows: [
    { Id_Investment: 'ARG-0001', Investor: 'Maverick Motos' },
    { Id_Investment: 'ARG-0002', Investor: 'Zijin Mining' }
  ],
  published: true,
  ...over
})

const issue = (over = {}) => ({
  severity: 'error', rule: 'fila/requerido-vacio', row: 2, column: 'Project_Type', value: null,
  message: 'La columna obligatoria "Project_Type" está vacía.',
  ...over
})

describe('planilla de pendientes', () => {
  it('corta por dueño del arreglo, no por país', () => {
    const r = resultado({
      issues: [
        issue(), // contenido
        issue({ severity: 'warning', rule: 'fila/inversor-sin-mapear', row: 3 }), // tabla-inversores
        issue({ severity: 'warning', rule: 'fila/iso-num', row: 3 }) // formato
      ]
    })
    const { hojas } = buildPendientes([r])
    expect(hojas.map((h) => h.nombre)).toEqual(['Contenido', 'Formato', 'Tabla de inversores'])
  })

  it('las hojas sin nada no se emiten', () => {
    const { hojas } = buildPendientes([resultado({ issues: [issue()] })])
    expect(hojas).toHaveLength(1)
    expect(hojas[0].nombre).toBe('Contenido')
  })

  it('cada fila se entiende sola, sin el informe al lado', () => {
    const { hojas } = buildPendientes([resultado({ issues: [issue()], excludedIds: ['ARG-0001'] })])
    const fila = hojas[0].filas[0]
    expect(fila).toMatchObject({
      'País': 'argentina',
      'Id_Investment': 'ARG-0001',
      'Fila': 2,
      'Inversor': 'Maverick Motos',
      'Bloquea': 'Sí',
      '¿Publica hoy?': 'No',
      'Corregido': ''
    })
    expect(fila['Cómo se corrige']).toBe(RULE_HELP['fila/requerido-vacio'].fix)
  })

  it('marca que publica cuando la inversión no está excluida', () => {
    const { hojas } = buildPendientes([resultado({ issues: [issue({ severity: 'warning' })] })])
    expect(hojas[0].filas[0]['¿Publica hoy?']).toBe('Sí')
    expect(hojas[0].filas[0].Bloquea).toBe('No')
  })

  it('los problemas de archivo entran, sin fila', () => {
    const r = resultado({
      fileErrors: [{ rule: 'archivo/nombre', message: 'El nombre no corresponde a un país.' }]
    })
    const { hojas, total } = buildPendientes([r])
    expect(total).toBe(1)
    expect(hojas[0].filas[0]).toMatchObject({ 'Fila': '', 'Bloquea': 'Sí' })
  })

  it('los informativos NO entran: convertirían el encargo en ruido', () => {
    const r = resultado({ issues: [issue({ severity: 'info', rule: 'archivo/columna-extra' })] })
    expect(buildPendientes([r]).total).toBe(0)
  })

  it('un archivo ilegible no rompe la planilla', () => {
    expect(buildPendientes([{ name: 'x.xlsx', error: 'no se pudo leer' }]).total).toBe(0)
    expect(buildPendientes([]).total).toBe(0)
  })

  it('los bloqueantes van primero dentro de la hoja', () => {
    const r = resultado({
      issues: [issue({ severity: 'warning', row: 2 }), issue({ severity: 'error', row: 3 })]
    })
    expect(buildPendientes([r]).hojas[0].filas.map((f) => f.Bloquea)).toEqual(['Sí', 'No'])
  })

  // Excel corta los nombres de hoja en 31 caracteres: "Encargado de la tabla de
  // inversores" (35) no cabe, y dos hojas truncadas al mismo prefijo romperían el
  // archivo entero.
  it('los nombres de hoja caben en Excel y son únicos', () => {
    const nombres = HOJAS_POR_DUENO.map((h) => h.hoja)
    for (const n of nombres) expect(n.length).toBeLessThanOrEqual(31)
    expect(new Set(nombres).size).toBe(nombres.length)
  })

  it('todo tipo de RULE_HELP tiene una hoja donde caer', () => {
    const tipos = new Set(Object.values(RULE_HELP).map((h) => h.tipo))
    const conHoja = new Set(HOJAS_POR_DUENO.map((h) => h.tipo))
    for (const t of tipos) expect(conHoja.has(t)).toBe(true)
  })
})
