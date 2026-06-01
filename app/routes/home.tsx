import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'

import { i18n, isLocale, setPreferredLocale } from '@/lib/i18n'
import { getTranslations } from '@/lib/translations'
import { normalizeVariant } from '@/lib/variant'

import type { Route } from './+types/home'

// Static access — Vite forbids dynamic access of import.meta.env.
const DOCS_ROOT =
  normalizeVariant(import.meta.env.VITE_DOCS_VARIANT) === 'selfhost' ? '/docs/setup' : '/docs'

export function meta({ params }: Route.MetaArgs) {
  const lang = isLocale(params.lang) ? params.lang : i18n.defaultLanguage
  const t = getTranslations(lang)

  return [{ title: t.meta.title }, { name: 'description', content: t.meta.description }]
}

export default function Home() {
  const params = useParams()
  const explicitLang = isLocale(params.lang) ? params.lang : null
  const lang = explicitLang ?? i18n.defaultLanguage
  const docsPath = lang === i18n.defaultLanguage ? DOCS_ROOT : `/${lang}${DOCS_ROOT}`
  const navigate = useNavigate()

  useEffect(() => {
    if (explicitLang) setPreferredLocale(explicitLang)
    navigate(docsPath, { replace: true })
  }, [docsPath, explicitLang, navigate])

  return (
    <>
      <meta httpEquiv="refresh" content={`0; url=${docsPath}`} />
      <noscript>
        <p style={{ padding: '2rem', textAlign: 'center' }}>
          Redirecting to <a href={docsPath}>{docsPath}</a>...
        </p>
      </noscript>
    </>
  )
}
