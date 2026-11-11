import {createKnife} from '../src/knife.js'
import {buildNetRegistration} from '../src/studio/netMasks.mjs'

function toStudioKnife(knife, templateId) {
  const facesRaw = knife.faces || []
  const minX = Math.min(...facesRaw.map((f) => f.x))
  const minY = Math.min(...facesRaw.map((f) => f.y))
  const maxX = Math.max(...facesRaw.map((f) => f.x + f.w))
  const maxY = Math.max(...facesRaw.map((f) => f.y + f.h))
  const faces = facesRaw.map((f) => {
    const outline =
      Array.isArray(f.outline) && f.outline.length >= 3
        ? f.outline
        : [
            [f.x, f.y],
            [f.x + f.w, f.y],
            [f.x + f.w, f.y + f.h],
            [f.x, f.y + f.h],
          ]
    const points = []
    for (const p of outline) points.push(Number(p[0]), Number(p[1]))
    return {name: f.name, x: f.x, y: f.y, w: f.w, h: f.h, points}
  })
  const cutPaths = []
  if (Array.isArray(knife.cutLoop) && knife.cutLoop.length >= 3) {
    const points = []
    for (const p of knife.cutLoop) points.push(Number(p[0]), Number(p[1]))
    cutPaths.push({points})
  }
  return {
    templateId,
    minX,
    minY,
    widthMm: maxX - minX,
    heightMm: maxY - minY,
    faces,
    folds: [],
    cutPaths,
    bleedPaths: [],
  }
}

const templateId = 'mailer-parametric-demo'
const knife = createKnife({
  templateId,
  length: 300,
  width: 200,
  height: 50,
  thickness: 1.5,
  bleed: 3,
  sizeMode: 'inner',
})
const studio = toStudioKnife(knife, templateId)
const hash = `${templateId}:300x200x50`
const a = buildNetRegistration(studio, hash)
const b = buildNetRegistration(studio, hash)

if (!a.printableMask.length) throw new Error('printableMask empty')
if (!a.mainMask.length) throw new Error('mainMask empty')
if (!a.totalMask.length) throw new Error('totalMask empty')
if (!a.maskHash) throw new Error('maskHash missing')
if (a.maskHash !== b.maskHash) throw new Error('maskHash unstable')
if (a.geometryHash !== hash) throw new Error('geometryHash mismatch')
if (a.polarity !== 'white_printable') throw new Error('polarity wrong')
if (a.pxPerMm !== 4 || a.maxEdgePx !== 1024) throw new Error('scale constants wrong')

console.log(
  `ok net-masks ${templateId} printable=${a.printableMask.length} total=${a.totalMask.length} main=${a.mainMask.length} hash=${a.maskHash}`,
)
console.log('check-net-masks: all passed')
