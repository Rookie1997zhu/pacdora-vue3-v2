/**
 * Batch-test export of every customizable (parametric) template through the running geometry
 * service, with the payload the backend sends. Does not use export quota.
 * Runs inside the geometry container (it needs the service on localhost:3100 and the repo's src/):
 *   docker compose exec -T geometry node --input-type=module - < scripts/audit/batch-customizable-export.mjs > result.json
 * Checks per template (and per piece of multi-piece templates):
 *   validate ok · SVG / DXF / PDF / AI export · DXF cut extent = knife cut extent (arcs by swept
 *   angle) · PDF / AI page fits the dieline at 1:1 and has the five layers · no NaN in text formats
 */
const SRC = process.env.BOXCRAFT_SRC || '/app/src'
const {PRESETS} = await import(`${SRC}/catalog/index.js`)
const {TEMPLATES} = await import(`${SRC}/templates/index.js`)
const {createKnife} = await import(`${SRC}/knife.js`)
const {PDFDocument, PDFName} = await import('pdf-lib')
const BASE = process.env.GEOMETRY_URL || 'http://localhost:3100'
const post = async (p, b) => {
  const r = await fetch(BASE + p, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(b)})
  return {status: r.status, j: await r.json()}
}
const CORR = ['flute-e', 'flute-b', 'kraft']
const BOARD = ['kraft-250', 'kraft-350', 'art-250', 'art-350', 'white-board', 'kraft', 'white']
const ENGINE = {'flute-e': 'kraft', 'flute-b': 'kraft', 'kraft-250': 'kraft', 'kraft-350': 'kraft', 'art-250': 'white', 'art-350': 'white', 'white-board': 'white'}

// Same defaults as the workbench (src/features/workbench/manifest.ts, manifestFromImportPreset)
function advancedOf(p) {
  const out = {}
  const defs = TEMPLATES[p.templateId]?.paramDefs || []
  for (const d of defs) {
    const row = d.code ? p.openParams?.[d.code] : undefined
    if (!d.code || !Array.isArray(row)) continue
    let v = Number(row[0])
    if (!Number.isFinite(v)) continue
    if (typeof d.min === 'number' && Number.isFinite(d.min)) v = Math.max(d.min, v)
    if (typeof d.max === 'number' && Number.isFinite(d.max)) v = Math.min(d.max, v)
    out[d.code] = v
  }
  return out
}

const targets = []
for (const p of PRESETS) {
  if (!p.templateId || !(p.fidelity === 'exact' || p.fidelity === 'close')) continue
  const corr = p.categoryId === 'shipping' || p.categoryId === 'mailer'
  const list = corr ? CORR : BOARD
  const materialId = p.materialId && list.includes(p.materialId) ? p.materialId : list[0]
  const pieces = (TEMPLATES[p.templateId]?.pieces || []).map((x) => x.id)
  for (const piece of pieces.length ? pieces : [null]) {
    targets.push({
      id: p.id,
      cat: p.categoryId,
      fidelity: p.fidelity,
      piece,
      registered: !!TEMPLATES[p.templateId],
      body: {
        template_id: p.templateId,
        length_mm: Number(p.length) || 100,
        width_mm: Number(p.width) || 80,
        height_mm: Number(p.height) || (Number(TEMPLATES[p.templateId]?.limits?.height?.[1]) === 0 ? 0 : 50),
        thickness_mm: Number(p.thickness) || (corr ? 1.5 : 0.5),
        bleed_mm: 3,
        size_mode: 'inner',
        flute_direction: 'L',
        material_id: materialId,
        params: advancedOf(p),
        piece_id: piece,
      },
    })
  }
}

function dxfTrimExtent(text) {
  const L = text.split(/\r?\n/)
  let cur = null
  const ents = []
  for (let i = 0; i < L.length - 1; i += 2) {
    const c = L[i].trim()
    const v = L[i + 1].trim()
    if (c === '0') {
      cur = {t: v}
      ents.push(cur)
    } else if (cur) cur[c] = v
  }
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  let n = 0
  const add = (x, y) => {
    x0 = Math.min(x0, x)
    x1 = Math.max(x1, x)
    y0 = Math.min(y0, y)
    y1 = Math.max(y1, y)
  }
  for (const e of ents) {
    if (e['8'] !== 'TRIM') continue
    if (e.t === 'VERTEX') {
      add(+e['10'], +e['20'])
      n++
    }
    if (e.t === 'LINE') {
      add(+e['10'], +e['20'])
      add(+e['11'], +e['21'])
      n++
    }
    if (e.t === 'ARC') {
      const cx = +e['10']
      const cy = +e['20']
      const r = +e['40']
      const a = +e['50']
      let b = +e['51']
      if (b < a) b += 360
      for (let t = a; ; t = Math.min(t + 1, b)) {
        add(cx + r * Math.cos((t * Math.PI) / 180), cy + r * Math.sin((t * Math.PI) / 180))
        if (t >= b) break
      }
      n++
    }
  }
  return n ? {w: x1 - x0, h: y1 - y0} : null
}

const rows = []
let done = 0
for (const t of targets) {
  const row = {id: t.id, cat: t.cat, tpl: t.body.template_id, piece: t.piece, fidelity: t.fidelity, issues: []}
  try {
    const v = await post('/validate', t.body)
    if (v.status !== 200) {
      row.issues.push(`validate ${v.j.code}: ${String(v.j.message).slice(0, 80)}`)
      rows.push(row)
      continue
    }
    const d = v.j.data
    if (!d.ok) row.issues.push('validation not ok')
    if (!(d.face_count > 0)) row.issues.push('no faces')
    row.cutApprox = !!d.cut_approx
    row.blocking = (d.issues || []).filter((i) => i.severity === 'blocking').map((i) => i.code || i.message).slice(0, 3)
    if (row.blocking.length) row.issues.push('blocking: ' + row.blocking.join(','))
    // Reference extent from the same engine call the service makes
    const knife = createKnife({
      templateId: t.body.template_id,
      length: t.body.length_mm,
      width: t.body.width_mm,
      height: t.body.height_mm,
      thickness: t.body.thickness_mm,
      bleed: 3,
      sizeMode: 'inner',
      fluteDirection: 'L',
      materialId: ENGINE[t.body.material_id] || t.body.material_id,
      params: t.body.params,
      piece: t.piece || undefined,
      strict: true,
    })
    const segs = knife.layers?.trim?.segments || []
    const xs = segs.flatMap((s) => [s.x1, s.x2])
    const ys = segs.flatMap((s) => [s.y1, s.y2])
    const W = Math.max(...xs) - Math.min(...xs)
    const H = Math.max(...ys) - Math.min(...ys)
    row.size = `${W.toFixed(1)}x${H.toFixed(1)}`
    if (!(W > 0 && H > 0)) row.issues.push('empty cut extent')
    for (const fmt of ['svg', 'dxf', 'pdf', 'ai']) {
      const e = await post('/export', {...t.body, format: fmt, quality_tier: 'vector_proof', options: {}})
      if (e.status !== 200) {
        row.issues.push(`${fmt} ${e.j.code}: ${String(e.j.message).slice(0, 60)}`)
        continue
      }
      const buf = Buffer.from(e.j.data.content_base64, 'base64')
      if (fmt === 'svg') {
        const s = buf.toString()
        if (/NaN|undefined|Infinity/.test(s) || !/viewBox=/.test(s)) row.issues.push('svg has NaN / no viewBox')
      }
      if (fmt === 'dxf') {
        const s = buf.toString()
        if (/NaN|undefined|Infinity/.test(s)) row.issues.push('dxf has NaN')
        const ext = dxfTrimExtent(s)
        if (!ext) row.issues.push('dxf has no cut entities')
        else if (Math.abs(ext.w - W) > 1 || Math.abs(ext.h - H) > 1) row.issues.push(`dxf extent ${ext.w.toFixed(1)}x${ext.h.toFixed(1)} vs ${row.size}`)
      }
      if (fmt === 'pdf' || fmt === 'ai') {
        const doc = await PDFDocument.load(buf)
        const pg = doc.getPage(0)
        const k = 25.4 / 72
        const ocp = doc.catalog.lookup(PDFName.of('OCProperties'))
        const n = ocp ? ocp.lookup(PDFName.of('OCGs')).asArray().length : 0
        if (n !== 5) row.issues.push(`${fmt} layers ${n}`)
        if (pg.getWidth() * k < W || pg.getHeight() * k < H) row.issues.push(`${fmt} page smaller than 1:1`)
      }
    }
  } catch (err) {
    row.issues.push('exception ' + String(err?.message || err).slice(0, 100))
  }
  rows.push(row)
  if (++done % 100 === 0) console.error(`${done}/${targets.length}`)
}
console.log(JSON.stringify({targets: targets.length, presets: new Set(targets.map((t) => t.id)).size, rows}))
