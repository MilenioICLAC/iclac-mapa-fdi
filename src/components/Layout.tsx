import { useEffect, useState, type ComponentType } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { LocaleCode } from '@/types/data'
import Footer from './Footer'
import LandingModal from './LandingModal'
import { consumeFirstVisit } from '@/lib/firstVisit'
import { MapIcon, TrendsIcon } from './icons'

const LANGS: { code: LocaleCode; label: string }[] = [
  { code: 'es', label: 'ES' },
  { code: 'en', label: 'EN' },
  { code: 'cn', label: '中文' }
]

// dataView routes share filter state via the URL query string (useFilters) —
// switching between them must preserve it, or filters silently reset to default.
// Only the two tools carry an icon: it is what marks them as instruments among pages,
// and the same glyph heads each tool's explanation panel.
const NAV: {
  to: string
  end?: boolean
  key: string
  dataView?: boolean
  icon?: ComponentType<{ className?: string }>
}[] = [
  { to: '/', end: true, key: 'nav.map', dataView: true, icon: MapIcon },
  { to: '/sankey', key: 'nav.sankey', dataView: true, icon: TrendsIcon },
  { to: '/methodology', key: 'nav.methodology' },
  { to: '/downloads', key: 'nav.downloads' },
  { to: '/contact', key: 'nav.contact' }
]

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'font-semibold text-gray-900' : 'text-gray-500 hover:text-brand-dark'

// El encabezado de iclac.cl mide 88px en escritorio (logo de 68px + 10px arriba y abajo)
// y se separa del contenido con sombra, no con borde. Replicamos las dos cosas para que
// la llegada desde el sitio institucional no se lea como un corte. En teléfono no: ahí
// cada píxel de alto se lo quita al mapa, y el encabezado se queda compacto.
const HEADER_SHADOW = 'shadow-[0_5px_10px_0_rgba(50,50,50,0.06)]'

export default function Layout() {
  const { t, i18n } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)
  // Resolved at mount rather than in an effect, so nothing can close the presentation
  // before it paints. The header button is the way back into it.
  const [aboutOpen, setAboutOpen] = useState(consumeFirstVisit)
  const { pathname, search } = useLocation()

  // Close the mobile menu on navigation so it never lingers over the new view.
  useEffect(() => setMenuOpen(false), [pathname])

  const langButtons = (
    <div className="flex gap-1 text-sm">
      {LANGS.map(l => (
        <button
          key={l.code}
          onClick={() => i18n.changeLanguage(l.code)}
          className={`px-2 py-1 rounded ${
            i18n.language === l.code
              ? 'bg-gray-900 text-white hover:bg-brand-dark'
              : 'text-gray-600 hover:bg-brand hover:text-gray-900'
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  )

  return (
    // h-full y no h-screen: el alto real de la ventana lo fija #root en index.css
    // (100dvh donde exista), porque 100vh en teléfono incluye la barra del navegador.
    <div className="h-full flex flex-col overflow-hidden">
      {/* Presentación del repositorio: sola en la primera carga de la sesión, y a
          demanda desde el botón del header. */}
      <LandingModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <header className={`relative z-[1000] bg-white px-4 py-3 sm:px-6 md:py-[10px] ${HEADER_SHADOW}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <a href="https://iclac.cl/" target="_blank" rel="noopener noreferrer" className="shrink-0">
              {/* 68px en md+ es el alto exacto con que iclac.cl dibuja el mismo logo. */}
              <img src="/icons/iclac.webp" alt="ICLAC" className="h-9 w-auto object-contain sm:h-10 md:h-[68px]" />
            </a>
            <div className="leading-tight min-w-0">
              <h1 className="font-display text-[13px] font-semibold leading-tight text-gray-900 sm:text-base">{t('app.subject')}</h1>
              <p className="hidden text-xs text-gray-500 sm:block sm:truncate">{t('app.kind')}</p>
            </div>
            {/* "Acerca de" beside the title, not in the nav cluster (Margaret UAT):
                it says what this is, not where to go. Reopens the presentation the
                session started with; per-view help lives inside each view now. */}
            <button
              type="button"
              onClick={() => setAboutOpen(true)}
              aria-label={t('about.label')}
              title={t('about.label')}
              className="flex shrink-0 items-center rounded-full text-[#377F83] transition-colors hover:text-[#093b4d]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
                <circle cx="12" cy="12" r="9" />
                <path strokeLinecap="round" d="M12 11v5" />
                <circle cx="12" cy="7.6" r="0.7" fill="currentColor" stroke="none" />
              </svg>
            </button>
          </div>

          {/* El nav completo aparece en lg, no en md. Medido: los cinco ítems ocupan
              376px y, al lado del título, entre 768 y 1023px no queda ancho — el h1 se
              partía en cinco líneas y estiraba el encabezado a 156px, comiéndose el
              mapa. Es el mismo corte que ya usaba la greca de las vistas editoriales,
              y el de `useIsCompact`: hasta 1023px nada se queda con ancho propio, ni el
              nav ni el panel de filtros ni el listado. Lo que NO sigue este umbral es
              el cromo del mapa (`useIsMobile`, md), que en tablet sí cabe flotando. */}
          <div className="hidden lg:flex items-center gap-4 shrink-0">
            {/* 13px en Raleway es el tamaño del menú de iclac.cl. Lo que no copiamos son
                sus mayúsculas con letter-spacing: cinco ítems en tres idiomas no caben, y
                en chino las mayúsculas no hacen nada. */}
            <nav className="flex gap-4 font-display text-[13px]">
              {NAV.map(n => (
                <NavLink
                  key={n.to}
                  to={n.dataView ? { pathname: n.to, search } : n.to}
                  end={n.end}
                  className={({ isActive }) => `flex items-center gap-1.5 ${navLinkClass({ isActive })}`}
                >
                  {n.icon && <n.icon className="h-4 w-4 shrink-0" />}
                  {t(n.key)}
                </NavLink>
              ))}
            </nav>
            <span className="h-5 w-px bg-gray-300" aria-hidden />
            {langButtons}
          </div>

          {/* Mobile: hamburger toggles a stacked menu below the header row. */}
          <button
            type="button"
            onClick={() => setMenuOpen(o => !o)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? t('common.close') : t('nav.menu')}
            className="lg:hidden flex h-9 w-9 shrink-0 items-center justify-center rounded text-gray-700 hover:bg-brand hover:text-gray-900"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
              )}
            </svg>
          </button>
        </div>

        {menuOpen && (
          <div className="absolute inset-x-0 top-full z-[1000] flex flex-col gap-1 border-b border-gray-200 bg-white px-4 py-3 shadow-lg lg:hidden">
            <nav className="flex flex-col font-display text-sm">
              {NAV.map(n => (
                <NavLink
                  key={n.to}
                  to={n.dataView ? { pathname: n.to, search } : n.to}
                  end={n.end}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded px-2 py-2 ${
                      isActive ? 'bg-gray-100 font-semibold text-gray-900' : 'text-gray-600 hover:bg-brand hover:text-gray-900'
                    }`
                  }
                >
                  {n.icon && <n.icon className="h-4 w-4 shrink-0" />}
                  {t(n.key)}
                </NavLink>
              ))}
            </nav>
            <div className="mt-2 border-t border-gray-100 pt-2">{langButtons}</div>
          </div>
        )}
      </header>

      {/* scrollbar-gutter: stable reserva el canal de la barra siempre. Sin esto las
          vistas largas (Metodología) muestran barra y las cortas (Datos) no, la caja
          de contenido cambia de ancho entre tabs y la columna centrada se corre unos
          px — visible sobre todo con la greca de fondo anclada al viewport. */}
      <main className="flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable]">
        <Outlet />
      </main>

      <Footer />
    </div>
  )
}
