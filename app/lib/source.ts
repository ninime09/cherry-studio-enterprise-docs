import { loader } from 'fumadocs-core/source'

import { create, docs } from '@/.source'
import { i18n, locales } from './i18n'
import {
  filterTopLevelMetaPages,
  isVirtualPathAllowed,
  normalizeVariant
} from './variant'

// Static access — Vite forbids dynamic access of import.meta.env.
const VARIANT = normalizeVariant(import.meta.env.VITE_DOCS_VARIANT)

let _source: ReturnType<typeof loader> | null = null

export async function getSource() {
  if (!_source) {
    const rawSource = await create.sourceAsync(docs.doc, docs.meta)
    const langMetaPaths = new Set(locales.map((l) => `${l}/meta.json`))

    rawSource.files = rawSource.files
      .filter((f) => {
        if (langMetaPaths.has(f.path)) return true
        return isVirtualPathAllowed(f.path, VARIANT)
      })
      .map((f) => {
        if (f.type === 'meta' && langMetaPaths.has(f.path)) {
          return {
            ...f,
            data: {
              ...f.data,
              pages: filterTopLevelMetaPages(f.data.pages, VARIANT)
            }
          }
        }
        return f
      })

    _source = loader({
      source: rawSource,
      baseUrl: '/docs',
      i18n
    })
  }
  return _source
}
