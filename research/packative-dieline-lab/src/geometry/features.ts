import type { SvgNormalizeResult } from '../normalize/svgParse.ts'
import { cuttingCountBreakdown } from './degenerateClassify.ts'
import type { CompactSeg } from './segmentMatch.ts'

export type FeatureSummary = {
  sampleId: string
  L: number | null
  W: number | null
  H: number | null
  cuttingCount: number
  cuttingCountRaw: number
  cuttingZeroLength: number
  cuttingExportArtifact: number
  cuttingCollapsedLockShelf: number
  cuttingStructural: number
  creasingCount: number
  geomWidthUu: number | null
  geomHeightUu: number | null
  pageWidthUu: number | null
  pageHeightUu: number | null
  topCreaseLengthsUu: number[]
  candidateMmPerUu: number | null
}

/** Packative export zero-length Cutting threshold (uu). */
export const ZERO_LENGTH_UU = 1e-6

export type LinearCoeff = { a: number; b: number; c: number; d: number; rmse: number; n: number }

export type InteractCoeff = {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
  g: number
  rmse: number
  n: number
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

  const compactLike: CompactSeg[] = doc.normalized.segments.map((s) => ({
    kind: s.kind,
    style: s.style,
    lengthUu: s.lengthUu,
    p0: s.world[0] || null,
    p1: s.world[s.world.length - 1] || null,
    pointCount: s.world.length,
  }))
  const bd = cuttingCountBreakdown(compactLike, doc.normalized.cuttingCount)

  return {
    sampleId: doc.sampleId,
    L: dims?.L ?? null,
    W: dims?.W ?? null,
    H: dims?.H ?? null,
    cuttingCount: bd.cuttingCountRaw,
    cuttingCountRaw: bd.cuttingCountRaw,
    cuttingZeroLength: bd.cuttingZeroLength,
    cuttingExportArtifact: bd.cuttingExportArtifact,
    cuttingCollapsedLockShelf: bd.cuttingCollapsedLockShelf,
    cuttingStructural: bd.cuttingStructural,
    creasingCount: doc.normalized.creasingCount,
    geomWidthUu: doc.normalized.geometryBounds?.width ?? null,
    geomHeightUu: doc.normalized.geometryBounds?.height ?? null,
    pageWidthUu: doc.normalized.pageBounds?.width ?? null,
    pageHeightUu: doc.normalized.pageBounds?.height ?? null,
    topCreaseLengthsUu: creases.slice(0, 8),
    candidateMmPerUu: doc.inferred.candidateMmPerUu,
  }
}

/** Gaussian elimination for n×n; returns null if singular. */
export function solveN(A: number[][], b: number[]): number[] | null {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
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

/** Fit y ≈ a*L + b*W + c*H + d with ordinary least squares (4+ samples). */
export function fitLinearLWH(
  rows: Array<{ L: number; W: number; H: number; y: number }>,
): LinearCoeff | null {
  if (rows.length < 4) return null
  const XtX = Array.from({ length: 4 }, () => Array(4).fill(0))
  const XtY = Array(4).fill(0)
  for (const r of rows) {
    const x = [r.L, r.W, r.H, 1]
    for (let i = 0; i < 4; i++) {
      XtY[i] += x[i] * r.y
      for (let j = 0; j < 4; j++) XtX[i][j] += x[i] * x[j]
    }
  }
  const coeff = solveN(XtX, XtY)
  if (!coeff) return null
  const [a, b, c, d] = coeff
  let sse = 0
  for (const r of rows) {
    const pred = a * r.L + b * r.W + c * r.H + d
    sse += (pred - r.y) ** 2
  }
  return { a, b, c, d, rmse: Math.sqrt(sse / rows.length), n: rows.length }
}

/** Fit y ≈ aL+bW+cH + e·LW + f·LH + g·WH + d (7+ samples). */
export function fitLinearLWHInteract(
  rows: Array<{ L: number; W: number; H: number; y: number }>,
): InteractCoeff | null {
  if (rows.length < 7) return null
  const XtX = Array.from({ length: 7 }, () => Array(7).fill(0))
  const XtY = Array(7).fill(0)
  for (const r of rows) {
    const x = [r.L, r.W, r.H, 1, r.L * r.W, r.L * r.H, r.W * r.H]
    for (let i = 0; i < 7; i++) {
      XtY[i] += x[i] * r.y
      for (let j = 0; j < 7; j++) XtX[i][j] += x[i] * x[j]
    }
  }
  const coeff = solveN(XtX, XtY)
  if (!coeff) return null
  const [a, b, c, d, e, f, g] = coeff
  let sse = 0
  for (const r of rows) {
    const pred = a * r.L + b * r.W + c * r.H + d + e * r.L * r.W + f * r.L * r.H + g * r.W * r.H
    sse += (pred - r.y) ** 2
  }
  return { a, b, c, d, e, f, g, rmse: Math.sqrt(sse / rows.length), n: rows.length }
}

export function predLinear(
  c: { a: number; b: number; c: number; d: number; e?: number; f?: number; g?: number },
  L: number,
  W: number,
  H: number,
): number {
  const e = c.e ?? 0
  const f = c.f ?? 0
  const g = c.g ?? 0
  return c.a * L + c.b * W + c.c * H + c.d + e * L * W + f * L * H + g * W * H
}
