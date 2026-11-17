/** Shared Motion for Vue enter presets (展示面统一入场). */

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

const easeOut = [0.22, 1, 0.36, 1] as const

export const pageEnter = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: easeOut },
}

export const softHover = {
  whileHover: { y: -2 },
  transition: { duration: 0.2, ease: easeOut },
}

/** Stagger delay for list/grid items; capped so long lists don't wait forever. */
export function staggerItemTransition(index: number, step = 0.05, cap = 0.3) {
  const delay = prefersReducedMotion() ? 0 : Math.min(index * step, cap)
  return { duration: 0.42, ease: easeOut, delay }
}

export function enterProps(extraDelay = 0) {
  if (prefersReducedMotion()) {
    return {
      initial: false as const,
      animate: pageEnter.animate,
      transition: { duration: 0 },
    }
  }
  return {
    initial: pageEnter.initial,
    animate: pageEnter.animate,
    transition: {
      ...pageEnter.transition,
      delay: extraDelay,
    },
  }
}

export function staggerEnterProps(index: number) {
  if (prefersReducedMotion()) {
    return {
      initial: false as const,
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0 },
    }
  }
  return {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: staggerItemTransition(index),
  }
}
