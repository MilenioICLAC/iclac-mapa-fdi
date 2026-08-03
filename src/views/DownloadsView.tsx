import { useTranslation } from 'react-i18next'
import Citation from '@/components/Citation'

// DOS descargas, las dos armadas por el ETL en build (`scripts/etl.mjs`), no por el
// navegador: los datos ya están unidos ahí, el bundle se ahorra SheetJS y lo que baja el
// público es exactamente lo que produjo el pipeline.
//
//   1. El dataset completo: lo que muestra el sitio.
//   2. El anexo de evidencia limitada: las inversiones que la compuerta de confiabilidad
//      deja fuera (reliability_score < 2, o sea sin una sola fuente independiente que las
//      confirme). Se publican para que el registro quede trazable, no como dato de uso.
//
// Los dos archivos tienen las MISMAS hojas y columnas, así que se concatenan: README,
// investments (una fila por inversión), sites (la geometría), case_studies.
//
// Servimos el archivo procesado, no el XLSX crudo del cliente (tiene las deficiencias
// documentadas en la auditoría).
//
// PENDIENTE CLIENTE (ver next_steps 2.6): sugerir publicar también la base canónica de
// inversores (investors_map) una vez aprobada la auditoría.

const DATASET_URL = '/data/iclac_inversiones_china_latam.xlsx'
const ANNEX_URL = '/data/iclac_anexo_evidencia_limitada.xlsx'

// El ícono de descarga es el mismo en los dos botones: la diferencia entre principal y
// anexo la lleva el color, no un glifo distinto.
function DownloadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="h-5 w-5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
      />
    </svg>
  )
}

export default function DownloadsView() {
  const { t } = useTranslation()

  return (
    <div className="sangria-greca mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-4 text-3xl font-semibold text-[#093b4d]">{t('downloads.title')}</h1>

      {/* Título, cita, descarga, cuerpo: el mismo orden que Metodología. */}
      <div className="mb-6">
        <Citation text={t('common.citation_text')} />
      </div>

      <a
        href={DATASET_URL}
        download
        className="inline-flex items-center gap-2 rounded-md bg-[#093b4d] px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark"
      >
        <DownloadIcon />
        {t('downloads.link')}
      </a>
      <p className="mb-8 mt-2 text-xs text-gray-500">{t('downloads.format')}</p>

      <div
        className="text-justify leading-relaxed text-gray-700 [&_p]:mb-4"
        dangerouslySetInnerHTML={{ __html: t('downloads.description') }}
      />

      {/* Anexo. Va debajo y en secundario a propósito: es material de trazabilidad, no la
          descarga que la mayoría viene a buscar. */}
      <section className="mt-10 rounded-md border border-gray-200 bg-gray-50 p-5">
        <h2 className="mb-2 text-lg font-semibold text-[#093b4d]">{t('downloads.annex_title')}</h2>
        <div
          className="mb-4 text-justify text-sm leading-relaxed text-gray-700 [&_p]:mb-3"
          dangerouslySetInnerHTML={{ __html: t('downloads.annex_description') }}
        />
        <a
          href={ANNEX_URL}
          download
          className="inline-flex items-center gap-2 rounded-md border border-[#093b4d] px-4 py-2 text-sm font-medium text-[#093b4d] transition hover:bg-brand hover:text-gray-900"
        >
          <DownloadIcon />
          {t('downloads.annex_link')}
        </a>
        <p className="mt-2 text-xs text-gray-500">{t('downloads.annex_format')}</p>
      </section>
    </div>
  )
}
