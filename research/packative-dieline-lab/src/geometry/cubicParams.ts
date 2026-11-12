import type { Bounds, CompactSeg, Pt } from './segmentMatch.ts'

const UU_PER_MM = 96 / 25.4

/** Cubic fillet offsets in mm relative to path start p0 (fitted on real SVGs). */
export type CubicOffMm = { c0: Pt; c1: Pt; p1: Pt }

export type CrashlockCubicParamsMm = {
  bigCornerFromCreaseMm: number
  bigFlapCubic: CubicOffMm
  topOutCubic: CubicOffMm
  topInCubic: CubicOffMm
  topX2InCubic: CubicOffMm
  topX2OutCubic: CubicOffMm
}

export const DEFAULT_CUBIC_PARAMS: CrashlockCubicParamsMm = {
  bigCornerFromCreaseMm: 1.89,
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

export function pathCubic(p0: Pt, c0: Pt, c1: Pt, p1: Pt, style: 'Cutting' | 'Creasing' = 'Cutting'): CompactSeg {
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

export function applyCubic(p0: Pt, off: CubicOffMm, mirrorX: boolean): CompactSeg {
  const u = UU_PER_MM
  const sx = mirrorX ? -1 : 1
  const c0 = { x: p0.x + sx * off.c0.x * u, y: p0.y + off.c0.y * u }
  const c1 = { x: p0.x + sx * off.c1.x * u, y: p0.y + off.c1.y * u }
  const p1 = { x: p0.x + sx * off.p1.x * u, y: p0.y + off.p1.y * u }
  return pathCubic(p0, c0, c1, p1, 'Cutting')
}

/** Envelope-normalized cubic control residual (undirected). */
export function cubicNormErr(a: CompactSeg, b: CompactSeg, bound: Bounds | null): number | null {
  if (!a.c0 || !a.c1 || !b.c0 || !b.c1 || !bound) return null
  const w = bound.width || 1
  const h = bound.height || 1
  const n = (p: Pt) => ({ x: (p.x - bound.minX) / w, y: (p.y - bound.minY) / h })
  const a0 = n(a.c0)
  const a1 = n(a.c1)
  const b0 = n(b.c0)
  const b1 = n(b.c1)
  const direct = Math.hypot(a0.x - b0.x, a0.y - b0.y) + Math.hypot(a1.x - b1.x, a1.y - b1.y)
  const swapped = Math.hypot(a0.x - b1.x, a0.y - b1.y) + Math.hypot(a1.x - b0.x, a1.y - b0.y)
  return Math.min(direct, swapped) / 2
}

/** Treat paths as endpoint lines for greedy matching; keep originals for cubic residual. */
export function asEndpointFeats(segs: CompactSeg[]) {
  const usable = segs.filter((s) => s.p0 && s.p1 && s.lengthUu > 1.5)
  const lines = usable.map((s) => ({
    ...s,
    kind: 'line',
    pointCount: 2,
  }))
  return { lines, originals: usable }
}
