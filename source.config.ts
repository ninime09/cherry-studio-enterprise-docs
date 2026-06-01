import { defineConfig, defineDocs } from 'fumadocs-mdx/config'
import { visit } from 'unist-util-visit'

// VITE_SHOW_PREMIUM is also consumed at runtime by <PremiumOnly>; keep flag in sync.
const SHOW_PREMIUM = process.env.VITE_SHOW_PREMIUM === 'true'

// Strip headings nested inside <PremiumOnly> so they don't appear in the right-side TOC
// while the runtime component hides their content.
function remarkStripPremiumHeadings() {
  return (tree: any) => {
    if (SHOW_PREMIUM) return
    visit(tree, (node: any) => {
      if (
        (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') &&
        node.name === 'PremiumOnly' &&
        Array.isArray(node.children)
      ) {
        node.children = node.children.filter((child: any) => child.type !== 'heading')
      }
    })
  }
}

export const docs = defineDocs({
  dir: 'content/docs'
})

export default defineConfig({
  lastModifiedTime: 'git',
  mdxOptions: {
    remarkPlugins: [remarkStripPremiumHeadings]
  }
})
