/**
 * Multi-layer boxes (face paper + greyboard + inner box … laid out side by side on one sheet):
 * does artwork placed on a panel land on that panel in the exported file?
 * For every multi-layer catalogue product a small marker is put at the centre of each face and the
 * box is exported through the running geometry service (SVG + PDF), then checked:
 *   · face names are unique (artwork is bound to a panel by name)
 *   · each marker is drawn where the panel is (translate = panel origin + offset)
 *   · the marker centre lies inside that panel's outline, and inside the cut extent
 *   · SVG has the ARTWORK group under the cut line, PDF has the ARTWORK layer
 * Runs inside the geometry container:
 *   docker compose exec -T geometry node --input-type=module - < scripts/audit/batch-multilayer-artwork.mjs > result.json
 */
import {readFileSync, existsSync} from 'node:fs'

const SRC = process.env.BOXCRAFT_SRC || '/app/src'
const PUB = process.env.BOXCRAFT_PUBLIC || '/app/public'
const {PRESETS} = await import(`${SRC}/catalog/index.js`)
const {knifeFromPacdoraGeom} = await import(`${SRC}/pacdoraGeomKnife.js`)
const {PDFDocument, PDFName} = await import('pdf-lib')
const BASE = process.env.GEOMETRY_URL || 'http://localhost:3100'
const post = async (p, b) => {
  const r = await fetch(BASE + p, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(b)})
  return {status: r.status, j: await r.json()}
}

function inside(pt, loop) {
  let c = false
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const [xi, yi] = loop[i]
    const [xj, yj] = loop[j]
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}
const outlineOf = (f) =>
  Array.isArray(f.outline) && f.outline.length >= 3
    ? f.outline.map((p) => [Number(p[0]), Number(p[1])])
    : [[f.x, f.y], [f.x + f.w, f.y], [f.x + f.w, f.y + f.h], [f.x, f.y + f.h]]
/** A point safely inside the outline: the bbox centre if it is inside, else the centroid of a fan triangle. */
function interiorPoint(f) {
  const loop = outlineOf(f)
  const c = [f.x + f.w / 2, f.y + f.h / 2]
  if (inside(c, loop)) return c
  for (let i = 1; i < loop.length - 1; i++) {
    const p = [(loop[0][0] + loop[i][0] + loop[i + 1][0]) / 3, (loop[0][1] + loop[i][1] + loop[i + 1][1]) / 3]
    if (inside(p, loop)) return p
  }
  return null
}

const rows = []
for (const p of PRESETS) {
  if (!['gift', 'square', 'mailer', 'shipping'].includes(p.categoryId) || !p.hasGeometry) continue
  const rel = p.geomPublicRel || p.geomRel
  const file = `${PUB}/${rel}`
  if (!rel || !existsSync(file)) continue
  const raw = JSON.parse(readFileSync(file, 'utf8'))
  const layerKeys = Object.keys(raw.layer || {})
  if (layerKeys.length < 2) continue
  const row = {id: p.id, layers: layerKeys.length, issues: []}
  try {
    const dims = {length: Number(p.length) || 100, width: Number(p.width) || 80, height: Number(p.height) || 0, thickness: Number(p.thickness) || 0.5}
    const knife = knifeFromPacdoraGeom(raw, {sourceNum: p.sourceNum, label: 'x', ...dims})
    const faces = knife.faces || []
    row.faces = faces.length
    row.pieces = (knife.sheetPieces || []).length
    const names = faces.map((f) => f.name)
    const dup = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))]
    if (dup.length) row.issues.push(`duplicate face names: ${dup.slice(0, 5).join(',')}${dup.length > 5 ? '…' : ''} (${dup.length})`)
    const segs = knife.layers?.trim?.segments || []
    const xs = segs.flatMap((s) => [s.x1, s.x2])
    const ys = segs.flatMap((s) => [s.y1, s.y2])
    const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
    // One marker per uniquely named face
    const M = 4
    const marks = []
    for (const f of faces) {
      if (dup.includes(f.name)) continue
      const c = interiorPoint(f)
      if (!c) {
        row.issues.push(`face ${f.name}: no interior point (degenerate outline)`)
        continue
      }
      marks.push({f, c})
    }
    row.marked = marks.length
    const artwork = {
      backgroundColor: null,
      layers: marks.map(({f, c}, i) => ({
        id: `m${i}`, kind: 'shape', name: `mark-${f.name}`, coordinateSpace: 'panel_mm', panelId: f.name, side: 'outside',
        transform: {xMm: c[0] - f.x - M / 2, yMm: c[1] - f.y - M / 2, rotationDeg: 0, scaleX: 1, scaleY: 1},
        widthMm: M, heightMm: M, visible: true, locked: false, opacity: 1, zIndex: i + 1, clip: 'panel', resizePolicy: 'keep_mm',
        shape: {shapeType: 'rect', fill: '#ff00aa', stroke: '', strokeWidthMm: 0},
      })),
    }
    const cat = p.categoryId
    const body = {
      template_id: cat === 'shipping' ? `fixed-${p.sourceNum}` : `fixed-${cat}-${p.sourceNum}`,
      length_mm: dims.length, width_mm: dims.width, height_mm: dims.height, thickness_mm: dims.thickness,
      bleed_mm: 3, size_mode: 'inner', flute_direction: 'L', material_id: 'white', params: {}, piece_id: null,
      quality_tier: 'vector_proof', options: {}, artwork, artwork_images: {},
    }
    const svgRes = await post('/export', {...body, format: 'svg'})
    if (svgRes.status !== 200) row.issues.push(`svg ${svgRes.j.code}: ${String(svgRes.j.message).slice(0, 60)}`)
    else {
      const svg = Buffer.from(svgRes.j.data.content_base64, 'base64').toString()
      if (!svgRes.j.data.preflight?.artwork_included) row.issues.push('svg: artwork_included is false')
      const warns = svgRes.j.data.preflight?.artwork_warnings || []
      if (warns.length) row.issues.push(`svg warnings: ${warns.slice(0, 2).join(' | ')}`)
      if (svg.indexOf('<g id="ARTWORK">') < 0 || svg.indexOf('<g id="ARTWORK">') > svg.indexOf('stroke="#2028b0"')) row.issues.push('svg: ARTWORK group missing or above the cut line')
      const got = new Map()
      for (const m of svg.matchAll(/<g transform="translate\(([-\d.e]+) ([-\d.e]+)\)"[^>]*data-layer="mark-([^"]+)"/g)) got.set(m[3], [Number(m[1]), Number(m[2])])
      let off = 0, outside = 0, missing = 0, beyond = 0
      for (const {f, c} of marks) {
        const g = got.get(f.name)
        if (!g) { missing++; continue }
        if (Math.abs(g[0] - (c[0] - M / 2)) > 0.01 || Math.abs(g[1] - (c[1] - M / 2)) > 0.01) off++
        const centre = [g[0] + M / 2, g[1] + M / 2]
        if (!inside(centre, outlineOf(f))) outside++
        if (centre[0] < box[0] - 0.5 || centre[0] > box[2] + 0.5 || centre[1] < box[1] - 0.5 || centre[1] > box[3] + 0.5) beyond++
      }
      if (missing) row.issues.push(`svg: ${missing} markers not drawn`)
      if (off) row.issues.push(`svg: ${off} markers not at panel origin + offset`)
      if (outside) row.issues.push(`svg: ${outside} markers outside their panel outline`)
      if (beyond) row.issues.push(`svg: ${beyond} markers outside the cut extent`)
    }
    const pdfRes = await post('/export', {...body, format: 'pdf'})
    if (pdfRes.status !== 200) row.issues.push(`pdf ${pdfRes.j.code}: ${String(pdfRes.j.message).slice(0, 60)}`)
    else {
      const doc = await PDFDocument.load(Buffer.from(pdfRes.j.data.content_base64, 'base64'))
      const ocp = doc.catalog.lookup(PDFName.of('OCProperties'))
      const namesPdf = ocp ? ocp.lookup(PDFName.of('OCGs')).asArray().map((r) => doc.context.lookup(r).lookup(PDFName.of('Name')).decodeText()) : []
      if (namesPdf[0] !== 'ARTWORK' || namesPdf.length !== 6) row.issues.push(`pdf layers: ${namesPdf.join(',')}`)
    }
  } catch (err) {
    row.issues.push('exception ' + String(err?.message || err).slice(0, 100))
  }
  rows.push(row)
}
console.log(JSON.stringify({products: rows.length, rows}))
