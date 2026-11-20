import { prefersReducedMotion } from './presets'

/** Prefer static poster instead of autoplaying video. */
export function prefersStaticHeroMedia(): boolean {
  if (typeof window === 'undefined') return false
  if (prefersReducedMotion()) return true
  try {
    const nav = navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string }
    }
    if (nav.connection?.saveData) return true
    const type = String(nav.connection?.effectiveType || '')
    if (type === 'slow-2g' || type === '2g') return true
  } catch {
    /* ignore */
  }
  return false
}

export { prefersReducedMotion }
