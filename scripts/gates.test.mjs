import { describe, it, expect } from 'vitest'
import {
  MIN_SCORE_DEFAULT,
  isCancelled,
  scoreOf,
  passesScore,
  exclusionReason,
  investmentDestinies
} from './lib/gates.mjs'

describe('isCancelled', () => {
  it('es un enum cerrado: sólo el 1 cancela', () => {
    expect(isCancelled(1)).toBe(true)
    expect(isCancelled('1')).toBe(true)
    expect(isCancelled(' 1 ')).toBe(true)
    for (const v of [0, '0', '', null, undefined, 'sí', 'true', 'x', 2]) {
      expect(isCancelled(v)).toBe(false)
    }
  })
})

describe('scoreOf', () => {
  it('distingue vacío de cero', () => {
    expect(scoreOf(null)).toBeNull()
    expect(scoreOf('')).toBeNull()
    expect(scoreOf('   ')).toBeNull()
    expect(scoreOf(0)).toBe(0)
    expect(scoreOf('3')).toBe(3)
    // Texto que no es número: no se inventa un puntaje.
    expect(scoreOf('alto')).toBeNull()
  })
})

describe('passesScore', () => {
  it('sin puntaje pasa: "sin revisar" no es "revisado y sin evidencia"', () => {
    expect(passesScore(null)).toBe(true)
  })

  it('el umbral es el mínimo que se publica', () => {
    expect(MIN_SCORE_DEFAULT).toBe(3)
    expect(passesScore(2)).toBe(false)
    expect(passesScore(3)).toBe(true)
    expect(passesScore(0)).toBe(false)
  })
})

describe('exclusionReason', () => {
  const base = { excluida: false, cancelada: false, scores: [5] }

  it('publica cuando pasa todo', () => {
    expect(exclusionReason(base)).toBeNull()
  })

  // El orden no es arbitrario: decirle a alguien "está cancelada" cuando además
  // tiene una fila rota lo manda a no hacer nada.
  it('el error de esquema gana sobre la cancelación y sobre el puntaje', () => {
    expect(exclusionReason({ excluida: true, cancelada: true, scores: [1] })).toBe('contenido')
  })

  it('la cancelación gana sobre el puntaje', () => {
    expect(exclusionReason({ ...base, cancelada: true, scores: [1] })).toBe('cancelada')
  })

  it('basta una fila bajo el umbral', () => {
    expect(exclusionReason({ ...base, scores: [5, 5, 2] })).toBe('evidencia')
    expect(exclusionReason({ ...base, scores: [5, null] })).toBeNull()
  })

  it('un país retenido tampoco publica', () => {
    expect(exclusionReason({ ...base, retenido: true })).toBe('retenido')
  })

  // Entre los motivos "ya decididos" gana el que va a seguir siendo cierto cuando
  // los demás se resuelvan: la retención del país se levanta con un publish=yes,
  // el umbral de evidencia se levanta con fuentes nuevas, y una cancelación no.
  it('la retención es el último, porque es el más temporal', () => {
    expect(exclusionReason({ ...base, retenido: true, cancelada: true })).toBe('cancelada')
    expect(exclusionReason({ ...base, retenido: true, scores: [1] })).toBe('evidencia')
  })
})

describe('investmentDestinies', () => {
  const filas = [
    { Id_Investment: 'CHL-0001', reliability_score: 5, cancelled: 0 },
    { Id_Investment: 'CHL-0001', reliability_score: 5, cancelled: 0 },
    { Id_Investment: 'CHL-0002', reliability_score: 1, cancelled: 0 },
    { Id_Investment: 'CHL-0003', reliability_score: 5, cancelled: 1 },
    { Id_Investment: 'CHL-0004', reliability_score: null, cancelled: null }
  ]

  it('resuelve el destino de cada inversión', () => {
    const d = investmentDestinies(filas)
    expect(d.get('CHL-0001')).toEqual({ publica: true, motivo: null })
    expect(d.get('CHL-0002')).toEqual({ publica: false, motivo: 'evidencia' })
    expect(d.get('CHL-0003')).toEqual({ publica: false, motivo: 'cancelada' })
    expect(d.get('CHL-0004')).toEqual({ publica: true, motivo: null })
  })

  it('la compuerta de contenido entra por excludedIds', () => {
    const d = investmentDestinies(filas, { excludedIds: ['CHL-0001'] })
    expect(d.get('CHL-0001')).toEqual({ publica: false, motivo: 'contenido' })
  })

  // `cancelled` es atributo de la inversión y debe repetirse en todas sus filas.
  // Si llega a medias, la inversión ENTERA cuenta como cancelada: es el mismo corte
  // que hace el ETL, porque partirla mandaría medio trazado a cada archivo.
  it('una sola fila cancelada cancela la inversión entera', () => {
    const d = investmentDestinies([
      { Id_Investment: 'X-1', reliability_score: 5, cancelled: 0 },
      { Id_Investment: 'X-1', reliability_score: 5, cancelled: 1 }
    ])
    expect(d.get('X-1').motivo).toBe('cancelada')
  })

  it('respeta un umbral distinto', () => {
    expect(investmentDestinies(filas, { minScore: 0 }).get('CHL-0002').publica).toBe(true)
  })

  it('ignora las filas sin id', () => {
    expect(investmentDestinies([{ Id_Investment: '  ', reliability_score: 1 }]).size).toBe(0)
  })

  // La compuerta de publicación es del ARCHIVO, no de la fila: sin esto un país
  // retenido mostraba «publica: sí» en todas sus inversiones.
  it('la retención del país alcanza a todas sus inversiones', () => {
    const d = investmentDestinies(filas, { retenido: true })
    expect(d.get('CHL-0001')).toEqual({ publica: false, motivo: 'retenido' })
    expect(d.get('CHL-0004')).toEqual({ publica: false, motivo: 'retenido' })
    // Y no tapa un motivo más durable.
    expect(d.get('CHL-0003').motivo).toBe('cancelada')
  })
})
