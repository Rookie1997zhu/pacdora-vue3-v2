import type { CompactSeg, Pt } from './segmentMatch.ts'
import {
  MM_PER_UU,
  UU_PER_MM,
  layoutLockBottomUu,
  segLine,
  type LockBottomLayoutUu,
} from './lockBottomFeatures.ts'

/** Empirical top-flap / glue params (mm), fitted across real crashlock SVGs. */
export type TopFlapParamsMm = {
  /** tuck tip depth = tipK * W + tipAddMm */
  tipK: number
  tipAddMm: number
  tuckOuterInsetMm: number
  tuckInnerInsetMm: number
  waistNotchMm: number
  tipChamferMm: number
  notchGapMm: number
  rootChamfer1Mm: number
  rootDropMm: number
  rootEndInsetMm: number
  glueTopChamferMm: number
  glueBottomRiseMm: number
  dustRootInsetLMm: number
  dustRootInsetRMm: number
  innerTipTopK: number
  innerTipTopAddMm: number
  dustTopK: number
  dustInsetLK: number
}

export const DEFAULT_TOP_PARAMS: TopFlapParamsMm = {
  tipK: 0.6,
  tipAddMm: 1,
  tuckOuterInsetMm: 2.57,
  tuckInnerInsetMm: 2,
  waistNotchMm: 10,
  tipChamferMm: 5,
  notchGapMm: 24,
  rootChamfer1Mm: 21.38,
  rootDropMm: 35.2,
  rootEndInsetMm: 2.89,
  glueTopChamferMm: 12,
  glueBottomRiseMm: 3.21,
  dustRootInsetLMm: 3.55,
  dustRootInsetRMm: 2.67,
  innerTipTopK: 0.05,
  innerTipTopAddMm: 25,
  dustTopK: 0.2955,
  dustInsetLK: 0.193,
}

export function tipDepthMm(W: number, p: TopFlapParamsMm = DEFAULT_TOP_PARAMS): number {
  return p.tipK * W + p.tipAddMm
}

export function dustDepthMm(W: number): number {
  return W / 2
}

export function inferBodyTopY(segs: CompactSeg[]): number | null {
  const horiz = segs.filter(
    (s) => s.style === 'Creasing' && s.p0 && s.p1 && Math.abs(s.p0.y - s.p1.y) < 1e-3 && s.p0.y > 200 && s.p0.y < 3000,
  )
  if (!horiz.length) return null
  const ys = [...new Set(horiz.map((s) => +s.p0!.y.toFixed(3)))].sort((a, b) => a - b)
  return ys[ys.length - 1]
}

/** Top-region cutting: above body top, or glue column left of first crease. */
export function topFlapCuttingLines(segs: CompactSeg[], bodyTopY: number, glueX: number): CompactSeg[] {
  return segs.filter((s) => {
    if (s.style !== 'Cutting' || s.kind !== 'line' || !s.p0 || !s.p1 || s.lengthUu <= 1.5) return false
    const above = Math.max(s.p0.y, s.p1.y) > bodyTopY + 0.5
    const inGlue = Math.max(s.p0.x, s.p1.x) < glueX + 1 && Math.min(s.p0.y, s.p1.y) < bodyTopY + 5
    return above || inGlue
  })
}

function C(a: Pt, b: Pt): CompactSeg {
  return segLine(a, b, 'Cutting')
}

function R(a: Pt, b: Pt): CompactSeg {
  return segLine(a, b, 'Creasing')
}

/**
 * Tuck tongue on L-panel [xL,xR].
 * side='left' → outer toward xL (front panel); side='right' → outer toward xR (back panel).
 */
function buildTuck(
  xL: number,
  xR: number,
  yTop: number,
  yWaist: number,
  yTip: number,
  W: number,
  p: TopFlapParamsMm,
  side: 'left' | 'right',
): CompactSeg[] {
  const u = UU_PER_MM
  const panelW = xR - xL
  const outerInset = p.tuckOuterInsetMm * u
  const innerInset = p.tuckInnerInsetMm * u
  const innerTop = (p.innerTipTopK * W + p.innerTipTopAddMm) * u
  const notchGap = p.notchGapMm * u
  const chamfer = p.tipChamferMm * u
  const waistNotch = p.waistNotchMm * u
  const outerTopLen = Math.max(8 * u, panelW - outerInset - innerInset - innerTop - notchGap)

  if (side === 'left') {
    const tipOuter = { x: xL + outerInset, y: yTip }
    const tipOuterEnd = { x: tipOuter.x + outerTopLen, y: yTip }
    const c45 = { x: tipOuterEnd.x + chamfer, y: yTip - chamfer }
    const waistL = { x: c45.x, y: yWaist }
    const waistR = { x: waistL.x + waistNotch, y: yWaist }
    const tipInnerStart = { x: xR - innerInset - innerTop, y: yTip }
    const tipInner = { x: xR - innerInset, y: yTip }
    const vertBase = { x: tipInner.x, y: yTop + p.rootDropMm * u }
    const rootMid = { x: xR - p.rootChamfer1Mm * u, y: yTop + p.rootChamfer1Mm * u }
    const rootEnd = { x: xR - p.rootEndInsetMm * u, y: yTop }
    return [
      C({ x: xL, y: yTop }, tipOuter),
      C(tipOuter, tipOuterEnd),
      C(tipOuterEnd, c45),
      C(c45, waistL),
      C(waistL, waistR),
      C(waistR, tipInnerStart),
      C(tipInnerStart, tipInner),
      C(tipInner, vertBase),
      C(vertBase, rootMid),
      C(rootMid, rootEnd),
    ]
  }

  const tipOuter = { x: xR - outerInset, y: yTip }
  const tipOuterEnd = { x: tipOuter.x - outerTopLen, y: yTip }
  const c45 = { x: tipOuterEnd.x - chamfer, y: yTip - chamfer }
  const waistL = { x: c45.x, y: yWaist }
  const waistR = { x: waistL.x - waistNotch, y: yWaist }
  const tipInnerStart = { x: xL + innerInset + innerTop, y: yTip }
  const tipInner = { x: xL + innerInset, y: yTip }
  const vertBase = { x: tipInner.x, y: yTop + p.rootDropMm * u }
  const rootMid = { x: xL + p.rootChamfer1Mm * u, y: yTop + p.rootChamfer1Mm * u }
  const rootEnd = { x: xL + p.rootEndInsetMm * u, y: yTop }
  return [
    C({ x: xR, y: yTop }, tipOuter),
    C(tipOuter, tipOuterEnd),
    C(tipOuterEnd, c45),
    C(c45, waistL),
    C(waistL, waistR),
    C(waistR, tipInnerStart),
    C(tipInnerStart, tipInner),
    C(tipInner, vertBase),
    C(vertBase, rootMid),
    C(rootMid, rootEnd),
  ]
}

function buildDust(xL: number, xR: number, yTop: number, yDust: number, W: number, p: TopFlapParamsMm): CompactSeg[] {
  const u = UU_PER_MM
  const insetL = p.dustInsetLK * W * u
  const topLen = p.dustTopK * W * u
  const t0 = { x: xL + insetL, y: yDust }
  const t1 = { x: t0.x + topLen, y: yDust }
  const rootL = { x: xL + p.dustRootInsetLMm * u, y: yTop }
  const rootR = { x: xR - p.dustRootInsetRMm * u, y: yTop }
  return [C(rootL, t0), C(t0, t1), C(t1, rootR)]
}

/**
 * Build top dust flaps + tuck tongues + glue outer cutting (~29 lines; match ≥22/26).
 * Also returns tuck crease diagonals replacing lock-bottom stubs.
 */
export function buildTopFlapSegments(
  layout: LockBottomLayoutUu,
  topParams: TopFlapParamsMm = DEFAULT_TOP_PARAMS,
): { cutting: CompactSeg[]; creasingExtra: CompactSeg[]; curveApprox: boolean } {
  const u = UU_PER_MM
  const { W, x0, x1, x2, x3, x4, yBodyTop, yBodySide } = layout
  const yTop = yBodyTop
  const yDust = yTop + dustDepthMm(W) * u
  const yTip = yTop + tipDepthMm(W, topParams) * u

  const cutting: CompactSeg[] = [
    ...buildTuck(x0, x1, yTop, yDust, yTip, W, topParams, 'left'),
    ...buildDust(x1, x2, yTop, yDust, W, topParams),
    ...buildTuck(x2, x3, yTop, yDust, yTip, W, topParams, 'right'),
    ...buildDust(x3, x4, yTop, yDust, W, topParams),
    // glue flap
    C({ x: x0, y: yTop }, { x: 0, y: yTop - topParams.glueTopChamferMm * u }),
    C({ x: 0, y: yTop - topParams.glueTopChamferMm * u }, { x: 0, y: yBodySide + topParams.glueBottomRiseMm * u }),
    C({ x: 0, y: yBodySide + topParams.glueBottomRiseMm * u }, { x: x0, y: yBodySide }),
  ]

  const creasingExtra: CompactSeg[] = [
    R({ x: x1 - 21.38 * u, y: yTop + 21.38 * u }, { x: x1 - 21.38 * u - (yDust - yTop - 21.38 * u), y: yDust }),
    R({ x: x3 - 21.38 * u, y: yTop + 21.38 * u }, { x: x3 - 21.38 * u - (yDust - yTop - 21.38 * u), y: yDust }),
  ]

  return { cutting, creasingExtra, curveApprox: true }
}

export function observeTopFlaps(
  sampleId: string,
  dims: { L: number; W: number; H: number },
  segs: CompactSeg[],
): {
  sampleId: string
  tipDepthMm: number | null
  dustDepthMm: number | null
  topCount: number
  ok: boolean
} {
  const bodyTopY = inferBodyTopY(segs)
  if (bodyTopY == null) {
    return { sampleId, tipDepthMm: null, dustDepthMm: null, topCount: 0, ok: false }
  }
  const lay = layoutLockBottomUu(dims.L, dims.W, dims.H)
  const top = topFlapCuttingLines(segs, bodyTopY, lay.x0)
  const tipHoriz = top.filter(
    (s) => Math.abs(s.p0!.y - s.p1!.y) < 1e-3 && (s.p0!.y - bodyTopY) * MM_PER_UU > dims.W / 2 + 5,
  )
  const dustHoriz = top.filter(
    (s) =>
      Math.abs(s.p0!.y - s.p1!.y) < 1e-3 && Math.abs((s.p0!.y - bodyTopY) * MM_PER_UU - dims.W / 2) < 1.5,
  )
  return {
    sampleId,
    tipDepthMm: tipHoriz.length ? (tipHoriz[0].p0!.y - bodyTopY) * MM_PER_UU : null,
    dustDepthMm: dustHoriz.length ? (dustHoriz[0].p0!.y - bodyTopY) * MM_PER_UU : null,
    topCount: top.length,
    ok: tipHoriz.length > 0 && dustHoriz.length > 0 && top.length >= 20,
  }
}
