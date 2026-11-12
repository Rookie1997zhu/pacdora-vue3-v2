/**
 * Partial parametric prototype for productbox-crashlock.
 * Envelope from fitted geom W/H vs L,W,H; lock-bottom first slice from mm formulas.
 * Does NOT claim full 63/14 topology or production readiness.
 */

import { predLinear } from '../geometry/features.ts'
import { buildLockBottomSegments, type LockBottomLayoutUu } from '../geometry/lockBottomFeatures.ts'
import { buildTopFlapSegments } from '../geometry/topFlapFeatures.ts'
import type { CompactSeg } from '../geometry/segmentMatch.ts'

export type CrashlockParams = { L: number; W: number; H: number }

export type FitCoeff = {
  a: number
  b: number
  c: number
  d: number
  e?: number
  f?: number
  g?: number
  model?: string
  note?: string
}

/** Fitted on training crashlock SVGs (uu), see data/rules/fit-coeffs.json */
export const GEOM_WIDTH_UU: FitCoeff = {
  a: 9.4488,
  b: 3.7795,
  c: 3.7795,
  d: 0,
  e: 0,
  f: 0,
  g: 0,
  model: 'lwh_linear',
  note: 'approx 2.5*L + W + H in CSS px if mm*3.7795; refined by OLS on local samples',
}

export const GEOM_HEIGHT_UU: FitCoeff = {
  a: 3.7795,
  b: 0,
  c: 5.6693,
  d: 0,
  e: 0,
  f: 0,
  g: 0,
  model: 'lwh_linear',
  note: 'approx L + 1.5*H in CSS px; refined by OLS on local samples',
}

export type PrototypeResult = {
  params: CrashlockParams
  widthUu: number
  heightUu: number
  mmPerUuCandidate: number
  svg: string
  implemented: string[]
  gaps: string[]
  modelWidth?: string
  modelHeight?: string
  layout?: LockBottomLayoutUu
  cutting?: CompactSeg[]
  creasing?: CompactSeg[]
  curveApprox?: boolean
}

export function setFitCoeffs(width: FitCoeff, height: FitCoeff) {
  Object.assign(GEOM_WIDTH_UU, { e: 0, f: 0, g: 0 }, width)
  Object.assign(GEOM_HEIGHT_UU, { e: 0, f: 0, g: 0 }, height)
}

export function generateCrashlockPartial(params: CrashlockParams): PrototypeResult {
  const { L, W, H } = params
  const widthUu = predLinear(GEOM_WIDTH_UU, L, W, H)
  const heightUu = predLinear(GEOM_HEIGHT_UU, L, W, H)
  const mmPerUuCandidate = 25.4 / 96

  const margin = 20
  const x0 = margin
  const y0 = margin
  const x1 = margin + widthUu
  const y1 = margin + heightUu
  const midX = x0 + (Math.abs(GEOM_WIDTH_UU.a * L) / (Math.abs(GEOM_WIDTH_UU.a * L) + Math.abs(GEOM_WIDTH_UU.b * W) + Math.abs(GEOM_WIDTH_UU.c * H) || 1)) * widthUu
  const midY = y0 + (Math.abs(GEOM_HEIGHT_UU.a * L) / (Math.abs(heightUu) || 1)) * heightUu

  const lines: Array<{ x1: number; y1: number; x2: number; y2: number; style: 'Cutting' | 'Creasing' }> = [
    { x1: x0, y1: y0, x2: x1, y2: y0, style: 'Cutting' },
    { x1: x1, y1: y0, x2: x1, y2: y1, style: 'Cutting' },
    { x1: x1, y1: y1, x2: x0, y2: y1, style: 'Cutting' },
    { x1: x0, y1: y1, x2: x0, y2: y0, style: 'Cutting' },
    { x1: midX, y1: y0, x2: midX, y2: y1, style: 'Creasing' },
    { x1: x0, y1: midY, x2: x1, y2: midY, style: 'Creasing' },
  ]

  const vbW = widthUu + margin * 2
  const vbH = heightUu + margin * 2
  const body = lines
    .map(
      (l) =>
        `<line x1="${l.x1.toFixed(3)}" y1="${l.y1.toFixed(3)}" x2="${l.x2.toFixed(3)}" y2="${l.y2.toFixed(3)}" stroke="${l.style === 'Cutting' ? 'rgb(255,0,0)' : 'rgb(0,255,0)'}" stroke-width="2" ev-style="${l.style}" />`,
    )
    .join('\n  ')

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${vbW.toFixed(3)}" height="${vbH.toFixed(3)}" viewBox="0 0 ${vbW.toFixed(3)} ${vbH.toFixed(3)}">
  <!-- BOXCRAFT dieline-lab PARTIAL prototype; not production; lock-bottom NOT implemented -->
  <g>
  ${body}
  </g>
</svg>
`

  return {
    params,
    widthUu,
    heightUu,
    mmPerUuCandidate,
    svg,
    modelWidth: GEOM_WIDTH_UU.model,
    modelHeight: GEOM_HEIGHT_UU.model,
    implemented: [
      GEOM_WIDTH_UU.e || GEOM_HEIGHT_UU.e
        ? 'outer_envelope_size_vs_LWH_interaction_fit'
        : 'outer_envelope_size_vs_LWH_linear_fit',
      'semantic_cutting_outer_rect',
      'semantic_creasing_cross_heuristic',
    ],
    gaps: [
      'prefer_generateCrashlockWithLockBottom_for_lock_slice',
      'auto_bottom_crashlock_flaps_not_in_partial',
      'glue_flap_and_dust_flap_topology_unknown',
      'curve_segments_not_modeled',
      'material_thickness_unobserved',
    ],
  }
}

function renderSegSvg(segs: CompactSeg[], vbW: number, vbH: number, comment: string): string {
  // SVG Y grows downward; evidence / layout Y grows upward from lock bottom → flip for display
  const flipY = (y: number) => vbH - y
  const body = segs
    .filter((s) => s.p0 && s.p1)
    .map((s) => {
      const stroke = s.style === 'Cutting' ? 'rgb(255,0,0)' : 'rgb(0,255,0)'
      return `<line x1="${s.p0!.x.toFixed(3)}" y1="${flipY(s.p0!.y).toFixed(3)}" x2="${s.p1!.x.toFixed(3)}" y2="${flipY(s.p1!.y).toFixed(3)}" stroke="${stroke}" stroke-width="2" ev-style="${s.style}" />`
    })
    .join('\n  ')
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${vbW.toFixed(3)}" height="${vbH.toFixed(3)}" viewBox="0 0 ${vbW.toFixed(3)} ${vbH.toFixed(3)}">
  <!-- ${comment} -->
  <g>
  ${body}
  </g>
</svg>
`
}

/**
 * First-slice lock-bottom generator (kept for match-lock-bottom CLI).
 * Prefer generateCrashlockWithTopFlaps for the combined prototype.
 */
export function generateCrashlockWithLockBottom(params: CrashlockParams): PrototypeResult {
  const { L, W, H } = params
  const widthUu = predLinear(GEOM_WIDTH_UU, L, W, H)
  const heightUu = predLinear(GEOM_HEIGHT_UU, L, W, H)
  const mmPerUuCandidate = 25.4 / 96
  const built = buildLockBottomSegments(L, W, H)
  const segs = [...built.cutting, ...built.creasing]
  const maxX = Math.max(widthUu, built.layout.x4 + 20)
  const maxY = Math.max(heightUu, built.layout.yBodyTop + built.layout.params.topDiagMm * (96 / 25.4) + 40)
  const svg = renderSegSvg(
    segs,
    maxX,
    maxY,
    'BOXCRAFT dieline-lab lock-bottom FIRST SLICE; curve_approx; not full 63/14 topology',
  )
  return {
    params,
    widthUu,
    heightUu,
    mmPerUuCandidate,
    svg,
    layout: built.layout,
    cutting: built.cutting,
    creasing: built.creasing,
    curveApprox: built.curveApprox,
    modelWidth: GEOM_WIDTH_UU.model,
    modelHeight: GEOM_HEIGHT_UU.model,
    implemented: [
      'outer_envelope_size_vs_LWH_fit',
      'body_panel_creasing_14_parametric',
      'lock_bottom_cutting_polyline_parametric',
      'curve_approx_chord_for_cubic_corners',
    ],
    gaps: [
      'top_dust_flap_and_tuck_tongue_not_reconstructed',
      'glue_flap_outer_cutting_not_reconstructed',
      'six_top_flap_fillets_not_modeled',
      'full_63_cutting_topology_not_claimed',
      'exact_cubic_corners_not_modeled',
      'material_thickness_unobserved',
    ],
  }
}

/**
 * Second-slice generator: lock bottom + top dust flaps + tuck tongues + glue outer.
 * Cubic corners → chord approx (curve_approx). Full 63/14 still not claimed.
 */
export function generateCrashlockWithTopFlaps(params: CrashlockParams): PrototypeResult {
  const { L, W, H } = params
  const widthUu = predLinear(GEOM_WIDTH_UU, L, W, H)
  const heightUu = predLinear(GEOM_HEIGHT_UU, L, W, H)
  const mmPerUuCandidate = 25.4 / 96
  const built = buildLockBottomSegments(L, W, H, undefined, { omitTopCreaseStubs: true })
  const top = buildTopFlapSegments(built.layout)
  const cutting = [...built.cutting, ...top.cutting]
  const creasing = [...built.creasing, ...top.creasingExtra]
  const segs = [...cutting, ...creasing]
  const tipExtra = tipDepthForView(W) * (96 / 25.4)
  const maxX = Math.max(widthUu, built.layout.x4 + 20)
  const maxY = Math.max(heightUu, built.layout.yBodyTop + tipExtra + 40)
  const svg = renderSegSvg(
    segs,
    maxX,
    maxY,
    'BOXCRAFT dieline-lab lock+top SECOND SLICE; curve_approx; not full 63/14 topology',
  )
  return {
    params,
    widthUu,
    heightUu,
    mmPerUuCandidate,
    svg,
    layout: built.layout,
    cutting,
    creasing,
    curveApprox: true,
    modelWidth: GEOM_WIDTH_UU.model,
    modelHeight: GEOM_HEIGHT_UU.model,
    implemented: [
      'outer_envelope_size_vs_LWH_fit',
      'body_panel_creasing_14_parametric',
      'lock_bottom_cutting_polyline_parametric',
      'top_dust_flap_cutting_parametric',
      'tuck_tongue_cutting_parametric',
      'glue_flap_outer_cutting_parametric',
      'curve_approx_chord_for_cubic_corners',
    ],
    gaps: [
      'body_side_outer_and_back_top_edge_not_closed',
      'bottom_corner_fillet_paths_not_modeled',
      'full_63_cutting_topology_not_claimed',
      'exact_cubic_corners_not_modeled',
      'material_thickness_unobserved',
    ],
  }
}

function tipDepthForView(W: number): number {
  return 0.6 * W + 1
}
