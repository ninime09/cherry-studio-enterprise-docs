import { glob } from 'node:fs/promises'
import type { Config } from '@react-router/dev/config'
import { createGetUrl, getSlugs } from 'fumadocs-core/source'

import { i18n, locales } from './app/lib/i18n'
import { isLangEntryAllowed, normalizeVariant } from './app/lib/variant'

const getUrl = createGetUrl('/docs', i18n)

// Node-only config — read from process.env directly.
const VARIANT = normalizeVariant(process.env.DOCS_VARIANT)

export default {
  ssr: false,
  async prerender({ getStaticPaths }) {
    const paths = new Set<string>()
    const addPath = (path: string) => {
      paths.add(path)
      // 同时生成带尾部斜线的路径
      if (!path.endsWith('/')) {
        paths.add(`${path}/`)
      }
    }

    for (const path of getStaticPaths()) {
      addPath(path)
    }

    for (const lang of locales) {
      if (lang !== i18n.defaultLanguage) {
        addPath(`/${lang}`)
      }
    }

    // Always prerender the bare /docs root (and /{lang}/docs) so a direct visit
    // doesn't 404. The loader returns a redirect when no page matches the empty slug.
    addPath('/docs')
    for (const lang of locales) {
      if (lang !== i18n.defaultLanguage) addPath(`/${lang}/docs`)
    }

    for (const lang of locales) {
      for await (const entry of glob('**/*.mdx', { cwd: `content/docs/${lang}` })) {
        if (!isLangEntryAllowed(entry, VARIANT)) continue
        const url = getUrl(getSlugs(entry), lang)
        addPath(url)
      }
    }

    return Array.from(paths)
  }
} satisfies Config
