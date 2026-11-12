export type Pt = { x: number; y: number }

export type CompactSeg = {
  kind: string
  style: string
  lengthUu: number
  p0: Pt | null
  p1: Pt | null
  pointCount: number
  /** World-space cubic control points when kind==='path' and a single C/c was preserved. */
  c0?: Pt | null
  c1?: Pt | null
}

export type Bounds = { minX: number; minY: number; width: number; height: number }

export type SegFeat = {
  index: number
  lengthUu: number
  pointCount: number
  kind: string
  /** envelope-normalized center */
  cx: number
  cy: number
  /** unit direction (undirected: force dx>=0 or dy>=0) */
  dx: number
  dy: number
  lengthNorm: number
}

function mid(a: Pt, b: Pt): Pt {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function undirectedDir(a: Pt, b: Pt): Pt {
  let dx = b.x - a.x
  let dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  dx /= len
  dy /= len
  if (dx < 0 || (Math.abs(dx) < 1e-9 && dy < 0)) {
    dx = -dx
    dy = -dy
  }
  return { x: dx, y: dy }
}

export function boundsFromSegs(segs: CompactSeg[]): Bounds | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const s of segs) {
    for (const p of [s.p0, s.p1]) {
      if (!p) continue
      minX = Math.min(minX, p.x)
      minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x)
      maxY = Math.max(maxY, p.y)
    }
  }
  if (!Number.isFinite(minX)) return null
  return { minX, minY, width: Math.max(1e-6, maxX - minX), height: Math.max(1e-6, maxY - minY) }
}

export function creaseFeatures(segs: CompactSeg[], bounds?: Bounds | null): SegFeat[] {
  const crease = segs.filter((s) => s.style === 'Creasing' && s.p0 && s.p1)
  const b = bounds ?? boundsFromSegs(crease)
  if (!b) return []
  const diag = Math.hypot(b.width, b.height) || 1
  return crease.map((s, index) => {
    const p0 = s.p0!
    const p1 = s.p1!
    const m = mid(p0, p1)
    const d = undirectedDir(p0, p1)
    return {
      index,
      lengthUu: s.lengthUu,
      pointCount: s.pointCount,
      kind: s.kind,
      cx: (m.x - b.minX) / b.width,
      cy: (m.y - b.minY) / b.height,
      dx: d.x,
      dy: d.y,
      lengthNorm: s.lengthUu / diag,
    }
  })
}

/** Cost between two normalized crease features (lower = better). */
export function featCost(a: SegFeat, b: SegFeat): number {
  const dPos = Math.hypot(a.cx - b.cx, a.cy - b.cy)
  const dDir = 1 - Math.abs(a.dx * b.dx + a.dy * b.dy) // 0..1
  const dLen = Math.abs(a.lengthNorm - b.lengthNorm)
  return dPos * 2 + dDir * 0.5 + dLen * 1.5
}

export type PairMatch = {
  aIndex: number
  bIndex: number
  cost: number
  /** Absolute center distance mapped into sample-A envelope uu (diagnostic). */
  endpointErrUu: number
  /** Normalized center distance in [0,~√2] (primary gate for cross-scale). */
  normPosErr: number
  aPointCount: number
  bPointCount: number
}

/**
 * Greedy one-to-one matching of crease features.
 * endpointErrUu approximates center distance in sample-A envelope uu.
 */
export function matchCreases(
  aSegs: CompactSeg[],
  bSegs: CompactSeg[],
): {
  matches: PairMatch[]
  unmatchedA: number[]
  unmatchedB: number[]
  matchRate: number
  medianEndpointErrUu: number
  maxEndpointErrUu: number
  medianNormPosErr: number
  maxNormPosErr: number
  polylineMidpointsDropped: boolean
} {
  const aBound = boundsFromSegs(aSegs.filter((s) => s.style === 'Creasing'))
  const aFeats = creaseFeatures(aSegs, aBound)
  const bFeats = creaseFeatures(bSegs, boundsFromSegs(bSegs.filter((s) => s.style === 'Creasing')))
  const usedB = new Set<number>()
  const matches: PairMatch[] = []
  const candidates: Array<{ i: number; j: number; cost: number }> = []
  for (let i = 0; i < aFeats.length; i++) {
    for (let j = 0; j < bFeats.length; j++) {
      candidates.push({ i, j, cost: featCost(aFeats[i], bFeats[j]) })
    }
  }
  candidates.sort((x, y) => x.cost - y.cost)
  const usedA = new Set<number>()
  for (const c of candidates) {
    if (usedA.has(c.i) || usedB.has(c.j)) continue
    usedA.add(c.i)
    usedB.add(c.j)
    const af = aFeats[c.i]
    const bf = bFeats[c.j]
    const normPosErr = Math.hypot(af.cx - bf.cx, af.cy - bf.cy)
    const endpointErrUu = aBound
      ? Math.hypot((af.cx - bf.cx) * aBound.width, (af.cy - bf.cy) * aBound.height)
      : c.cost * 100
    matches.push({
      aIndex: af.index,
      bIndex: bf.index,
      cost: c.cost,
      endpointErrUu,
      normPosErr,
      aPointCount: af.pointCount,
      bPointCount: bf.pointCount,
    })
  }
  const unmatchedA = aFeats.filter((_, i) => !usedA.has(i)).map((f) => f.index)
  const unmatchedB = bFeats.filter((_, i) => !usedB.has(i)).map((f) => f.index)
  const errs = matches.map((m) => m.endpointErrUu).sort((x, y) => x - y)
  const norms = matches.map((m) => m.normPosErr).sort((x, y) => x - y)
  const medianEndpointErrUu = errs.length ? errs[Math.floor(errs.length / 2)] : Infinity
  const maxEndpointErrUu = errs.length ? errs[errs.length - 1] : Infinity
  const medianNormPosErr = norms.length ? norms[Math.floor(norms.length / 2)] : Infinity
  const maxNormPosErr = norms.length ? norms[norms.length - 1] : Infinity
  const denom = Math.max(aFeats.length, bFeats.length, 1)
  return {
    matches,
    unmatchedA,
    unmatchedB,
    matchRate: matches.length / denom,
    medianEndpointErrUu,
    maxEndpointErrUu,
    medianNormPosErr,
    maxNormPosErr,
    polylineMidpointsDropped: [...aFeats, ...bFeats].some((f) => f.pointCount > 2),
  }
}
