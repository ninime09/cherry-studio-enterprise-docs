import type { ReactNode } from 'react'

// Static access — Vite forbids dynamic access of import.meta.env.
const SHOW_PREMIUM = import.meta.env.VITE_SHOW_PREMIUM === 'true'

// PremiumOnly hides content related to the deprecated Premium edition.
// Content stays in MDX (soft hide) but is not rendered unless
// VITE_SHOW_PREMIUM=true is set at build time.
export function PremiumOnly({ children }: { children?: ReactNode }) {
  if (!SHOW_PREMIUM) return null
  return <>{children}</>
}
