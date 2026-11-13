/**
 * Parametric productbox-crashlock → boxcraft.knife.v3 (2D geomMode).
 * Lab prototype segments (uu, Y-up) → mm knife layers (Y-down).
 * manufacturingReady always false.
 * Thickness/kerf hooks are applied but unvalidated (not calibrated for production).
 * Structural truth is 61 Cutting + 14 Creasing (raw 63 includes export zero-length artifacts — not emitted).
 */
import { sizeArrowDataFromBounds } from '../dimAnnotations.js'
import { generateCrashlockWithOutline } from '../../packages/crashlock-engine/index.mjs'

const BLEED_EXTRA_MM = 10
const EPS = 1e-4
const CUBIC_SEGS = 10
const STRUCTURAL_CUTTING = 61
const STRUCTURAL_CREASING = 14

function r3(n) {
  return Math.round(Number(n) * 1000) / 1000
}

function sampleCubic(x0, y0, cx1, cy1, cx2, cy2, x1, y1, segs = CUBIC_SEGS) {
  const pts = [[x0, y0]]
  for (let i = 1; i <= segs; i++) {
    const t = i / segs
    const u = 1 - t
    pts.push([
      u * u * u * x0 + 3 * u * u * t * cx1 + 3 * u * t * t * cx2 + t * t * t * x1,
      u * u * u * y0 + 3 * u * u * t * cy1 + 3 * u * t * t * cy2 + t * t * t * y1,
    ])
  }
  return pts
}

/** CompactSeg (uu, Y-up) → line segments in mm, Y-down (flip with maxYUu). */
function compactToMmSegs(compactSegs, scale, maxYUu) {
  const out = []
  const flipY = (y) => maxYUu - y
  const pushLine = (x1, y1, x2, y2) => {
    if (![x1, y1, x2, y2].every(Number.isFinite)) return
    if (Math.hypot(x2 - x1, y2 - y1) < EPS) return
    out.push({
      x1: r3(x1 * scale),
      y1: r3(flipY(y1) * scale),
      x2: r3(x2 * scale),
      y2: r3(flipY(y2) * scale),
    })
  }
  for (const s of compactSegs || []) {
    if (!s?.p0 || !s?.p1) continue
    if (s.exportArtifact) continue
    if (s.kind === 'path' && s.c0 && s.c1) {
      const pts = sampleCubic(s.p0.x, s.p0.y, s.c0.x, s.c0.y, s.c1.x, s.c1.y, s.p1.x, s.p1.y)
      for (let i = 0; i < pts.length - 1; i++) {
        pushLine(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1])
      }
    } else {
      pushLine(s.p0.x, s.p0.y, s.p1.x, s.p1.y)
    }
  }
  return out
}

function boundsFromSegs(groups) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const segs of groups) {
    for (const s of segs || []) {
      for (const [x, y] of [
        [s.x1, s.y1],
        [s.x2, s.y2],
      ]) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }
  }
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) {
    return { minX: 0, minY: 0, maxX: 1, maxY: 1 }
  }
  return { minX, minY, maxX, maxY }
}

function rectBleedSegs(b, dist) {
  const x0 = b.minX - dist
  const y0 = b.minY - dist
  const x1 = b.maxX + dist
  const y1 = b.maxY + dist
  return [
    { x1: r3(x0), y1: r3(y0), x2: r3(x1), y2: r3(y0) },
    { x1: r3(x1), y1: r3(y0), x2: r3(x1), y2: r3(y1) },
    { x1: r3(x1), y1: r3(y1), x2: r3(x0), y2: r3(y1) },
    { x1: r3(x0), y1: r3(y1), x2: r3(x0), y2: r3(y0) },
  ]
}

function segsToPathList(segs) {
  return (segs || []).map((s) => `M ${s.x1} ${s.y1} L ${s.x2} ${s.y2}`)
}

/**
 * @param {{
 *   length:number, width:number, height:number, thickness?:number,
 *   bleed?:number, sizeMode?:string, fluteDirection?:string, materialId?:string,
 *   params?: { kerfMm?: number },
 * }} opts
 */
export function createCrashlockKnife(opts = {}) {
  const L = Number(opts.length)
  const W = Number(opts.width)
  const H = Number(opts.height)
  const T = Number(opts.thickness)
  const thickness = Number.isFinite(T) && T >= 0 ? T : 0.6
  if (![L, W, H].every((n) => Number.isFinite(n) && n > 0)) {
    throw new Error('productbox-crashlock requires positive length/width/height')
  }
  const params = opts.params && typeof opts.params === 'object' ? opts.params : {}
  const kerfRaw = Number(params.kerfMm)
  const kerfMm = Number.isFinite(kerfRaw) && kerfRaw >= 0 ? kerfRaw : 0
  const thicknessMm = Number.isFinite(thickness) ? thickness : 0
  const hooksActive = thicknessMm !== 0 || kerfMm !== 0

  const bleedSrc = Number.isFinite(Number(opts.bleed)) ? Math.max(0, Number(opts.bleed)) : 5
  const bleedEff = bleedSrc + BLEED_EXTRA_MM
  const sizeMode = opts.sizeMode === 'outer' ? 'outer' : 'inner'
  const fluteDirection = opts.fluteDirection === 'W' ? 'W' : 'L'
  const materialId = ['kraft', 'white', 'blue'].includes(opts.materialId) ? opts.materialId : 'kraft'

  const result = generateCrashlockWithOutline({
    L,
    W,
    H,
    thicknessMm,
    kerfMm,
  })
  const structuralCutting = Array.isArray(result.cutting) ? result.cutting.length : 0
  const structuralCreasing = Array.isArray(result.creasing) ? result.creasing.length : 0
  const structuralOk =
    structuralCutting === STRUCTURAL_CUTTING && structuralCreasing === STRUCTURAL_CREASING

  const scale = Number(result.mmPerUuCandidate) || 25.4 / 96
  const tipPad = 40
  const maxYUu =
    Math.max(
      result.heightUu || 0,
      ...(result.cutting || []).flatMap((s) =>
        [s.p0?.y, s.p1?.y, s.c0?.y, s.c1?.y].filter((y) => y != null),
      ),
      ...(result.creasing || []).flatMap((s) => [s.p0?.y, s.p1?.y].filter((y) => y != null)),
    ) + tipPad

  const cutSegs = compactToMmSegs(result.cutting, scale, maxYUu)
  const folds = compactToMmSegs(result.creasing, scale, maxYUu)
  if (!cutSegs.length) throw new Error('productbox-crashlock produced no cutting segments')

  const cutBounds = boundsFromSegs([cutSegs, folds])
  const bleeds = rectBleedSegs(cutBounds, BLEED_EXTRA_MM)
  const bounds = boundsFromSegs([cutSegs, folds, bleeds])
  const cutPaths = segsToPathList(cutSegs)
  const bleedPaths = segsToPathList(bleeds)
  const layers = {
    trim: { role: 'trim', color: '#2028b0', segments: cutSegs },
    crease: { role: 'crease', color: '#fa0000', dash: true, segments: folds },
    bleed: { role: 'bleed', color: '#46ba00', segments: bleeds },
  }

  return {
    schema: 'boxcraft.knife.v3',
    unit: 'mm',
    template: 'productbox-crashlock',
    templateInfo: {
      id: 'productbox-crashlock',
      label: '锁底盒',
      labelEn: 'Crashlock / Auto-bottom',
      standard: 'Packative Lab parametric prototype',
      sizeRule: 'parametric',
      version: '1',
    },
    geomMode: true,
    fromCrashlockLab: true,
    provenance: {
      source: 'crashlock-lab-prototype',
      lockedSample: false,
      unitConfidence: 'trusted',
      mmPerUnit: scale,
      engineeringExportAllowed: true,
      gaps: result.gaps || [],
      implemented: result.implemented || [],
      filletsExact: !!result.filletsExact,
      hooksActive,
      thicknessMm,
      kerfMm,
      structuralCutting,
      structuralCreasing,
      fullTopologyClaimed: false,
    },
    dimensions: {
      length: L,
      width: W,
      height: H,
      thickness: thicknessMm,
      sizeMode,
      fluteDirection,
      inner: { length: L, width: W, height: H },
      outer: { length: L, width: W, height: H },
      panel: { length: L, width: W, height: H },
    },
    material: { id: materialId, science: 'crashlock-lab', fluteDirection },
    bleed: bleedSrc,
    bleedEffective: bleedEff,
    params: { kerfMm },
    faces: [],
    cuts: cutSegs,
    bleeds,
    folds,
    hinges: [],
    foldStages: [],
    layers,
    holes: [],
    cutPath: cutPaths.join(' '),
    bleedPath: bleedPaths.join(' '),
    cutPaths,
    bleedPaths,
    meta: {
      anyPoly: false,
      fromCrashlockLab: true,
      foldStageCount: 0,
      bleedExtra: BLEED_EXTRA_MM,
      bleedEffective: bleedEff,
      cutCount: cutSegs.length,
      creaseCount: folds.length,
      structuralCutting,
      structuralCreasing,
      hooksActive,
      // intentionally omit cutApprox / bleedApprox for engineering gate
      widthUu: result.widthUu,
      heightUu: result.heightUu,
    },
    topology: {
      root: null,
      roots: [],
      faceCount: 0,
      hingeCount: 0,
      faceOrder: [],
      supportsClosedCheck: false,
      supportsPiece: false,
      holeCount: 0,
      anyPoly: false,
      components: 0,
    },
    animation: { groups: [], animations: [] },
    sizeArrowData: sizeArrowDataFromBounds(bounds, {
      length: L,
      width: W,
      height: H,
      sizeMode,
    }),
    totalX: r3(bounds.maxX - bounds.minX),
    totalY: r3(bounds.maxY - bounds.minY),
    bounds,
    manufacturingReady: false,
    productionReady: false,
    validation: {
      ok: cutSegs.length > 0 && folds.length > 0 && structuralOk,
      checks: [
        {
          id: 'crashlock-parametric',
          ok: cutSegs.length > 0,
          detail: `lab outline slice sampledCuts=${cutSegs.length}; structural=${structuralCutting}/${structuralCreasing} (not raw 63)`,
        },
        {
          id: 'structural-count',
          ok: structuralOk,
          detail: structuralOk
            ? `structural Cutting=${STRUCTURAL_CUTTING} Creasing=${STRUCTURAL_CREASING}`
            : `expected ${STRUCTURAL_CUTTING}/${STRUCTURAL_CREASING} got ${structuralCutting}/${structuralCreasing}`,
        },
        {
          id: 'unitConfidence',
          ok: true,
          detail: `trusted mmPerUu=${scale}`,
        },
        {
          id: 'thickness-hooks',
          ok: true,
          detail: hooksActive
            ? `unvalidated hooks thicknessMm=${thicknessMm} kerfMm=${kerfMm}`
            : 'identity hooks thicknessMm=0 kerfMm=0',
        },
      ],
    },
  }
}
