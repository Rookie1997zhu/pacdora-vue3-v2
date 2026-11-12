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

/** Cubic fillet offsets in mm relative to path start p0 (fitted on real SVGs). */
export type CubicOffMm = { c0: Pt; c1: Pt; p1: Pt }

export type BodyOutlineParamsMm = {
  microBridgeMm: number
  bigCornerFromCreaseMm: number
  bigFlapCubic: CubicOffMm
  topOutCubic: CubicOffMm
  topInCubic: CubicOffMm
  topX2InCubic: CubicOffMm
  topX2OutCubic: CubicOffMm
}

export const DEFAULT_OUTLINE_PARAMS: BodyOutlineParamsMm = {
  microBridgeMm: 0.75,
  bigCornerFromCreaseMm: 1.89,
  // lockish big-flap corners (mirrored on x for left/right)
  bigFlapCubic: {
    c0: { x: 0.249, y: -4.641 },
    c1: { x: 2.785, y: -8.856 },
    p1: { x: 6.769, y: -11.25 },
  },
  topOutCubic: {
    c0: { x: 0.42, y: 0 },
    c1: { x: 0.796, y: 0.263 },
    p1: { x: 0.94, y: 0.658 },
  },
  topInCubic: {
    c0: { x: -0.295, y: 0 },
    c1: { x: -0.574, y: 0.13 },
    p1: { x: -0.764, y: 0.355 },
  },
  topX2InCubic: {
    c0: { x: -0.265, y: 0 },
    c1: { x: -0.52, y: 0.105 },
    p1: { x: -0.707, y: 0.293 },
  },
  topX2OutCubic: {
    c0: { x: 0.532, y: 0 },
    c1: { x: 0.971, y: 0.416 },
    p1: { x: 0.999, y: 0.948 },
  },
}

function C(a: Pt, b: Pt): CompactSeg {
  return segLine(a, b, 'Cutting')
}

function pathCubic(p0: Pt, c0: Pt, c1: Pt, p1: Pt, style: 'Cutting' | 'Creasing' = 'Cutting'): CompactSeg {
  return {
    kind: 'path',
    style,
    lengthUu: Math.hypot(p1.x - p0.x, p1.y - p0.y),
    p0,
    p1,
    pointCount: 4,
    c0,
    c1,
  }
}

function applyCubic(p0: Pt, off: CubicOffMm, mirrorX: boolean): CompactSeg {
  const u = UU_PER_MM
  const sx = mirrorX ? -1 : 1
  const c0 = { x: p0.x + sx * off.c0.x * u, y: p0.y + off.c0.y * u }
  const c1 = { x: p0.x + sx * off.c1.x * u, y: p0.y + off.c1.y * u }
  const p1 = { x: p0.x + sx * off.p1.x * u, y: p0.y + off.p1.y * u }
  return pathCubic(p0, c0, c1, p1, 'Cutting')
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
 * Body outline leftovers: straight edges + exact cubic fillets (8 paths).
 */
export function buildBodyOutlineSegments(
  layout: LockBottomLayoutUu,
  params: BodyOutlineParamsMm = DEFAULT_OUTLINE_PARAMS,
): { cutting: CompactSeg[]; curveApprox: boolean; filletsExact: boolean } {
  const u = UU_PER_MM
  const { x0, x1, x2, x3, x4, yBodySide, yBodyTop, yBodyTopInner, yNotch } = layout
  const micro = params.microBridgeMm * u

  const cutting: CompactSeg[] = [
    // front L-panel bottom outer cutting (length ≈ L)
    C({ x: x1, y: yBodySide }, { x: x0, y: yBodySide }),
    // right body outer vertical (length ≈ H)
    C({ x: x4, y: yBodySide }, { x: x4, y: yBodyTop }),
    // micro bridge at body bottom crease
    C({ x: x1, y: yBodySide }, { x: x1 + micro, y: yBodySide }),
    // 2 big-flap corner cubics
    applyCubic({ x: x2 + params.bigCornerFromCreaseMm * u, y: yNotch }, params.bigFlapCubic, false),
    applyCubic({ x: x3 - params.bigCornerFromCreaseMm * u, y: yNotch }, params.bigFlapCubic, true),
    // 6 body-top fillet cubics at x1/x2/x3
    applyCubic({ x: x1, y: yBodyTopInner }, params.topOutCubic, false),
    applyCubic({ x: x1, y: yBodyTopInner }, params.topInCubic, false),
    applyCubic({ x: x2, y: yBodyTopInner }, params.topX2InCubic, false),
    applyCubic({ x: x2, y: yBodyTopInner }, params.topX2OutCubic, false),
    applyCubic({ x: x3, y: yBodyTopInner }, params.topOutCubic, false),
    applyCubic({ x: x3, y: yBodyTopInner }, params.topInCubic, false),
  ]

  return { cutting, curveApprox: false, filletsExact: true }
}
