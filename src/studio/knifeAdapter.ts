// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — existing JS knife engine
import { createKnife } from '../knife.js'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — Pacdora geom replay
import { loadPacdoraGeomKnife } from '../pacdoraGeomKnife.js'
import type { DesignDocumentV1 } from '../../packages/design-schema/designDocument'

export type StudioFace = {
  name: string
  x: number
  y: number
  w: number
  h: number
  points: number[]
}

export type StudioFold = { points: number[] }

export type StudioGuidePath = { points: number[]; closed?: boolean }

export type StudioKnife = {
  templateId: string
  minX: number
  minY: number
  widthMm: number
  heightMm: number
  faces: StudioFace[]
  folds: StudioFold[]
  /** Outer cut loops as flat [x,y,...] polylines (closed). */
  cutPaths: StudioGuidePath[]
  /** Bleed loops as flat [x,y,...] polylines (closed). */
  bleedPaths: StudioGuidePath[]
  /** Pacdora geom replay: face outlines should not re-stroke cut blue. */
  geomMode?: boolean
}

type EngineFace = { name: string; x: number; y: number; w: number; h: number; outline?: number[][] }
type EngineFold = { x1: number; y1: number; x2: number; y2: number }
type EngineSeg = { x1: number; y1: number; x2: number; y2: number }
type EngineKnife = {
  faces?: EngineFace[]
  folds?: EngineFold[]
  cutLoop?: number[][]
  cutExtraLoops?: number[][][]
  cuts?: EngineSeg[]
  bleedLoop?: number[][]
  bleeds?: EngineSeg[]
  /** LAB-style SVG subpaths from Pacdora geom (preferred over concatenating cuts). */
  cutPaths?: string[]
  bleedPaths?: string[]
  geomMode?: boolean
}

/** Parse pathFromCmds-style SVG (M/L/A/Q/C/Z) into flat polyline points for Konva. */
export function svgPathToGuide(d: string, arcSegs = 10): StudioGuidePath | null {
  const tokens = String(d || '')
    .replace(/,/g, ' ')
    .trim()
    .split(/[\s]+/)
    .filter(Boolean)
  if (!tokens.length) return null

  const points: number[] = []
  let i = 0
  let cx = 0
  let cy = 0
  let started = false
  let closed = false

  const push = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return
    const n = points.length
    if (n >= 2 && Math.hypot(points[n - 2] - x, points[n - 1] - y) < 1e-6) return
    points.push(x, y)
  }

  const readNum = () => {
    const v = Number(tokens[i++])
    return Number.isFinite(v) ? v : NaN
  }

  while (i < tokens.length) {
    const cmd = tokens[i++]
    if (!cmd) break
    const c = cmd.toUpperCase()
    if (c === 'M') {
      const x = readNum()
      const y = readNum()
      cx = x
      cy = y
      started = true
      push(cx, cy)
    } else if (c === 'L') {
      const x = readNum()
      const y = readNum()
      cx = x
      cy = y
      if (started) push(cx, cy)
    } else if (c === 'A') {
      const rx = Math.max(1e-6, readNum() || 0)
      readNum() // ry
      readNum() // ang
      readNum() // large-arc
      const sweep = readNum()
      const x2 = readNum()
      const y2 = readNum()
      const x1 = cx
      const y1 = cy
      const mx = (x1 + x2) / 2
      const my = (y1 + y2) / 2
      const dx = x2 - x1
      const dy = y2 - y1
      const len = Math.hypot(dx, dy) || 1
      const nx = -dy / len
      const ny = dx / len
      const bulge = Math.min(rx, rx) * (sweep ? 1 : -1) * 0.55
      for (let s = 1; s <= arcSegs; s++) {
        const t = s / arcSegs
        const px =
          (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * (mx + nx * bulge) + t * t * x2
        const py =
          (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * (my + ny * bulge) + t * t * y2
        push(px, py)
      }
      cx = x2
      cy = y2
    } else if (c === 'Q') {
      const qx = readNum()
      const qy = readNum()
      const x2 = readNum()
      const y2 = readNum()
      const x1 = cx
      const y1 = cy
      for (let s = 1; s <= arcSegs; s++) {
        const t = s / arcSegs
        push(
          (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * qx + t * t * x2,
          (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * qy + t * t * y2,
        )
      }
      cx = x2
      cy = y2
    } else if (c === 'C') {
      const cx1 = readNum()
      const cy1 = readNum()
      const cx2 = readNum()
      const cy2 = readNum()
      const x2 = readNum()
      const y2 = readNum()
      const x1 = cx
      const y1 = cy
      for (let s = 1; s <= arcSegs; s++) {
        const t = s / arcSegs
        const u = 1 - t
        push(
          u * u * u * x1 + 3 * u * u * t * cx1 + 3 * u * t * t * cx2 + t * t * t * x2,
          u * u * u * y1 + 3 * u * u * t * cy1 + 3 * u * t * t * cy2 + t * t * t * y2,
        )
      }
      cx = x2
      cy = y2
    } else if (c === 'Z') {
      closed = true
      if (points.length >= 4) {
        push(points[0], points[1])
      }
    } else if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(cmd)) {
      // Unexpected bare number — rewind and skip to avoid infinite loop
      i -= 1
      break
    }
  }

  if (points.length < 4) return null
  return { points, closed }
}

function guidePathsFromSvg(paths: string[] | undefined): StudioGuidePath[] {
  if (!Array.isArray(paths) || !paths.length) return []
  const out: StudioGuidePath[] = []
  for (const d of paths) {
    const g = svgPathToGuide(d)
    if (g) out.push(g)
  }
  return out
}

/** Fallback: each cut segment as its own path — never concatenate unrelated segs. */
function guidePathsFromSegments(segs: EngineSeg[] | undefined): StudioGuidePath[] {
  if (!Array.isArray(segs) || !segs.length) return []
  return segs
    .filter((s) => Number.isFinite(s.x1) && Number.isFinite(s.y1) && Number.isFinite(s.x2) && Number.isFinite(s.y2))
    .map((s) => ({ points: [s.x1, s.y1, s.x2, s.y2], closed: false }))
}

function facePoints(face: EngineFace): number[] {
  const loop =
    Array.isArray(face.outline) && face.outline.length >= 3
      ? face.outline
      : [
          [face.x, face.y],
          [face.x + face.w, face.y],
          [face.x + face.w, face.y + face.h],
          [face.x, face.y + face.h],
        ]
  const pts: number[] = []
  for (const p of loop) {
    pts.push(Number(p[0]), Number(p[1]))
  }
  return pts
}

function loopToPath(loop: number[][] | undefined): StudioGuidePath | null {
  if (!Array.isArray(loop) || loop.length < 3) return null
  const points: number[] = []
  for (const p of loop) {
    points.push(Number(p[0]), Number(p[1]))
  }
  if (points.length >= 4) {
    const firstX = points[0]
    const firstY = points[1]
    const lastX = points[points.length - 2]
    const lastY = points[points.length - 1]
    if (firstX !== lastX || firstY !== lastY) {
      points.push(firstX, firstY)
    }
  }
  return { points }
}

/** Resolve Pacdora shipping sourceNum from design document (templateId fixed-* or advanced.sourceNum). */
export function resolveShippingSourceNum(doc: DesignDocumentV1): string | null {
  const advanced = doc.geometry.params?.advanced || {}
  const fromAdvanced = advanced.sourceNum
  if (fromAdvanced != null && Number.isFinite(Number(fromAdvanced)) && Number(fromAdvanced) > 0) {
    // Keep integer form without scientific notation (e.g. 20001001)
    return String(Math.trunc(Number(fromAdvanced)))
  }
  const tid = String(doc.geometry.templateId || '')
  const m = /^fixed-(.+)$/i.exec(tid)
  if (m?.[1]) return m[1]
  return null
}

export function studioKnifeFromEngineKnife(knife: EngineKnife, templateId: string): StudioKnife {
  const facesRaw = knife.faces || []
  if (!facesRaw.length) {
    throw new Error('knife has no faces')
  }
  const minX = Math.min(...facesRaw.map((f) => f.x))
  const minY = Math.min(...facesRaw.map((f) => f.y))
  const maxX = Math.max(...facesRaw.map((f) => f.x + f.w))
  const maxY = Math.max(...facesRaw.map((f) => f.y + f.h))
  const faces: StudioFace[] = facesRaw.map((f) => ({
    name: f.name,
    x: f.x,
    y: f.y,
    w: f.w,
    h: f.h,
    points: facePoints(f),
  }))
  const folds: StudioFold[] = (knife.folds || []).map((fold) => ({
    points: [fold.x1, fold.y1, fold.x2, fold.y2],
  }))

  // Prefer LAB-style SVG subpaths (Pacdora geom). Never concatenate independent cut segs.
  let cutPaths = guidePathsFromSvg(knife.cutPaths)
  if (!cutPaths.length) {
    const mainCut = loopToPath(knife.cutLoop)
    if (mainCut) cutPaths.push(mainCut)
    for (const extra of knife.cutExtraLoops || []) {
      const path = loopToPath(extra)
      if (path) cutPaths.push(path)
    }
  }
  if (!cutPaths.length) {
    cutPaths = guidePathsFromSegments(knife.cuts)
  }

  let bleedPaths = guidePathsFromSvg(knife.bleedPaths)
  if (!bleedPaths.length) {
    const mainBleed = loopToPath(knife.bleedLoop)
    if (mainBleed) bleedPaths.push(mainBleed)
  }
  if (!bleedPaths.length) {
    bleedPaths = guidePathsFromSegments(knife.bleeds)
  }

  return {
    templateId,
    minX,
    minY,
    widthMm: maxX - minX,
    heightMm: maxY - minY,
    faces,
    folds,
    cutPaths,
    bleedPaths,
    geomMode: !!knife.geomMode,
  }
}

function createParametricEngineKnife(doc: DesignDocumentV1): EngineKnife {
  const p = doc.geometry.params
  return createKnife({
    templateId: doc.geometry.templateId,
    length: p.lengthMm,
    width: p.widthMm,
    height: p.heightMm,
    thickness: p.thicknessMm,
    bleed: p.bleedInputMm,
    sizeMode: p.sizeMode,
    fluteDirection: p.fluteDirection,
    materialId: p.materialId,
    params: p.advanced || {},
  }) as EngineKnife
}

/**
 * Sync knife build for parametric templates only.
 * Fixed shipping snapshots must use buildStudioKnifeAsync (Pacdora geom replay).
 */
export function buildStudioKnife(doc: DesignDocumentV1): StudioKnife {
  if (doc.geometry.mode === 'fixed_snapshot' && resolveShippingSourceNum(doc)) {
    throw new Error('fixed_snapshot shipping knife requires buildStudioKnifeAsync')
  }
  const knife = createParametricEngineKnife(doc)
  return studioKnifeFromEngineKnife(knife, doc.geometry.templateId)
}

/** Resolve studio knife: Pacdora geom for fixed shipping, else parametric createKnife. */
export async function buildStudioKnifeAsync(doc: DesignDocumentV1): Promise<StudioKnife> {
  const sourceNum = resolveShippingSourceNum(doc)
  if (doc.geometry.mode === 'fixed_snapshot' && sourceNum) {
    const p = doc.geometry.params
    const knife = (await loadPacdoraGeomKnife(sourceNum, {
      label: doc.geometry.templateId,
      length: p.lengthMm,
      width: p.widthMm,
      height: p.heightMm,
      thickness: p.thicknessMm,
      materialId: p.materialId,
    })) as EngineKnife
    return studioKnifeFromEngineKnife(knife, doc.geometry.templateId)
  }
  const knife = createParametricEngineKnife(doc)
  return studioKnifeFromEngineKnife(knife, doc.geometry.templateId)
}

/** Raw engine knife for 3D scene (same resolution rules as buildStudioKnifeAsync). */
export async function resolveEngineKnife(doc: DesignDocumentV1): Promise<EngineKnife> {
  const sourceNum = resolveShippingSourceNum(doc)
  if (doc.geometry.mode === 'fixed_snapshot' && sourceNum) {
    const p = doc.geometry.params
    return (await loadPacdoraGeomKnife(sourceNum, {
      label: doc.geometry.templateId,
      length: p.lengthMm,
      width: p.widthMm,
      height: p.heightMm,
      thickness: p.thicknessMm,
      materialId: p.materialId,
    })) as EngineKnife
  }
  return createParametricEngineKnife(doc)
}

/** 将 panel 局部 mm 转为刀版 sheet mm（相对 buildStudioKnife 的原点需再减 minX/minY） */
export function panelLocalToSheet(
  face: StudioFace,
  xMm: number,
  yMm: number,
): { x: number; y: number } {
  return { x: face.x + xMm, y: face.y + yMm }
}
