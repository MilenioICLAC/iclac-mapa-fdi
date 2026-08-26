import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Investment, ResearchCase } from '@/types/data'
import { sectorColor } from '@/lib/sectors'
import { flatList, groupByCountry, localizedArea, localizedDetail, studyHref, type CardSort } from '@/lib/projectDocs'
import { formatUsd } from '@/lib/money'
import { byLocalizedCountry, localizedCountry } from '@/lib/countries'
import { useFilters } from '@/hooks/useFilters'
import { useIsMobile } from '@/hooks/useMediaQuery'
import MiniSegmented from './MiniSegmented'
import ProjectSearchBox from './ProjectSearchBox'

type Props = {
  investments: Investment[]
  lang: string
  onLocate?: (inv: Investment) => void
}

const PinIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
    <path
      fillRule="evenodd"
      d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.683 2.282 16.975 16.975 0 001.144.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z"
      clipRule="evenodd"
    />
  </svg>
)

const Chevron = ({ open }: { open: boolean }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
  </svg>
)

const StudyLinks = ({ cases, note }: { cases: ResearchCase[]; note: string }) => (
  <div className="mt-3 text-left">
    <ul className="space-y-1">
      {cases.map((rc, i) => (
        <li key={i}>
          {studyHref(rc.link) ? (
            <a
              href={studyHref(rc.link)!}
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-700 underline decoration-1 hover:text-teal-900"
            >
              {rc.caso}
            </a>
          ) : (
            <span className="text-gray-700">{rc.caso}</span>
          )}
        </li>
      ))}
    </ul>
    <p className="mt-2 text-xs italic text-gray-400">{note}</p>
  </div>
)

// Cuántas columnas dibuja la fila. El panel desplegado la ocupa entera con un
// colSpan, así que este número y las celdas de arriba tienen que salir del mismo
// lado: estuvo escrito a mano en 6 y cualquier columna que se agregara o se sacara
// dejaba el panel corto o largo sin avisar.
const colCount = (variant: 'grouped' | 'flat', compact: boolean): number =>
  1 + // chevron
  (variant === 'flat' && !compact ? 1 : 0) + // país
  1 + // inversor
  (compact ? 0 : 1) + // año
  1 + // sector
  1 + // monto
  (variant === 'grouped' && !compact ? 1 : 0) // localidad

// One investment row + its expandable detail panel. In flat view the country is
// its own column (no country grouping to carry it); in grouped view the country
// lives in the group header, so the last column shows the locality instead.
//
// En teléfono la fila se queda con inversor, sector y monto, y el resto baja al
// panel desplegado: seis columnas en 312px daban 29,5px por columna elástica y el
// texto se imprimía encima del de la vecina. El año no desaparece, se pega como
// segunda línea del inversor, porque es el criterio de orden por defecto y ordenar
// por un dato que no se ve no se entiende.
function InvRow({
  inv,
  idx,
  variant,
  compact,
  lang,
  open,
  onToggle,
  onLocate
}: {
  inv: Investment
  idx: number
  variant: 'grouped' | 'flat'
  compact: boolean
  lang: string
  open: boolean
  onToggle: () => void
  onLocate?: (inv: Investment) => void
}) {
  const { t } = useTranslation()
  const cases = inv.research_cases ?? []
  const hasStudies = cases.length > 0
  const zebra = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
  const country = inv.country ? localizedCountry(inv.country, lang) : '—'
  // `break-word` corta sólo si la palabra no entra, y no achica el ancho mínimo de la
  // columna. Se probó `anywhere`, que sí lo achica: hace entrar la tabla, pero parte
  // «Minería» en «Mine / ría» aunque sobre lugar. Lo que hace entrar la tabla en 312px
  // sin partir nada es el relleno: 8px por lado y por columna son 64px de los 312.
  const corte = 'break-words'
  const pad = compact ? 'px-1' : 'px-2'
  // En 312px la suma de los anchos mínimos se pasa del panel y alguna columna tiene
  // que ceder. Cede el inversor: sus nombres ya vienen en dos o tres líneas, así que
  // un corte dentro de «Construction» casi no se nota. El sector no cede aunque sea
  // la palabra más larga, porque partir «Minería» en «Minerí / a» se lee como un
  // error. Ese fue el orden probado: cortando el sector la tabla entraba igual y se
  // veía rota.
  return (
    <Fragment>
      <tr className={`${zebra} cursor-pointer hover:bg-brand/20`} onClick={onToggle}>
        <td className="px-1 py-2 align-top">
          <button type="button" aria-label={t('list.details')} className="text-gray-500 hover:text-brand-dark">
            <Chevron open={open} />
          </button>
        </td>
        {variant === 'flat' && !compact && (
          <td className={`${pad} py-2 align-top text-gray-700 ${corte}`}>
            <span className="block">{country}</span>
          </td>
        )}
        <td className={`${pad} py-2 align-top font-medium text-gray-900 ${compact ? "[overflow-wrap:anywhere]" : corte}`}>
          {inv.investor ?? '—'}
          {compact && (
            <span className="block text-xs font-normal tabular-nums text-gray-500">{inv.year ?? '—'}</span>
          )}
        </td>
        {!compact && <td className="px-2 py-2 align-top tabular-nums text-gray-700">{inv.year ?? '—'}</td>}
        <td className={`${pad} py-2 align-top`}>
          <span className="flex items-start gap-1.5">
            <span
              className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: sectorColor(inv.area_en) }}
            />
            <span className={`min-w-0 ${corte}`}>{localizedArea(inv, lang)}</span>
          </span>
        </td>
        {/* El monto envuelve. Con `whitespace-nowrap` la columna reclamaba los 169px
            que mide «US$ 1,2 mil millones» en español, y entre eso y el mínimo de las
            demás la tabla se pasaba 78px del panel: dejaba de pisarse y se salía. */}
        <td className={`${pad} py-2 align-top text-right tabular-nums text-gray-700`}>
          {formatUsd(inv.investment_musd, lang)}
        </td>
        {variant === 'grouped' && !compact && (
          <td className="px-2 py-2 align-top text-gray-700">
            <span className="flex items-start gap-1">
              {onLocate && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation()
                    onLocate(inv)
                  }}
                  title={t('list.locate')}
                  className="mt-0.5 shrink-0 text-teal-600 hover:text-teal-800"
                >
                  <PinIcon />
                </button>
              )}
              <span className={`min-w-0 ${corte}`}>{inv.location ?? '—'}</span>
            </span>
          </td>
        )}
      </tr>
      {open && (
        <tr className={zebra}>
          <td colSpan={colCount(variant, compact)} className="bg-gray-50 px-4 py-3 text-left">
            {/* El año no se repite acá: en teléfono ya viaja bajo el nombre del
                inversor. Lo único que el panel repone es el país, que en la lista
                plana sí perdió su columna. */}
            {compact && variant === 'flat' && <p className="mb-1 text-xs text-gray-600">{country}</p>}
            <p className="text-sm font-medium text-gray-900">{localizedDetail(inv, lang)}</p>
            {inv.location && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-600">
                {onLocate && (
                  <button
                    type="button"
                    onClick={() => onLocate(inv)}
                    title={t('list.locate')}
                    className="shrink-0 text-teal-600 hover:text-teal-800"
                  >
                    <PinIcon />
                  </button>
                )}
                <span>
                  {t('list.location')}: {inv.location}
                </span>
              </p>
            )}
            {hasStudies && <StudyLinks cases={cases} note={t('list.studies_network')} />}
          </td>
        </tr>
      )}
    </Fragment>
  )
}

// Column header row. Flat adds a País column and drops Locality (locality moves
// to the expanded detail); grouped is the reverse.
//
// Ningún ancho se declara acá, y por eso la tabla es `table-auto`: el ancho que
// necesita el monto lo decide el idioma («US$ 1,2 mil millones» mide 152px y
// «US$12亿» mucho menos), así que cualquier número que escribamos es una
// adivinanza que se rompe al cambiar de idioma. El `w-7` del chevron es el único,
// y es el ancho de un ícono.
function TableHead({ variant, compact }: { variant: 'grouped' | 'flat'; compact: boolean }) {
  const { t } = useTranslation()
  const pad = compact ? 'px-1' : 'px-2'
  return (
    <thead className="bg-teal-700 text-white text-xs">
      <tr>
        <th className="w-7 px-1 py-2" />
        {variant === 'flat' && !compact && (
          <th className={`${pad} py-2 text-left font-medium`}>{t('filter.country')}</th>
        )}
        <th className={`${pad} py-2 text-left font-medium`}>{t('list.investor')}</th>
        {!compact && <th className="px-2 py-2 text-left font-medium">{t('list.year')}</th>}
        <th className={`${pad} py-2 text-left font-medium`}>{t('list.area')}</th>
        <th className={`${pad} py-2 text-right font-medium`}>{t('list.amount')}</th>
        {variant === 'grouped' && !compact && (
          <th className="px-2 py-2 text-left font-medium">{t('list.location')}</th>
        )}
      </tr>
    </thead>
  )
}

export default function ProjectDocsTable({ investments, lang, onLocate }: Props) {
  const { t } = useTranslation()
  const { filters } = useFilters()
  const compact = useIsMobile()
  const query = filters.query
  const [sortBy, setSortBy] = useState<CardSort>('year')
  const [grouped, setGrouped] = useState(true)
  // Reordenados por el nombre mostrado, igual que en Fichas: `groupByCountry`
  // ordena por el crudo (inglés).
  const groups = useMemo(() => {
    if (!grouped) return []
    const cmp = byLocalizedCountry(lang)
    return groupByCountry(investments, sortBy).sort((a, b) => cmp(a.country, b.country))
  }, [investments, sortBy, grouped, lang])
  const flat = useMemo(() => (grouped ? [] : flatList(investments, sortBy)), [investments, sortBy, grouped])
  // Starts fully collapsed: the table is the default list format, and opening a
  // country by default buried the rest of the countries below a long row block.
  const [openCountries, setOpenCountries] = useState<Set<string>>(() => new Set())
  const [openRows, setOpenRows] = useState<Set<string>>(() => new Set())

  // Auto-expand matches when entering search, collapse all when clearing — same
  // behaviour as the cards, or a search would appear to return nothing.
  const hadQuery = useRef(false)
  useEffect(() => {
    const has = query.length > 0
    if (has && !hadQuery.current) setOpenCountries(new Set(groups.map(g => g.country)))
    else if (!has && hadQuery.current) setOpenCountries(new Set())
    hadQuery.current = has
  }, [query, groups])

  const toggleIn = (set: Set<string>, key: string): Set<string> => {
    const next = new Set(set)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  }
  const toggleRow = (id: string) => setOpenRows(s => toggleIn(s, id))

  return (
    <div className="w-full text-sm">
      <div className="sticky top-0 z-20 border-b border-gray-200 bg-white px-3 py-2">
        <ProjectSearchBox />
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[0.6875rem] font-medium text-gray-500">{t('list.sort_by')}</span>
            <MiniSegmented
              items={[
                { value: 'year', label: t('list.sort_year') },
                { value: 'amount', label: t('list.sort_amount') }
              ]}
              value={sortBy}
              onPick={setSortBy}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[0.6875rem] font-medium text-gray-500">{t('list.view_as')}</span>
            <MiniSegmented
              items={[
                { value: 'grouped', label: t('list.grouped') },
                { value: 'flat', label: t('list.flat') }
              ]}
              value={grouped ? 'grouped' : 'flat'}
              onPick={v => setGrouped(v === 'grouped')}
            />
          </div>
        </div>
      </div>

      {grouped ? (
        groups.map(group => {
          const open = openCountries.has(group.country)
          return (
            <div key={group.country} className="border-b border-gray-200">
              <button
                type="button"
                onClick={() => setOpenCountries(s => toggleIn(s, group.country))}
                className="flex w-full items-center gap-2 bg-gray-100 px-4 py-3 text-left font-semibold text-teal-800 hover:bg-brand hover:text-gray-900"
              >
                <Chevron open={open} />
                {t('list.projects_in', {
                  country: localizedCountry(group.country, lang),
                  count: group.projects.length
                })}
              </button>
              {open && (
                // Red, no encuadre: con el corte de palabra y sin anchos declarados la
                // tabla entra sola en los seis anchos medidos. Esto existe para que un
                // dato futuro más largo empuje un scroll de 8px en vez de romper el
                // panel, que es lo que hacían los anchos fijos.
                <div className="overflow-x-auto">
                <table className="w-full table-auto border-collapse">
                  <TableHead variant="grouped" compact={compact} />
                  <tbody>
                    {group.projects.map((inv, idx) => (
                      <InvRow
                        key={inv.id}
                        inv={inv}
                        idx={idx}
                        variant="grouped"
                        compact={compact}
                        lang={lang}
                        open={openRows.has(inv.id)}
                        onToggle={() => toggleRow(inv.id)}
                        onLocate={onLocate}
                      />
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          )
        })
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full table-auto border-collapse">
          <TableHead variant="flat" compact={compact} />
          <tbody>
            {flat.map((inv, idx) => (
              <InvRow
                key={inv.id}
                inv={inv}
                idx={idx}
                variant="flat"
                compact={compact}
                lang={lang}
                open={openRows.has(inv.id)}
                onToggle={() => toggleRow(inv.id)}
                onLocate={onLocate}
              />
            ))}
          </tbody>
        </table>
        </div>
      )}

      {(grouped ? groups.length === 0 : flat.length === 0) && (
        <p className="px-3 py-4 text-sm text-gray-400">{t('list.no_results')}</p>
      )}
    </div>
  )
}
