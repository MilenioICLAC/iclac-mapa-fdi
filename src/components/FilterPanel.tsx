import { useTranslation } from 'react-i18next'
import { useFilters } from '@/hooks/useFilters'
import { sectorColor } from '@/lib/sectors'
import type { ResearchFilter } from '@/lib/filter'

type Props = {
  countries: string[]
  sectors: string[]
  yearMin: number
  yearMax: number
}

const PROJECT_TYPES = ['Adquisición', 'Greenfield'] as const

const toggleInArray = (arr: string[], v: string): string[] =>
  arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]

export default function FilterPanel({ countries, sectors, yearMin, yearMax }: Props) {
  const { t } = useTranslation()
  const { filters, setFilters, reset } = useFilters()

  const yMin = filters.yearMin ?? yearMin
  const yMax = filters.yearMax ?? yearMax

  return (
    <aside className="w-72 shrink-0 border-r border-gray-200 bg-white overflow-y-auto p-4 space-y-5 text-sm">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-base">{t('filter.country')}</h3>
        <button
          onClick={reset}
          className="text-xs text-gray-500 hover:text-gray-900 underline"
        >
          {t('filter.clear_all')}
        </button>
      </div>

      <section>
        <label className="block text-xs font-medium text-gray-600 mb-1">{t('filter.country')}</label>
        <select
          multiple
          value={filters.countries}
          onChange={e => setFilters({ countries: [...e.target.selectedOptions].map(o => o.value) })}
          className="w-full border rounded p-1 h-32"
        >
          {countries.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </section>

      <section>
        <label className="block text-xs font-medium text-gray-600 mb-1">{t('filter.year')}</label>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            min={yearMin}
            max={yearMax}
            value={yMin}
            onChange={e => setFilters({ yearMin: Number.parseInt(e.target.value, 10) || null })}
            className="w-20 border rounded px-2 py-1"
          />
          <span className="text-gray-400">–</span>
          <input
            type="number"
            min={yearMin}
            max={yearMax}
            value={yMax}
            onChange={e => setFilters({ yearMax: Number.parseInt(e.target.value, 10) || null })}
            className="w-20 border rounded px-2 py-1"
          />
        </div>
        <div className="text-xs text-gray-400 mt-1">{yearMin}–{yearMax}</div>
      </section>

      <section>
        <label className="block text-xs font-medium text-gray-600 mb-1">{t('filter.project_type')}</label>
        <div className="space-y-1">
          {PROJECT_TYPES.map(pt => (
            <label key={pt} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.types.length === 0 || filters.types.includes(pt)}
                onChange={() => {
                  const current = filters.types.length === 0 ? [...PROJECT_TYPES] : filters.types
                  const next = toggleInArray(current, pt)
                  setFilters({ types: next.length === PROJECT_TYPES.length ? [] : next })
                }}
              />
              {pt}
            </label>
          ))}
        </div>
      </section>

      <section>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={filters.includeConstruction}
            onChange={e => setFilters({ includeConstruction: e.target.checked })}
          />
          <span className="text-xs font-medium text-gray-600">{t('filter.construction')}</span>
        </label>
      </section>

      <section>
        <label className="block text-xs font-medium text-gray-600 mb-1">{t('filter.case_studies')}</label>
        <div className="flex gap-2">
          {(['all', 'yes', 'no'] as ResearchFilter[]).map(opt => (
            <button
              key={opt}
              onClick={() => setFilters({ research: opt })}
              className={`px-2 py-1 rounded text-xs border ${
                filters.research === opt ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300'
              }`}
            >
              {opt === 'all' ? t('common.all') : opt === 'yes' ? t('filter.with_studies') : t('filter.without_studies')}
            </button>
          ))}
        </div>
      </section>

      <section>
        <label className="block text-xs font-medium text-gray-600 mb-1">{t('filter.sectors')}</label>
        <div className="space-y-1">
          {sectors.map(s => {
            const active = filters.sectors.length === 0 || filters.sectors.includes(s)
            return (
              <label key={s} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => {
                    const current = filters.sectors.length === 0 ? sectors : filters.sectors
                    const next = toggleInArray(current, s)
                    setFilters({ sectors: next.length === sectors.length ? [] : next })
                  }}
                />
                <span
                  className="inline-block w-3 h-3 rounded-sm"
                  style={{ backgroundColor: sectorColor(s) }}
                />
                <span>{t(`sector.${s}`, s)}</span>
              </label>
            )
          })}
        </div>
      </section>
    </aside>
  )
}
