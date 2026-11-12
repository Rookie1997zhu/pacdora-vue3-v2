/**
 * Partial parametric prototype for productbox-crashlock.
 * Envelope from fitted geom W/H vs L,W,H; lock-bottom first slice from mm formulas.
 * Does NOT claim full 63/14 topology or production readiness.
 */

import { predLinear } from '../geometry/features.ts'
import {
  applyMaterialHooks,
  buildLockBottomSegments,
  DEFAULT_LOCK_PARAMS,
  type LockBottomLayoutUu,
} from '../geometry/lockBottomFeatures.ts'
import {
  applyTopMaterialHooks,
  buildTopFlapSegments,
  DEFAULT_TOP_PARAMS,
  tipDepthMm,
} from '../geometry/topFlapFeatures.ts'
import { buildBodyOutlineSegments } from '../geometry/bodyOutlineFeatures.ts'
import type { CompactSeg } from '../geometry/segmentMatch.ts'

export type CrashlockParams = {
  L: number
  W: number
  H: number
  /** Research sensitivity hook; default 0. Unobserved / unvalidated caliper. */
  thicknessMm?: number
  /** Research sensitivity hook; default 0. Half-applied to tip/bigAdd. */
  kerfMm?: number
}

function materialFromParams(params: CrashlockParams) {
  const thicknessMm = params.thicknessMm ?? 0
  const kerfMm = params.kerfMm ?? 0
  const lockParams = applyMaterialHooks(DEFAULT_LOCK_PARAMS, thicknessMm, kerfMm)
  const topParams = applyTopMaterialHooks(DEFAULT_TOP_PARAMS, thicknessMm, kerfMm)
  const hooksActive = thicknessMm !== 0 || kerfMm !== 0
  return { thicknessMm, kerfMm, lockParams, topParams, hooksActive }
}

function materialGapTags(hooksActive: boolean): string[] {
  return hooksActive
    ? ['material_hooks_applied_unvalidated']
    : ['material_thickness_unobserved']
}

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

/** Defaults synced to data/rules/fit-coeffs.json@2026-11-12 (OLS / validated-rules envelope). */
export const GEOM_WIDTH_UU: FitCoeff = {
  a: 7.559005140049829,
  b: 7.559153452808672,
  c: -0.00018231249214184508,
  d: 43.47466587018427,
  e: 0,
  f: 0,
  g: 0,
  model: 'lwh_linear',
  note: 'fit-coeffs.json geomWidthUu@2026-11-12; lwh_linear OLS',
}

export const GEOM_HEIGHT_UU: FitCoeff = {
  a: 0.0009457842562090699,
  b: 6.045474847320218,
  c: 3.778819750831597,
  d: 45.40780286286577,
  e: -5.506342569382325e-7,
  f: -0.000011271669240737835,
  g: 0.000022652701149000716,
  model: 'lwh_interact',
  note: 'fit-coeffs.json geomHeightUu@2026-11-12; lwh_interact OLS',
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
  filletsExact?: boolean
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
      if (s.kind === 'path' && s.c0 && s.c1) {
        const d = `M ${s.p0!.x.toFixed(3)} ${flipY(s.p0!.y).toFixed(3)} C ${s.c0.x.toFixed(3)} ${flipY(s.c0.y).toFixed(3)} ${s.c1.x.toFixed(3)} ${flipY(s.c1.y).toFixed(3)} ${s.p1!.x.toFixed(3)} ${flipY(s.p1!.y).toFixed(3)}`
        return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="2" ev-style="${s.style}" />`
      }
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
  const { lockParams, hooksActive } = materialFromParams(params)
  const widthUu = predLinear(GEOM_WIDTH_UU, L, W, H)
  const heightUu = predLinear(GEOM_HEIGHT_UU, L, W, H)
  const mmPerUuCandidate = 25.4 / 96
  const built = buildLockBottomSegments(L, W, H, lockParams)
  const segs = [...built.cutting, ...built.creasing]
  const maxX = Math.max(widthUu, built.layout.x4 + 20)
  const maxY = Math.max(heightUu, built.layout.yBodyTop + built.layout.params.topDiagMm * (96 / 25.4) + 40)
  const svg = renderSegSvg(
    segs,
    maxX,
    maxY,
    'BOXCRAFT dieline-lab lock-bottom FIRST SLICE; exact big-flap cubics + hook line chamfers; not full 63/14 topology',
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
    filletsExact: built.filletsExactBigFlap,
    modelWidth: GEOM_WIDTH_UU.model,
    modelHeight: GEOM_HEIGHT_UU.model,
    implemented: [
      'outer_envelope_size_vs_LWH_fit',
      'body_panel_creasing_14_parametric',
      'lock_bottom_cutting_polyline_parametric',
      'lock_bottom_exact_big_flap_cubics',
      'curve_approx_hook_chamfer_lines',
      ...(hooksActive ? ['material_hooks_thickness_kerf_unvalidated'] : []),
    ],
    gaps: [
      'top_dust_flap_and_tuck_tongue_not_reconstructed',
      'glue_flap_outer_cutting_not_reconstructed',
      'six_top_flap_fillets_not_modeled',
      'full_63_cutting_topology_not_claimed',
      ...materialGapTags(hooksActive),
    ],
  }
}

/**
 * Second-slice generator: lock bottom + top dust flaps + tuck tongues + glue outer.
 * Owns 2 big-flap + 6 top-fillet exact cubics. Full 63/14 still not claimed.
 */
export function generateCrashlockWithTopFlaps(params: CrashlockParams): PrototypeResult {
  return generateCrashlockPartialSlices(params, { includeOutline: false })
}

/**
 * Third-slice generator: lock + top + body outline leftovers (right outer, L-bottom, micro bridge).
 * Exact cubics live in lock/top; outline is lines-only. Full 63/14 not claimed.
 */
export function generateCrashlockWithOutline(params: CrashlockParams): PrototypeResult {
  return generateCrashlockPartialSlices(params, { includeOutline: true })
}

function generateCrashlockPartialSlices(
  params: CrashlockParams,
  opts: { includeOutline: boolean },
): PrototypeResult {
  const { L, W, H } = params
  const { lockParams, topParams, hooksActive } = materialFromParams(params)
  const widthUu = predLinear(GEOM_WIDTH_UU, L, W, H)
  const heightUu = predLinear(GEOM_HEIGHT_UU, L, W, H)
  const mmPerUuCandidate = 25.4 / 96
  const built = buildLockBottomSegments(L, W, H, lockParams, { omitTopCreaseStubs: true })
  const top = buildTopFlapSegments(built.layout, topParams)
  const outline = opts.includeOutline
    ? buildBodyOutlineSegments(built.layout)
    : { cutting: [] as CompactSeg[], curveApprox: true, filletsExact: false }
  const cutting = [...built.cutting, ...top.cutting, ...outline.cutting]
  const creasing = [...built.creasing, ...top.creasingExtra]
  const segs = [...cutting, ...creasing]
  const tipExtra = tipDepthMm(W, topParams) * (96 / 25.4)
  const maxX = Math.max(widthUu, built.layout.x4 + 20)
  const maxY = Math.max(heightUu, built.layout.yBodyTop + tipExtra + 40)
  const filletsExact = Boolean(built.filletsExactBigFlap && top.filletsExactTop)
  const sliceLabel = opts.includeOutline ? 'lock+top+outline' : 'lock+top SECOND SLICE'
  const curveNote = filletsExact ? 'exact_cubics_lock2_top6' : 'curve_approx'
  const svg = renderSegSvg(
    segs,
    maxX,
    maxY,
    `BOXCRAFT dieline-lab ${sliceLabel}; ${curveNote}; not full 63/14 topology`,
  )
  const implemented = [
    'outer_envelope_size_vs_LWH_fit',
    'body_panel_creasing_14_parametric',
    'lock_bottom_cutting_polyline_parametric',
    'lock_bottom_exact_big_flap_cubics',
    'top_dust_flap_cutting_parametric',
    'tuck_tongue_cutting_parametric',
    'glue_flap_outer_cutting_parametric',
    'top_exact_body_fillet_cubics',
  ]
  if (opts.includeOutline) {
    implemented.push('body_outline_outer_edges_parametric')
    implemented.push('body_outline_lines_only_cubics_relocated')
  }
  if (hooksActive) {
    implemented.push('material_hooks_thickness_kerf_unvalidated')
    implemented.push('top_tuck_inset_thickness_hook_unvalidated')
  }
  const gaps = opts.includeOutline
    ? [
        'zero_length_degenerate_segments_omitted',
        'full_63_cutting_topology_not_claimed',
        ...materialGapTags(hooksActive),
      ]
    : [
        'body_side_outer_and_back_top_edge_not_closed',
        'full_63_cutting_topology_not_claimed',
        ...materialGapTags(hooksActive),
      ]
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
    gaps,
  }
}

