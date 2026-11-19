/**
 * Catalog 3D overview: auto-suspect by closed bbox vs registered LWH, optional Edge screenshots,
 * and a browsable HTML wall.
 *
 * Usage:
 *   node scripts/audit/catalog-3d-overview.mjs [--base http://localhost] [--vite http://127.0.0.1:5173]
 *     [--shots] [--limit N]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import * as THREE from 'three'
import { knifeFromPacdoraGeom } from '../../src/pacdoraGeomKnife.js'
import { buildGeomRig } from '../../src/geomRig.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const arg = (k, d) => {
  const i = process.argv.indexOf(k)
  return i > 0 ? process.argv[i + 1] : d
}
const has = (k) => process.argv.includes(k)
const BASE = arg('--base', 'http://localhost').replace(/\/$/, '')
const VITE = arg('--vite', 'http://127.0.0.1:5173').replace(/\/$/, '')
const LIMIT = Number(arg('--limit', '0')) || 0
const DO_SHOTS = has('--shots')
const SHOTS_SUSPECTS_ONLY = has('--shots-suspects-only')
const OUT_DIR = path.join(ROOT, 'docs', 'audit', 'catalog-3d-overview')
const SHOT_DIR = path.join(OUT_DIR, 'shots')
const EDGE = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => fs.existsSync(p))

fs.mkdirSync(SHOT_DIR, { recursive: true })

const getJson = async (u) => {
  const r = await fetch(u)
  if (!r.ok) throw new Error(`${r.status} ${u}`)
  return r.json()
}

function closedDims(knife) {
  const makeMesh = (f) =>
    new THREE.Mesh(new THREE.BoxGeometry(Math.max(f.w, 0.1), Math.max(f.h, 0.1), 0.1))
  const rig = buildGeomRig(knife, { makeMesh, zOff: 0 })
  rig.apply(1)
  rig.root.updateMatrixWorld(true)
  const s = new THREE.Box3().setFromObject(rig.root).getSize(new THREE.Vector3())
  return [s.x, s.y, s.z]
}

function sorted(a) {
  return [...a].map(Number).sort((x, y) => y - x)
}

function ratioErr(a, b) {
  const A = sorted(a),
    B = sorted(b)
  let m = 1
  for (let i = 0; i < 3; i++) {
    const x = Math.max(A[i], 1),
      y = Math.max(B[i], 1)
    m = Math.max(m, x / y, y / x)
  }
  return m - 1
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

async function shot(url, outFile) {
  if (!EDGE) return false
  try {
    if (fs.existsSync(outFile)) fs.unlinkSync(outFile)
  } catch {
    /* ignore */
  }
  spawnSync(
    EDGE,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--run-all-compositor-stages-before-draw',
      `--screenshot=${outFile}`,
      '--window-size=400,420',
      '--virtual-time-budget=6000',
      url,
    ],
    { timeout: 20000, stdio: 'ignore' },
  )
  for (let i = 0; i < 50; i++) {
    if (fs.existsSync(outFile) && fs.statSync(outFile).size > 2000) return true
    await new Promise((r) => setTimeout(r, 100))
  }
  return fs.existsSync(outFile) && fs.statSync(outFile).size > 2000
}

const products = []
for (let page = 1; ; page++) {
  const d = (await getJson(`${BASE}/api/v1/products/?page_size=100&page=${page}`)).data
  products.push(...d.items)
  if (!d.has_next) break
}
let imports = products.filter((p) => String(p.slug || '').startsWith('import-'))
if (LIMIT > 0) imports = imports.slice(0, LIMIT)
console.log(`imports=${imports.length} shots=${DO_SHOTS}`)

let viteOk = false
if (DO_SHOTS) {
  try {
    const r = await fetch(VITE, { signal: AbortSignal.timeout(3000) })
    viteOk = r.ok || r.status === 404
  } catch {
    viteOk = false
  }
  if (!viteOk) console.warn('vite not reachable; screenshots skipped (auto-suspect still runs)')
}

const rows = []
let i = 0
for (const p of imports) {
  i++
  const row = {
    slug: p.slug,
    category: p.category,
    name: p.name,
    num: '',
    size: '',
    closed: '',
    err_pct: '',
    suspect: 'N',
    suspect_reason: '',
    shot_closed: '',
    shot_half: '',
    verdict: '',
    notes: '',
  }
  try {
    const detail = (await getJson(`${BASE}/api/v1/products/${encodeURIComponent(p.slug)}/`)).data
    const m = /^fixed-(?:([a-z]+)-)?(\d+)$/.exec(detail.template_key || '')
    if (!m) {
      row.suspect = 'Y'
      row.suspect_reason = 'bad template_key'
      rows.push(row)
      continue
    }
    const cat = m[1] || p.category
    const num = m[2]
    row.num = num
    const dp = detail.capabilities?.default_params || {}
    const L = Number(dp.lengthMm),
      W = Number(dp.widthMm),
      H = Number(dp.heightMm),
      T = Number(dp.thicknessMm || 0.5)
    row.size = `${L}×${W}×${H}`
    row.cover_url = detail.cover_rel ? `${BASE}/${String(detail.cover_rel).replace(/^\//, '')}` : ''
    const served = await getJson(`${BASE}/${cat}-geom/${num}.json`)
    const knife = knifeFromPacdoraGeom(served, { sourceNum: num, L, W, H, T })
    const zero = (knife.faces || []).filter((f) => Number(f.w) < 0.05 || Number(f.h) < 0.05)
    const dims = closedDims(knife)
    row.closed = dims.map((v) => v.toFixed(1)).join('×')
    if (H < 0.05 || L < 0.05 || W < 0.05) {
      row.suspect = 'Y'
      row.suspect_reason = 'registered dim ~0'
    } else if (zero.length) {
      row.suspect = 'Y'
      row.suspect_reason = `zero faces ${zero.length}`
    } else {
      const err = ratioErr(dims, [L, W, H])
      row.err_pct = (err * 100).toFixed(1)
      // Flat: smallest closed axis << registered height, or overall mismatch ≥20%
      const flat = Math.min(...dims) < Math.max(H, 1) * 0.35
      if (err >= 0.2 || flat) {
        row.suspect = 'Y'
        row.suspect_reason = flat ? `flat/err ${row.err_pct}%` : `size err ${row.err_pct}%`
      }
    }

    // provisional auto verdict for overview sorting; human pass fills verdict column later
    if (row.suspect === 'Y' && /~0|zero faces|flat/.test(row.suspect_reason)) row.verdict = '不成盒'
    else if (row.suspect === 'Y') row.verdict = '待看'
    else row.verdict = '成盒'

    const closedRel = `shots/${p.slug}-closed.png`
    const halfRel = `shots/${p.slug}-half.png`
    if (fs.existsSync(path.join(SHOT_DIR, `${p.slug}-closed.png`))) row.shot_closed = closedRel
    if (fs.existsSync(path.join(SHOT_DIR, `${p.slug}-half.png`))) row.shot_half = halfRel
    const wantShot =
      DO_SHOTS && viteOk && EDGE && (!SHOTS_SUSPECTS_ONLY || row.suspect === 'Y' || i <= 12)
    if (wantShot && (!row.shot_closed || !row.shot_half)) {
      const q = `cat=${cat}&num=${num}&L=${L}&W=${W}&H=${H}&T=${T}&size=360`
      const closedPath = path.join(SHOT_DIR, `${p.slug}-closed.png`)
      const halfPath = path.join(SHOT_DIR, `${p.slug}-half.png`)
      const page = `${VITE}/scripts/audit/catalog-3d-thumb.html?${q}`
      if (!row.shot_closed && (await shot(`${page}&fold=1`, closedPath))) row.shot_closed = closedRel
      if (!row.shot_half && (await shot(`${page}&fold=0.45`, halfPath))) row.shot_half = halfRel
    }
  } catch (e) {
    row.suspect = 'Y'
    row.suspect_reason = String(e.message || e).slice(0, 80)
    row.verdict = '看不出'
  }
  rows.push(row)
  if (i % 20 === 0 || i === imports.length) console.log(`${i}/${imports.length} suspects=${rows.filter((r) => r.suspect === 'Y').length}`)
}

rows.sort((a, b) => Number(b.suspect === 'Y') - Number(a.suspect === 'Y') || a.category.localeCompare(b.category) || a.slug.localeCompare(b.slug))

// Human pass: manual-verdicts.json (every screenshot looked at) overrides the provisional auto verdict.
// The auto rule only compares the closed bounding box with the registered size, so it calls tall
// narrow boxes and envelopes "flat" and cannot see scattered panels at all.
const MANUAL = path.join(OUT_DIR, 'manual-verdicts.json')
if (fs.existsSync(MANUAL)) {
  const manual = JSON.parse(fs.readFileSync(MANUAL, 'utf8')).items || {}
  for (const row of rows) {
    const m = manual[row.slug]
    row.verdict = m ? m.verdict : '成盒'
    row.notes = m?.notes || ''
  }
}
const csvCols = ['slug', 'category', 'num', 'name', 'size', 'closed', 'err_pct', 'suspect', 'suspect_reason', 'shot_closed', 'shot_half', 'verdict', 'notes']
fs.writeFileSync(
  path.join(OUT_DIR, '3d-conclusions.csv'),
  '\ufeff' +
    [csvCols.join(',')]
      .concat(rows.map((r) => csvCols.map((c) => csvEsc(r[c])).join(',')))
      .join('\n'),
)

const byCat = {}
for (const r of rows) (byCat[r.category] ||= []).push(r)

const cards = rows
  .map((r) => {
    const cls = r.suspect === 'Y' ? 'card suspect' : 'card'
    const cover = r.cover_url
      ? `<img src="${esc(r.cover_url)}" alt="cover"/>`
      : `<div class="ph">no cover</div>`
    const imgC = r.shot_closed
      ? `<img src="${esc(r.shot_closed)}" alt="closed"/>`
      : `<div class="ph">closed: auto ${esc(r.closed || '-')}</div>`
    const imgH = r.shot_half
      ? `<img src="${esc(r.shot_half)}" alt="half"/>`
      : `<div class="ph"><a href="${esc(BASE)}/products/${esc(r.slug)}" target="_blank">打开产品页看 3D</a></div>`
    return `<article class="${cls}" id="${esc(r.slug)}">
  <header><strong>${esc(r.name)}</strong><span>${esc(r.slug)}</span></header>
  <div class="shots">${cover}${imgC}${imgH}</div>
  <p>登记 ${esc(r.size)} · 合盖 ${esc(r.closed)} · 偏差 ${esc(r.err_pct)}%</p>
  <p class="tag">${esc(r.verdict)} ${r.suspect === 'Y' ? '· ' + esc(r.suspect_reason) : ''}</p>
</article>`
  })
  .join('\n')

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"/><title>产品目录 3D 总览</title>
<style>
body{font:14px/1.5 system-ui;margin:0;background:#f6f8f9;color:#1c2428}
header.page{padding:20px 24px;background:#fff;border-bottom:1px solid #dfe5e8}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px;padding:16px 24px 40px}
.card{background:#fff;border:1px solid #dfe5e8;border-radius:10px;padding:10px}
.card.suspect{border-color:#c45c26;box-shadow:inset 0 0 0 1px #c45c26}
.shots{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}
.shots img,.ph{width:100%;aspect-ratio:1;object-fit:contain;background:#eef2f3;border-radius:6px}
.ph{display:grid;place-items:center;color:#889}
header span{display:block;color:#5d6b72;font-size:12px}
.tag{color:#0f6e68;font-weight:600}
.card.suspect .tag{color:#9a5b00}
</style></head><body>
<header class="page">
  <h1>产品目录 3D 总览（${rows.length}）</h1>
  <p>可疑 ${rows.filter((r) => r.suspect === 'Y').length} · 已按可疑置顶。结论见 3d-conclusions.csv（可人工改 verdict）。</p>
</header>
<main class="grid">${cards}</main>
</body></html>`
fs.writeFileSync(path.join(OUT_DIR, 'index.html'), html)
console.log('written', OUT_DIR)
console.log(
  'suspects',
  rows.filter((r) => r.suspect === 'Y').length,
  'byVerdict',
  rows.reduce((a, r) => {
    a[r.verdict] = (a[r.verdict] || 0) + 1
    return a
  }, {}),
)
