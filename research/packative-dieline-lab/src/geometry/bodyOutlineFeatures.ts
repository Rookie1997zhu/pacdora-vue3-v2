import type { CompactSeg, Pt } from './segmentMatch.ts'
import {
  UU_PER_MM,
  inferBodyBottomY,
  layoutLockBottomUu,
  lockBottomCuttingLines,
  segLine,
  type LockBottomLayoutUu,
} from './lockBottomFeatures.ts'
import { inferBodyTopY, topFlapCuttingLines } from './topFlapFeatures.ts'

/** @deprecated Prefer DEFAULT_CUBIC_PARAMS from cubicParams.ts */
export type { CubicOffMm, CrashlockCubicParamsMm as BodyOutlineParamsMm } from './cubicParams.ts'
export { DEFAULT_CUBIC_PARAMS as DEFAULT_OUTLINE_PARAMS } from './cubicParams.ts'

function C(a: Pt, b: Pt): CompactSeg {
  return segLine(a, b, 'Cutting')
}

/**
 * Leftover cutting: not lock-bottom and not top/glue (paths now owned by those slices).
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
 * Body outline leftovers: straight edges only (cubics owned by lock/top slices).
 */
export function buildBodyOutlineSegments(
  layout: LockBottomLayoutUu,
  params?: { microBridgeMm?: number },
): { cutting: CompactSeg[]; curveApprox: boolean; filletsExact: boolean } {
  const u = UU_PER_MM
  const { x0, x1, x4, yBodySide, yBodyTop } = layout
  const micro = (params?.microBridgeMm ?? 0.75) * u

  const cutting: CompactSeg[] = [
    // front L-panel bottom outer cutting (length ≈ L)
    C({ x: x1, y: yBodySide }, { x: x0, y: yBodySide }),
    // right body outer vertical (length ≈ H)
    C({ x: x4, y: yBodySide }, { x: x4, y: yBodyTop }),
    // micro bridge at body bottom crease
    C({ x: x1, y: yBodySide }, { x: x1 + micro, y: yBodySide }),
  ]

  return { cutting, curveApprox: false, filletsExact: true }
}
