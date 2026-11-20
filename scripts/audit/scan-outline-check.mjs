/**
 * Outline check (OUTLINE_BROKEN, src/outlineIntegrity.js) over every customizable template:
 *   · at the catalogue default size it must never fire (a false block would take the box offline)
 *   · inside the allowed size range: how many sizes / boxes it blocks
 * Sizes: 0.6 0.7 0.8 0.9 1.1 1.25 1.4 × default (clamped to the allowed range), plus min and max.
 *   node scripts/audit/scan-outline-check.mjs [out.csv]
 */
import {writeFileSync} from 'node:fs'
import {createKnife} from '../../src/knife.js'
import {PRESETS} from '../../src/catalog/index.js'
import {TEMPLATES} from '../../src/templates/index.js'

const DIMS = ['length', 'width', 'height']
const usable = (r) => Array.isArray(r) && r.length === 2 && +r[1] > +r[0] && !(+r[0] === 0 && +r[1] >= 2000)
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
const broken = (kn) => (kn.validation?.checks || []).some((c) => c.id === 'OUTLINE_BROKEN' && !c.ok)

let targets = 0, cases = 0, blockedCases = 0, otherInvalid = 0
const falseBlocks = []
const otherWhy = []
const rows = []
for (const p of PRESETS) {
  if (!p.templateId || !(p.fidelity === 'exact' || p.fidelity === 'close')) continue
  const t = TEMPLATES[p.templateId]
  if (!t) continue
  const lim = t.limits || t.verifiedRange
  const def = {length: Number(p.length) || 100, width: Number(p.width) || 80, height: Number(p.height) || (Number(t.limits?.height?.[1]) === 0 ? 0 : 50)}
  const pieces = (t.pieces || []).map((x) => x.id)
  for (const piece of pieces.length ? pieces : [null]) {
    targets++
    const make = (s) => createKnife({templateId: p.templateId, ...s, thickness: Number(p.thickness) || 0.5, bleed: 3, sizeMode: 'inner', materialId: 'kraft', params: advancedOf(p), piece: piece || undefined, strict: true})
    const name = p.id + (piece ? '/' + piece : '')
    try {
      if (broken(make(def))) falseBlocks.push(name)
    } catch (err) {
      falseBlocks.push(name + ' (throws: ' + String(err?.message || err).slice(0, 60) + ')')
      continue
    }
    if (!lim) continue
    const hit = []
    const tested = []
    for (const k of [0.6, 0.7, 0.8, 0.9, 1.1, 1.25, 1.4, 'min', 'max']) {
      const s = Object.fromEntries(DIMS.map((d) => {
        if (!usable(lim[d])) return [d, def[d]]
        const [lo, hi] = lim[d]
        const v = k === 'min' ? lo : k === 'max' ? hi : def[d] * k
        return [d, Math.round(Math.max(lo, Math.min(hi, v)) * 10) / 10]
      }))
      if (DIMS.every((d) => s[d] === def[d])) continue
      cases++
      tested.push(k)
      try {
        const kn = make(s)
        if (broken(kn)) { blockedCases++; hit.push(`${k}(${s.length}x${s.width}x${s.height})`) } else if (!kn.validation?.ok) { otherInvalid++; otherWhy.push(`${name} ${k}: ${kn.validation.checks.filter((c) => !c.ok).map((c) => c.id).join('+')}`) }
      } catch (err) { otherInvalid++; otherWhy.push(`${name} ${k}: ${err?.code || ''} ${String(err?.message || err).slice(0, 60)}`) }
    }
    if (hit.length) rows.push({name, cat: p.categoryId, def: `${def.length}x${def.width}x${def.height}`, tested: tested.length, hit})
  }
}
console.log(`targets ${targets} · false blocks at default size ${falseBlocks.length}`)
if (falseBlocks.length) console.log(falseBlocks.join('\n'))
console.log(`resized cases ${cases} · blocked ${blockedCases} · boxes with at least one blocked size ${rows.length} · invalid for other reasons ${otherInvalid}`)
if (otherWhy.length) console.log(otherWhy.slice(0, 12).join(String.fromCharCode(10)))
const shrinkOnly = rows.filter((r) => r.hit.every((h) => /^(0\.|min)/.test(h))).length
console.log(`boxes blocked only when made smaller ${shrinkOnly} · also/only when made larger ${rows.length - shrinkOnly}`)
if (process.argv[2]) {
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`
  writeFileSync(process.argv[2], '﻿' + ['产品,类别,默认尺寸(长x宽x高),测试的尺寸数,被拦住的尺寸数,被拦住的尺寸', ...rows.map((r) => [r.name, r.cat, r.def, r.tested, r.hit.length, r.hit.join(' ')].map(esc).join(','))].join('\r\n'))
}
process.exit(falseBlocks.length ? 1 : 0)
