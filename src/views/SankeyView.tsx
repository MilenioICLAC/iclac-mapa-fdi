import { useTranslation } from 'react-i18next'

export default function SankeyView() {
  const { t } = useTranslation()
  return (
    <div className="p-8 text-gray-600">
      <h2 className="text-2xl font-semibold mb-4">{t('sankey.title')}</h2>
      <p>{t('common.coming_soon')}</p>
    </div>
  )
}
