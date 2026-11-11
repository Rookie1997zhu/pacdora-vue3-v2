/**
 * Partial parametric prototype for productbox-crashlock main panel envelope.
 * Evidence-backed subset only: outer rectangle from fitted geom W/H vs L,W,H.
 * Does NOT claim full auto-bottom lock geometry.
 */

export type CrashlockParams = { L: number; W: number; H: number }

/** Fitted on training crashlock SVGs (uu), see data/rules/validated-rules.json */
export const GEOM_WIDTH_UU = {
  a: 9.4488,
  b: 3.7795,
  c: 3.7795,
  d: 0,
  note: 'approx 2.5*L + W + H in CSS px if mm*3.7795; refined by OLS on local samples',
}

export const GEOM_HEIGHT_UU = {
  a: 3.7795,
  b: 0,
  c: 5.6693,
  d: 0,
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
}

export function setFitCoeffs(
  width: { a: number; b: number; c: number; d: number },
  height: { a: number; b: number; c: number; d: number },
) {
  Object.assign(GEOM_WIDTH_UU, width)
  Object.assign(GEOM_HEIGHT_UU, height)
}

export function generateCrashlockPartial(params: CrashlockParams): PrototypeResult {
  const { L, W, H } = params
  const widthUu = GEOM_WIDTH_UU.a * L + GEOM_WIDTH_UU.b * W + GEOM_WIDTH_UU.c * H + GEOM_WIDTH_UU.d
  const heightUu = GEOM_HEIGHT_UU.a * L + GEOM_HEIGHT_UU.b * W + GEOM_HEIGHT_UU.c * H + GEOM_HEIGHT_UU.d
  const mmPerUuCandidate = 25.4 / 96

  // Main body crease rectangle (semantic Creasing) + outer cutting frame (semantic Cutting).
  // This is a PARTIAL stand-in for panel envelope — not crash-lock bottom flaps.
  const margin = 20
  const x0 = margin
  const y0 = margin
  const x1 = margin + widthUu
  const y1 = margin + heightUu
  // Internal cross creases approximating L/W split (heuristic layout, documented as inferred)
  const midX = x0 + (GEOM_WIDTH_UU.a * L) / (GEOM_WIDTH_UU.a * L + GEOM_WIDTH_UU.b * W + GEOM_WIDTH_UU.c * H || 1) * widthUu
  const midY = y0 + (GEOM_HEIGHT_UU.a * L) / (heightUu || 1) * heightUu

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
    implemented: [
      'outer_envelope_size_vs_LWH_linear_fit',
      'semantic_cutting_outer_rect',
      'semantic_creasing_cross_heuristic',
    ],
    gaps: [
      'auto_bottom_crashlock_flaps_not_reconstructed',
      'glue_flap_and_dust_flap_topology_unknown',
      'curve_segments_not_modeled',
      'material_thickness_unobserved',
    ],
  }
}
