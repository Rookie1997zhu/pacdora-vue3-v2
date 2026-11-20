/**
 * Sample export with artwork on both print sides, for looking at the result (render the PDF with
 * poppler: `pdftoppm -r 80 -png inside-test.pdf page`).
 *   node scripts/audit/sample-inside-artwork.mjs <outDir>
 * The outside carries a line of text near the left edge of the biggest panel; the inside carries an
 * arrow-like bar and text near the left edge of the same panel plus a layer on a side panel. On the
 * inside page the panel sits at its mirrored position and the layers keep their left offset.
 */
import fs from 'node:fs'
import path from 'node:path'
import {createKnife} from '../../src/knife.js'
import {toPdf, toAi, toSvgDieline} from '../../src/exportDieline.js'
import {outlineText} from '../../services/geometry/textOutline.mjs'

const out = process.argv[2] || '.'
const k = createKnife({templateId: 'rea-mailer-0427', length: 200, width: 150, height: 60, thickness: 1.5, bleed: 3, sizeMode: 'inner'})
const faces = [...k.faces].sort((a, b) => b.w * b.h - a.w * a.h)
const main = faces[0]
// a panel clearly left of the main one on the outside view
const side = k.faces.filter((f) => f.x + f.w <= main.x + 1 && f.h > 40).sort((a, b) => a.x - b.x)[0] || faces[1]
const base = {coordinateSpace: 'panel_mm', visible: true, locked: false, opacity: 1, clip: 'panel', resizePolicy: 'keep_mm'}
const tf = (x, y, r = 0) => ({xMm: x, yMm: y, rotationDeg: r, scaleX: 1, scaleY: 1})
const text = (content, size, fill) => ({content, fontFamily: 'sans-serif', fontSizeMm: size, fill, align: 'left'})
const artwork = {backgroundColor: null, layers: [
  {...base, id: 'o1', kind: 'text', name: 'outside text', side: 'outside', panelId: main.name, text: text('OUTSIDE 外面 →', 10, '#0f6e68'), transform: tf(8, 10), widthMm: 150, heightMm: 14, zIndex: 1},
  {...base, id: 'i1', kind: 'shape', name: 'inside bar', side: 'inside', panelId: main.name, shape: {shapeType: 'rect', fill: '#c2410c', stroke: '', strokeWidthMm: 0}, transform: tf(8, 40), widthMm: 60, heightMm: 6, zIndex: 2},
  {...base, id: 'i2', kind: 'text', name: 'inside text', side: 'inside', panelId: main.name, text: text('INSIDE 内面 안쪽 →', 10, '#c2410c'), transform: tf(8, 52), widthMm: 150, heightMm: 14, zIndex: 3},
  {...base, id: 'i3', kind: 'shape', name: 'inside dot', side: 'inside', panelId: side.name, shape: {shapeType: 'ellipse', fill: '#7c3aed', stroke: '', strokeWidthMm: 0}, transform: tf(5, 20), widthMm: 20, heightMm: 20, zIndex: 4},
]}
const warnings = []
fs.writeFileSync(path.join(out, 'inside-test.pdf'), await toPdf(k, {artwork, artworkImages: {}, artworkWarnings: warnings, outlineText}))
fs.writeFileSync(path.join(out, 'inside-test.ai'), await toAi(k, {artwork, artworkImages: {}, artworkWarnings: [], outlineText}))
fs.writeFileSync(path.join(out, 'inside-test.svg'), toSvgDieline(k, {artwork, artworkImages: {}, artworkWarnings: []}))
console.log(`main panel ${main.name} at x=${main.x}, side panel ${side.name} at x=${side.x}`)
console.log([...new Set(warnings)].join('\n'))
