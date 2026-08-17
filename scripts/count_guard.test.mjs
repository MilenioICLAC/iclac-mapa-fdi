import { describe, it, expect } from 'vitest'
import {
  countInvestments, parseExpectedCounts, formatExpectedCounts, checkCounts, DROP_THRESHOLD
} from './lib/count_guard.mjs'

describe('conteo de inversiones', () => {
  it('cuenta ids distintos, no filas', () => {
    const rows = [
      { Id_Investment: 'ARG-0001' },
      { Id_Investment: 'ARG-0001' },
      { Id_Investment: 'ARG-0002' }
    ]
    expect(countInvestments(rows)).toBe(2)
  })

  it('ignora filas sin id y tolera vacíos', () => {
    expect(countInvestments([{ Id_Investment: null }, { Id_Investment: '  ' }, {}])).toBe(0)
    expect(countInvestments([])).toBe(0)
    expect(countInvestments(undefined)).toBe(0)
  })
})

describe('línea base', () => {
  it('parsear y formatear son inversos', () => {
    const counts = { BRA: 163, ARG: 52, CHL: 51 }
    expect(parseExpectedCounts(formatExpectedCounts(counts))).toEqual(counts)
  })

  it('se escribe ordenada, para que el diff se lea', () => {
    expect(formatExpectedCounts({ VEN: 20, ARG: 52 })).toBe('alpha3,investments\nARG,52\nVEN,20\n')
  })

  it('un archivo vacío o sin las columnas esperadas no rompe', () => {
    expect(parseExpectedCounts('')).toEqual({})
    expect(parseExpectedCounts('foo,bar\n1,2')).toEqual({})
  })
})

describe('la guardia dispara con el accidente, no con la edición normal', () => {
  const base = { BRA: 163, ARG: 52, VEN: 20 }

  it('archivo que desaparece', () => {
    const { problems } = checkCounts(base, { BRA: 163, ARG: 52 })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatchObject({ alpha3: 'VEN', kind: 'archivo-ausente' })
  })

  it('archivo que queda sin inversiones', () => {
    const { problems } = checkCounts(base, { ...base, VEN: 0 })
    expect(problems[0]).toMatchObject({ alpha3: 'VEN', kind: 'vacio' })
  })

  it('caída grande, con el porcentaje en el mensaje', () => {
    const { problems } = checkCounts(base, { ...base, BRA: 16 })
    expect(problems[0].kind).toBe('caida')
    expect(problems[0].message).toContain('90%')
  })

  // La regla del repositorio: un validador que grita sobre datos correctos deja de
  // leerse. Sacar unas inversiones de un país es trabajo normal.
  it('una caída chica NO dispara', () => {
    const { problems } = checkCounts(base, { ...base, BRA: Math.ceil(163 * (1 - DROP_THRESHOLD)) })
    expect(problems).toEqual([])
  })

  it('crecer nunca dispara', () => {
    expect(checkCounts(base, { BRA: 400, ARG: 52, VEN: 20 }).problems).toEqual([])
  })

  it('un país nuevo se informa pero no bloquea', () => {
    const { problems, nuevos } = checkCounts(base, { ...base, CUB: 4 })
    expect(problems).toEqual([])
    expect(nuevos).toEqual(['CUB'])
  })

  // El registro lleva 32 países y sólo 17 tienen archivo: si la guardia mirara el
  // registro en vez de la línea base, marcaría quince países correctos.
  it('un país del registro que nunca tuvo archivo no existe para la guardia', () => {
    expect(checkCounts({}, {}).problems).toEqual([])
    expect(checkCounts({ ARG: 52 }, { ARG: 52 }).problems).toEqual([])
  })
})
