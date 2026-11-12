import { boundsFromSegs, featCost, type CompactSeg, type PairMatch } from './segmentMatch.ts'
import { lineFeatures } from './lockBottomMatch.ts'
import { bodyOutlineCuttingLines } from './bodyOutlineFeatures.ts'

function asMatchableLines(segs: CompactSeg[]): CompactSeg[] {
  return segs
    .filter((s) => s.p0 && s.p1 && s.lengthUu > 1.5)
    .map((s) => ({
      ...s,
      kind: 'line',
      pointCount: 2,
    }))
}

export function matchBodyOutline(
  genSegs: CompactSeg[],
  realSegs: CompactSeg[],
  dims: { L: number; W: number; H: number },
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
} {
  // Generator is expected to pass outline-only cuts (+ creases for Y). Do not re-filter
  // through bodyOutlineCuttingLines — fillet chords below bodyBottom would be misclassified as lock.
  const aUse = asMatchableLines(genSegs.filter((s) => s.style === 'Cutting' && (s.lengthUu || 0) > 1.5))
  const bSegs = asMatchableLines(bodyOutlineCuttingLines(realSegs, dims))

  const aBound = boundsFromSegs(aUse)
  const aFeats = lineFeatures(aUse, aBound)
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
  }
}
