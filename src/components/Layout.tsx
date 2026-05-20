import { Outlet, NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { LocaleCode } from '@/types/data'

const LANGS: { code: LocaleCode; label: string }[] = [
  { code: 'es', label: 'ES' },
  { code: 'en', label: 'EN' },
  { code: 'cn', label: '中文' }
]

export default function Layout() {
  const { t, i18n } = useTranslation()

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <h1 className="text-lg font-semibold">{t('app.title')}</h1>
          <nav className="flex gap-4 text-sm">
            <NavLink to="/" end className={({ isActive }) => (isActive ? 'font-semibold' : 'text-gray-600')}>
              {t('nav.map')}
            </NavLink>
            <NavLink to="/sankey" className={({ isActive }) => (isActive ? 'font-semibold' : 'text-gray-600')}>
              {t('nav.sankey')}
            </NavLink>
            <NavLink to="/methodology" className={({ isActive }) => (isActive ? 'font-semibold' : 'text-gray-600')}>
              {t('nav.methodology')}
            </NavLink>
          </nav>
        </div>
        <div className="flex gap-1 text-sm">
          {LANGS.map(l => (
            <button
              key={l.code}
              onClick={() => i18n.changeLanguage(l.code)}
              className={`px-2 py-1 rounded ${i18n.language === l.code ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-gray-200 px-6 py-3 text-xs text-gray-500">
        ICLAC · {t('footer.tagline')}
      </footer>
    </div>
  )
}
