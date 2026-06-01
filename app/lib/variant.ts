// Docs variant: which top-level sections of the docs site are included
// in the build.
//
//   saas      → SaaS 使用文档（默认，原站）
//   selfhost  → Express 私有化部署文档
//
// Env reading happens at the call site (each context has different rules):
//   - Node / build scripts (react-router.config.ts): process.env.DOCS_VARIANT
//   - Vite client / SSR (source.ts, home.tsx, premium-only.tsx):
//       import.meta.env.VITE_DOCS_VARIANT  (must be a static access)
//
// This module stays env-free so it can be safely imported from any context.

export type DocsVariant = 'saas' | 'selfhost'

export const DEFAULT_VARIANT: DocsVariant = 'saas'

const TOP_LEVEL_INCLUDED: Record<DocsVariant, ReadonlySet<string>> = {
  saas: new Set(['index', 'quickstart', 'admin', 'client', 'pricing', 'contact']),
  selfhost: new Set(['setup', 'contact'])
}

export function normalizeVariant(raw: string | undefined | null): DocsVariant {
  return raw === 'selfhost' ? 'selfhost' : 'saas'
}

export function isTopLevelSlugAllowed(slug: string, variant: DocsVariant): boolean {
  return TOP_LEVEL_INCLUDED[variant].has(slug)
}

// `entry` is a path relative to a language root, e.g. "index.mdx" or
// "setup/docker.mdx" or "admin/about/index.mdx".
export function isLangEntryAllowed(entry: string, variant: DocsVariant): boolean {
  const first = entry.split('/')[0]
  const slug = first.replace(/\.(mdx?|json|ya?ml)$/i, '')
  return isTopLevelSlugAllowed(slug, variant)
}

// `virtualPath` is the source-loader path, e.g. "zh/index.mdx" or
// "zh/setup/docker.mdx" or "zh/meta.json".
export function isVirtualPathAllowed(virtualPath: string, variant: DocsVariant): boolean {
  const segments = virtualPath.split('/')
  if (segments.length < 2) return true
  return isLangEntryAllowed(segments.slice(1).join('/'), variant)
}

export function filterTopLevelMetaPages(
  pages: string[] | undefined,
  variant: DocsVariant
): string[] | undefined {
  if (!pages) return pages
  return pages.filter((p) => {
    if (p.startsWith('---')) return true
    return isTopLevelSlugAllowed(p, variant)
  })
}
