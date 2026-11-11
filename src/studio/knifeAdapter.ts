// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — existing JS knife engine
import { createKnife } from '../knife.js'
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

function facePoints(face: { x: number; y: number; w: number; h: number; outline?: number[][] }): number[] {
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

export function buildStudioKnife(doc: DesignDocumentV1): StudioKnife {
  const p = doc.geometry.params
  const knife = createKnife({
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
  })
  const facesRaw = knife.faces || []
  const minX = Math.min(...facesRaw.map((f: { x: number }) => f.x))
  const minY = Math.min(...facesRaw.map((f: { y: number }) => f.y))
  const maxX = Math.max(...facesRaw.map((f: { x: number; w: number }) => f.x + f.w))
  const maxY = Math.max(...facesRaw.map((f: { y: number; h: number }) => f.y + f.h))
  const faces: StudioFace[] = facesRaw.map(
    (f: { name: string; x: number; y: number; w: number; h: number; outline?: number[][] }) => ({
      name: f.name,
      x: f.x,
      y: f.y,
      w: f.w,
      h: f.h,
      points: facePoints(f),
    }),
  )
  const folds: StudioFold[] = (knife.folds || []).map(
    (fold: { x1: number; y1: number; x2: number; y2: number }) => ({
      points: [fold.x1, fold.y1, fold.x2, fold.y2],
    }),
  )

  function loopToPath(loop: number[][] | undefined): StudioGuidePath | null {
    if (!Array.isArray(loop) || loop.length < 3) return null
    const points: number[] = []
    for (const p of loop) {
      points.push(Number(p[0]), Number(p[1]))
    }
    // close ring for Konva closed line
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

  const cutPaths: StudioGuidePath[] = []
  const mainCut = loopToPath(knife.cutLoop)
  if (mainCut) cutPaths.push(mainCut)
  for (const extra of knife.cutExtraLoops || []) {
    const path = loopToPath(extra)
    if (path) cutPaths.push(path)
  }
  // fallback: segment edges if no loop
  if (!cutPaths.length && Array.isArray(knife.cuts) && knife.cuts.length) {
    const pts: number[] = []
    for (const seg of knife.cuts as { x1: number; y1: number; x2: number; y2: number }[]) {
      pts.push(seg.x1, seg.y1, seg.x2, seg.y2)
    }
    if (pts.length >= 4) cutPaths.push({ points: pts })
  }

  const bleedPaths: StudioGuidePath[] = []
  const mainBleed = loopToPath(knife.bleedLoop)
  if (mainBleed) bleedPaths.push(mainBleed)
  if (!bleedPaths.length && Array.isArray(knife.bleeds) && knife.bleeds.length) {
    const pts: number[] = []
    for (const seg of knife.bleeds as { x1: number; y1: number; x2: number; y2: number }[]) {
      pts.push(seg.x1, seg.y1, seg.x2, seg.y2)
    }
    if (pts.length >= 4) bleedPaths.push({ points: pts })
  }

  return {
    templateId: doc.geometry.templateId,
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

/** 将 panel 局部 mm 转为刀版 sheet mm（相对 buildStudioKnife 的原点需再减 minX/minY） */
export function panelLocalToSheet(
  face: StudioFace,
  xMm: number,
  yMm: number,
): { x: number; y: number } {
  return { x: face.x + xMm, y: face.y + yMm }
}
