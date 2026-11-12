import { boundsFromSegs, featCost, type CompactSeg, type PairMatch } from './segmentMatch.ts'
import { lineFeatures } from './lockBottomMatch.ts'
import { layoutLockBottomUu } from './lockBottomFeatures.ts'
import { inferBodyTopY, topFlapCuttingLines } from './topFlapFeatures.ts'

export function matchTopCutting(
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
  bodyTopY: number | null
} {
  const lay = layoutLockBottomUu(dims.L, dims.W, dims.H)
  const realTopY = inferBodyTopY(realSegs)
  const genTopY = inferBodyTopY(genSegs) ?? realTopY
  const glueX = lay.x0

  const bSegs =
    realTopY != null ? topFlapCuttingLines(realSegs, realTopY, glueX) : ([] as CompactSeg[])
  const aSegs =
    genTopY != null
      ? topFlapCuttingLines(genSegs, genTopY, glueX)
      : genSegs.filter((s) => s.style === 'Cutting' && s.kind === 'line')

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
    bodyTopY: realTopY,
  }
}
