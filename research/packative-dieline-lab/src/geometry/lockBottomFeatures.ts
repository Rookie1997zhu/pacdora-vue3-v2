import type { CompactSeg, Pt } from './segmentMatch.ts'

export const MM_PER_UU = 25.4 / 96
export const UU_PER_MM = 96 / 25.4

/** Empirical lock-bottom params (mm), fitted across real crashlock SVGs. */
export type LockBottomParamsMm = {
  glueMm: number
  bodyExtraHMm: number
  /** tipDepth = W/2 + tipAddMm */
  tipAddMm: number
  /** bigFlapDepth = W + bigAddMm */
  bigAddMm: number
  /** side-panel bottom crease sits this far above center hinge */
  sideBottomLiftMm: number
  /** inner crease height from dieline bottom */
  bigInnerMm: number
  /** bottom edge inset from L-panel sides (fixed across sizes) */
  botInsetMm: number
  /** notch width at big-flap inner corners */
  notchWidthMm: number
  /** notch floor below inner crease */
  notchDropMm: number
  /** stub height above notch floor */
  notchStubMm: number
  /** tip horizontal inset toward outer (≈ tipDepth * tipInsetLRatio) */
  tipInsetLRatio: number
  /** tip horizontal inset toward center panel */
  tipInsetRMm: number
  hookChamferMm: number
  hookRiseMm: number
  bodyCornerChamferMm: number
  tipInnerDxMm: number
  /** top dust-flap diagonal stub (approx; not full topology) */
  topDiagMm: number
  topGapMm: number
}

export const DEFAULT_LOCK_PARAMS: LockBottomParamsMm = {
  glueMm: 12,
  bodyExtraHMm: 0.5,
  tipAddMm: 5,
  bigAddMm: 10.5,
  sideBottomLiftMm: 0.5,
  bigInnerMm: 12,
  botInsetMm: 7.269,
  notchWidthMm: 9,
  notchDropMm: 0.75,
  notchStubMm: 2.25,
  tipInsetLRatio: 0.2785,
  tipInsetRMm: 5,
  hookChamferMm: 2,
  hookRiseMm: 7,
  bodyCornerChamferMm: 3,
  tipInnerDxMm: 2,
  topDiagMm: 48.56,
  topGapMm: 0.86,
}

export type LockBottomLayoutUu = {
  L: number
  W: number
  H: number
  x0: number
  x1: number
  x2: number
  x3: number
  x4: number
  yBottom: number
  yInner: number
  yNotch: number
  yNotchTop: number
  yTip: number
  yBodyHinge: number
  yBodySide: number
  yBodyTop: number
  yBodyTopInner: number
  tipDepthUu: number
  tipDepthMm: number
  tipInsetLUu: number
  bigFlapDepthUu: number
  params: LockBottomParamsMm
}

export function layoutLockBottomUu(
  L: number,
  W: number,
  H: number,
  params: LockBottomParamsMm = DEFAULT_LOCK_PARAMS,
): LockBottomLayoutUu {
  const u = UU_PER_MM
  const x0 = params.glueMm * u
  const x1 = x0 + L * u
  const x2 = x1 + W * u
  const x3 = x2 + L * u
  const x4 = x3 + W * u
  const tipDepthMm = W / 2 + params.tipAddMm
  const bigFlapDepthUu = (W + params.bigAddMm) * u
  const tipDepthUu = tipDepthMm * u
  const yBottom = 0
  const yInner = params.bigInnerMm * u
  const yNotch = yInner - params.notchDropMm * u
  const yNotchTop = yNotch + params.notchStubMm * u
  const yBodyHinge = bigFlapDepthUu
  const yBodySide = yBodyHinge + params.sideBottomLiftMm * u
  const yTip = yBodyHinge - tipDepthUu
  // evidence tipY is measured vs bodyBottomY(=hinge); tip sits at hinge - tipDepth
  // but observed tipY_mm = W/2 + 5.5 = tipDepth + 0.5 → tip vs side bottom:
  // use tip relative to side bottom: yBodySide - tipDepthUu
  const yTipAdj = yBodySide - tipDepthUu
  const yBodyTop = yBodyHinge + (H + params.bodyExtraHMm) * u
  const yBodyTopInner = yBodyTop - params.sideBottomLiftMm * u
  const tipInsetLUu = tipDepthMm * params.tipInsetLRatio * u
  return {
    L,
    W,
    H,
    x0,
    x1,
    x2,
    x3,
    x4,
    yBottom,
    yInner,
    yNotch,
    yNotchTop,
    yTip: yTipAdj,
    yBodyHinge,
    yBodySide,
    yBodyTop,
    yBodyTopInner,
    tipDepthUu,
    tipDepthMm,
    tipInsetLUu,
    bigFlapDepthUu,
    params,
  }
}

export type LockObs = {
  sampleId: string
  L: number
  W: number
  H: number
  bodyBottomY: number
  tipY: number | null
  tipDepthMm: number | null
  bigFlapDepthMm: number | null
  lockLineCount: number
  ok: boolean
}

export function observeLockBottom(
  sampleId: string,
  dims: { L: number; W: number; H: number },
  segs: CompactSeg[],
): LockObs {
  const creases = segs.filter((s) => s.style === 'Creasing' && s.p0 && s.p1)
  const cuts = segs.filter((s) => s.style === 'Cutting' && s.p0 && s.p1 && s.lengthUu > 1)
  const horiz = creases.filter((s) => Math.abs(s.p0!.y - s.p1!.y) < 1e-3)
  const bodyHoriz = horiz.filter((s) => s.p0!.y > 200 && s.p0!.y < 2000)
  if (bodyHoriz.length < 2) {
    return {
      sampleId,
      ...dims,
      bodyBottomY: NaN,
      tipY: null,
      tipDepthMm: null,
      bigFlapDepthMm: null,
      lockLineCount: 0,
      ok: false,
    }
  }
  const ys = [...new Set(bodyHoriz.map((s) => +s.p0!.y.toFixed(3)))].sort((a, b) => a - b)
  const bodyBottomY = ys[0]
  const tipHoriz = cuts.filter(
    (s) =>
      s.kind === 'line' &&
      Math.abs(s.p0!.y - s.p1!.y) < 1e-3 &&
      s.p0!.y < bodyBottomY - 10 &&
      s.lengthUu > 100,
  )
  const tipY = tipHoriz.length ? tipHoriz[0].p0!.y : null
  const lockLines = cuts.filter((s) => s.kind === 'line' && Math.min(s.p0!.y, s.p1!.y) < bodyBottomY - 0.5)
  return {
    sampleId,
    ...dims,
    bodyBottomY,
    tipY,
    tipDepthMm: tipY != null ? (bodyBottomY - tipY) * MM_PER_UU : null,
    bigFlapDepthMm: bodyBottomY * MM_PER_UU,
    lockLineCount: lockLines.length,
    ok: tipY != null && lockLines.length >= 18,
  }
}

/** Filter cutting lines in lock-bottom region (below body bottom crease). */
export function lockBottomCuttingLines(segs: CompactSeg[], bodyBottomY: number): CompactSeg[] {
  return segs.filter(
    (s) =>
      s.style === 'Cutting' &&
      s.kind === 'line' &&
      s.p0 &&
      s.p1 &&
      s.lengthUu > 1.5 &&
      Math.min(s.p0.y, s.p1.y) < bodyBottomY - 0.5,
  )
}

export function inferBodyBottomY(segs: CompactSeg[]): number | null {
  const horiz = segs.filter(
    (s) => s.style === 'Creasing' && s.p0 && s.p1 && Math.abs(s.p0.y - s.p1.y) < 1e-3 && s.p0.y > 200 && s.p0.y < 2000,
  )
  if (!horiz.length) return null
  const ys = [...new Set(horiz.map((s) => +s.p0!.y.toFixed(3)))].sort((a, b) => a - b)
  return ys[0]
}

export function segLine(p0: Pt, p1: Pt, style: 'Cutting' | 'Creasing'): CompactSeg {
  return {
    kind: 'line',
    style,
    lengthUu: Math.hypot(p1.x - p0.x, p1.y - p0.y),
    p0,
    p1,
    pointCount: 2,
  }
}

/**
 * Build parametric lock-bottom Cutting lines (~21) + body Creasing lines (14).
 * Curve corners approximated as chords (`curve_approx`).
 */
export function buildLockBottomSegments(
  L: number,
  W: number,
  H: number,
  params: LockBottomParamsMm = DEFAULT_LOCK_PARAMS,
): { layout: LockBottomLayoutUu; cutting: CompactSeg[]; creasing: CompactSeg[]; curveApprox: boolean } {
  const lay = layoutLockBottomUu(L, W, H, params)
  const u = UU_PER_MM
  const {
    x0,
    x1,
    x2,
    x3,
    x4,
    yBottom,
    yInner,
    yNotch,
    yNotchTop,
    yTip,
    yBodyHinge,
    yBodySide,
    yBodyTop,
    yBodyTopInner,
    tipInsetLUu,
  } = lay
  const tipInsetR = params.tipInsetRMm * u
  const botInset = params.botInsetMm * u
  const notchW = params.notchWidthMm * u
  const hookCh = params.hookChamferMm * u
  const hookRise = params.hookRiseMm * u
  const bodyCh = params.bodyCornerChamferMm * u
  // evidence: hook vertical sits ~0.75mm inside panel crease (same as notchDrop)
  const hookVertX = x1 + params.notchDropMm * u
  const hookVertXR = x4 - params.notchDropMm * u

  const C = (a: Pt, b: Pt) => segLine(a, b, 'Cutting')
  const R = (a: Pt, b: Pt) => segLine(a, b, 'Creasing')

  // --- Big flap cutting ---
  const botL = { x: x2 + botInset, y: yBottom }
  const botR = { x: x3 - botInset, y: yBottom }
  const nL0 = { x: x2, y: yInner }
  const nL1 = { x: x2, y: yNotch }
  const nL2 = { x: x2 + notchW, y: yNotch }
  const nL3 = { x: x2 + notchW, y: yNotchTop }
  const nR0 = { x: x3, y: yInner }
  const nR1 = { x: x3, y: yNotch }
  const nR2 = { x: x3 - notchW, y: yNotch }
  const nR3 = { x: x3 - notchW, y: yNotchTop }

  // --- Left wing ---
  const tipL0 = { x: x1 + tipInsetLUu, y: yTip }
  const tipL1 = { x: x2 - tipInsetR, y: yTip }
  const wingInnerTop = { x: x2 - bodyCh, y: yBodySide - bodyCh }
  const wingOuterMid = { x: hookVertX + hookCh, y: yBodySide - hookRise - hookCh }
  const wingOuterHook = { x: hookVertX, y: yBodySide - hookRise }
  const wingOuterTop = { x: hookVertX, y: yBodySide }

  // --- Right wing (mirror) ---
  const tipR0 = { x: x3 + tipInsetR, y: yTip }
  const tipR1 = { x: x4 - tipInsetLUu, y: yTip }
  const wingRInnerTop = { x: x3 + bodyCh, y: yBodySide - bodyCh }
  const wingROuterMid = { x: hookVertXR - hookCh, y: yBodySide - hookRise - hookCh }
  const wingROuterHook = { x: hookVertXR, y: yBodySide - hookRise }
  const wingROuterTop = { x: hookVertXR, y: yBodySide }

  const cutting: CompactSeg[] = [
    // big flap bottom + notches + sides
    C(botR, botL),
    C(nL0, nL1),
    C(nL1, nL2),
    C(nL2, nL3),
    C(nR1, nR2),
    C(nR2, nR3),
    C(nR0, nR1),
    C(nL0, { x: x2, y: yBodySide }),
    C({ x: x3, y: yBodySide }, nR0),
    // left wing
    C(tipL0, wingOuterMid),
    C(tipL1, tipL0),
    C(wingInnerTop, tipL1),
    C(wingOuterMid, wingOuterHook),
    C(wingOuterHook, wingOuterTop),
    C({ x: x2, y: yBodySide }, wingInnerTop),
    // right wing
    C(wingRInnerTop, tipR0),
    C(tipR0, tipR1),
    C(tipR1, wingROuterMid),
    C(wingROuterMid, wingROuterHook),
    C(wingROuterHook, wingROuterTop),
    C({ x: x3, y: yBodySide }, wingRInnerTop),
  ]

  // --- 14 creases ---
  const topGap = params.topGapMm * u
  const topDiag = params.topDiagMm * u
  const creasing: CompactSeg[] = [
    R({ x: x3 - notchW, y: yInner }, { x: x2 + notchW, y: yInner }),
    R({ x: x2, y: yBodyHinge }, { x: x3, y: yBodyHinge }),
    R({ x: x0, y: yBodySide }, { x: x0, y: yBodyTop }),
    R({ x: hookVertX, y: yBodySide }, { x: x2, y: yBodySide }),
    R({ x: x2, y: yBodySide }, { x: x2, y: yBodyTopInner }),
    R({ x: x4, y: yBodySide }, { x: x3, y: yBodySide }),
    R({ x: x1, y: yBodyTopInner }, { x: x1, y: yBodySide }),
    R({ x: x3, y: yBodyTopInner }, { x: x3, y: yBodySide }),
    // top horizontal broken into 4 panel spans (gaps ≈ dust-flap cutouts)
    R({ x: x0, y: yBodyTop }, { x: x1 - topGap * 4, y: yBodyTop }),
    R({ x: x1 + topGap * 4, y: yBodyTop }, { x: x2 - topGap * 4, y: yBodyTop }),
    R({ x: x2 + topGap * 4, y: yBodyTop }, { x: x3 - topGap * 4, y: yBodyTop }),
    R({ x: x3 + topGap * 4, y: yBodyTop }, { x: x4, y: yBodyTop }),
    // top dust-flap crease diagonals (approx; full tongue geometry not implemented)
    R({ x: x1 - 21.4 * u, y: yBodyTop + 5.65 * u }, { x: x1 - 21.4 * u - topDiag / Math.SQRT2, y: yBodyTop + 5.65 * u + topDiag / Math.SQRT2 }),
    R({ x: x3 - 21.4 * u, y: yBodyTop + 5.65 * u }, { x: x3 - 21.4 * u - topDiag / Math.SQRT2, y: yBodyTop + 5.65 * u + topDiag / Math.SQRT2 }),
  ]

  return { layout: lay, cutting, creasing, curveApprox: true }
}
