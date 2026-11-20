/**
 * Customizable templates at sizes other than the default: can they still be validated and
 * exported? Structure parameters stay at the workbench defaults (what a user gets who only
 * changes L / W / H).
 * Sizes per template (inner size, inside the range the workbench allows):
 *   min   every dimension at its lower limit        s080  0.8 × default
 *   max   every dimension at its upper limit        s125  1.25 × default
 * Size-interpolated templates use their verified range for the four above, plus fbmin / fbmax
 * at the limits of the parametric template they fall back to outside that range.
 * Checks: validate accepted and ok · no blocking issue · DXF and PDF export · DXF cut extent =
 * knife cut extent · PDF page fits 1:1 · no NaN. This says whether a resized box breaks; it does
 * NOT say the resized dieline is accurate (only the verified ranges were compared with the source).
 * Runs inside the geometry container:
 *   docker compose exec -T geometry node --input-type=module - < scripts/audit/batch-customizable-resize.mjs > result.json
 */
const SRC = process.env.BOXCRAFT_SRC || '/app/src'
const {PRESETS} = await import(`${SRC}/catalog/index.js`)
const {TEMPLATES} = await import(`${SRC}/templates/index.js`)
const {createKnife} = await import(`${SRC}/knife.js`)
const {PDFDocument} = await import('pdf-lib')
const BASE = process.env.GEOMETRY_URL || 'http://localhost:3100'
const post = async (p, b) => {
  const r = await fetch(BASE + p, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(b)})
  return {status: r.status, j: await r.json()}
}
const CORR = ['flute-e', 'flute-b', 'kraft']
const BOARD = ['kraft-250', 'kraft-350', 'art-250', 'art-350', 'white-board', 'kraft', 'white']
const ENGINE = {'flute-e': 'kraft', 'flute-b': 'kraft', 'kraft-250': 'kraft', 'kraft-350': 'kraft', 'art-250': 'white', 'art-350': 'white', 'white-board': 'white'}
const DIMS = ['length', 'width', 'height']

function advancedOf(p) {
  const out = {}
  for (const d of TEMPLATES[p.templateId]?.paramDefs || []) {
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
const usable = (r) => Array.isArray(r) && r.length === 2 && Number(r[1]) > Number(r[0]) && !(Number(r[0]) === 0 && Number(r[1]) >= 2000)
const r1 = (v) => Math.round(v * 10) / 10

/** Size variants inside `limits`; dimensions without a usable range keep the default. */
function variants(def, limits, tags) {
  const pick = (fn) => Object.fromEntries(DIMS.map((k) => [k, usable(limits?.[k]) ? r1(fn(k, limits[k])) : def[k]]))
  const clamp = (v, [lo, hi]) => Math.max(lo, Math.min(hi, v))
  const all = {
    min: pick((k, r) => r[0]),
    max: pick((k, r) => r[1]),
    s080: pick((k, r) => clamp(def[k] * 0.8, r)),
    s125: pick((k, r) => clamp(def[k] * 1.25, r)),
  }
  return tags.map((t) => [t, all[t]])
}

const targets = []
for (const p of PRESETS) {
  if (!p.templateId || !(p.fidelity === 'exact' || p.fidelity === 'close')) continue
  const t = TEMPLATES[p.templateId]
  if (!t) continue
  const corr = p.categoryId === 'shipping' || p.categoryId === 'mailer'
  const list = corr ? CORR : BOARD
  const materialId = p.materialId && list.includes(p.materialId) ? p.materialId : list[0]
  const def = {
    length: Number(p.length) || 100,
    width: Number(p.width) || 80,
    height: Number(p.height) || (Number(t.limits?.height?.[1]) === 0 ? 0 : 50),
  }
  const sized = []
  if (t.limits) sized.push(...variants(def, t.limits, ['min', 'max', 's080', 's125']))
  else if (t.verifiedRange) {
    sized.push(...variants(def, t.verifiedRange, ['min', 'max', 's080', 's125']))
    const fb = t.sampledFallback && TEMPLATES[t.sampledFallback]?.limits
    if (fb) sized.push(...variants(def, fb, ['min', 'max']).map(([tag, s]) => [`fb${tag}`, s]))
  }
  const pieces = (t.pieces || []).map((x) => x.id)
  for (const piece of pieces.length ? pieces : [null]) {
    for (const [tag, s] of sized) {
      if (DIMS.every((k) => s[k] === def[k])) continue // nothing to resize
      targets.push({
        id: p.id, cat: p.categoryId, piece, tag, kind: p.templateId.split('-')[0],
        body: {
          template_id: p.templateId, length_mm: s.length, width_mm: s.width, height_mm: s.height,
          thickness_mm: Number(p.thickness) || (corr ? 1.5 : 0.5), bleed_mm: 3, size_mode: 'inner', flute_direction: 'L',
          material_id: materialId, params: advancedOf(p), piece_id: piece,
        },
      })
    }
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
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, n = 0
  const add = (x, y) => {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
  }
  for (const e of ents) {
    if (e['8'] !== 'TRIM') continue
    if (e.t === 'VERTEX') { add(+e['10'], +e['20']); n++ }
    if (e.t === 'LINE') { add(+e['10'], +e['20']); add(+e['11'], +e['21']); n++ }
    if (e.t === 'ARC') {
      const cx = +e['10'], cy = +e['20'], r = +e['40'], a = +e['50']
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
  const b = t.body
  const row = {id: t.id, cat: t.cat, kind: t.kind, tpl: b.template_id, piece: t.piece, tag: t.tag, size: `${b.length_mm}x${b.width_mm}x${b.height_mm}`, issues: []}
  try {
    const v = await post('/validate', b)
    if (v.status !== 200) {
      row.issues.push(`validate ${v.j.code}: ${String(v.j.message).slice(0, 90)}`)
      rows.push(row)
      continue
    }
    const d = v.j.data
    if (!d.ok) row.issues.push('validation not ok')
    const blocking = (d.issues || []).filter((i) => i.severity === 'blocking').map((i) => i.code || i.message)
    if (blocking.length) row.issues.push('blocking: ' + [...new Set(blocking)].slice(0, 3).join(','))
    row.warn = [...new Set((d.issues || []).filter((i) => i.severity !== 'blocking').map((i) => i.code || ''))].filter(Boolean).slice(0, 4)
    if (d.cut_approx) row.approx = true
    let W = 0, H = 0
    try {
      const knife = createKnife({
        templateId: b.template_id, length: b.length_mm, width: b.width_mm, height: b.height_mm, thickness: b.thickness_mm, bleed: 3,
        sizeMode: 'inner', fluteDirection: 'L', materialId: ENGINE[b.material_id] || b.material_id, params: b.params, piece: t.piece || undefined, strict: true,
      })
      const segs = knife.layers?.trim?.segments || []
      const xs = segs.flatMap((s) => [s.x1, s.x2])
      const ys = segs.flatMap((s) => [s.y1, s.y2])
      W = Math.max(...xs) - Math.min(...xs)
      H = Math.max(...ys) - Math.min(...ys)
      row.sheet = `${W.toFixed(0)}x${H.toFixed(0)}`
      if (!(W > 0 && H > 0) || !Number.isFinite(W + H)) row.issues.push('empty or non-finite cut extent')
    } catch (err) {
      row.issues.push('local knife ' + String(err?.message || err).slice(0, 80))
    }
    for (const fmt of ['dxf', 'pdf']) {
      const e = await post('/export', {...b, format: fmt, quality_tier: 'vector_proof', options: {}})
      if (e.status !== 200) {
        row.issues.push(`${fmt} ${e.j.code}: ${String(e.j.message).slice(0, 60)}`)
        continue
      }
      const buf = Buffer.from(e.j.data.content_base64, 'base64')
      if (fmt === 'dxf') {
        const s = buf.toString()
        if (/NaN|undefined|Infinity/.test(s)) row.issues.push('dxf has NaN')
        const ext = dxfTrimExtent(s)
        if (!ext) row.issues.push('dxf has no cut entities')
        else if (W > 0 && (Math.abs(ext.w - W) > 1 || Math.abs(ext.h - H) > 1)) row.issues.push(`dxf extent ${ext.w.toFixed(1)}x${ext.h.toFixed(1)} vs ${W.toFixed(1)}x${H.toFixed(1)}`)
      } else {
        const pg = (await PDFDocument.load(buf)).getPage(0)
        const k = 25.4 / 72
        if (W > 0 && (pg.getWidth() * k < W || pg.getHeight() * k < H)) row.issues.push('pdf page smaller than 1:1')
      }
    }
  } catch (err) {
    row.issues.push('exception ' + String(err?.message || err).slice(0, 100))
  }
  rows.push(row)
  if (++done % 200 === 0) console.error(`${done}/${targets.length}`)
}
console.log(JSON.stringify({targets: targets.length, presets: new Set(targets.map((t) => t.id)).size, rows}))
