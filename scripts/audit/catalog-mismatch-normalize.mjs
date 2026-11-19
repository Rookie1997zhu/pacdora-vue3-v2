/**
 * Normalize-and-compare the 84 "不重合" catalog products vs cover/reference outlines.
 * Produces a compare HTML wall + conclusions CSV.
 *
 * Usage: node scripts/audit/catalog-mismatch-normalize.mjs [--base http://localhost]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { knifeFromPacdoraGeom } from '../../src/pacdoraGeomKnife.js'
import { computeKnifeStats } from '../../src/knife.js'
import { referenceOf } from '../check-pacdora-fidelity.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const arg = (k, d) => {
  const i = process.argv.indexOf(k)
  return i > 0 ? process.argv[i + 1] : d
}
const BASE = arg('--base', 'http://localhost').replace(/\/$/, '')
const BASELINE = path.join(ROOT, 'docs', '上线产品刀版核实结果_2026-11-19.csv')
const OUT_DIR = path.join(ROOT, 'docs', 'audit', 'catalog-mismatch-84')
const THREE_D = path.join(ROOT, 'docs', 'audit', 'catalog-3d-overview', '3d-conclusions.csv')
fs.mkdirSync(OUT_DIR, { recursive: true })

const getJson = async (u) => {
  const r = await fetch(u)
  if (!r.ok) throw new Error(`${r.status} ${u}`)
  return r.json()
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/)
  const header = splitCsv(lines[0])
  return lines.slice(1).map((line) => {
    const cols = splitCsv(line)
    const o = {}
    header.forEach((h, i) => {
      o[h] = cols[i]
    })
    return o
  })
}

function splitCsv(line) {
  const cols = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"'
        i++
      } else q = !q
      continue
    }
    if (ch === ',' && !q) {
      cols.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  cols.push(cur)
  return cols
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
}

function csvEsc(s) {
  const t = String(s ?? '')
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}

function knifeSvg(knife, w = 420, h = 320) {
  const paths = knife.layers?.trim?.paths || knife.paths?.trim || []
  const folds = knife.folds || []
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  const segs = []
  for (const cmds of paths) {
    let d = ''
    for (const c of cmds || []) {
      if (!Number.isFinite(c?.x) || !Number.isFinite(c?.y)) continue
      minX = Math.min(minX, c.x)
      minY = Math.min(minY, c.y)
      maxX = Math.max(maxX, c.x)
      maxY = Math.max(maxY, c.y)
      if (c.mtd === 'M') d += `M${c.x} ${c.y}`
      else if (c.mtd === 'L') d += `L${c.x} ${c.y}`
      else if (c.mtd === 'Z') d += 'Z'
      else if (c.mtd === 'A') d += `A${c.rx || 0} ${c.ry || 0} ${c.ang || 0} ${c.arc ? 1 : 0} ${c.dir ?? 1} ${c.x} ${c.y}`
      else d += `L${c.x} ${c.y}`
    }
    if (d) segs.push(`<path d="${d}" fill="none" stroke="#2028b0" stroke-width="1.2"/>`)
  }
  for (const f of folds) {
    const x1 = f.x1,
      y1 = f.y1,
      x2 = f.x2,
      y2 = f.y2
    if (![x1, y1, x2, y2].every(Number.isFinite)) continue
    minX = Math.min(minX, x1, x2)
    minY = Math.min(minY, y1, y2)
    maxX = Math.max(maxX, x1, x2)
    maxY = Math.max(maxY, y1, y2)
    segs.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#fa0000" stroke-width="1" stroke-dasharray="4 3"/>`)
  }
  if (!Number.isFinite(minX)) {
    minX = 0
    minY = 0
    maxX = 100
    maxY = 100
  }
  const bw = maxX - minX || 1
  const bh = maxY - minY || 1
  const pad = 12
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX - pad} ${minY - pad} ${bw + 2 * pad} ${bh + 2 * pad}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" style="background:#fff">${segs.join('')}</svg>`
}

/** Structure fingerprint after dropping absolute size. */
function fingerprint(knife, ref) {
  const faces = knife.faces?.length || 0
  const folds = knife.folds?.length || knife.hinges?.length || 0
  const holes = knife.holes?.length || 0
  const sheetAspect = knife.totalY > 0 ? knife.totalX / knife.totalY : 0
  return {
    faces,
    folds,
    holes,
    sheetAspect: Number(sheetAspect.toFixed(3)),
    refFaces: ref?.faces ?? null,
  }
}

function classify(auto, coverPct, ourPct, threeVerdict) {
  // Normalized structure match → same structure different size (harmless)
  if (auto === '同结构不同尺寸') {
    if (threeVerdict === '不成盒') return { conclusion: '刀版有误', note: '3D不成盒且结构标记同结构——优先复核' }
    return { conclusion: '无害', note: '归一化后面片/折线对齐；封面图为别尺寸示意' }
  }
  if (auto === '结构可疑') {
    if (threeVerdict === '不成盒') return { conclusion: '刀版有误', note: '结构指纹不对且3D不成盒' }
    if (Number(coverPct) < 30 && Number(ourPct) < 30) return { conclusion: '拿不准', note: '覆盖率双低，需对Pacdora' }
    if (Number(coverPct) < 40 && Number(ourPct) > 70) return { conclusion: '封面图有误', note: '我方轮廓覆盖高、原图覆盖低' }
    return { conclusion: '刀版有误', note: '归一化后面片/折线对不上' }
  }
  return { conclusion: '拿不准', note: '自动分类失败' }
}

const baseline = parseCsv(fs.readFileSync(BASELINE, 'utf8'))
const mismatch = baseline.filter((r) => String(r['结论'] || '').includes('不重合'))
console.log('mismatch rows', mismatch.length)

const threeMap = {}
if (fs.existsSync(THREE_D)) {
  for (const r of parseCsv(fs.readFileSync(THREE_D, 'utf8'))) threeMap[r.slug] = r
}

const rows = []
for (const r of mismatch) {
  const slug = r.slug
  const row = {
    slug,
    category: r['类目'],
    num: r['编号'],
    name: r['名称'],
    cover_pct: r['原图线条被我方覆盖%'],
    our_pct: r['我方线条被原图覆盖%'],
    layers: r['图层数'],
    auto_class: '',
    conclusion: '',
    note: '',
    faces: '',
    folds: '',
    size: '',
    three_verdict: threeMap[slug]?.verdict || '',
    svg: '',
    cover_url: '',
  }
  try {
    const detail = (await getJson(`${BASE}/api/v1/products/${encodeURIComponent(slug)}/`)).data
    const m = /^fixed-(?:([a-z]+)-)?(\d+)$/.exec(detail.template_key || '')
    const cat = m?.[1] || detail.category
    const num = m?.[2] || r['编号']
    const dp = detail.capabilities?.default_params || {}
    row.size = `${dp.lengthMm}×${dp.widthMm}×${dp.heightMm}`
    row.cover_url = detail.cover_rel ? `${BASE}/${detail.cover_rel.replace(/^\//, '')}` : ''
    const served = await getJson(`${BASE}/${cat}-geom/${num}.json`)
    const ref = referenceOf(served)
    const knife = knifeFromPacdoraGeom(served, {
      sourceNum: num,
      L: dp.lengthMm,
      W: dp.widthMm,
      H: dp.heightMm,
      T: dp.thicknessMm,
    })
    computeKnifeStats(knife)
    const fp = fingerprint(knife, ref)
    row.faces = String(fp.faces)
    row.folds = String(fp.folds)
    const faceOk = fp.refFaces == null || fp.faces === fp.refFaces || Math.abs(fp.faces - fp.refFaces) <= 1
    // Cover overlap mid-range with matching face count → same structure different size
    const cov = Number(row.cover_pct)
    const ours = Number(row.our_pct)
    if (faceOk && fp.folds > 0 && (cov + ours) / 2 >= 40) row.auto_class = '同结构不同尺寸'
    else if (faceOk && Math.abs(cov - ours) <= 15 && cov >= 25) row.auto_class = '同结构不同尺寸'
    else row.auto_class = '结构可疑'
    const judged = classify(row.auto_class, cov, ours, row.three_verdict)
    row.conclusion = judged.conclusion
    row.note = judged.note
    row.svg = knifeSvg(knife)
  } catch (e) {
    row.auto_class = '结构可疑'
    row.conclusion = '拿不准'
    row.note = String(e.message || e).slice(0, 80)
  }
  rows.push(row)
}

rows.sort((a, b) => {
  const rank = (c) => (c === '刀版有误' ? 0 : c === '拿不准' ? 1 : c === '封面图有误' ? 2 : 3)
  return rank(a.conclusion) - rank(b.conclusion) || a.slug.localeCompare(b.slug)
})

const cols = [
  'slug',
  'category',
  'num',
  'name',
  'cover_pct',
  'our_pct',
  'auto_class',
  'conclusion',
  'note',
  'faces',
  'folds',
  'size',
  'three_verdict',
]
fs.writeFileSync(
  path.join(OUT_DIR, 'mismatch-conclusions.csv'),
  '\ufeff' + [cols.join(',')].concat(rows.map((r) => cols.map((c) => csvEsc(r[c])).join(','))).join('\n'),
)

const cards = rows
  .map((r) => {
    const cover = r.cover_url
      ? `<img src="${esc(r.cover_url)}" alt="cover"/>`
      : `<div class="ph">no cover</div>`
    return `<article class="card ${esc(r.conclusion)}">
  <header><strong>${esc(r.name)}</strong><span>${esc(r.slug)}</span></header>
  <div class="pair">${cover}<div class="svg">${r.svg}</div></div>
  <p>LWH ${esc(r.size)} · faces ${esc(r.faces)} · folds ${esc(r.folds)} · cover ${esc(r.cover_pct)}/${esc(r.our_pct)}</p>
  <p><b>${esc(r.conclusion)}</b> · ${esc(r.auto_class)} · 3D ${esc(r.three_verdict || '-')}</p>
  <p class="note">${esc(r.note)}</p>
</article>`
  })
  .join('\n')

const summary = rows.reduce((a, r) => {
  a[r.conclusion] = (a[r.conclusion] || 0) + 1
  return a
}, {})

fs.writeFileSync(
  path.join(OUT_DIR, 'index.html'),
  `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><title>84 不重合对照</title>
<style>
body{margin:0;font:14px/1.5 system-ui;background:#f6f8f9;color:#1c2428}
header.page{padding:20px 24px;background:#fff;border-bottom:1px solid #dfe5e8}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(480px,1fr));gap:14px;padding:16px 24px 40px}
.card{background:#fff;border:1px solid #dfe5e8;border-radius:10px;padding:10px}
.card.刀版有误{border-color:#9b2c2c}
.card.拿不准{border-color:#9a5b00}
.card.封面图有误{border-color:#0f6e68}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.pair img,.svg, .ph{width:100%;aspect-ratio:4/3;object-fit:contain;background:#eef2f3;border-radius:6px}
.ph{display:grid;place-items:center;color:#889}
header span{display:block;color:#5d6b72;font-size:12px}
.note{color:#5d6b72}
</style></head><body>
<header class="page"><h1>84 个「与原图不重合」对照</h1>
<p>${Object.entries(summary).map(([k, v]) => `${k} ${v}`).join(' · ')} · 结构可疑/刀版有误已置顶</p>
</header><main class="grid">${cards}</main></body></html>`,
)

console.log('summary', summary)
console.log('written', OUT_DIR)
if ((summary['刀版有误'] || 0) > 10) {
  console.log('PAUSE_HINT: 刀版有误超过10个，按计划需先与你确认处理策略（本步只记录不修）')
}
