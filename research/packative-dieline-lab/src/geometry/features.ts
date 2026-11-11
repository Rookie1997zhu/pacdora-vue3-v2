import type { SvgNormalizeResult } from '../normalize/svgParse.ts'

export type FeatureSummary = {
  sampleId: string
  L: number | null
  W: number | null
  H: number | null
  cuttingCount: number
  creasingCount: number
  geomWidthUu: number | null
  geomHeightUu: number | null
  pageWidthUu: number | null
  pageHeightUu: number | null
  topCreaseLengthsUu: number[]
  candidateMmPerUu: number | null
}

export function summarizeFeatures(
  doc: SvgNormalizeResult,
  dims: { L: number; W: number; H: number } | null,
): FeatureSummary {
  const creases = doc.normalized.segments
    .filter((s) => s.style === 'Creasing' && s.world.length >= 2)
    .map((s) => s.lengthUu)
    .filter((n) => n > 1)
    .sort((a, b) => b - a)

  return {
    sampleId: doc.sampleId,
    L: dims?.L ?? null,
    W: dims?.W ?? null,
    H: dims?.H ?? null,
    cuttingCount: doc.normalized.cuttingCount,
    creasingCount: doc.normalized.creasingCount,
    geomWidthUu: doc.normalized.geometryBounds?.width ?? null,
    geomHeightUu: doc.normalized.geometryBounds?.height ?? null,
    pageWidthUu: doc.normalized.pageBounds?.width ?? null,
    pageHeightUu: doc.normalized.pageBounds?.height ?? null,
    topCreaseLengthsUu: creases.slice(0, 8),
    candidateMmPerUu: doc.inferred.candidateMmPerUu,
  }
}

/** Fit y ≈ a*L + b*W + c*H + d with ordinary least squares (4+ samples). */
export function fitLinearLWH(
  rows: Array<{ L: number; W: number; H: number; y: number }>,
): { a: number; b: number; c: number; d: number; rmse: number; n: number } | null {
  if (rows.length < 4) return null
  // Normal equations for [L W H 1]
  const XtX = Array.from({ length: 4 }, () => Array(4).fill(0))
  const XtY = Array(4).fill(0)
  for (const r of rows) {
    const x = [r.L, r.W, r.H, 1]
    for (let i = 0; i < 4; i++) {
      XtY[i] += x[i] * r.y
      for (let j = 0; j < 4; j++) XtX[i][j] += x[i] * x[j]
    }
  }
  const coeff = solve4(XtX, XtY)
  if (!coeff) return null
  const [a, b, c, d] = coeff
  let sse = 0
  for (const r of rows) {
    const pred = a * r.L + b * r.W + c * r.H + d
    sse += (pred - r.y) ** 2
  }
  return { a, b, c, d, rmse: Math.sqrt(sse / rows.length), n: rows.length }
}

function solve4(A: number[][], b: number[]): number[] | null {
  const M = A.map((row, i) => [...row, b[i]])
  const n = 4
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r
    if (Math.abs(M[pivot][col]) < 1e-12) return null
    ;[M[col], M[pivot]] = [M[pivot], M[col]]
    const div = M[col][col]
    for (let j = col; j <= n; j++) M[col][j] /= div
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = M[r][col]
      for (let j = col; j <= n; j++) M[r][j] -= f * M[col][j]
    }
  }
  return M.map((row) => row[n])
}
