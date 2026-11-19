// Verifies the dielines of the imported products that are live on the site (/products):
// for every published `import-*` product it loads the geometry file the site serves, checks it is
// the captured Pacdora sample unchanged, replays it the way Studio does and compares the result
// with the sample's own figures (face count, sheet size, cut / crease length, holes, box size).
// Usage: node scripts/verify-live-product-dielines.mjs [--base http://localhost] [--out file.csv]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { knifeFromPacdoraGeom } from '../src/pacdoraGeomKnife.js'
import { computeKnifeStats } from '../src/knife.js'
import { referenceOf } from './check-pacdora-fidelity.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d }
const BASE = arg('--base', 'http://localhost')
const OUT = arg('--out', path.join(ROOT, 'docs', '上线产品刀版核实结果.csv'))
const rel = (a, b) => (b > 0 ? Math.abs(a - b) / b : a > 0 ? 1 : 0)
const getJson = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`${r.status} ${u}`); return r.json() }

const products = []
for (let page = 1; ; page++) {
  const d = (await getJson(`${BASE}/api/v1/products/?page_size=100&page=${page}`)).data
  products.push(...d.items)
  if (!d.has_next) break
}
const imports = products.filter((p) => p.slug.startsWith('import-'))
console.log(`live products ${products.length}, imported ${imports.length}, built-in examples skipped ${products.length - imports.length}`)

const stable = (o) => JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((x) => [x, v[x]])) : v))
const rows = []
for (const p of imports) {
  const row = { slug: p.slug, category: p.category, name: p.name, problems: [] }
  const bad = (s) => row.problems.push(s)
  try {
    const m = /^fixed-(?:([a-z]+)-)?(\d+)$/.exec(p.template_key || '')
    if (!m) { bad('template key not fixed-*'); rows.push(row); continue }
    const cat = m[1] || 'shipping'
    const num = m[2]
    row.num = num
    if (cat !== p.category) bad(`template category ${cat} ≠ product category ${p.category}`)
    const detail = (await getJson(`${BASE}/api/v1/products/${p.slug}/`)).data
    const dp = detail.capabilities?.default_params || {}
    const served = await getJson(`${BASE}/${cat}-geom/${num}.json`)
    // 1. the served file is the captured sample
    const srcFile = [path.join(ROOT, 'docs', `pacdora_${cat}_boxes`, 'geometry', `${num}.json`), path.join(ROOT, 'geometry', 'pacdora_boxes', `${num}.json`)].find((f) => fs.existsSync(f))
    if (!srcFile) row.source = 'no local capture to compare'
    else {
      const same = stable(JSON.parse(fs.readFileSync(srcFile, 'utf8'))) === stable(served)
      row.source = same ? 'identical' : 'differs'
      if (!same) bad('served geometry differs from the captured sample')
    }
    if (String(served.cate_no ?? served.modeCate?.cate_no ?? num) !== num) bad(`file is for model ${served.cate_no}`)
    // 2. replay as Studio does and compare with the sample's own figures
    const ref = referenceOf(served)
    // multi-layer boxes are replayed with every layer on one sheet: count faces over all layers
    const layerList = Object.values(served.layer || {}).filter((l) => Array.isArray(l?.faces) && l.faces.length)
    if (layerList.length > 1) {
      ref.faces = layerList.reduce((t, l) => t + l.faces.length, 0)
      ref.sheetW = 0; ref.sheetH = 0; ref.cutLen = 0; ref.foldLen = 0
    }
    const knife = knifeFromPacdoraGeom(served, { sourceNum: num, L: dp.lengthMm, W: dp.widthMm, H: dp.heightMm, T: dp.thicknessMm })
    const stats = computeKnifeStats(knife)
    Object.assign(row, {
      faces: knife.faces.length, refFaces: ref.faces,
      sheetW: knife.totalX, refSheetW: ref.sheetW, sheetH: knife.totalY, refSheetH: ref.sheetH,
      cut: Math.round(stats.cutLengthMm), refCut: Math.round(ref.cutLen),
      crease: Math.round(stats.creaseLengthMm), refCrease: Math.round(ref.foldLen),
      holes: (knife.holes || []).length, refHoles: ref.holes,
      hinges: (knife.hinges || []).length, layers: Object.keys(served.layer || {}).length,
    })
    row.sheetErr = Math.max(rel(knife.totalX, ref.sheetW), rel(knife.totalY, ref.sheetH))
    row.cutErr = ref.cutLen ? rel(stats.cutLengthMm, ref.cutLen) : null
    row.creaseErr = ref.foldLen ? rel(stats.creaseLengthMm, ref.foldLen) : null
    if (knife.faces.length !== ref.faces) bad(`faces ${knife.faces.length} vs sample ${ref.faces}`)
    if (layerList.length > 1) { row.sheetErr = 0; if ((knife.sheetPieces || []).length !== layerList.length) bad(`pieces ${(knife.sheetPieces || []).length} vs layers ${layerList.length}`) }
    if (row.sheetErr > 0.005) bad(`sheet size off ${(row.sheetErr * 100).toFixed(1)}%`)
    if (row.creaseErr != null && row.creaseErr > 0.02) bad(`crease length off ${(row.creaseErr * 100).toFixed(1)}%`)
    if (!row.hinges) bad('no fold lines (cannot fold in 3D)')
    const coords = JSON.stringify([knife.cuts, knife.folds])
    if (/null|NaN/.test(coords)) bad('invalid coordinates')
    // 3. the size shown on the product page is the sample's size
    const s = served.size || {}
    row.size = `${dp.lengthMm}×${dp.widthMm}×${dp.heightMm}`
    row.refSize = `${s.L}×${s.W}×${s.H}`
    const dims = [[dp.lengthMm, s.L], [dp.widthMm, s.W], [dp.heightMm, s.H]]
    if (dims.some(([a, b]) => Number(b) > 0 && Math.abs(Number(a) - Number(b)) > 0.6)) bad(`size ${row.size} vs sample ${row.refSize}`)
  } catch (e) {
    bad(`error: ${String(e?.message || e).slice(0, 80)}`)
  }
  rows.push(row)
}

const cols = ['slug', 'category', 'num', 'name', 'source', 'faces', 'refFaces', 'sheetW', 'refSheetW', 'sheetH', 'refSheetH', 'cut', 'refCut', 'crease', 'refCrease', 'holes', 'refHoles', 'hinges', 'layers', 'size', 'refSize', 'problems']
const csv = [cols.join(',')].concat(rows.map((r) => cols.map((c) => { const v = c === 'problems' ? r.problems.join('; ') : r[c] ?? ''; return /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v }).join(','))).join('\n')
fs.writeFileSync(OUT, '﻿' + csv)

const byCat = {}
for (const r of rows) { const c = (byCat[r.category] ||= { total: 0, ok: 0 }); c.total++; if (!r.problems.length) c.ok++ }
console.log(byCat)
const kinds = {}
for (const r of rows) for (const pr of r.problems) { const k = pr.replace(/[\d.]+%?/g, 'N').replace(/N×N×N/g, 'S'); (kinds[k] ||= []).push(r.slug) }
for (const [k, v] of Object.entries(kinds).sort((a, b) => b[1].length - a[1].length)) console.log(String(v.length).padStart(4), k, '|', v.slice(0, 4).join(' '))
console.log('sources', rows.reduce((a, r) => { a[r.source] = (a[r.source] || 0) + 1; return a }, {}))
console.log('written', OUT)
