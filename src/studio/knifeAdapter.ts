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

export type StudioGuidePath = { points: number[] }

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

  const cutPaths: StudioGuidePath[] = []
  const mainCut = loopToPath(knife.cutLoop)
  if (mainCut) cutPaths.push(mainCut)
  for (const extra of knife.cutExtraLoops || []) {
    const path = loopToPath(extra)
    if (path) cutPaths.push(path)
  }
  if (!cutPaths.length && Array.isArray(knife.cuts) && knife.cuts.length) {
    const pts: number[] = []
    for (const seg of knife.cuts) {
      pts.push(seg.x1, seg.y1, seg.x2, seg.y2)
    }
    if (pts.length >= 4) cutPaths.push({ points: pts })
  }

  const bleedPaths: StudioGuidePath[] = []
  const mainBleed = loopToPath(knife.bleedLoop)
  if (mainBleed) bleedPaths.push(mainBleed)
  if (!bleedPaths.length && Array.isArray(knife.bleeds) && knife.bleeds.length) {
    const pts: number[] = []
    for (const seg of knife.bleeds) {
      pts.push(seg.x1, seg.y1, seg.x2, seg.y2)
    }
    if (pts.length >= 4) bleedPaths.push({ points: pts })
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
