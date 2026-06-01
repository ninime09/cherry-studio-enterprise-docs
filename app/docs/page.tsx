import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import type * as React from 'react'
import type * as PageTree from 'fumadocs-core/page-tree'
import { toClientRenderer } from 'fumadocs-mdx/runtime/vite'
import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import defaultMdxComponents from 'fumadocs-ui/mdx'
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/page'
import type { TOCItemType } from 'fumadocs-core/toc'

import { docs } from '@/.source'
import { Card, Cards } from '@/components/card'
import { ConditionalBreadcrumb } from '@/components/conditional-breadcrumb'
import { ExperienceCard, ExperienceCards } from '@/components/experience-card'
import { ImageSteps } from '@/components/image-steps'
import { PremiumOnly } from '@/components/premium-only'
import { sidebarComponents } from '@/components/sidebar-components'
import { i18n, isLocale } from '@/lib/i18n'
import { baseOptions } from '@/lib/layout.shared'
import { getSource } from '@/lib/source'
import { normalizeVariant } from '@/lib/variant'

import type { Route } from './+types/page'

// Static access — Vite forbids dynamic access of import.meta.env.
const DOCS_ROOT =
  normalizeVariant(import.meta.env.VITE_DOCS_VARIANT) === 'selfhost' ? '/docs/setup' : '/docs'

export async function loader({ params }: Route.LoaderArgs) {
  const source = await getSource()
  const lang = isLocale(params.lang) ? params.lang : i18n.defaultLanguage
  const slugs = params['*'].split('/').filter((v) => v.length > 0)
  const page = source.getPage(slugs, lang)
  if (!page) {
    // No matching page at /docs root (e.g. selfhost filters out the root index).
    // Send the visitor to the variant's docs entry instead of throwing.
    if (slugs.length === 0) {
      const target = lang === i18n.defaultLanguage ? DOCS_ROOT : `/${lang}${DOCS_ROOT}`
      return { redirect: target, lang } as const
    }
    throw new Response('Not found', { status: 404 })
  }

  return {
    path: page.path,
    tree: source.getPageTree(lang),
    lang
  }
}

const DOWNLOAD_EXT = /\.(zip|pdf|tar|tar\.gz|tgz|gz|7z|rar|exe|dmg|pkg|msi|deb|rpm)(\?|#|$)/i

function DownloadAwareLink({ href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (typeof href === 'string' && DOWNLOAD_EXT.test(href)) {
    return <a href={href} download {...props} />
  }
  const Anchor = defaultMdxComponents.a as React.ComponentType<React.AnchorHTMLAttributes<HTMLAnchorElement>>
  return <Anchor href={href} {...props} />
}

const renderer = toClientRenderer(docs.doc, ({ toc, default: Mdx, frontmatter }) => {
  const fullToc: TOCItemType[] = [
    { title: frontmatter.title, url: '#page-title', depth: 2 },
    ...toc.map((item) => ({ ...item, depth: item.depth + 1 }))
  ]
  return (
    <DocsPage toc={fullToc} breadcrumb={{ component: <ConditionalBreadcrumb /> }}>
      <title>{frontmatter.title}</title>
      <meta name="description" content={frontmatter.description} />
      <DocsTitle id="page-title">{frontmatter.title}</DocsTitle>
      <DocsDescription>{frontmatter.description}</DocsDescription>
      <DocsBody>
        <Mdx components={{ ...defaultMdxComponents, a: DownloadAwareLink, Card, Cards, ExperienceCard, ExperienceCards, ImageSteps, PremiumOnly }} />
      </DocsBody>
    </DocsPage>
  )
})

function DocsRootRedirect({ to }: { to: string }) {
  const navigate = useNavigate()
  useEffect(() => {
    navigate(to, { replace: true })
  }, [to, navigate])
  return (
    <>
      <meta httpEquiv="refresh" content={`0; url=${to}`} />
      <noscript>
        <p style={{ padding: '2rem', textAlign: 'center' }}>
          Redirecting to <a href={to}>{to}</a>...
        </p>
      </noscript>
    </>
  )
}

export default function Page({ loaderData }: Route.ComponentProps) {
  if ('redirect' in loaderData) {
    return <DocsRootRedirect to={loaderData.redirect} />
  }
  const { tree, path, lang } = loaderData
  const Content = renderer[path]

  return (
    <DocsLayout
      {...baseOptions(lang)}
      tree={tree as PageTree.Root}
      sidebar={{ components: sidebarComponents }}
    >
      <Content />
    </DocsLayout>
  )
}
