// research/packative-dieline-lab/src/geometry/cubicParams.ts
var UU_PER_MM = 96 / 25.4;
var DEFAULT_CUBIC_PARAMS = {
  bigCornerFromCreaseMm: 1.89,
  bigFlapCubic: {
    c0: { x: 0.249, y: -4.641 },
    c1: { x: 2.785, y: -8.856 },
    p1: { x: 6.769, y: -11.25 }
  },
  topOutCubic: {
    c0: { x: 0.42, y: 0 },
    c1: { x: 0.796, y: 0.263 },
    p1: { x: 0.94, y: 0.658 }
  },
  topInCubic: {
    c0: { x: -0.295, y: 0 },
    c1: { x: -0.574, y: 0.13 },
    p1: { x: -0.764, y: 0.355 }
  },
  topX2InCubic: {
    c0: { x: -0.265, y: 0 },
    c1: { x: -0.52, y: 0.105 },
    p1: { x: -0.707, y: 0.293 }
  },
  topX2OutCubic: {
    c0: { x: 0.532, y: 0 },
    c1: { x: 0.971, y: 0.416 },
    p1: { x: 0.999, y: 0.948 }
  }
};
function pathCubic(p0, c0, c1, p1, style = "Cutting") {
  return {
    kind: "path",
    style,
    lengthUu: Math.hypot(p1.x - p0.x, p1.y - p0.y),
    p0,
    p1,
    pointCount: 4,
    c0,
    c1
  };
}
function applyCubic(p0, off, mirrorX) {
  const u = UU_PER_MM;
  const sx = mirrorX ? -1 : 1;
  const c0 = { x: p0.x + sx * off.c0.x * u, y: p0.y + off.c0.y * u };
  const c1 = { x: p0.x + sx * off.c1.x * u, y: p0.y + off.c1.y * u };
  const p1 = { x: p0.x + sx * off.p1.x * u, y: p0.y + off.p1.y * u };
  return pathCubic(p0, c0, c1, p1, "Cutting");
}

// research/packative-dieline-lab/src/geometry/lockBottomFeatures.ts
var MM_PER_UU = 25.4 / 96;
var UU_PER_MM2 = 96 / 25.4;
var DEFAULT_LOCK_PARAMS = {
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
  topGapMm: 0.86
};
function applyMaterialHooks(base, thicknessMm = 0, kerfMm = 0) {
  const t = Number.isFinite(thicknessMm) ? thicknessMm : 0;
  const k = Number.isFinite(kerfMm) ? kerfMm : 0;
  const halfKerf = k / 2;
  return {
    ...base,
    bodyExtraHMm: base.bodyExtraHMm + t,
    tipAddMm: base.tipAddMm + halfKerf,
    bigAddMm: base.bigAddMm + halfKerf
  };
}
function layoutLockBottomUu(L, W, H, params = DEFAULT_LOCK_PARAMS) {
  const u = UU_PER_MM2;
  const x0 = params.glueMm * u;
  const x1 = x0 + L * u;
  const x2 = x1 + W * u;
  const x3 = x2 + L * u;
  const x4 = x3 + W * u;
  const tipDepthMm2 = W / 2 + params.tipAddMm;
  const bigFlapDepthUu = (W + params.bigAddMm) * u;
  const tipDepthUu = tipDepthMm2 * u;
  const yBottom = 0;
  const yInner = params.bigInnerMm * u;
  const yNotch = yInner - params.notchDropMm * u;
  const yNotchTop = yNotch + params.notchStubMm * u;
  const yBodyHinge = bigFlapDepthUu;
  const yBodySide = yBodyHinge + params.sideBottomLiftMm * u;
  const yTip = yBodyHinge - tipDepthUu;
  const yTipAdj = yBodySide - tipDepthUu;
  const yBodyTop = yBodyHinge + (H + params.bodyExtraHMm) * u;
  const yBodyTopInner = yBodyTop - params.sideBottomLiftMm * u;
  const tipInsetLUu = tipDepthMm2 * params.tipInsetLRatio * u;
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
    tipDepthMm: tipDepthMm2,
    tipInsetLUu,
    bigFlapDepthUu,
    params
  };
}
function segLine(p0, p1, style) {
  return {
    kind: "line",
    style,
    lengthUu: Math.hypot(p1.x - p0.x, p1.y - p0.y),
    p0,
    p1,
    pointCount: 2
  };
}
function buildLockBottomSegments(L, W, H, params = DEFAULT_LOCK_PARAMS, opts) {
  const lay = layoutLockBottomUu(L, W, H, params);
  const u = UU_PER_MM2;
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
    tipInsetLUu
  } = lay;
  const tipInsetR = params.tipInsetRMm * u;
  const botInset = params.botInsetMm * u;
  const notchW = params.notchWidthMm * u;
  const hookCh = params.hookChamferMm * u;
  const hookRise = params.hookRiseMm * u;
  const bodyCh = params.bodyCornerChamferMm * u;
  const hookVertX = x1 + params.notchDropMm * u;
  const hookVertXR = x4 - params.notchDropMm * u;
  const C3 = (a, b) => segLine(a, b, "Cutting");
  const R2 = (a, b) => segLine(a, b, "Creasing");
  const botL = { x: x2 + botInset, y: yBottom };
  const botR = { x: x3 - botInset, y: yBottom };
  const nL0 = { x: x2, y: yInner };
  const nL1 = { x: x2, y: yNotch };
  const nL2 = { x: x2 + notchW, y: yNotch };
  const nL3 = { x: x2 + notchW, y: yNotchTop };
  const nR0 = { x: x3, y: yInner };
  const nR1 = { x: x3, y: yNotch };
  const nR2 = { x: x3 - notchW, y: yNotch };
  const nR3 = { x: x3 - notchW, y: yNotchTop };
  const tipL0 = { x: x1 + tipInsetLUu, y: yTip };
  const tipL1 = { x: x2 - tipInsetR, y: yTip };
  const wingInnerTop = { x: x2 - bodyCh, y: yBodySide - bodyCh };
  const wingOuterMid = { x: hookVertX + hookCh, y: yBodySide - hookRise - hookCh };
  const wingOuterHook = { x: hookVertX, y: yBodySide - hookRise };
  const wingOuterTop = { x: hookVertX, y: yBodySide };
  const tipR0 = { x: x3 + tipInsetR, y: yTip };
  const tipR1 = { x: x4 - tipInsetLUu, y: yTip };
  const wingRInnerTop = { x: x3 + bodyCh, y: yBodySide - bodyCh };
  const wingROuterMid = { x: hookVertXR - hookCh, y: yBodySide - hookRise - hookCh };
  const wingROuterHook = { x: hookVertXR, y: yBodySide - hookRise };
  const wingROuterTop = { x: hookVertXR, y: yBodySide };
  const cubic = DEFAULT_CUBIC_PARAMS;
  const cornerOff = cubic.bigCornerFromCreaseMm * u;
  const cutting = [
    // big flap bottom + notches + sides
    C3(botR, botL),
    C3(nL0, nL1),
    C3(nL1, nL2),
    C3(nL2, nL3),
    C3(nR1, nR2),
    C3(nR2, nR3),
    C3(nR0, nR1),
    C3(nL0, { x: x2, y: yBodySide }),
    C3({ x: x3, y: yBodySide }, nR0),
    // left wing
    C3(tipL0, wingOuterMid),
    C3(tipL1, tipL0),
    C3(wingInnerTop, tipL1),
    C3(wingOuterMid, wingOuterHook),
    C3(wingOuterHook, wingOuterTop),
    C3({ x: x2, y: yBodySide }, wingInnerTop),
    // right wing
    C3(wingRInnerTop, tipR0),
    C3(tipR0, tipR1),
    C3(tipR1, wingROuterMid),
    C3(wingROuterMid, wingROuterHook),
    C3(wingROuterHook, wingROuterTop),
    C3({ x: x3, y: yBodySide }, wingRInnerTop),
    // exact big-flap corner cubics (2)
    applyCubic({ x: x2 + cornerOff, y: yNotch }, cubic.bigFlapCubic, false),
    applyCubic({ x: x3 - cornerOff, y: yNotch }, cubic.bigFlapCubic, true)
  ];
  const topGap = params.topGapMm * u;
  const topDiag = params.topDiagMm * u;
  const creasing = [
    R2({ x: x3 - notchW, y: yInner }, { x: x2 + notchW, y: yInner }),
    R2({ x: x2, y: yBodyHinge }, { x: x3, y: yBodyHinge }),
    R2({ x: x0, y: yBodySide }, { x: x0, y: yBodyTop }),
    R2({ x: hookVertX, y: yBodySide }, { x: x2, y: yBodySide }),
    R2({ x: x2, y: yBodySide }, { x: x2, y: yBodyTopInner }),
    R2({ x: x4, y: yBodySide }, { x: x3, y: yBodySide }),
    R2({ x: x1, y: yBodyTopInner }, { x: x1, y: yBodySide }),
    R2({ x: x3, y: yBodyTopInner }, { x: x3, y: yBodySide }),
    // top horizontal broken into 4 panel spans (gaps ≈ dust-flap cutouts)
    R2({ x: x0, y: yBodyTop }, { x: x1 - topGap * 4, y: yBodyTop }),
    R2({ x: x1 + topGap * 4, y: yBodyTop }, { x: x2 - topGap * 4, y: yBodyTop }),
    R2({ x: x2 + topGap * 4, y: yBodyTop }, { x: x3 - topGap * 4, y: yBodyTop }),
    R2({ x: x3 + topGap * 4, y: yBodyTop }, { x: x4, y: yBodyTop })
  ];
  if (!opts?.omitTopCreaseStubs) {
    creasing.push(
      R2(
        { x: x1 - 21.4 * u, y: yBodyTop + 5.65 * u },
        { x: x1 - 21.4 * u - topDiag / Math.SQRT2, y: yBodyTop + 5.65 * u + topDiag / Math.SQRT2 }
      ),
      R2(
        { x: x3 - 21.4 * u, y: yBodyTop + 5.65 * u },
        { x: x3 - 21.4 * u - topDiag / Math.SQRT2, y: yBodyTop + 5.65 * u + topDiag / Math.SQRT2 }
      )
    );
  }
  return { layout: lay, cutting, creasing, curveApprox: true, filletsExactBigFlap: true };
}

// research/packative-dieline-lab/src/geometry/features.ts
function predLinear(c, L, W, H) {
  const e = c.e ?? 0;
  const f = c.f ?? 0;
  const g = c.g ?? 0;
  return c.a * L + c.b * W + c.c * H + c.d + e * L * W + f * L * H + g * W * H;
}

// research/packative-dieline-lab/src/geometry/topFlapFeatures.ts
var DEFAULT_TOP_PARAMS = {
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
  dustInsetLK: 0.193
};
function applyTopMaterialHooks(base, thicknessMm = 0, kerfMm = 0) {
  const t = Number.isFinite(thicknessMm) ? thicknessMm : 0;
  const k = Number.isFinite(kerfMm) ? kerfMm : 0;
  return {
    ...base,
    tuckOuterInsetMm: base.tuckOuterInsetMm + t,
    tuckInnerInsetMm: base.tuckInnerInsetMm + t,
    tipAddMm: base.tipAddMm + k / 2
  };
}
function tipDepthMm(W, p = DEFAULT_TOP_PARAMS) {
  return p.tipK * W + p.tipAddMm;
}
function dustDepthMm(W) {
  return W / 2;
}
function C(a, b) {
  return segLine(a, b, "Cutting");
}
function R(a, b) {
  return segLine(a, b, "Creasing");
}
function buildTuck(xL, xR, yTop, yWaist, yTip, W, p, side) {
  const u = UU_PER_MM2;
  const panelW = xR - xL;
  const outerInset = p.tuckOuterInsetMm * u;
  const innerInset = p.tuckInnerInsetMm * u;
  const innerTop = (p.innerTipTopK * W + p.innerTipTopAddMm) * u;
  const notchGap = p.notchGapMm * u;
  const chamfer = p.tipChamferMm * u;
  const waistNotch = p.waistNotchMm * u;
  const outerTopLen = Math.max(8 * u, panelW - outerInset - innerInset - innerTop - notchGap);
  if (side === "left") {
    const tipOuter2 = { x: xL + outerInset, y: yTip };
    const tipOuterEnd2 = { x: tipOuter2.x + outerTopLen, y: yTip };
    const c452 = { x: tipOuterEnd2.x + chamfer, y: yTip - chamfer };
    const waistL2 = { x: c452.x, y: yWaist };
    const waistR2 = { x: waistL2.x + waistNotch, y: yWaist };
    const tipInnerStart2 = { x: xR - innerInset - innerTop, y: yTip };
    const tipInner2 = { x: xR - innerInset, y: yTip };
    const vertBase2 = { x: tipInner2.x, y: yTop + p.rootDropMm * u };
    const rootMid2 = { x: xR - p.rootChamfer1Mm * u, y: yTop + p.rootChamfer1Mm * u };
    const rootEnd2 = { x: xR - p.rootEndInsetMm * u, y: yTop };
    return [
      C({ x: xL, y: yTop }, tipOuter2),
      C(tipOuter2, tipOuterEnd2),
      C(tipOuterEnd2, c452),
      C(c452, waistL2),
      C(waistL2, waistR2),
      C(waistR2, tipInnerStart2),
      C(tipInnerStart2, tipInner2),
      C(tipInner2, vertBase2),
      C(vertBase2, rootMid2),
      C(rootMid2, rootEnd2)
    ];
  }
  const tipOuter = { x: xR - outerInset, y: yTip };
  const tipOuterEnd = { x: tipOuter.x - outerTopLen, y: yTip };
  const c45 = { x: tipOuterEnd.x - chamfer, y: yTip - chamfer };
  const waistL = { x: c45.x, y: yWaist };
  const waistR = { x: waistL.x - waistNotch, y: yWaist };
  const tipInnerStart = { x: xL + innerInset + innerTop, y: yTip };
  const tipInner = { x: xL + innerInset, y: yTip };
  const vertBase = { x: tipInner.x, y: yTop + p.rootDropMm * u };
  const rootMid = { x: xL + p.rootChamfer1Mm * u, y: yTop + p.rootChamfer1Mm * u };
  const rootEnd = { x: xL + p.rootEndInsetMm * u, y: yTop };
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
    C(rootMid, rootEnd)
  ];
}
function buildDust(xL, xR, yTop, yDust, W, p) {
  const u = UU_PER_MM2;
  const insetL = p.dustInsetLK * W * u;
  const topLen = p.dustTopK * W * u;
  const t0 = { x: xL + insetL, y: yDust };
  const t1 = { x: t0.x + topLen, y: yDust };
  const rootL = { x: xL + p.dustRootInsetLMm * u, y: yTop };
  const rootR = { x: xR - p.dustRootInsetRMm * u, y: yTop };
  return [C(rootL, t0), C(t0, t1), C(t1, rootR)];
}
function buildTopFlapSegments(layout, topParams = DEFAULT_TOP_PARAMS) {
  const u = UU_PER_MM2;
  const { W, x0, x1, x2, x3, x4, yBodyTop, yBodyTopInner, yBodySide } = layout;
  const yTop = yBodyTop;
  const yDust = yTop + dustDepthMm(W) * u;
  const yTip = yTop + tipDepthMm(W, topParams) * u;
  const cubic = DEFAULT_CUBIC_PARAMS;
  const cutting = [
    ...buildTuck(x0, x1, yTop, yDust, yTip, W, topParams, "left"),
    ...buildDust(x1, x2, yTop, yDust, W, topParams),
    ...buildTuck(x2, x3, yTop, yDust, yTip, W, topParams, "right"),
    ...buildDust(x3, x4, yTop, yDust, W, topParams),
    // glue flap
    C({ x: x0, y: yTop }, { x: 0, y: yTop - topParams.glueTopChamferMm * u }),
    C({ x: 0, y: yTop - topParams.glueTopChamferMm * u }, { x: 0, y: yBodySide + topParams.glueBottomRiseMm * u }),
    C({ x: 0, y: yBodySide + topParams.glueBottomRiseMm * u }, { x: x0, y: yBodySide }),
    // exact body-top fillet cubics (6)
    applyCubic({ x: x1, y: yBodyTopInner }, cubic.topOutCubic, false),
    applyCubic({ x: x1, y: yBodyTopInner }, cubic.topInCubic, false),
    applyCubic({ x: x2, y: yBodyTopInner }, cubic.topX2InCubic, false),
    applyCubic({ x: x2, y: yBodyTopInner }, cubic.topX2OutCubic, false),
    applyCubic({ x: x3, y: yBodyTopInner }, cubic.topOutCubic, false),
    applyCubic({ x: x3, y: yBodyTopInner }, cubic.topInCubic, false)
  ];
  const creasingExtra = [
    R({ x: x1 - 21.38 * u, y: yTop + 21.38 * u }, { x: x1 - 21.38 * u - (yDust - yTop - 21.38 * u), y: yDust }),
    R({ x: x3 - 21.38 * u, y: yTop + 21.38 * u }, { x: x3 - 21.38 * u - (yDust - yTop - 21.38 * u), y: yDust })
  ];
  return { cutting, creasingExtra, curveApprox: true, filletsExactTop: true };
}

// research/packative-dieline-lab/src/geometry/bodyOutlineFeatures.ts
function C2(a, b) {
  return segLine(a, b, "Cutting");
}
function buildBodyOutlineSegments(layout, params) {
  const u = UU_PER_MM2;
  const { x0, x1, x4, yBodySide, yBodyTop } = layout;
  const micro = (params?.microBridgeMm ?? 0.75) * u;
  const cutting = [
    // front L-panel bottom outer cutting (length ≈ L)
    C2({ x: x1, y: yBodySide }, { x: x0, y: yBodySide }),
    // right body outer vertical (length ≈ H)
    C2({ x: x4, y: yBodySide }, { x: x4, y: yBodyTop }),
    // micro bridge at body bottom crease
    C2({ x: x1, y: yBodySide }, { x: x1 + micro, y: yBodySide })
  ];
  return { cutting, curveApprox: false, filletsExact: true };
}

// research/packative-dieline-lab/src/prototype/crashlock.ts
function materialFromParams(params) {
  const thicknessMm = params.thicknessMm ?? 0;
  const kerfMm = params.kerfMm ?? 0;
  const lockParams = applyMaterialHooks(DEFAULT_LOCK_PARAMS, thicknessMm, kerfMm);
  const topParams = applyTopMaterialHooks(DEFAULT_TOP_PARAMS, thicknessMm, kerfMm);
  const hooksActive = thicknessMm !== 0 || kerfMm !== 0;
  return { thicknessMm, kerfMm, lockParams, topParams, hooksActive };
}
function materialGapTags(hooksActive) {
  return hooksActive ? ["material_hooks_applied_unvalidated"] : ["material_thickness_unobserved"];
}
var GEOM_WIDTH_UU = {
  a: 7.559005140049829,
  b: 7.559153452808672,
  c: -18231249214184508e-20,
  d: 43.47466587018427,
  e: 0,
  f: 0,
  g: 0,
  model: "lwh_linear",
  note: "fit-coeffs.json geomWidthUu@2026-11-12; lwh_linear OLS"
};
var GEOM_HEIGHT_UU = {
  a: 9457842562090699e-19,
  b: 6.045474847320218,
  c: 3.778819750831597,
  d: 45.40780286286577,
  e: -5506342569382325e-22,
  f: -11271669240737835e-21,
  g: 22652701149000716e-21,
  model: "lwh_interact",
  note: "fit-coeffs.json geomHeightUu@2026-11-12; lwh_interact OLS"
};
function setFitCoeffs(width, height) {
  Object.assign(GEOM_WIDTH_UU, { e: 0, f: 0, g: 0 }, width);
  Object.assign(GEOM_HEIGHT_UU, { e: 0, f: 0, g: 0 }, height);
}
function renderSegSvg(segs, vbW, vbH, comment) {
  const flipY = (y) => vbH - y;
  const body = segs.filter((s) => s.p0 && s.p1).map((s) => {
    const stroke = s.style === "Cutting" ? "rgb(255,0,0)" : "rgb(0,255,0)";
    if (s.kind === "path" && s.c0 && s.c1) {
      const d = `M ${s.p0.x.toFixed(3)} ${flipY(s.p0.y).toFixed(3)} C ${s.c0.x.toFixed(3)} ${flipY(s.c0.y).toFixed(3)} ${s.c1.x.toFixed(3)} ${flipY(s.c1.y).toFixed(3)} ${s.p1.x.toFixed(3)} ${flipY(s.p1.y).toFixed(3)}`;
      return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="2" ev-style="${s.style}" />`;
    }
    return `<line x1="${s.p0.x.toFixed(3)}" y1="${flipY(s.p0.y).toFixed(3)}" x2="${s.p1.x.toFixed(3)}" y2="${flipY(s.p1.y).toFixed(3)}" stroke="${stroke}" stroke-width="2" ev-style="${s.style}" />`;
  }).join("\n  ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${vbW.toFixed(3)}" height="${vbH.toFixed(3)}" viewBox="0 0 ${vbW.toFixed(3)} ${vbH.toFixed(3)}">
  <!-- ${comment} -->
  <g>
  ${body}
  </g>
</svg>
`;
}
function generateCrashlockWithOutline(params) {
  return generateCrashlockPartialSlices(params, { includeOutline: true });
}
function generateCrashlockPartialSlices(params, opts) {
  const { L, W, H } = params;
  const { lockParams, topParams, hooksActive } = materialFromParams(params);
  const widthUu = predLinear(GEOM_WIDTH_UU, L, W, H);
  const heightUu = predLinear(GEOM_HEIGHT_UU, L, W, H);
  const mmPerUuCandidate = 25.4 / 96;
  const built = buildLockBottomSegments(L, W, H, lockParams, { omitTopCreaseStubs: true });
  const top = buildTopFlapSegments(built.layout, topParams);
  const outline = opts.includeOutline ? buildBodyOutlineSegments(built.layout) : { cutting: [], curveApprox: true, filletsExact: false };
  const cutting = [...built.cutting, ...top.cutting, ...outline.cutting];
  const creasing = [...built.creasing, ...top.creasingExtra];
  const segs = [...cutting, ...creasing];
  const tipExtra = tipDepthMm(W, topParams) * (96 / 25.4);
  const maxX = Math.max(widthUu, built.layout.x4 + 20);
  const maxY = Math.max(heightUu, built.layout.yBodyTop + tipExtra + 40);
  const filletsExact = Boolean(built.filletsExactBigFlap && top.filletsExactTop);
  const sliceLabel = opts.includeOutline ? "lock+top+outline" : "lock+top SECOND SLICE";
  const curveNote = filletsExact ? "exact_cubics_lock2_top6" : "curve_approx";
  const svg = renderSegSvg(
    segs,
    maxX,
    maxY,
    `BOXCRAFT dieline-lab ${sliceLabel}; ${curveNote}; not full 63/14 topology`
  );
  const implemented = [
    "outer_envelope_size_vs_LWH_fit",
    "body_panel_creasing_14_parametric",
    "lock_bottom_cutting_polyline_parametric",
    "lock_bottom_exact_big_flap_cubics",
    "top_dust_flap_cutting_parametric",
    "tuck_tongue_cutting_parametric",
    "glue_flap_outer_cutting_parametric",
    "top_exact_body_fillet_cubics"
  ];
  if (opts.includeOutline) {
    implemented.push("body_outline_outer_edges_parametric");
    implemented.push("body_outline_lines_only_cubics_relocated");
  }
  if (hooksActive) {
    implemented.push("material_hooks_thickness_kerf_unvalidated");
    implemented.push("top_tuck_inset_thickness_hook_unvalidated");
  }
  const gaps = opts.includeOutline ? [
    "zero_length_degenerate_segments_omitted",
    "full_63_cutting_topology_not_claimed",
    ...materialGapTags(hooksActive)
  ] : [
    "body_side_outer_and_back_top_edge_not_closed",
    "full_63_cutting_topology_not_claimed",
    ...materialGapTags(hooksActive)
  ];
  return {
    params,
    widthUu,
    heightUu,
    mmPerUuCandidate,
    svg,
    layout: built.layout,
    cutting,
    creasing,
    curveApprox: !filletsExact,
    filletsExact,
    modelWidth: GEOM_WIDTH_UU.model,
    modelHeight: GEOM_HEIGHT_UU.model,
    implemented,
    gaps
  };
}
export {
  GEOM_HEIGHT_UU,
  GEOM_WIDTH_UU,
  generateCrashlockWithOutline,
  setFitCoeffs
};
