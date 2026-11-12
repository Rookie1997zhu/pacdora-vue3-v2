/**
 * Lab playback wrapper for research crashlock prototype.
 * Does not inject into knife.js / templates.
 */

import { generateCrashlockWithOutline } from '@packative-lab/prototype/crashlock.ts'

/**
 * @param {{ L:number, W:number, H:number }} params
 * @returns {{
 *   svg: string,
 *   gaps: string[],
 *   implemented: string[],
 *   widthUu: number,
 *   heightUu: number,
 *   params: { L:number, W:number, H:number },
 * }}
 */
export function playCrashlockPrototype({ L, W, H }) {
  const l = Number(L)
  const w = Number(W)
  const h = Number(H)
  if (!Number.isFinite(l) || !Number.isFinite(w) || !Number.isFinite(h)) {
    throw new Error('invalid_LWH')
  }
  if (l <= 0 || w <= 0 || h <= 0) {
    throw new Error('nonpositive_LWH')
  }
  // thickness/kerf stay 0 — material hooks remain unvalidated research hooks
  const result = generateCrashlockWithOutline({ L: l, W: w, H: h })
  return {
    svg: result.svg,
    gaps: result.gaps || [],
    implemented: result.implemented || [],
    widthUu: result.widthUu,
    heightUu: result.heightUu,
    params: { L: l, W: w, H: h },
  }
}
