import assert from 'node:assert/strict'
import { annotateLayerAdapt, migrateLayers } from '../src/studio/artworkResize.mjs'

function face(name, x, y, w, h) {
  return {
    name,
    x,
    y,
    w,
    h,
    points: [x, y, x + w, y, x + w, y + h, x, y + h],
  }
}

function layer(partial) {
  return {
    id: 'l1',
    kind: 'shape',
    name: 'rect',
    coordinateSpace: 'panel_mm',
    panelId: 'front',
    pieceId: null,
    side: 'outside',
    transform: { xMm: 10, yMm: 20, rotationDeg: 0, scaleX: 1, scaleY: 1 },
    widthMm: 40,
    heightMm: 30,
    visible: true,
    locked: false,
    opacity: 1,
    zIndex: 1,
    clip: 'panel',
    assetId: null,
    text: null,
    shape: { shapeType: 'rect', fill: '#0f6e68', stroke: '#000', strokeWidthMm: 1 },
    crop: null,
    resizePolicy: 'keep_mm',
    anchor: null,
    ...partial,
  }
}

const oldKnife = {
  templateId: 't',
  minX: 0,
  minY: 0,
  widthMm: 300,
  heightMm: 200,
  faces: [face('front', 0, 0, 100, 50)],
  folds: [],
}
const newKnife = {
  ...oldKnife,
  faces: [face('front', 0, 0, 200, 100)],
}

{
  const [out] = migrateLayers([layer({ resizePolicy: 'keep_mm' })], oldKnife, newKnife)
  assert.equal(out.transform.xMm, 10)
  assert.equal(out.widthMm, 40)
}

{
  const [out] = migrateLayers([layer({ resizePolicy: 'scale_with_panel' })], oldKnife, newKnife)
  assert.equal(out.transform.xMm, 20)
  assert.equal(out.transform.yMm, 40)
  assert.equal(out.widthMm, 80)
  assert.equal(out.heightMm, 60)
  assert.equal(out.shape.strokeWidthMm, 2)
}

{
  const [out] = migrateLayers(
    [layer({ resizePolicy: 'anchor', anchor: { x: 0.5, y: 0.5 } })],
    oldKnife,
    newKnife,
  )
  assert.equal(out.widthMm, 40)
  assert.equal(out.heightMm, 30)
  assert.equal(out.transform.xMm, 40)
  assert.equal(out.transform.yMm, 55)
}

{
  const missingPanelKnife = {
    ...newKnife,
    faces: [face('side', 0, 0, 80, 40)],
  }
  const [out] = migrateLayers(
    [layer({ panelId: 'front', sourceGeometryHash: 'old' })],
    oldKnife,
    missingPanelKnife,
    'new-hash',
  )
  assert.equal(out.adaptStatus, 'needs_rebind')
  assert.equal(out.panelId, 'front')
}

{
  const [out] = migrateLayers(
    [
      layer({
        kind: 'image',
        resizePolicy: 'keep_mm',
        sourceGeometryHash: 'old-hash',
        assetId: 'a1',
        shape: null,
      }),
    ],
    oldKnife,
    newKnife,
    'new-hash',
  )
  assert.equal(out.adaptStatus, 'needs_adapt')
}

{
  const [out] = annotateLayerAdapt(
    [layer({ panelId: 'gone', sourceGeometryHash: 'h' })],
    newKnife,
    'h2',
  )
  assert.equal(out.adaptStatus, 'needs_rebind')
}

console.log('check-artwork-resize: ok')
