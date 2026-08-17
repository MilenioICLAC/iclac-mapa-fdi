import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildFindings, groupByTipo } from './lib/findings.mjs'
import { withInteract } from './lib/report_render.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Un resultado como el que devuelve validateRows, con lo mínimo para el modelo.
const resultado = (over = {}) => ({
  name: 'chile.xlsx',
  fileErrors: [],
  issues: [],
  curaciones: [],
  excludedIds: [],
  rows: [
    { Id_Investment: 'CHL-0001', Investor: 'CNOOC' },
    { Id_Investment: 'CHL-0002', Investor: 'Zijin' }
  ],
  stats: { rows: 2, investments: 2 },
  published: true,
  ...over
})

const issue = (over = {}) => ({
  severity: 'error',
  rule: 'fila/requerido-vacio',
  row: 2,
  column: 'Project_Type',
  value: null,
  message: 'Falta un valor requerido.',
  ...over
})

describe('buildFindings', () => {
  it('cuelga cada hallazgo de su fila, su inversión y su inversor', () => {
    const [f] = buildFindings([resultado({ issues: [issue()] })])
    expect(f).toMatchObject({
      archivo: 'chile.xlsx',
      pais: 'chile',
      id: 'CHL-0001',
      fila: 2,
      columna: 'Project_Type',
      inversor: 'CNOOC',
      tipo: 'contenido',
      bloquea: true
    })
    // El título sale de RULE_HELP, no de la regla cruda.
    expect(f.titulo).not.toBe(f.regla)
  })

  it('marca publicaHoy en false cuando la inversión quedó excluida', () => {
    const fs = buildFindings([
      resultado({ issues: [issue(), issue({ row: 3 })], excludedIds: ['CHL-0001'] })
    ])
    const uno = fs.find((f) => f.id === 'CHL-0001')
    expect(uno.publicaHoy).toBe(false)
    expect(uno.motivoNoPublica).toBe('contenido')
    // Un error de esquema SÍ se arregla editando el archivo.
    expect(uno.corregible).toBe(true)
    expect(fs.find((f) => f.id === 'CHL-0002').publicaHoy).toBe(true)
  })

  // Antes `publicaHoy` sólo miraba la compuerta de contenido, así que decía "sí"
  // sobre una inversión que el sitio manda al anexo, y eso salía impreso en la
  // planilla que se le pasa a otra persona.
  it('ve las compuertas de cancelación y de evidencia, no sólo la de contenido', () => {
    const fs = buildFindings([
      resultado({
        rows: [
          { Id_Investment: 'CHL-0001', Investor: 'CNOOC', cancelled: 1, reliability_score: 5 },
          { Id_Investment: 'CHL-0002', Investor: 'Zijin', cancelled: 0, reliability_score: 1 }
        ],
        issues: [issue(), issue({ row: 3 })]
      })
    ])
    const cancelada = fs.find((f) => f.id === 'CHL-0001')
    const flaca = fs.find((f) => f.id === 'CHL-0002')
    expect(cancelada.publicaHoy).toBe(false)
    expect(cancelada.motivoNoPublica).toBe('cancelada')
    expect(flaca.motivoNoPublica).toBe('evidencia')
    // Ninguna de las dos se arregla editando el archivo: corregirles el formato
    // es trabajo tirado, y el filtro de la página cuelga de esto.
    expect(cancelada.corregible).toBe(false)
    expect(flaca.corregible).toBe(false)
  })

  it('deja los problemas de archivo con fila 0 y sin inversión', () => {
    const [f] = buildFindings([
      resultado({ fileErrors: [{ rule: 'archivo/hojas', message: 'Tiene 3 hojas.' }] })
    ])
    expect(f.fila).toBe(0)
    expect(f.id).toBe('')
    expect(f.bloquea).toBe(true)
    // Sin inversión de la cual colgar, la pregunta "¿publica hoy?" no aplica.
    expect(f.publicaHoy).toBeNull()
  })

  it('descarta los info: son columnas extra permitidas y meterlas es ruido', () => {
    const fs = buildFindings([
      resultado({ issues: [issue({ severity: 'info', rule: 'archivo/columna-extra' }), issue()] })
    ])
    expect(fs).toHaveLength(1)
    expect(fs[0].severidad).toBe('error')
  })

  it('ignora los archivos que no se pudieron abrir', () => {
    expect(buildFindings([{ name: 'roto.xlsx', error: 'no se pudo leer' }])).toEqual([])
  })

  it('ordena bloqueantes primero, después por país y por fila', () => {
    const fs = buildFindings([
      resultado({
        name: 'peru.xlsx',
        issues: [issue({ row: 3, severity: 'warning', rule: 'fila/caso-url' }), issue({ row: 5 })]
      }),
      resultado({ name: 'chile.xlsx', issues: [issue({ row: 9 })] })
    ])
    expect(fs.map((f) => [f.pais, f.fila, f.bloquea])).toEqual([
      ['chile', 9, true],
      ['peru', 5, true],
      ['peru', 3, false]
    ])
  })
})

describe('groupByTipo', () => {
  it('respeta el orden pedido y no pierde un tipo que no estaba en la lista', () => {
    const fs = buildFindings([
      resultado({
        issues: [
          issue({ rule: 'fila/iso-num' }), // formato
          issue({ rule: 'fila/requerido-vacio' }), // contenido
          issue({ rule: 'fila/provincia-pais' }) // revisar
        ]
      })
    ])
    const g = groupByTipo(fs, ['revisar', 'contenido'])
    expect([...g.keys()]).toEqual(['revisar', 'contenido', 'formato'])
  })
})

describe('withInteract', () => {
  // Este test existe por un bug que se publicó sin ruido: el informe se veía bien
  // pero no tenía pestañas ni filtros, porque `String.replace` con una CADENA de
  // reemplazo convierte `$$` en `$`.
  it('mete el módulo sin tocarle un caracter', () => {
    const src = 'const $$ = (s) => [...document.querySelectorAll(s)]\nexport const wireReport = () => $$("li")'
    const out = withInteract('<html><body><p>hola</p></body></html>', src)
    expect(out).toContain(src)
    expect(out).toContain('const $$ = ')
    expect(out).not.toContain('const $ = ')
  })

  it('llama a wireReport y deja el cierre de body después del script', () => {
    const out = withInteract('<html><body>x</body></html>', 'export const wireReport = () => {}')
    expect(out.indexOf('wireReport(document)')).toBeLessThan(out.indexOf('</body>'))
  })

  it('en modo fragmento no busca el body, agrega al final', () => {
    const out = withInteract('<div>x</div>', 'export const wireReport = () => {}', { fragment: true })
    expect(out.startsWith('<div>x</div>')).toBe(true)
    expect(out).toContain('wireReport(document)')
  })

  it('falla ruidosamente si el módulo trae una etiqueta de cierre de script', () => {
    const veneno = 'const t = "<' + '/script>"'
    expect(() => withInteract('<html><body>x</body></html>', veneno)).toThrow(/cierre de script/)
  })
})

describe('el módulo de interacción real', () => {
  it('no contiene ninguna etiqueta de cierre de script, ni en comentarios', () => {
    const src = readFileSync(resolve(__dirname, 'lib', 'report_interact.mjs'), 'utf8')
    expect(/<\/script/i.test(src)).toBe(false)
  })

  it('sobrevive al inlineado tal como está hoy', () => {
    const src = readFileSync(resolve(__dirname, 'lib', 'report_interact.mjs'), 'utf8')
    expect(withInteract('<html><body>x</body></html>', src)).toContain(src)
  })
})
