/**
 * Build-time script to generate static search indexes for fumadocs.
 * Reads all MDX files, extracts content, builds Orama databases per locale,
 * and exports to public/api/search.json for client-side static search.
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { create, insertMultiple, save } from '@orama/orama'

const CONTENT_DIR = 'content/docs'
const OUTPUT_FILE = 'public/api/search.json'
const LOCALES = ['en', 'zh', 'ja']
const DEFAULT_LOCALE = 'en'

// Mirror app/lib/variant.ts. Kept inline so the .mjs script has no TS dep.
const VARIANT = process.env.DOCS_VARIANT === 'selfhost' ? 'selfhost' : 'saas'
const VARIANT_TOP_LEVEL = {
  saas: new Set(['index', 'quickstart', 'admin', 'client', 'pricing', 'contact']),
  selfhost: new Set(['setup', 'contact'])
}
function isLangEntryAllowed(entry) {
  const first = entry.split('/')[0]
  const slug = first.replace(/\.(mdx?|json|ya?ml)$/i, '')
  return VARIANT_TOP_LEVEL[VARIANT].has(slug)
}

const advancedSchema = {
  content: 'string',
  page_id: 'string',
  type: 'string',
  breadcrumbs: 'string[]',
  tags: 'enum[]',
  url: 'string'
}

const CJK_REGEX = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/

function cjkTokenize(text) {
  const tokens = []
  const words = text.toLowerCase().split(/[\s,.;:!?()[\]{}"'""''、。！？；：（）【】「」『』·…—\-/]+/).filter(Boolean)
  tokens.push(...words)
  for (const word of words) {
    if (CJK_REGEX.test(word)) {
      for (let i = 0; i < word.length - 1; i++) tokens.push(word.slice(i, i + 2))
    }
  }
  return tokens
}

const CJK_LOCALES = new Set(['zh', 'ja'])

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return { title: '', description: '', body: raw }
  const fm = match[1]
  const titleMatch = fm.match(/title:\s*["']([^"']*)["']/) || fm.match(/title:\s*(.+)/)
  const descMatch = fm.match(/description:\s*["']([^"']*)["']/) || fm.match(/description:\s*(.+)/)
  return {
    title: titleMatch?.[1] || '',
    description: descMatch?.[1]?.replace(/^["']|["']$/g, '').trim() || '',
    body: raw.slice(match[0].length)
  }
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// Strip <PremiumOnly>...</PremiumOnly> blocks unless VITE_SHOW_PREMIUM=true.
const SHOW_PREMIUM = process.env.VITE_SHOW_PREMIUM === 'true'
function stripPremiumBlocks(body) {
  if (SHOW_PREMIUM) return body
  return body.replace(/<PremiumOnly>[\s\S]*?<\/PremiumOnly>/g, '')
}

function extractHeadings(body) {
  const clean = stripPremiumBlocks(body).replace(/```[\s\S]*?```/g, '')
  const headings = []
  const regex = /^(#{1,3})\s+(.+)$/gm
  let m
  while ((m = regex.exec(clean))) {
    const text = m[2]
      .replace(/\*\*/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[🛠️🚀☁️⚖️📚🏷️🌍🐧💰❓]/gu, '')
      .trim()
    if (text) headings.push({ id: slugify(text), content: text })
  }
  return headings
}


async function buildBreadcrumbMap(localeDir) {
  const map = {}
  async function walk(dir) {
    const metaPath = join(dir, 'meta.json')
    try {
      const raw = await readFile(metaPath, 'utf-8')
      const meta = JSON.parse(raw)
      const slug = relative(localeDir, dir).replace(/\\/g, '/')
      if (slug && meta.title) {
        map[slug] = meta.title
      }
    } catch {}
    const items = await readdir(dir, { withFileTypes: true })
    for (const item of items) {
      if (item.isDirectory()) await walk(join(dir, item.name))
    }
  }
  await walk(localeDir)
  return map
}

async function getMdxFiles(dir) {
  const entries = []
  async function walk(d) {
    const items = await readdir(d, { withFileTypes: true })
    for (const item of items) {
      const full = join(d, item.name)
      if (item.isDirectory()) await walk(full)
      else if (item.name.endsWith('.mdx') || item.name.endsWith('.md')) entries.push(full)
    }
  }
  await walk(dir)
  return entries
}

async function buildLocaleIndex(locale) {
  const dir = join(CONTENT_DIR, locale)
  const allFiles = await getMdxFiles(dir)
  const files = allFiles.filter((file) =>
    isLangEntryAllowed(relative(dir, file).replace(/\\/g, '/'))
  )
  const breadcrumbMap = await buildBreadcrumbMap(dir)

  // Build title map from MDX frontmatter for leaf page breadcrumbs
  const titleMap = {}
  for (const file of files) {
    const raw = await readFile(file, 'utf-8')
    const { title } = parseFrontmatter(raw)
    if (!title) continue
    const rel = relative(dir, file)
      .replace(/\\/g, '/')
      .replace(/\.mdx?$/, '')
      .replace(/(^|\/)index$/, '')
    if (rel) titleMap[rel] = title
  }

  const dbOptions = { schema: advancedSchema }
  if (CJK_LOCALES.has(locale)) {
    dbOptions.components = {
      tokenizer: { tokenize: cjkTokenize }
    }
  }
  const db = create(dbOptions)
  const items = []

  for (const file of files) {
    const raw = await readFile(file, 'utf-8')
    const { title, description, body } = parseFrontmatter(raw)
    if (!title) continue

    const rel = relative(dir, file)
      .replace(/\\/g, '/')
      .replace(/\.mdx?$/, '')
      .replace(/(^|\/)index$/, '')

    const urlPrefix = locale === DEFAULT_LOCALE ? '/docs' : `/${locale}/docs`
    const url = rel ? `${urlPrefix}/${rel}` : urlPrefix
    const pageId = url
    const slugParts = rel.split('/').filter(Boolean)
    const breadcrumbs = slugParts.map((_, i) => {
      const path = slugParts.slice(0, i + 1).join('/')
      return breadcrumbMap[path] || titleMap[path] || slugParts[i]
    })

    // Page entry (title)
    items.push({
      id: pageId,
      page_id: pageId,
      type: 'page',
      content: title,
      breadcrumbs,
      tags: [],
      url
    })

    // H1-H3 headings only
    const headings = extractHeadings(body)
    headings.forEach((h, i) => {
      items.push({
        id: `${pageId}-h-${i}`,
        page_id: pageId,
        type: 'heading',
        content: h.content,
        breadcrumbs,
        tags: [],
        url: `${url}#${h.id}`
      })
    })
  }

  await insertMultiple(db, items)
  console.log(`  ${locale}: ${files.length} pages, ${items.length} index entries`)
  return { type: 'advanced', ...save(db) }
}

async function main() {
  await mkdir('public/api', { recursive: true })

  const data = {}
  for (const locale of LOCALES) {
    data[locale] = await buildLocaleIndex(locale)
  }

  const output = JSON.stringify({ type: 'i18n', data })
  await writeFile(OUTPUT_FILE, output)
  const sizeMB = (Buffer.byteLength(output) / 1024 / 1024).toFixed(2)
  console.log(`Search index written to ${OUTPUT_FILE} (${sizeMB} MB)`)
}

main().catch((err) => {
  console.error('Failed to build search index:', err)
  process.exit(1)
})
