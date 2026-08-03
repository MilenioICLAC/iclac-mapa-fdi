// Núcleo puro del validador de la TABLA DE INVERSORES (data/schema/investors_map.csv).
// Convención (24-07): la base por país lleva el nombre RAW del inversor; la
// identidad canónica y la propiedad viven acá, en la tabla de inversores, que
// también pasa por el validador. Consumido por scripts/validate_investors.mjs.
//
// Reglas: columnas requeridas, enum de ownership, is_consortium booleano,
// investor_raw único, mapeo company_id ↔ company_canonical 1:1, y ownership
// consistente por company_id (una empresa no puede tener dos clasificaciones).

import { OWNERSHIP_TYPES } from './validate.mjs'

const REQUIRED = ['investor_raw', 'company_id', 'company_canonical', 'is_consortium', 'ownership']
const s = (v) => (v == null ? '' : String(v).trim())

/**
 * @param {Array<Record<string, unknown>>} rows filas del CSV (objetos por columna)
 * @returns {{ issues: Array, stats: { rows, errors, warnings, passed } }}
 */
export const validateInvestors = (rows) => {
  const issues = []
  const push = (severity, rule, row, column, value, message) =>
    issues.push({ severity, rule, row, column, value, message })

  const columns = rows.length ? Object.keys(rows[0]) : []
  for (const c of REQUIRED) {
    if (!columns.includes(c)) push('error', 'archivo/columna-requerida', 0, c, null, `Falta la columna obligatoria "${c}".`)
  }

  const rawSeen = new Map() // investor_raw -> fila
  const canonToId = new Map() // company_canonical -> company_id
  const idToCanon = new Map() // company_id -> company_canonical
  const idOwnership = new Map() // company_id -> Map(ownership -> fila)

  rows.forEach((r, i) => {
    const row = i + 2
    const raw = s(r.investor_raw)
    const id = s(r.company_id)
    const canon = s(r.company_canonical)
    const cons = s(r.is_consortium).toLowerCase()
    const own = s(r.ownership)
    const members = s(r.members)
    // origin_country vacío significa China: es un registro de inversores chinos, así que
    // ese es el default correcto. Un olvido no pasa desapercibido, porque una fila sin
    // ownership y sin origin_country cae en fila/ownership-vacio.
    const origen = s(r.origin_country)
    const noChina = origen !== '' && origen.toLowerCase() !== 'china'

    if (!raw) push('error', 'fila/raw-vacio', row, 'investor_raw', null, 'investor_raw vacío.')
    if (!id) push('error', 'fila/id-vacio', row, 'company_id', null, 'company_id vacío.')
    if (!canon) push('error', 'fila/canonico-vacio', row, 'company_canonical', null, 'company_canonical vacío.')

    // La propiedad es atributo de una EMPRESA. Un consorcio es una relación entre
    // empresas y no tiene dueño: su propiedad sale de los miembros, en el momento de
    // leerla. Por eso el vacío está reservado para marcar "esto no es una empresa", y
    // por eso las dos reglas son simétricas.
    if (cons === 'true') {
      // El estado de revisión de un consorcio no es un estado de trabajo: su propiedad
      // no se guarda nunca, se resuelve desde members al leerla. "derived" lo dice; un
      // "pendiente" prometería un paso futuro que no existe.
      const st = s(r.ownership_status)
      if (st && st !== 'derived') {
        push('error', 'fila/consorcio-estado', row, 'ownership_status', st,
          `La fila es un consorcio y su ownership_status es "${st}". Debe ser "derived": su propiedad se calcula desde members, no se revisa ni se completa.`)
      }
      if (own) {
        push('error', 'fila/consorcio-con-ownership', row, 'ownership', own,
          `La fila es un consorcio y trae ownership "${own}". Un consorcio es un acuerdo entre empresas, no una empresa: no tiene propiedad propia, se calcula desde members. Dejar la celda vacía.`)
      }
    } else if (noChina) {
      // La propiedad tampoco aplica a un socio no chino: el enum describe estructura de
      // capital china. Vacío = "no aplica", con dos razones posibles, relación o empresa
      // no china, que se distinguen por is_consortium y origin_country.
      if (own) {
        push('error', 'fila/no-china-con-ownership', row, 'ownership', own,
          `La fila es un socio no chino (origin_country "${origen}") y trae ownership "${own}". El enum de propiedad describe estructura de capital china y no le aplica: dejar la celda vacía.`)
      }
    } else if (!own) {
      push('error', 'fila/ownership-vacio', row, 'ownership', null,
        'ownership vacío en una empresa china. El vacío está reservado para consorcios y socios no chinos; si la propiedad no se conoce, va UNKNOWN.')
    } else if (!OWNERSHIP_TYPES.includes(own)) {
      push('error', 'fila/ownership', row, 'ownership', own, `ownership "${own}" fuera del enum (${OWNERSHIP_TYPES.join(', ')}).`)
    }
    if (cons && cons !== 'true' && cons !== 'false') {
      push('error', 'fila/consorcio', row, 'is_consortium', cons, `is_consortium debe ser "true" o "false" (recibido "${cons}").`)
    }
    if (cons === 'true' && !members) {
      push('warning', 'fila/consorcio-sin-miembros', row, 'members', null, 'is_consortium=true pero members está vacío.')
    }
    if (cons === 'false' && members) {
      push('warning', 'fila/miembros-sin-consorcio', row, 'members', members, 'members poblado pero is_consortium=false.')
    }

    if (raw) {
      if (rawSeen.has(raw)) push('error', 'fila/raw-duplicado', row, 'investor_raw', raw, `investor_raw "${raw}" duplicado (ya en fila ${rawSeen.get(raw)}).`)
      else rawSeen.set(raw, row)
    }

    if (id && canon) {
      if (canonToId.has(canon) && canonToId.get(canon) !== id) {
        push('error', 'fila/canonico-multi-id', row, 'company_id', id,
          `company_canonical "${canon}" aparece con dos company_id distintos ("${canonToId.get(canon)}" y "${id}").`)
      } else canonToId.set(canon, id)
      if (idToCanon.has(id) && idToCanon.get(id) !== canon) {
        push('error', 'fila/id-multi-canonico', row, 'company_canonical', canon,
          `company_id "${id}" aparece con dos company_canonical distintos ("${idToCanon.get(id)}" y "${canon}").`)
      } else idToCanon.set(id, canon)
    }

    if (id && own) {
      if (!idOwnership.has(id)) idOwnership.set(id, new Map())
      idOwnership.get(id).set(own, row)
    }
  })

  // Ownership inconsistente por company_id (una empresa, una clasificación).
  for (const [id, owns] of idOwnership) {
    if (owns.size > 1) {
      const list = [...owns.keys()].join(', ')
      const firstRow = Math.min(...owns.values())
      push('error', 'empresa/ownership-inconsistente', firstRow, 'ownership', list,
        `El company_id "${id}" tiene ownership inconsistente entre sus filas: ${list}. Una empresa debe tener una sola clasificación.`)
    }
  }

  const errors = issues.filter((x) => x.severity === 'error').length
  const warnings = issues.filter((x) => x.severity === 'warning').length
  return { issues, stats: { rows: rows.length, errors, warnings, passed: errors === 0 } }
}
