/**
 * Finds customizable templates whose dieline falls apart when resized: the cut outline stops being
 * closed (segment ends that touch nothing) although validation still says ok.
 * For every customizable preset: default size (reference) and scales 0.7 … 1.4 of all three
 * dimensions, inside the allowed range. "Definite": the sheet size or the total cut length is far
 * from what the scale implies, or the number of panels changes. "Suspect": only the count of open
 * cut ends grows - that also happens when the outline legitimately changes shape.
 * Usage: node scripts/audit/scan-resize-broken-outline.mjs [out.json]
 */
import {writeFileSync} from 'node:fs'
import {createKnife} from '../../src/knife.js'
import {PRESETS} from '../../src/catalog/index.js'
import {TEMPLATES} from '../../src/templates/index.js'

const DIMS = ['length', 'width', 'height']
const SCALES = [0.7, 0.8, 0.9, 1.1, 1.25, 1.4]
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

/** Cut-segment ends that meet no other cut segment (0.05 mm grid). A closed outline has none. */
function openEnds(knife) {
  const deg = new Map()
  const key = (x, y) => `${Math.round(x * 20)},${Math.round(y * 20)}`
  let n = 0
  for (const s of knife.layers?.trim?.segments || []) {
    if (Math.hypot(s.x2 - s.x1, s.y2 - s.y1) < 0.01) continue
    n++
    for (const k of [key(s.x1, s.y1), key(s.x2, s.y2)]) deg.set(k, (deg.get(k) || 0) + 1)
  }
  return {open: [...deg.values()].filter((v) => v === 1).length, segs: n}
}
function measure(p, t, size, piece) {
  const knife = createKnife({
    templateId: p.templateId, length: size.length, width: size.width, height: size.height,
    thickness: Number(p.thickness) || 0.5, bleed: 3, sizeMode: 'inner', materialId: 'kraft', params: advancedOf(p), piece: piece || undefined, strict: true,
  })
  const o = openEnds(knife)
  const segs = knife.layers?.trim?.segments || []
  const xs = segs.flatMap((s) => [s.x1, s.x2]), ys = segs.flatMap((s) => [s.y1, s.y2])
  const cutLen = segs.reduce((a, v) => a + Math.hypot(v.x2 - v.x1, v.y2 - v.y1), 0)
  return {
    ...o, cutLen, faces: (knife.faces || []).length, creases: (knife.layers?.crease?.segments || []).length,
    w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys),
    ok: !!knife.validation?.ok, blocking: (knife.issues || []).filter((i) => i.severity === 'blocking').length,
    warn: [...new Set((knife.issues || []).map((i) => i.code))].slice(0, 4),
  }
}

const rows = []
for (const p of PRESETS) {
  if (!p.templateId || !(p.fidelity === 'exact' || p.fidelity === 'close')) continue
  const t = TEMPLATES[p.templateId]
  if (!t) continue
  const limits = t.limits || t.verifiedRange || {}
  const def = {length: Number(p.length) || 100, width: Number(p.width) || 80, height: Number(p.height) || (Number(t.limits?.height?.[1]) === 0 ? 0 : 50)}
  for (const piece of (t.pieces || []).map((x) => x.id).concat((t.pieces || []).length ? [] : [null])) {
    let base
    try { base = measure(p, t, def, piece) } catch (e) { rows.push({id: p.id, tpl: p.templateId, piece, error: String(e.message).slice(0, 80)}); continue }
    const broken = []
    const tested = []
    for (const k of SCALES) {
      const size = Object.fromEntries(DIMS.map((d) => [d, usable(limits[d]) ? Math.round(Math.max(limits[d][0], Math.min(limits[d][1], def[d] * k)) * 10) / 10 : def[d]]))
      if (DIMS.every((d) => size[d] === def[d])) continue
      // in range only: what the workbench lets the user enter
      const inRange = DIMS.every((d) => !usable(limits[d]) || (def[d] * k >= limits[d][0] - 1e-6 && def[d] * k <= limits[d][1] + 1e-6))
      if (!inRange) continue
      tested.push(k)
      let m
      try { m = measure(p, t, size, piece) } catch (e) { broken.push({k, why: 'throws: ' + String(e.message).slice(0, 60)}); continue }
      const why = []
      if (m.open > base.open) why.push(`open ends ${base.open}→${m.open}`)
      if (m.faces !== base.faces) why.push(`faces ${base.faces}→${m.faces}`)
      const rw = m.w / base.w, rh = m.h / base.h
      if (rw < k * 0.6 || rh < k * 0.6 || rw > k * 1.6 || rh > k * 1.6) why.push(`sheet ${base.w.toFixed(0)}x${base.h.toFixed(0)}→${m.w.toFixed(0)}x${m.h.toFixed(0)}`)
      // Total cut length follows the scale closely on a healthy dieline; when part of the outline
      // is lost or doubled it does not (checked by eye on 171030, 112550, 116200)
      const cl = m.cutLen / base.cutLen / k
      if (cl < 0.7 || cl > 1.45) why.push(`cut length x${cl.toFixed(2)} of expected`)
      const definite = why.some((w) => !w.startsWith('open ends'))
      if (why.length) broken.push({k, why: why.join('; '), definite, ok: m.ok, blocking: m.blocking, warn: m.warn})
    }
    rows.push({id: p.id, cat: p.categoryId, tpl: p.templateId, kind: p.templateId.split('-')[0], fidelity: p.fidelity, piece, baseOpen: base.open, tested, broken})
  }
}
const out = process.argv[2]
if (out) writeFileSync(out, JSON.stringify({rows}))
const bad = rows.filter((r) => r.broken?.some((b) => b.definite))
const suspect = rows.filter((r) => r.broken?.length && !r.broken.some((b) => b.definite))
const silent = bad.filter((r) => r.broken.some((b) => b.definite && b.ok && !b.blocking))
console.log(JSON.stringify({
  targets: rows.length, presets: new Set(rows.map((r) => r.id)).size, errors: rows.filter((r) => r.error).length,
  defaultHasOpenEnds: rows.filter((r) => r.baseOpen > 0).length,
  brokenTargets: bad.length, brokenPresets: new Set(bad.map((r) => r.id)).size, brokenTemplates: new Set(bad.map((r) => r.tpl)).size,
  silentPresets: new Set(silent.map((r) => r.id)).size,
  suspectPresets: new Set(suspect.map((r) => r.id)).size,
}))
