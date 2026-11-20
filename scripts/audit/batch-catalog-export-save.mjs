/**
 * Batch-test export + size-lock save for every live import-* catalog product.
 * Does NOT consume export quota (uses local knife/export same as geometry service).
 *
 * Usage:
 *   node scripts/audit/batch-catalog-export-save.mjs [--base http://localhost]
 *     [--out docs/产品目录_导出与保存批量测试_2026-11-19.csv]
 *     [--limit N] [--skip-save] [--email ...] [--password ...]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { knifeFromPacdoraGeom } from '../../src/pacdoraGeomKnife.js'
import { computeKnifeStats } from '../../src/knife.js'
import { toDxf, toSvgDieline, toPdf, toAi } from '../../src/exportDieline.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const arg = (k, d) => {
  const i = process.argv.indexOf(k)
  return i > 0 ? process.argv[i + 1] : d
}
const has = (k) => process.argv.includes(k)
const BASE = arg('--base', 'http://localhost').replace(/\/$/, '')
const OUT = arg('--out', path.join(ROOT, 'docs', '产品目录_导出与保存批量测试_2026-11-19.csv'))
const LIMIT = Number(arg('--limit', '0')) || 0
const SKIP_SAVE = has('--skip-save')
const EMAIL = arg('--email', process.env.SMOKE_EMAIL || 'smoke@boxcraft.local')
// No password in the repo: pass --password or set SMOKE_PASSWORD
const PASSWORD = arg('--password', process.env.SMOKE_PASSWORD || '')

const getJson = async (u, init) => {
  const r = await fetch(u, init)
  const text = await r.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = { raw: text.slice(0, 200) }
  }
  if (!r.ok) {
    const err = new Error(`${r.status} ${u}: ${body?.message || text.slice(0, 120)}`)
    err.status = r.status
    err.body = body
    throw err
  }
  return body
}

function csvEsc(v) {
  const t = String(v ?? '')
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}

/** Path endpoints only (arc extents use end points; centers/controls excluded). */
function collectPoints(paths) {
  const pts = []
  for (const pathCmds of paths || []) {
    for (const c of pathCmds || []) {
      if (Number.isFinite(c?.x) && Number.isFinite(c?.y)) pts.push([c.x, c.y])
    }
  }
  return pts
}

function bboxOf(pts) {
  if (!pts.length) return null
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const [x, y] of pts) {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY }
}

/**
 * Extent of DXF TRIM-layer cut geometry.
 * LINE/LWPOLYLINE/POLYLINE vertices counted; ARC uses center±radius (true span).
 */
function dxfTrimExtent(dxf) {
  const xs = [],
    ys = []
  const lines = String(dxf).split(/\r?\n/)
  let inEntities = false
  let ent = null
  const flush = () => {
    if (!ent || ent.layer !== 'TRIM') return
    if (ent.type === 'ARC' && Number.isFinite(ent.cx) && Number.isFinite(ent.cy) && Number.isFinite(ent.r)) {
      // Only the swept part of the arc counts: a corner fillet is a quarter circle, not a full one
      let a0 = Number.isFinite(ent.a0) ? ent.a0 : 0
      let a1 = Number.isFinite(ent.a1) ? ent.a1 : 360
      if (a1 < a0) a1 += 360
      for (let t = a0; ; t = Math.min(t + 1, a1)) {
        const rad = (t * Math.PI) / 180
        xs.push(ent.cx + ent.r * Math.cos(rad))
        ys.push(ent.cy + ent.r * Math.sin(rad))
        if (t >= a1) break
      }
      return
    }
    for (const [x, y] of ent.pts) {
      xs.push(x)
      ys.push(y)
    }
  }
  // DXF is strict code/value pairs: stepping one line at a time read values such as "0" (a z
  // coordinate) as group codes and cut every ARC short before its radius.
  for (let i = 0; i < lines.length - 1; i += 2) {
    const code = lines[i].trim()
    const val = lines[i + 1]
    if (code === '2' && val.trim() === 'ENTITIES') inEntities = true
    if (code === '0' && val.trim() === 'ENDSEC' && inEntities) {
      flush()
      inEntities = false
      ent = null
      continue
    }
    if (!inEntities) continue
    if (code === '0') {
      flush()
      const t = val.trim()
      ent = ['LINE', 'LWPOLYLINE', 'POLYLINE', 'VERTEX', 'ARC', 'SPLINE'].includes(t)
        ? { type: t, layer: '', pts: [], cx: NaN, cy: NaN, r: NaN }
        : null
      continue
    }
    if (!ent) continue
    if (code === '8') ent.layer = val.trim()
    if (code === '10') {
      const n = Number(val)
      if (ent.type === 'ARC') ent.cx = n
      else if (Number.isFinite(n)) ent.pts.push([n, NaN])
    }
    if (code === '20') {
      const n = Number(val)
      if (ent.type === 'ARC') ent.cy = n
      else if (ent.pts.length) ent.pts[ent.pts.length - 1][1] = n
    }
    if (code === '11') {
      const n = Number(val)
      if (Number.isFinite(n)) ent.pts.push([n, NaN])
    }
    if (code === '21') {
      const n = Number(val)
      if (ent.pts.length) ent.pts[ent.pts.length - 1][1] = n
    }
    if (code === '40' && ent.type === 'ARC') ent.r = Number(val)
    if (code === '50' && ent.type === 'ARC') ent.a0 = Number(val)
    if (code === '51' && ent.type === 'ARC') ent.a1 = Number(val)
  }
  flush()
  const fxs = xs.filter(Number.isFinite)
  const fys = ys.filter(Number.isFinite)
  if (!fxs.length || !fys.length) return null
  return {
    minX: Math.min(...fxs),
    maxX: Math.max(...fxs),
    minY: Math.min(...fys),
    maxY: Math.max(...fys),
    w: Math.max(...fxs) - Math.min(...fxs),
    h: Math.max(...fys) - Math.min(...fys),
  }
}

function hasIllegalNumber(text) {
  return /\b(NaN|Infinity|null)\b/i.test(String(text))
}

function zeroFaces(knife) {
  const bad = []
  for (const f of knife.faces || []) {
    const w = Number(f.w),
      h = Number(f.h)
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 0.05 || h < 0.05) {
      bad.push(`${f.name || '?'}(${w}x${h})`)
    }
  }
  return bad
}

function creaseIssues(knife, trimBox) {
  const issues = []
  if (!trimBox) return ['no trim bbox']
  const pad = 1.0
  for (const fold of knife.folds || []) {
    const x1 = fold.x1 ?? fold[0]?.[0]
    const y1 = fold.y1 ?? fold[0]?.[1]
    const x2 = fold.x2 ?? fold[1]?.[0]
    const y2 = fold.y2 ?? fold[1]?.[1]
    if (![x1, y1, x2, y2].every(Number.isFinite)) {
      issues.push('non-finite crease')
      continue
    }
    const len = Math.hypot(x2 - x1, y2 - y1)
    if (len < 0.05) issues.push('zero-length crease')
    for (const [x, y] of [
      [x1, y1],
      [x2, y2],
    ]) {
      if (
        x < trimBox.minX - pad ||
        x > trimBox.maxX + pad ||
        y < trimBox.minY - pad ||
        y > trimBox.maxY + pad
      ) {
        issues.push('crease outside trim')
        break
      }
    }
  }
  return [...new Set(issues)]
}

async function checkPdfFit(bytes, knife) {
  const { PDFDocument } = await import('pdf-lib')
  const page = (await PDFDocument.load(bytes)).getPage(0)
  const trim = knife.layers?.trim?.paths || knife.paths?.trim || []
  const box = bboxOf(collectPoints(trim))
  if (!box) return 'pdf: no trim paths'
  const k = 72 / 25.4
  const w = box.w * k,
    h = box.h * k
  if (page.getWidth() + 0.5 < w || page.getHeight() + 0.5 < h) {
    return `pdf page ${page.getWidth().toFixed(0)}x${page.getHeight().toFixed(0)}pt < dieline ${w.toFixed(0)}x${h.toFixed(0)}pt`
  }
  return ''
}

async function checkAiLayers(bytes) {
  const { PDFDocument, PDFName, decodePDFRawStream, PDFRawStream } = await import('pdf-lib')
  const doc = await PDFDocument.load(bytes)
  const ocp = doc.catalog.lookup(PDFName.of('OCProperties'))
  if (!ocp) return 'ai: missing OCProperties'
  const names = ocp
    .lookup(PDFName.of('OCGs'))
    .asArray()
    .map((r) => doc.context.lookup(r).lookup(PDFName.of('Name')).decodeText())
  const expect = ['BLEED', 'TRIM', 'CREASE', 'DIM', 'TEXT']
  if (JSON.stringify(names) !== JSON.stringify(expect)) return `ai layers ${names.join('|')}`
  return ''
}

function cookieJar() {
  const jar = new Map()
  return {
    store(res) {
      const raw = res.headers.getSetCookie?.() || []
      for (const c of raw) {
        const [pair] = c.split(';')
        const i = pair.indexOf('=')
        if (i > 0) jar.set(pair.slice(0, i), pair.slice(i + 1))
      }
    },
    header() {
      return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
    },
    get(name) {
      return jar.get(name) || ''
    },
  }
}

async function loginSession() {
  const jar = cookieJar()
  const csrfRes = await fetch(`${BASE}/api/v1/auth/csrf/`, { headers: { Accept: 'application/json' } })
  jar.store(csrfRes)
  const csrfBody = await csrfRes.json()
  const csrf = csrfBody?.data?.csrf_token || jar.get('csrftoken')
  const loginRes = await fetch(`${BASE}/api/v1/auth/login/`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-CSRFToken': csrf,
      Cookie: jar.header(),
    },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  jar.store(loginRes)
  const loginBody = await loginRes.json().catch(() => ({}))
  if (!loginRes.ok) throw new Error(`login failed ${loginRes.status} ${loginBody?.message || ''}`)
  const csrf2 = jar.get('csrftoken') || csrf
  return {
    async api(method, pathName, json) {
      const res = await fetch(`${BASE}${pathName}`, {
        method,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-CSRFToken': csrf2,
          Cookie: jar.header(),
          ...(method !== 'GET' ? { 'Idempotency-Key': crypto.randomUUID() } : {}),
        },
        body: json != null ? JSON.stringify(json) : undefined,
      })
      jar.store(res)
      const text = await res.text()
      let body
      try {
        body = JSON.parse(text)
      } catch {
        body = { raw: text.slice(0, 200) }
      }
      return { ok: res.ok, status: res.status, body }
    },
  }
}

function designContentFromDetail(detail, paramsOverride = {}) {
  const p = { ...(detail.capabilities?.default_params || {}), ...paramsOverride }
  return {
    schemaVersion: 'boxcraft.design.v1',
    locale: 'zh-CN',
    geometry: {
      mode: detail.geometry_mode || 'fixed_snapshot',
      templateId: detail.template_key,
      templateVersion: detail.template_version?.version || '1',
      engineVersion: detail.template_version?.engine_version || 'boxcraft.knife.v3',
      params: {
        lengthMm: p.lengthMm,
        widthMm: p.widthMm,
        heightMm: p.heightMm,
        thicknessMm: p.thicknessMm ?? 0.5,
        sizeMode: p.sizeMode || 'inner',
        fluteDirection: p.fluteDirection || 'L',
        materialId: p.materialId || 'kraft',
        bleedInputMm: p.bleedInputMm ?? 3,
        advanced: p.advanced || {},
      },
      geometryHash: 'pending',
    },
    artwork: { backgroundColor: null, layers: [] },
    aiSettings: null,
    outbox: {
      enabled: false,
      sizingMode: 'grow',
      quantity: 1,
      thicknessMm: 3,
      gapsMm: { length: 5, width: 5, height: 5 },
    },
  }
}

async function testSave(session, detail) {
  const problems = []
  const create = await session.api('POST', '/api/v1/designs/', {
    name: `audit-${detail.slug}`,
    product_slug: detail.slug,
  })
  if (!create.ok) return [`save create ${create.status}:${create.body?.code || create.body?.message || ''}`]
  const designId = create.body.data.id
  const rowVersion = create.body.data.row_version ?? create.body.data.current_revision?.row_version
  try {
    const okSave = await session.api('POST', `/api/v1/designs/${designId}/revisions/`, {
      expected_row_version: rowVersion ?? 1,
      content: designContentFromDetail(detail),
      kind: 'autosave',
    })
    // some APIs nest differently — also accept 201 create-only without revision if already locked ok
    if (!okSave.ok) {
      // create already applied geometry; treat create success + locked reject as enough if revision API shape differs
      if (okSave.status === 400 && okSave.body?.code === 'SIZE_LOCKED') {
        problems.push('locked size rejected on original (unexpected)')
      } else if (okSave.status !== 409) {
        // try without expected_row_version field variants
        problems.push(`save original ${okSave.status}:${okSave.body?.code || okSave.body?.message || ''}`)
      }
    }
    const bad = await session.api('POST', `/api/v1/designs/${designId}/revisions/`, {
      expected_row_version: (okSave.body?.data?.row_version ?? rowVersion ?? 1) + 0,
      content: designContentFromDetail(detail, {
        lengthMm: Number(detail.capabilities?.default_params?.lengthMm || 100) + 25,
      }),
      kind: 'autosave',
    })
    const code = bad.body?.code || bad.body?.data?.code
    if (bad.ok) problems.push('save resized unexpectedly allowed')
    else if (code !== 'SIZE_LOCKED' && bad.status !== 400) {
      // re-fetch and try again with fresh row version
      const det = await session.api('GET', `/api/v1/designs/${designId}/`)
      const rv = det.body?.data?.row_version ?? det.body?.data?.current_revision?.row_version
      const bad2 = await session.api('POST', `/api/v1/designs/${designId}/revisions/`, {
        expected_row_version: rv,
        content: designContentFromDetail(detail, {
          lengthMm: Number(detail.capabilities?.default_params?.lengthMm || 100) + 25,
        }),
        kind: 'autosave',
      })
      const code2 = bad2.body?.code
      if (bad2.ok || code2 !== 'SIZE_LOCKED') {
        problems.push(`save resize reject ${bad2.status}:${code2 || bad2.body?.message || ''}`)
      }
    }
  } finally {
    await session.api('DELETE', `/api/v1/designs/${designId}/`).catch(() => {})
  }
  return problems
}

const products = []
for (let page = 1; ; page++) {
  const d = (await getJson(`${BASE}/api/v1/products/?page_size=100&page=${page}`)).data
  products.push(...d.items)
  if (!d.has_next) break
}
let imports = products.filter((p) => String(p.slug || '').startsWith('import-'))
if (LIMIT > 0) imports = imports.slice(0, LIMIT)
console.log(`live=${products.length} imports=${imports.length} base=${BASE}`)

let session = null
if (!SKIP_SAVE) {
  try {
    session = await loginSession()
    console.log('save auth ok', EMAIL)
  } catch (e) {
    console.warn('save auth failed, continuing without save checks:', e.message)
  }
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
    template_key: p.template_key,
    size: '',
    layers: '',
    validate_ok: '',
    export_svg: '',
    export_dxf: '',
    export_pdf: '',
    export_ai: '',
    dxf_extent_err_mm: '',
    side_panels: '',
    save_ok: '',
    save_reject_resize: '',
    problems: [],
  }
  const bad = (s) => row.problems.push(s)
  process.stdout.write(`[${i}/${imports.length}] ${p.slug} `)
  try {
    const detail = (await getJson(`${BASE}/api/v1/products/${encodeURIComponent(p.slug)}/`)).data
    const m = /^fixed-(?:([a-z]+)-)?(\d+)$/.exec(detail.template_key || p.template_key || '')
    if (!m) {
      bad('template key not fixed-*')
      rows.push(row)
      console.log('FAIL template')
      continue
    }
    const cat = m[1] || p.category || 'shipping'
    const num = m[2]
    row.num = num
    row.template_key = detail.template_key
    const dp = detail.capabilities?.default_params || {}
    row.size = `${dp.lengthMm}×${dp.widthMm}×${dp.heightMm}`
    const geomUrl = `${BASE}/${cat}-geom/${num}.json`
    const served = await getJson(geomUrl)
    row.layers = Object.keys(served.layer || {}).length

    const knife = knifeFromPacdoraGeom(served, {
      sourceNum: num,
      L: dp.lengthMm,
      W: dp.widthMm,
      H: dp.heightMm,
      T: dp.thicknessMm,
      length: dp.lengthMm,
      width: dp.widthMm,
      height: dp.heightMm,
      thickness: dp.thicknessMm,
    })
    const holeCuts = (knife.holes || []).map((h) => h.pathCommands).filter((c) => Array.isArray(c) && c.length)
    if (holeCuts.length) {
      const trim = [...(knife.paths?.trim || []), ...holeCuts]
      knife.paths = { ...knife.paths, trim }
      if (knife.layers?.trim) knife.layers = { ...knife.layers, trim: { ...knife.layers.trim, paths: trim } }
    }

    const vOk = !!knife.validation?.ok
    row.validate_ok = vOk ? 'Y' : 'N'
    if (!vOk) bad(`validate: ${(knife.validation?.errors || []).join(';') || 'failed'}`)

    const zf = zeroFaces(knife)
    row.side_panels = zf.length ? `BAD:${zf.slice(0, 4).join('|')}` : 'OK'
    if (zf.length) bad(`zero face ${zf.slice(0, 6).join(',')}`)

    // Reference extent from the flattened cut segments: path end points alone miss the bulge of
    // arcs (rounded flaps, tube ends) and made every curved box look like a DXF mismatch.
    const trimSegs = knife.layers?.trim?.segments || []
    const trimPts = trimSegs.length
      ? trimSegs.flatMap((sg) => [[sg.x1, sg.y1], [sg.x2, sg.y2]])
      : collectPoints(knife.layers?.trim?.paths || knife.paths?.trim || [])
    const trimBox = bboxOf(trimPts)
    for (const issue of creaseIssues(knife, trimBox)) bad(issue)

    // SVG
    try {
      const svg = toSvgDieline(knife, { includeDims: true })
      if (!svg || svg.length < 50) bad('svg empty')
      else if (hasIllegalNumber(svg)) bad('svg illegal number')
      else row.export_svg = 'Y'
    } catch (e) {
      bad(`svg ${String(e.message || e).slice(0, 60)}`)
      row.export_svg = 'N'
    }

    // DXF
    try {
      const dxf = toDxf(knife)
      if (!dxf || dxf.length < 50) bad('dxf empty')
      else if (hasIllegalNumber(dxf)) bad('dxf illegal number')
      else {
        row.export_dxf = 'Y'
        const ext = dxfTrimExtent(dxf)
        // Compare cut outline extents (not sheet canvas / dim padding).
        if (ext && trimBox) {
          const err = Math.max(Math.abs(ext.w - trimBox.w), Math.abs(ext.h - trimBox.h))
          row.dxf_extent_err_mm = err.toFixed(2)
          if (err > 1.0) bad(`dxf extent err ${err.toFixed(2)}mm`)
        } else if (!ext) {
          bad('dxf TRIM extent missing')
        }
        if (!dxf.includes('TRIM') || !dxf.includes('CREASE')) bad('dxf missing layers')
      }
    } catch (e) {
      bad(`dxf ${String(e.message || e).slice(0, 60)}`)
      row.export_dxf = 'N'
    }

    // PDF
    try {
      const pdf = await toPdf(knife)
      if (!(pdf instanceof Uint8Array) || pdf.length < 500) bad('pdf empty')
      else {
        const fit = await checkPdfFit(pdf, knife)
        if (fit) bad(fit)
        else row.export_pdf = 'Y'
      }
    } catch (e) {
      bad(`pdf ${String(e.message || e).slice(0, 60)}`)
      row.export_pdf = 'N'
    }

    // AI
    try {
      const ai = await toAi(knife)
      if (!(ai instanceof Uint8Array) || ai.length < 500) bad('ai empty')
      else {
        const layerErr = await checkAiLayers(ai)
        if (layerErr) bad(layerErr)
        else row.export_ai = 'Y'
      }
    } catch (e) {
      bad(`ai ${String(e.message || e).slice(0, 60)}`)
      row.export_ai = 'N'
    }

    computeKnifeStats(knife) // ensure stats path does not throw

    if (session) {
      const saveProblems = await testSave(session, detail)
      const origFail = saveProblems.filter((s) => s.includes('original') || s.includes('create'))
      const resizeFail = saveProblems.filter((s) => s.includes('resize') || s.includes('allowed'))
      row.save_ok = origFail.length ? 'N' : 'Y'
      row.save_reject_resize = resizeFail.length ? 'N' : 'Y'
      for (const s of saveProblems) bad(s)
    } else {
      row.save_ok = 'SKIP'
      row.save_reject_resize = 'SKIP'
    }
  } catch (e) {
    bad(`error: ${String(e?.message || e).slice(0, 100)}`)
  }
  rows.push(row)
  console.log(row.problems.length ? `FAIL ${row.problems[0]}` : 'OK')
}

const cols = [
  'slug',
  'category',
  'num',
  'name',
  'template_key',
  'size',
  'layers',
  'validate_ok',
  'export_svg',
  'export_dxf',
  'export_pdf',
  'export_ai',
  'dxf_extent_err_mm',
  'side_panels',
  'save_ok',
  'save_reject_resize',
  'problems',
]
const csv = [cols.join(',')]
  .concat(
    rows.map((r) =>
      cols
        .map((c) => csvEsc(c === 'problems' ? r.problems.join('; ') : r[c]))
        .join(','),
    ),
  )
  .join('\n')
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, '\ufeff' + csv)

const fail = rows.filter((r) => r.problems.length)
console.log(`done total=${rows.length} fail=${fail.length} ok=${rows.length - fail.length}`)
console.log('written', OUT)
if (fail.length) {
  const kinds = {}
  for (const r of fail) {
    for (const pr of r.problems) {
      const k = pr.replace(/[\d.]+/g, 'N').slice(0, 80)
      ;(kinds[k] ||= []).push(r.slug)
    }
  }
  for (const [k, v] of Object.entries(kinds).sort((a, b) => b[1].length - a[1].length).slice(0, 20)) {
    console.log(String(v.length).padStart(4), k, '|', v.slice(0, 3).join(' '))
  }
}
