# mapa_FDI

Repositorio Regional de Inversiones Chinas en América Latina — frontend.

Reescritura para ICLAC. Reemplaza la implementación anterior (Vue 3 / IMFD).

## Stack

- React 18 + Vite + TypeScript (strict)
- react-router-dom 6
- react-i18next (es / en / cn)
- Leaflet 1.9 + react-leaflet
- D3 v7
- ECharts 5
- Tailwind CSS 3
- Hosting: Netlify

## Requisitos

- Node ≥ 20 (ver `.nvmrc`)
- npm ≥ 10

## Setup

```bash
npm install
npm run dev
```

Abrir `http://localhost:5173`.

## Scripts

| Script | Acción |
|---|---|
| `npm run dev` | Vite dev server (HMR, puerto 5173) |
| `npm run build` | Typecheck (`tsc --noEmit`) + bundle producción a `dist/` |
| `npm run preview` | Servir `dist/` localmente para verificación post-build |
| `npm run typecheck` | Solo TypeScript, sin emitir |
| `npm run lint` | ESLint sobre `src/` (legacy excluido) |

## Estructura

```
src/
  App.tsx              # rutas
  main.tsx             # entrypoint
  i18n.ts              # config react-i18next
  index.css            # tailwind directivas
  components/
    Layout.tsx         # header + nav + footer + lang switcher
  views/
    MapView.tsx        # mapa Leaflet con GeoJSON LATAM
    SankeyView.tsx     # placeholder S3+
    MethodologyView.tsx# placeholder
  locales/
    es.json, en.json, cn.json
  types/
    data.ts            # tipos compartidos (GeoJSON, locales)
public/
  data/                # GeoJSON + JSON estáticos servidos en runtime
legacy/                # código Vue original — solo referencia, no compilar
docs/                  # cotización, planes de sprint
.github/workflows/ci.yml  # typecheck + lint + build
```

## Datos

`public/data/` sirve los archivos estáticos al cliente. En S1 solo `south-america.geojson`. El resto entra en S2 según necesidad de filtros (Inversión, año, sectores, paper).

Pipeline planeado (S5):

1. Cliente edita XLSX en su repo fork
2. Abre PR
3. GitHub Action ejecuta validador JS (esquema, tipos, FK)
4. Merge → Netlify rebuild

## Idiomas

`es` (default), `en`, `cn`. Detección automática vía `navigator.language` con fallback a `es`. Strings en `src/locales/*.json`. Revisor externo confirmado para chino.

## TypeScript

Modo `strict` activo. Tipos compartidos en `src/types/data.ts`. Imports de JSON tipados vía `resolveJsonModule`. Alias `@/*` → `./src/*`.

Si se añade dependencia sin tipos, instalar `@types/<paquete>` o declarar shim en `src/vite-env.d.ts`.

## CI

`.github/workflows/ci.yml` corre en push a `main` y en PRs:

1. `npm ci`
2. `npm run typecheck`
3. `npm run lint`
4. `npm run build`

Build artifact se sube solo desde `main`.

## Despliegue

Netlify lee `netlify.toml`. Build command `npm run build`, publish dir `dist`. SPA redirect (`/* /index.html 200`) configurado.

- `main` → staging (cuenta dev en S1–S4)
- Transferencia a cuenta ICLAC en S5
- PRs / ramas → preview deploys automáticos

## Documentación

- [`.claude/CLAUDE.md`](.claude/CLAUDE.md) — contexto del proyecto para asistentes IA
- [`docs/plan_s1.md`](docs/plan_s1.md) — plan sprint actual
- [`docs/cotizacion_iclac_fase1_felipe.html`](docs/cotizacion_iclac_fase1_felipe.html) — alcance y precio Fase 1
- [`legacy/AUDIT.md`](legacy/AUDIT.md) — auditoría del proyecto Vue original (problemas a no replicar)
- [`legacy/`](legacy/) — código y datos del proyecto original como referencia
