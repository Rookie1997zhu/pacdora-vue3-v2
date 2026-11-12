import { ZERO_LENGTH_UU } from './features.ts'
import { inferBodyBottomY } from './lockBottomFeatures.ts'
import { boundsFromSegs, type CompactSeg, type Pt } from './segmentMatch.ts'

/**
 * Body-bottom fold band half-width (uu). Class A twins sit at maxX near bodyBottomY
 * (offset varies ~1.9–7 uu across samples); Class B lock shelves are far from this band.
 */
export const BODY_BOTTOM_ARTIFACT_BAND_UU = 12

export type ZeroKind = 'export_artifact_maxX_bodyBottom' | 'collapsed_lock_shelf' | null

export function isZeroLengthCutting(s: Pick<CompactSeg, 'style' | 'lengthUu'>): boolean {
  return s.style === 'Cutting' && (s.lengthUu ?? 0) < ZERO_LENGTH_UU
}

/** Class A: duplicate zero-length Cutting at geom maxX ∩ body-bottom fold band. */
export function isClassAMaxXBodyBottom(pt: Pt, segs: CompactSeg[]): boolean {
  const b = boundsFromSegs(segs)
  const bodyBottomY = inferBodyBottomY(segs)
  if (!b) return false
  const epsX = Math.max(1, b.width * 0.002)
  const maxX = b.minX + b.width
  if (Math.abs(pt.x - maxX) > epsX) return false
  if (bodyBottomY == null) return true
  return Math.abs(pt.y - bodyBottomY) <= BODY_BOTTOM_ARTIFACT_BAND_UU
}

export function classifyZeroCutting(s: CompactSeg, allSegs: CompactSeg[]): ZeroKind {
  if (!isZeroLengthCutting(s)) return null
  const pt = s.p0 || s.p1
  if (!pt) return 'collapsed_lock_shelf'
  if (isClassAMaxXBodyBottom(pt, allSegs)) return 'export_artifact_maxX_bodyBottom'
  return 'collapsed_lock_shelf'
}

export type CuttingCountBreakdown = {
  cuttingCountRaw: number
  cuttingZeroLength: number
  cuttingExportArtifact: number
  cuttingCollapsedLockShelf: number
  cuttingStructural: number
}

/** Structural = raw − Class A only (collapsed lock shelves stay in structural count). */
export function cuttingCountBreakdown(segs: CompactSeg[], cuttingCountRaw?: number): CuttingCountBreakdown {
  const cuts = segs.filter((s) => s.style === 'Cutting')
  const raw = cuttingCountRaw ?? cuts.length
  let cuttingExportArtifact = 0
  let cuttingCollapsedLockShelf = 0
  let cuttingZeroLength = 0
  for (const s of cuts) {
    const kind = s.exportArtifact
      ? 'export_artifact_maxX_bodyBottom'
      : s.collapsedLockShelf
        ? 'collapsed_lock_shelf'
        : classifyZeroCutting(s, segs)
    if (!kind) continue
    cuttingZeroLength++
    if (kind === 'export_artifact_maxX_bodyBottom') cuttingExportArtifact++
    else cuttingCollapsedLockShelf++
  }
  return {
    cuttingCountRaw: raw,
    cuttingZeroLength,
    cuttingExportArtifact,
    cuttingCollapsedLockShelf,
    cuttingStructural: raw - cuttingExportArtifact,
  }
}

export function annotateZeroKinds(segs: CompactSeg[]): CompactSeg[] {
  return segs.map((s) => {
    const kind = classifyZeroCutting(s, segs)
    const base: CompactSeg = {
      kind: s.kind,
      style: s.style,
      lengthUu: s.lengthUu,
      p0: s.p0,
      p1: s.p1,
      pointCount: s.pointCount,
      ...(s.c0 ? { c0: s.c0 } : {}),
      ...(s.c1 ? { c1: s.c1 } : {}),
    }
    if (kind === 'export_artifact_maxX_bodyBottom') return { ...base, exportArtifact: true }
    if (kind === 'collapsed_lock_shelf') return { ...base, collapsedLockShelf: true }
    return base
  })
}
