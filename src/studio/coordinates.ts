/** mm（刀版坐标系，y 向下）↔ Konva stage 像素 */

export type Viewport = {
  pxPerMm: number
  offsetX: number
  offsetY: number
}

export function fitViewport(
  sheetWidthMm: number,
  sheetHeightMm: number,
  viewWidthPx: number,
  viewHeightPx: number,
  paddingPx = 24,
): Viewport {
  const availW = Math.max(1, viewWidthPx - paddingPx * 2)
  const availH = Math.max(1, viewHeightPx - paddingPx * 2)
  const pxPerMm = Math.min(availW / Math.max(sheetWidthMm, 1), availH / Math.max(sheetHeightMm, 1))
  const contentW = sheetWidthMm * pxPerMm
  const contentH = sheetHeightMm * pxPerMm
  return {
    pxPerMm,
    offsetX: (viewWidthPx - contentW) / 2,
    offsetY: (viewHeightPx - contentH) / 2,
  }
}

export function mmToStage(xMm: number, yMm: number, vp: Viewport) {
  return {
    x: vp.offsetX + xMm * vp.pxPerMm,
    y: vp.offsetY + yMm * vp.pxPerMm,
  }
}

export function stageToMm(xPx: number, yPx: number, vp: Viewport) {
  return {
    xMm: (xPx - vp.offsetX) / vp.pxPerMm,
    yMm: (yPx - vp.offsetY) / vp.pxPerMm,
  }
}

export function mmSizeToPx(mm: number, vp: Viewport) {
  return mm * vp.pxPerMm
}
