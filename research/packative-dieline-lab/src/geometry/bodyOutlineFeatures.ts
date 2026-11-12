import type { CompactSeg, Pt } from './segmentMatch.ts'
import {
  UU_PER_MM,
  inferBodyBottomY,
  layoutLockBottomUu,
  lockBottomCuttingLines,
  segLine,
  type LockBottomLayoutUu,
  DEFAULT_LOCK_PARAMS,
} from './lockBottomFeatures.ts'
import { inferBodyTopY, topFlapCuttingLines } from './topFlapFeatures.ts'

/** Body-outline / leftover fillet params (mm). */
export type BodyOutlineParamsMm = {
  microBridgeMm: number
  bigCornerFromCreaseMm: number
  filletOutAlongMm: number
  filletOutUpMm: number
  filletInAlongMm: number
  filletInUpMm: number
  filletX2OutAlongMm: number
  filletX2OutUpMm: number
}

export const DEFAULT_OUTLINE_PARAMS: BodyOutlineParamsMm = {
  microBridgeMm: 0.75,
  bigCornerFromCreaseMm: 1.89,
  filletOutAlongMm: 3.55,
  filletOutUpMm: 2.49,
  filletInAlongMm: 2.89,
  filletInUpMm: 1.34,
  filletX2OutAlongMm: 3.77,
  filletX2OutUpMm: 3.58,
}

function C(a: Pt, b: Pt): CompactSeg {
  return segLine(a, b, 'Cutting')
}

/**
 * Leftover cutting: not lock-bottom lines and not top/glue lines.
 * Includes path segments (fillets); excludes zero-length degenerates.
 */
export function bodyOutlineCuttingLines(
  segs: CompactSeg[],
  dims: { L: number; W: number; H: number },
  minLenUu = 1.5,
): CompactSeg[] {
  const bodyBottomY = inferBodyBottomY(segs)
  const bodyTopY = inferBodyTopY(segs)
  const lay = layoutLockBottomUu(dims.L, dims.W, dims.H)
  if (bodyBottomY == null || bodyTopY == null) return []

  const lockIdx = new Set<number>()
  const topIdx = new Set<number>()
  segs.forEach((s, i) => {
    if (s.style !== 'Cutting' || !s.p0 || !s.p1) return
    if (lockBottomCuttingLines([s], bodyBottomY).length) lockIdx.add(i)
    if (topFlapCuttingLines([s], bodyTopY, lay.x0).length) topIdx.add(i)
  })
  return segs.filter((s, i) => {
    if (s.style !== 'Cutting' || !s.p0 || !s.p1) return false
    if (lockIdx.has(i) || topIdx.has(i)) return false
    if (s.lengthUu < minLenUu) return false
    return true
  })
}

/**
 * Parametric body outline leftovers (~11 meaningful segments).
 * Path fillets emitted as chord lines (curve_approx).
 */
export function buildBodyOutlineSegments(
  layout: LockBottomLayoutUu,
  params: BodyOutlineParamsMm = DEFAULT_OUTLINE_PARAMS,
): { cutting: CompactSeg[]; curveApprox: boolean } {
  const u = UU_PER_MM
  const { x0, x1, x2, x3, x4, yBodySide, yBodyTop, yBodyTopInner, yBottom, yNotch } = layout
  const micro = params.microBridgeMm * u
  const botInset = DEFAULT_LOCK_PARAMS.botInsetMm * u

  const cutting: CompactSeg[] = [
    // front L-panel bottom outer cutting (length ≈ L)
    C({ x: x1, y: yBodySide }, { x: x0, y: yBodySide }),
    // right body outer vertical (length ≈ H)
    C({ x: x4, y: yBodySide }, { x: x4, y: yBodyTop }),
    // micro bridge at body bottom crease
    C({ x: x1, y: yBodySide }, { x: x1 + micro, y: yBodySide }),
    // big-flap corner chords (2 path fillets → curve_approx)
    C({ x: x2 + params.bigCornerFromCreaseMm * u, y: yNotch }, { x: x2 + botInset, y: yBottom }),
    C({ x: x3 - params.bigCornerFromCreaseMm * u, y: yNotch }, { x: x3 - botInset, y: yBottom }),
    // 6 body-top fillet chords at x1/x2/x3 crease junctions
    C({ x: x1, y: yBodyTopInner }, { x: x1 + params.filletOutAlongMm * u, y: yBodyTopInner + params.filletOutUpMm * u }),
    C({ x: x1, y: yBodyTopInner }, { x: x1 - params.filletInAlongMm * u, y: yBodyTopInner + params.filletInUpMm * u }),
    C({ x: x2, y: yBodyTopInner }, { x: x2 - params.filletInAlongMm * 0.92 * u, y: yBodyTopInner + params.filletInUpMm * 0.83 * u }),
    C({ x: x2, y: yBodyTopInner }, { x: x2 + params.filletX2OutAlongMm * u, y: yBodyTopInner + params.filletX2OutUpMm * u }),
    C({ x: x3, y: yBodyTopInner }, { x: x3 + params.filletOutAlongMm * u, y: yBodyTopInner + params.filletOutUpMm * u }),
    C({ x: x3, y: yBodyTopInner }, { x: x3 - params.filletInAlongMm * u, y: yBodyTopInner + params.filletInUpMm * u }),
  ]

  return { cutting, curveApprox: true }
}
