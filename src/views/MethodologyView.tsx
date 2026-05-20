import { useTranslation } from 'react-i18next'

export default function MethodologyView() {
  const { t } = useTranslation()
  return (
    <div className="p-8 text-gray-600">
      <h2 className="text-2xl font-semibold mb-4">{t('methodology.title')}</h2>
      <p>{t('common.coming_soon')}</p>
    </div>
  )
}
