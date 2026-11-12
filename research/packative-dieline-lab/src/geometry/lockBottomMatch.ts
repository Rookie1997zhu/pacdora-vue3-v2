import {
  boundsFromSegs,
  featCost,
  type CompactSeg,
  type PairMatch,
  type SegFeat,
  type Bounds,
} from './segmentMatch.ts'
import { inferBodyBottomY, lockBottomCuttingLines } from './lockBottomFeatures.ts'

function mid(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function undirectedDir(a: { x: number; y: number }, b: { x: number; y: number }) {
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

export function lineFeatures(segs: CompactSeg[], bounds?: Bounds | null): SegFeat[] {
  const lines = segs.filter((s) => s.kind === 'line' && s.p0 && s.p1)
  const b = bounds ?? boundsFromSegs(lines)
  if (!b) return []
  const diag = Math.hypot(b.width, b.height) || 1
  return lines.map((s, index) => {
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

export function matchLockCutting(
  genSegs: CompactSeg[],
  realSegs: CompactSeg[],
): {
  matches: PairMatch[]
  unmatchedGen: number[]
  unmatchedReal: number[]
  matchRate: number
  matched: number
  genCount: number
  realCount: number
  medianEndpointErrUu: number
  medianNormPosErr: number
  maxNormPosErr: number
  bodyBottomY: number | null
} {
  const bodyBottomY = inferBodyBottomY(realSegs)
  const realLock =
    bodyBottomY != null ? lockBottomCuttingLines(realSegs, bodyBottomY) : genSegs.filter(() => false)
  // Generator cutting is already lock-only; still clip by its own body hinge if creases present
  const genBodyY = inferBodyBottomY(genSegs) ?? bodyBottomY
  const genLock =
    genBodyY != null
      ? lockBottomCuttingLines(
          genSegs.map((s) => s),
          genBodyY,
        )
      : genSegs.filter((s) => s.style === 'Cutting' && s.kind === 'line')

  // If generator segs are cutting-only (no creases), use all cutting lines
  const aSegs = genLock.length ? genLock : genSegs.filter((s) => s.style === 'Cutting' && s.kind === 'line')
  const bSegs = realLock

  const aBound = boundsFromSegs(aSegs)
  const aFeats = lineFeatures(aSegs, aBound)
  const bFeats = lineFeatures(bSegs, boundsFromSegs(bSegs))
  const usedB = new Set<number>()
  const usedA = new Set<number>()
  const matches: PairMatch[] = []
  const candidates: Array<{ i: number; j: number; cost: number }> = []
  for (let i = 0; i < aFeats.length; i++) {
    for (let j = 0; j < bFeats.length; j++) {
      candidates.push({ i, j, cost: featCost(aFeats[i], bFeats[j]) })
    }
  }
  candidates.sort((x, y) => x.cost - y.cost)
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
  const unmatchedGen = aFeats.filter((_, i) => !usedA.has(i)).map((f) => f.index)
  const unmatchedReal = bFeats.filter((_, i) => !usedB.has(i)).map((f) => f.index)
  const errs = matches.map((m) => m.endpointErrUu).sort((x, y) => x - y)
  const norms = matches.map((m) => m.normPosErr).sort((x, y) => x - y)
  const denom = Math.max(aFeats.length, bFeats.length, 1)
  return {
    matches,
    unmatchedGen,
    unmatchedReal,
    matchRate: matches.length / denom,
    matched: matches.length,
    genCount: aFeats.length,
    realCount: bFeats.length,
    medianEndpointErrUu: errs.length ? errs[Math.floor(errs.length / 2)] : Infinity,
    medianNormPosErr: norms.length ? norms[Math.floor(norms.length / 2)] : Infinity,
    maxNormPosErr: norms.length ? norms[norms.length - 1] : Infinity,
    bodyBottomY,
  }
}
