import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useFilters } from '@/hooks/useFilters'
import { useIsCompact } from '@/hooks/useMediaQuery'
import { useJumpScroll } from '@/hooks/useJumpScroll'
import { CONSTRUCTION_FILTERS, type ResearchFilter } from '@/lib/filter'
import { byLocalizedCountry, localizedCountry } from '@/lib/countries'
import type { CompanyOption } from '@/lib/sankey'
import CollapsibleSection from './CollapsibleSection'
import YearRangeSlider from './YearRangeSlider'
import CheckList from './CheckList'
import InvestorFilter from './InvestorFilter'
import HelpTip from './HelpTip'

type Props = {
  countries: string[]
  yearMin: number
  yearMax: number
  companies: CompanyOption[]
}

// Shared stroke icons. One viewBox, consistent weight across the rail.
//
// Componentes y no nodos fijos: el mismo glifo se dibuja a 20px en el riel y a 16px
// junto al título de su sección en el panel abierto, y el guiño necesita poder
// agregarle una clase. Un ReactNode ya construido no admite ninguna de las dos.
type IconProps = { className?: string }
const icon = (path: ReactNode) =>
  function Icon({ className = 'h-5 w-5' }: IconProps) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
        {path}
      </svg>
    )
  }
const IconChevronLeft = icon(<path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />)
const IconChevronRight = icon(<path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />)
const IconGlobe = icon(<path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c2.5-2.3 3.75-5.3 3.75-9S14.5 5.3 12 3m0 18c-2.5-2.3-3.75-5.3-3.75-9S9.5 5.3 12 3M3.5 9h17M3.5 15h17" />)
const IconCalendar = icon(<path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 8.25h18M4.5 5.25h15A1.5 1.5 0 0 1 21 6.75v12a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.75v-12a1.5 1.5 0 0 1 1.5-1.5Z" />)
const IconTag = icon(<path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581a2.25 2.25 0 0 0 3.182 0l4.318-4.318a2.25 2.25 0 0 0 0-3.182L11.16 3.66A2.25 2.25 0 0 0 9.568 3ZM6 6h.008v.008H6V6Z" />)
const IconBuilding = icon(<path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h9v18h-9V3Zm9 6h6v12h-6M7.5 6.75h.008v.008H7.5V6.75Zm0 3h.008v.008H7.5V9.75Zm0 3h.008v.008H7.5v-.008Z" />)
const IconDoc = icon(<path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25M6.75 21h10.5a2.25 2.25 0 0 0 2.25-2.25V8.25L13.5 2.25H6.75A2.25 2.25 0 0 0 4.5 4.5v14.25A2.25 2.25 0 0 0 6.75 21Z" />)
const IconBriefcase = icon(<path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.1a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25v-4.1M12 12.75h.008v.008H12v-.008ZM3.75 9.75A2.25 2.25 0 0 1 6 7.5h12a2.25 2.25 0 0 1 2.25 2.25v2.25a17.9 17.9 0 0 1-8.25 2 17.9 17.9 0 0 1-8.25-2V9.75ZM15 7.5V6a2.25 2.25 0 0 0-2.25-2.25h-1.5A2.25 2.25 0 0 0 9 6v1.5" />)
const IconBank = icon(<path strokeLinecap="round" strokeLinejoin="round" d="M12 3 2.25 8.25h19.5L12 3Zm-7.5 7.5V18m5-7.5V18m5-7.5V18m5-7.5V18M2.25 21h19.5" />)

// Rail entries mirror the panel sections top-to-bottom (flat, no groups — the
// order follows Margareth's UAT list).
//
// Es la MISMA lista que titula las secciones del panel abierto: el ícono del riel y
// el de la sección salen de acá, así no pueden separarse. `key` es además el destino
// del salto (`data-filter-key` en la sección).
const RAIL: { key: string; Icon: (p: IconProps) => ReactNode }[] = [
  { key: 'filter.country', Icon: IconGlobe },
  { key: 'filter.year', Icon: IconCalendar },
  { key: 'filter.project_type', Icon: IconTag },
  { key: 'filter.construction', Icon: IconBuilding },
  { key: 'filter.case_studies', Icon: IconDoc },
  { key: 'filter.company', Icon: IconBriefcase },
  { key: 'sankey.ownership', Icon: IconBank }
]

// Sección no colapsable (año, tipo, construcción, estudios). Lleva el mismo par
// ícono + rótulo que el botón de las colapsables, para que las siete entradas del
// riel se reconozcan igual una vez abierto el panel, y es destino de salto como
// ellas. `help` es el (?) que va pegado al rótulo, no debajo.
function PlainSection({
  sectionKey,
  Icon,
  label,
  jump,
  help,
  children
}: {
  sectionKey: string
  Icon: (p: IconProps) => ReactNode
  label: string
  jump: number
  help?: ReactNode
  children: ReactNode
}) {
  const ref = useJumpScroll<HTMLElement>(jump)
  return (
    <section ref={ref} data-filter-key={sectionKey}>
      <div className="mb-1 flex items-center gap-1.5">
        {/* El span es el disco del guiño: 24px alrededor de un glifo de 16px, con
            `-my-1` para que el chip no estire la fila. key lo remonta, y sin remontar
            la animación no vuelve a correr al tocar dos veces el mismo ícono del riel. */}
        <span
          key={jump}
          className={`-my-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-500 ${jump ? 'filtro-guino' : ''}`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <label className="block text-xs font-medium text-gray-600">{label}</label>
        {help}
      </div>
      {children}
    </section>
  )
}

const OWNERSHIP_VALUES = ['Central SOE', 'Local SOE', 'POE', 'MIXED', 'UNKNOWN'] as const

const PROJECT_TYPES = ['Adquisición', 'Greenfield'] as const

// Data layer treats [] as "all". Legacy URLs may still carry the '__none__'
// sentinel (old select-all UI); the UI strips it and the first toggle clears it.
const NONE = '__none__'

const toggleInArray = (arr: string[], v: string): string[] =>
  arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]

// Shared segmented control for type / case studies / map mode. Joined buttons,
// active = dark fill. Multi-select (type) and single-select (others) both use it.
type SegItem<T extends string> = { value: T; label: string }
function Segmented<T extends string>({
  items,
  isActive,
  onPick,
  disabled = false
}: {
  items: SegItem<T>[]
  isActive: (v: T) => boolean
  onPick: (v: T) => void
  disabled?: boolean
}) {
  return (
    <div className={`flex overflow-hidden rounded border border-gray-300 text-xs ${disabled ? 'opacity-40' : ''}`}>
      {items.map((it, i) => (
        <button
          key={it.value}
          onClick={() => onPick(it.value)}
          aria-pressed={isActive(it.value)}
          disabled={disabled}
          // Hover highlight differs by state on purpose: the active button is dark
          // with white text, so a light hover made its label vanish.
          className={`flex-1 px-2 py-1.5 ${i > 0 ? 'border-l border-gray-300' : ''} ${
            isActive(it.value)
              ? `bg-gray-900 text-white ${disabled ? '' : 'hover:bg-brand-dark'}`
              : `bg-white text-gray-700 ${disabled ? '' : 'hover:bg-brand hover:text-gray-900'}`
          } ${disabled ? 'cursor-not-allowed' : ''}`}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}

export default function FilterPanel({ countries, yearMin, yearMax, companies }: Props) {
  const { t, i18n } = useTranslation()
  const { filters, setFilters, reset } = useFilters()
  // Collapsed by default on phones so the map gets the full width; the thin rail
  // stays as the affordance to reopen. Desktop keeps the panel open.
  // Tablet arranca igual que teléfono: 288px de panel sobre 800 dejaban el mapa en
  // una tira, y el riel de 48px conserva las siete entradas a un toque.
  const isCompact = useIsCompact()
  const [collapsed, setCollapsed] = useState(isCompact)
  // Sección a la que apuntaba el ícono del riel que se tocó. El token distingue dos
  // clics sobre el MISMO ícono, que si no se leerían como un solo estado y no
  // volverían a animar. Se limpia solo: el guiño es un aviso, no un estado.
  const [jump, setJump] = useState<{ key: string; token: number } | null>(null)

  // El guiño es un aviso, no un estado: se apaga solo. Este plazo es lo que quita la
  // clase `.filtro-guino`, así que tiene que ser el ÚLTIMO en pasar: 1100ms del disco
  // + 150ms de atraso del giro. Si se acorta, el destello se corta de golpe.
  // El scroll no se hace acá: lo pide cada sección con `useJumpScroll`, que es la que
  // sabe cuándo su alto es el definitivo.
  useEffect(() => {
    if (!jump) return
    const clear = setTimeout(() => setJump(null), 1300)
    return () => clearTimeout(clear)
  }, [jump])

  // 0 = sin guiño. La sección apuntada recibe el token, que al cambiar remonta su ícono.
  const jumpFor = (key: string) => (jump?.key === key ? jump.token : 0)

  if (collapsed) {
    return (
      <aside className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-gray-200 bg-white py-3">
        <button
          onClick={() => setCollapsed(false)}
          title={t('filter.expand')}
          aria-label={t('filter.expand')}
          className="flex h-9 w-9 items-center justify-center rounded text-gray-700 hover:bg-brand hover:text-gray-900"
        >
          <IconChevronRight />
        </button>
        <div className="my-1 h-px w-6 bg-gray-200" />
        {RAIL.map(r => (
          <button
            key={r.key}
            // Abre el panel Y lleva a la sección de este ícono: el riel no es un
            // botón de "abrir" repetido siete veces, cada ícono tiene destino.
            onClick={() => {
              setCollapsed(false)
              setJump(j => ({ key: r.key, token: (j?.token ?? 0) + 1 }))
            }}
            title={t(r.key)}
            aria-label={t(r.key)}
            className="flex h-9 w-9 items-center justify-center rounded text-gray-500 hover:bg-brand hover:text-gray-900"
          >
            <r.Icon />
          </button>
        ))}
      </aside>
    )
  }

  const countryLabel = (c: string) => localizedCountry(c, i18n.language)
  const sortedCountries = [...countries].sort(byLocalizedCountry(i18n.language))

  const yMin = filters.yearMin ?? yearMin
  const yMax = filters.yearMax ?? yearMax
  // Empty selection means "all" in the data layer; treat it as every box checked.
  // Same semantics as the Sankey: clicking one country from "all" narrows to it.
  const selectedCountries = filters.countries.filter(c => c !== NONE)
  const allCountries = selectedCountries.length === 0

  return (
    <>
      {/* Teléfono y tablet: el panel es una capa, así que atenúa el mapa detrás y el
          toque afuera cierra. El corte es lg, no md: en tablet el panel tampoco le
          quita ancho al mapa. `max-w-xs` es lo que evita un drawer de 680px en una
          tablet de 800 (85vw), donde el ancho útil del panel no necesita crecer. */}
      <div
        className="fixed inset-0 z-[855] bg-black/30 lg:hidden"
        onClick={() => setCollapsed(true)}
        aria-hidden
      />
      <aside className="absolute inset-y-0 left-0 z-[860] w-[85vw] max-w-xs shadow-2xl shrink-0 overflow-y-auto border-r border-gray-200 bg-white p-4 space-y-5 text-sm lg:static lg:z-auto lg:w-72 lg:max-w-none lg:shadow-none">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCollapsed(true)}
            title={t('filter.collapse')}
            aria-label={t('filter.collapse')}
            className="-ml-1 flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-brand hover:text-gray-900"
          >
            <IconChevronLeft />
          </button>
          <h3 className="font-semibold text-base">{t('filter.title')}</h3>
        </div>
        <button
          onClick={reset}
          // Text link: `brand` on white is 2.96:1, so links take the dark shade.
          className="text-xs text-gray-500 underline hover:text-brand-dark"
        >
          {t('filter.clear_all')}
        </button>
      </div>

      <CollapsibleSection
        label={t('filter.country')}
        Icon={IconGlobe}
        sectionKey="filter.country"
        jump={jumpFor('filter.country')}
        summary={
          allCountries ? t('common.all') : t('filter.n_selected', { count: selectedCountries.length })
        }
      >
        <div className="rounded border border-gray-300">
          {/* Explicit "All" row at the top (Margareth UAT). Empty selection = all
              in the data layer; checking All clears the selection back to that. */}
          <label className="flex items-center gap-2 border-b border-gray-200 px-2 py-1.5 font-medium">
            <input
              type="checkbox"
              checked={allCountries}
              onChange={() => setFilters({ countries: [] })}
            />
            <span className="text-xs">{t('common.all')}</span>
          </label>
          <CheckList
            items={sortedCountries}
            selected={selectedCountries}
            onToggle={c => setFilters({ countries: toggleInArray(selectedCountries, c) })}
            label={countryLabel}
          />
        </div>
      </CollapsibleSection>

      <PlainSection
        sectionKey="filter.year"
        Icon={IconCalendar}
        label={t('filter.year')}
        jump={jumpFor('filter.year')}
      >
        <YearRangeSlider
          min={yearMin}
          max={yearMax}
          valueMin={yMin}
          valueMax={yMax}
          onChange={(vMin, vMax) => setFilters({ yearMin: vMin, yearMax: vMax })}
        />
      </PlainSection>

      <PlainSection
        sectionKey="filter.project_type"
        Icon={IconTag}
        label={t('filter.project_type')}
        jump={jumpFor('filter.project_type')}
      >
        {/* Dead while construction is on 'only': acquisition and greenfield are the
            two types being filtered out wholesale, so leaving the buttons live would
            offer a choice that changes nothing. */}
        <Segmented
          items={PROJECT_TYPES.map(pt => ({ value: pt, label: t(`project_type.${pt}`) }))}
          isActive={pt => filters.types.length === 0 || filters.types.includes(pt)}
          disabled={filters.construction === 'only'}
          onPick={pt => {
            const current = filters.types.length === 0 ? [...PROJECT_TYPES] : filters.types
            const next = toggleInArray(current, pt)
            setFilters({ types: next.length === PROJECT_TYPES.length ? [] : next })
          }}
        />
        {filters.construction === 'only' && (
          <p className="mt-1 text-[11px] leading-snug text-gray-400">{t('filter.type_off_only')}</p>
        )}
      </PlainSection>

      {/* Three states, same segmented control as Tipo / Estudios. A checkbox could
          only exclude or include; there was no way to look at the construction
          projects on their own. The (?) carries the methodology's reason these are
          not FDI, which is what the three labels raise. */}
      <PlainSection
        sectionKey="filter.construction"
        Icon={IconBuilding}
        label={t('filter.construction')}
        jump={jumpFor('filter.construction')}
        help={<HelpTip text={t('filter.construction_help')} label={t('filter.construction')} />}
      >
        <Segmented
          items={CONSTRUCTION_FILTERS.map(c => ({ value: c, label: t(`filter.construction_${c}`) }))}
          isActive={c => filters.construction === c}
          onPick={c => setFilters({ construction: c })}
        />
      </PlainSection>

      <PlainSection
        sectionKey="filter.case_studies"
        Icon={IconDoc}
        label={t('filter.case_studies')}
        jump={jumpFor('filter.case_studies')}
      >
        <Segmented
          items={(['all', 'yes', 'no'] as ResearchFilter[]).map(opt => ({
            value: opt,
            label: opt === 'all' ? t('common.all') : opt === 'yes' ? t('filter.with_studies') : t('filter.without_studies')
          }))}
          isActive={opt => filters.research === opt}
          onPick={opt => setFilters({ research: opt })}
        />
      </PlainSection>

      <CollapsibleSection
        label={t('filter.company')}
        Icon={IconBriefcase}
        sectionKey="filter.company"
        jump={jumpFor('filter.company')}
        summary={
          filters.investors.length === 0 ? t('common.all') : t('filter.n_selected', { count: filters.investors.length })
        }
      >
        <div className="rounded border border-gray-300">
          <InvestorFilter
            options={companies}
            selected={filters.investors}
            onChange={ids => setFilters({ investors: ids })}
            metric={filters.pieMetric}
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        label={t('sankey.ownership')}
        Icon={IconBank}
        sectionKey="sankey.ownership"
        jump={jumpFor('sankey.ownership')}
        summary={
          filters.ownership.length === 0 ? t('common.all') : t('filter.n_selected', { count: filters.ownership.length })
        }
      >
        <div className="rounded border border-gray-300 p-2 space-y-1">
          {OWNERSHIP_VALUES.map(o => (
            <label key={o} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.ownership.length === 0 || filters.ownership.includes(o)}
                onChange={() => {
                  const base = filters.ownership.length === 0 ? [...OWNERSHIP_VALUES] : filters.ownership
                  const next = toggleInArray(base, o)
                  setFilters({ ownership: next.length === OWNERSHIP_VALUES.length ? [] : next })
                }}
              />
              <span className="min-w-0 flex-1 truncate">{t(`sankey.own_${o.toLowerCase().replace(/\s+/g, '_')}`, o)}</span>
            </label>
          ))}
        </div>
      </CollapsibleSection>

      </aside>
    </>
  )
}
