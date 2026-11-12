/**
 * Lab playback wrapper for research crashlock prototype.
 * Does not inject into knife.js / templates.
 */

import {
  generateCrashlockWithOutline,
  setFitCoeffs,
} from '@packative-lab/prototype/crashlock.ts'
import fitCoeffs from '../../research/packative-dieline-lab/data/rules/fit-coeffs.json'

function applyPublishedFitCoeffs() {
  const w = fitCoeffs.geomWidthUu
  const h = fitCoeffs.geomHeightUu
  if (!w || !h) return
  setFitCoeffs(
    {
      a: w.a,
      b: w.b,
      c: w.c,
      d: w.d,
      e: w.e ?? 0,
      f: w.f ?? 0,
      g: w.g ?? 0,
      model: w.model,
      note: 'fit-coeffs.json geomWidthUu (Lab playback)',
    },
    {
      a: h.a,
      b: h.b,
      c: h.c,
      d: h.d,
      e: h.e ?? 0,
      f: h.f ?? 0,
      g: h.g ?? 0,
      model: h.model,
      note: 'fit-coeffs.json geomHeightUu (Lab playback)',
    },
  )
}

applyPublishedFitCoeffs()

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
