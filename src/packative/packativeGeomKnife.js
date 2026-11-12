/**
 * Packative 官方 Cutting/Creasing SVG → boxcraft.knife.v3（仅 2D 图层）。
 * 无 faces / hinges / foldStages，不虚构 3D。
 *
 * Phase 0 门禁（packative-3d-map-verdict = mesh_only）：
 * - 禁止从 Creasing 猜测面片树并填 faces
 * - 禁止在本适配器接入 geomRig；EngView Collada 预览属另阶段
 * - 见 research/packative-dieline-lab/reports/packative-3d-map-verdict.md
 */
import { sizeArrowDataFromBounds } from '../dimAnnotations.js'
import { BLEED_EXTRA_MM, expandBleedLoops } from '../knife.js'
import { publicAssetUrl } from '../assetUrl.js'

const cache = new Map()
const inflight = new Map()

const EPS = 1e-4
const JOIN_EPS = 0.75

function r3(n) {
  return Math.round(Number(n) * 1000) / 1000
}

function parseSvgTransform(raw) {
  const s = String(raw || '')
  let tx = 0
  let ty = 0
  let sx = 1
  let sy = 1
  const tm = /translate\(\s*([-\d.eE+]+)\s*[, ]\s*([-\d.eE+]+)\s*\)/.exec(s)
  if (tm) {
    tx = Number(tm[1]) || 0
    ty = Number(tm[2]) || 0
  }
  const sm = /scale\(\s*([-\d.eE+]+)(?:\s*[, ]\s*([-\d.eE+]+))?\s*\)/.exec(s)
  if (sm) {
    sx = Number(sm[1])
    sy = sm[2] != null ? Number(sm[2]) : sx
    if (!Number.isFinite(sx)) sx = 1
    if (!Number.isFinite(sy)) sy = 1
  }
  return { tx, ty, sx, sy }
}

function xfPoint(x, y, t) {
  return { x: t.tx + t.sx * x, y: t.ty + t.sy * y }
}

function sampleCubic(x0, y0, cx1, cy1, cx2, cy2, x1, y1, segs = 8) {
  const pts = []
  for (let i = 1; i <= segs; i++) {
    const t = i / segs
    const u = 1 - t
    pts.push([
      u * u * u * x0 + 3 * u * u * t * cx1 + 3 * u * t * t * cx2 + t * t * t * x1,
      u * u * u * y0 + 3 * u * u * t * cy1 + 3 * u * t * t * cy2 + t * t * t * y1,
    ])
  }
  return pts
}

/** 将 path d 按绝对坐标展开为折线点列（仅 M/L/C/c/Z；支持 `c-0.9` 命令粘连数字） */
function pathDToPolyline(d, t, { arcSegs = 8 } = {}) {
  const tokens = []
  const src = String(d || '')
  const re = /([MmLlCcZz])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g
  let m
  while ((m = re.exec(src))) tokens.push(m[1] || m[2])
  const pts = []
  let i = 0
  let cx = 0
  let cy = 0
  let startX = 0
  let startY = 0
  let cmd = 'M'
  const push = (x, y) => {
    const p = xfPoint(x, y, t)
    const last = pts[pts.length - 1]
    if (last && Math.hypot(last[0] - p.x, last[1] - p.y) < EPS) return
    pts.push([p.x, p.y])
  }
  const readNum = () => {
    const n = Number(tokens[i++])
    return Number.isFinite(n) ? n : NaN
  }
  while (i < tokens.length) {
    if (/^[MmLlCcZz]$/.test(tokens[i])) {
      cmd = tokens[i++]
      if (/^[Zz]$/.test(cmd)) {
        push(startX, startY)
        continue
      }
    }
    if (/^[Mm]$/.test(cmd)) {
      let x = readNum()
      let y = readNum()
      if (![x, y].every(Number.isFinite)) break
      if (cmd === 'm' && pts.length) {
        cx += x
        cy += y
      } else {
        cx = x
        cy = y
      }
      startX = cx
      startY = cy
      push(cx, cy)
      cmd = cmd === 'm' ? 'l' : 'L'
      continue
    }
    if (/^[Ll]$/.test(cmd)) {
      let x = readNum()
      let y = readNum()
      if (![x, y].every(Number.isFinite)) break
      if (cmd === 'l') {
        cx += x
        cy += y
      } else {
        cx = x
        cy = y
      }
      push(cx, cy)
      continue
    }
    if (/^[Cc]$/.test(cmd)) {
      const rel = cmd === 'c'
      let x1 = readNum()
      let y1 = readNum()
      let x2 = readNum()
      let y2 = readNum()
      let x = readNum()
      let y = readNum()
      if (![x1, y1, x2, y2, x, y].every(Number.isFinite)) break
      if (rel) {
        x1 += cx
        y1 += cy
        x2 += cx
        y2 += cy
        x += cx
        y += cy
      }
      for (const p of sampleCubic(cx, cy, x1, y1, x2, y2, x, y, arcSegs)) {
        const q = xfPoint(p[0], p[1], t)
        const last = pts[pts.length - 1]
        if (last && Math.hypot(last[0] - q.x, last[1] - q.y) < EPS) continue
        pts.push([q.x, q.y])
      }
      cx = x
      cy = y
      continue
    }
    i++
  }
  return pts
}

function polylineToSegs(pts) {
  const segs = []
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < EPS) continue
    segs.push({ x1: a[0], y1: a[1], x2: b[0], y2: b[1] })
  }
  return segs
}

function styleOf(el) {
  return String(el.getAttribute('ev-style') || '').trim()
}

function parseViewBoxAttr(vbRaw) {
  if (!vbRaw) return null
  const viewBox = String(vbRaw)
    .trim()
    .split(/[\s,]+/)
    .map(Number)
    .filter((n) => Number.isFinite(n))
  return viewBox.length === 4 ? viewBox : null
}

function attrOf(tag, name) {
  const m = new RegExp(`${name}="([^"]*)"`, 'i').exec(tag)
  return m ? m[1] : ''
}

/** DOMParser 不可用时（Node 校验脚本）用正则抽取 line/path */
function parsePackativeOfficialSvgRegex(text) {
  const vb = /viewBox="([^"]+)"/i.exec(text)
  const viewBox = parseViewBoxAttr(vb?.[1])
  const gm = /<g[^>]*transform="([^"]*)"/i.exec(text)
  const t = parseSvgTransform(gm?.[1] || '')
  const cuts = []
  const creases = []
  const pushRole = (role, segs) => {
    const bucket = role === 'Creasing' ? creases : role === 'Cutting' ? cuts : null
    if (!bucket) return
    for (const s of segs) bucket.push(s)
  }
  const lineRe = /<line\b[^>]*>/gi
  let m
  while ((m = lineRe.exec(text))) {
    const tag = m[0]
    const role = attrOf(tag, 'ev-style')
    if (role !== 'Cutting' && role !== 'Creasing') continue
    const p0 = xfPoint(Number(attrOf(tag, 'x1')), Number(attrOf(tag, 'y1')), t)
    const p1 = xfPoint(Number(attrOf(tag, 'x2')), Number(attrOf(tag, 'y2')), t)
    if (![p0.x, p0.y, p1.x, p1.y].every(Number.isFinite)) continue
    if (Math.hypot(p0.x - p1.x, p0.y - p1.y) < EPS) continue
    pushRole(role, [{ x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y }])
  }
  const pathRe = /<path\b[^>]*>/gi
  while ((m = pathRe.exec(text))) {
    const tag = m[0]
    const role = attrOf(tag, 'ev-style')
    if (role !== 'Cutting' && role !== 'Creasing') continue
    const poly = pathDToPolyline(attrOf(tag, 'd') || '', t, { arcSegs: 10 })
    pushRole(role, polylineToSegs(poly))
  }
  return { cuts, creases, viewBox }
}

/**
 * 解析官方 SVG → Cutting / Creasing 线段（已应用根 g 变换）。
 * @param {string} svgText
 * @returns {{ cuts: Array<{x1:number,y1:number,x2:number,y2:number}>, creases: Array<{x1:number,y1:number,x2:number,y2:number}>, viewBox: number[]|null }}
 */
export function parsePackativeOfficialSvg(svgText) {
  const text = String(svgText || '')
  if (!text.includes('<svg')) throw new Error('invalid packative SVG')
  if (typeof DOMParser === 'undefined') return parsePackativeOfficialSvgRegex(text)
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
  const svg = doc.querySelector('svg')
  if (!svg) throw new Error('missing svg root')
  const viewBox = parseViewBoxAttr(svg.getAttribute('viewBox'))
  const g = svg.querySelector('g[transform]') || svg.querySelector('g')
  const t = parseSvgTransform(g?.getAttribute('transform') || '')
  const cuts = []
  const creases = []
  const pushRole = (role, segs) => {
    const bucket = role === 'Creasing' ? creases : role === 'Cutting' ? cuts : null
    if (!bucket) return
    for (const s of segs) bucket.push(s)
  }
  for (const line of svg.querySelectorAll('line')) {
    const role = styleOf(line)
    if (role !== 'Cutting' && role !== 'Creasing') continue
    const p0 = xfPoint(Number(line.getAttribute('x1')), Number(line.getAttribute('y1')), t)
    const p1 = xfPoint(Number(line.getAttribute('x2')), Number(line.getAttribute('y2')), t)
    if (![p0.x, p0.y, p1.x, p1.y].every(Number.isFinite)) continue
    if (Math.hypot(p0.x - p1.x, p0.y - p1.y) < EPS) continue
    pushRole(role, [{ x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y }])
  }
  for (const path of svg.querySelectorAll('path')) {
    const role = styleOf(path)
    if (role !== 'Cutting' && role !== 'Creasing') continue
    const poly = pathDToPolyline(path.getAttribute('d') || '', t, { arcSegs: 10 })
    pushRole(role, polylineToSegs(poly))
  }
  return { cuts, creases, viewBox }
}

/** 已有 normalized 线段（研究台）→ 同构输入 */
export function segmentsFromNormalized(normalized) {
  const segs = Array.isArray(normalized?.segments) ? normalized.segments : []
  const cuts = []
  const creases = []
  for (const s of segs) {
    const style = String(s.style || '')
    const bucket = style === 'Creasing' ? creases : style === 'Cutting' ? cuts : null
    if (!bucket) continue
    if (s.kind === 'path' && s.c0 && s.c1 && s.p0 && s.p1) {
      const poly = [[s.p0.x, s.p0.y], ...sampleCubic(s.p0.x, s.p0.y, s.c0.x, s.c0.y, s.c1.x, s.c1.y, s.p1.x, s.p1.y, 10)]
      bucket.push(...polylineToSegs(poly))
      continue
    }
    if (!s.p0 || !s.p1) continue
    if (Math.hypot(s.p0.x - s.p1.x, s.p0.y - s.p1.y) < EPS) continue
    bucket.push({ x1: s.p0.x, y1: s.p0.y, x2: s.p1.x, y2: s.p1.y })
  }
  return { cuts, creases }
}

function keyPt(x, y) {
  return `${Math.round(x / JOIN_EPS)},${Math.round(y / JOIN_EPS)}`
}

/** 无向边串成闭合环（用于出血外扩）；失败则退回 AABB */
function loopsFromSegments(segs) {
  const edges = (segs || [])
    .map((s) => [
      [s.x1, s.y1],
      [s.x2, s.y2],
    ])
    .filter(([a, b]) => Math.hypot(a[0] - b[0], a[1] - b[1]) > EPS)
  if (!edges.length) return []

  const adj = new Map()
  const add = (a, b) => {
    const ka = keyPt(a[0], a[1])
    const kb = keyPt(b[0], b[1])
    if (!adj.has(ka)) adj.set(ka, [])
    if (!adj.has(kb)) adj.set(kb, [])
    adj.get(ka).push({ k: kb, p: b })
    adj.get(kb).push({ k: ka, p: a })
  }
  for (const [a, b] of edges) add(a, b)

  const used = new Set()
  const loops = []
  const edgeKey = (ka, kb) => (ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`)

  for (const [startK, startNbs] of adj) {
    for (const nb of startNbs) {
      const ek0 = edgeKey(startK, nb.k)
      if (used.has(ek0)) continue
      const pts = []
      let prevK = startK
      let curK = nb.k
      let curP = nb.p
      used.add(ek0)
      pts.push(curP)
      let guard = 0
      while (guard++ < edges.length + 2) {
        if (curK === startK) break
        const nbs = adj.get(curK) || []
        let next = null
        for (const cand of nbs) {
          const ek = edgeKey(curK, cand.k)
          if (used.has(ek)) continue
          if (cand.k === prevK && nbs.length > 1) continue
          next = cand
          used.add(ek)
          break
        }
        if (!next) break
        prevK = curK
        curK = next.k
        curP = next.p
        pts.push(curP)
      }
      if (pts.length >= 3 && curK === startK) loops.push(pts)
    }
  }

  if (loops.length) return loops

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const s of segs) {
    minX = Math.min(minX, s.x1, s.x2)
    minY = Math.min(minY, s.y1, s.y2)
    maxX = Math.max(maxX, s.x1, s.x2)
    maxY = Math.max(maxY, s.y1, s.y2)
  }
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) return []
  return [
    [
      [minX, minY],
      [maxX, minY],
      [maxX, maxY],
      [minX, maxY],
    ],
  ]
}

function boundsFromSegs(segLists, viewBox) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const list of segLists) {
    for (const s of list || []) {
      minX = Math.min(minX, s.x1, s.x2)
      minY = Math.min(minY, s.y1, s.y2)
      maxX = Math.max(maxX, s.x1, s.x2)
      maxY = Math.max(maxY, s.y1, s.y2)
    }
  }
  if (viewBox && viewBox.length === 4 && ![minX, minY, maxX, maxY].every(Number.isFinite)) {
    return {
      minX: viewBox[0],
      minY: viewBox[1],
      maxX: viewBox[0] + viewBox[2],
      maxY: viewBox[1] + viewBox[3],
    }
  }
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100 }
  }
  return { minX: r3(minX), minY: r3(minY), maxX: r3(maxX), maxY: r3(maxY) }
}

function segsToPathList(segs) {
  return (segs || [])
    .map((s) => `M ${r3(s.x1)} ${r3(s.y1)} L ${r3(s.x2)} ${r3(s.y2)}`)
    .filter(Boolean)
}

/**
 * @param {{ cuts: any[], creases: any[], viewBox?: number[]|null }} geom
 * @param {{ L:number, W:number, H:number, templateId?:string, label?:string, geomRel?:string, bleed?:number }} meta
 */
export function knifeFromPackativeGeom(geom, meta = {}) {
  const cuts = Array.isArray(geom?.cuts) ? geom.cuts : []
  const creases = Array.isArray(geom?.creases) ? geom.creases : []
  if (!cuts.length && !creases.length) throw new Error('packative geom has no Cutting/Creasing segments')

  const L = Number(meta.L) || 0
  const W = Number(meta.W) || 0
  const H = Number(meta.H) || 0
  const T = Number(meta.thickness) || 1.5
  const bleedSrc = Number.isFinite(Number(meta.bleed)) ? Number(meta.bleed) : 5
  const bleedEff = bleedSrc + BLEED_EXTRA_MM
  const templateId = String(meta.templateId || 'productbox-crashlock')

  const cutLoops = loopsFromSegments(cuts)
  const bleedLoops = expandBleedLoops(cutLoops, BLEED_EXTRA_MM)
  const bleeds = bleedLoops.flatMap((loop) => {
    const segs = []
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i]
      const b = loop[(i + 1) % loop.length]
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) < EPS) continue
      segs.push({ x1: a[0], y1: a[1], x2: b[0], y2: b[1] })
    }
    return segs
  })
  const bleedPaths = bleedLoops
    .map((loop) => {
      if (!loop.length) return ''
      return loop.map((p, i) => `${i ? 'L' : 'M'} ${r3(p[0])} ${r3(p[1])}`).join(' ') + ' Z'
    })
    .filter(Boolean)

  const cutPaths = segsToPathList(cuts)
  const folds = creases.map((s) => ({
    x1: r3(s.x1),
    y1: r3(s.y1),
    x2: r3(s.x2),
    y2: r3(s.y2),
  }))
  const cutSegs = cuts.map((s) => ({
    x1: r3(s.x1),
    y1: r3(s.y1),
    x2: r3(s.x2),
    y2: r3(s.y2),
  }))
  const bounds = boundsFromSegs([cutSegs, folds, bleeds], geom?.viewBox)
  const layers = {
    trim: { role: 'trim', color: '#2028b0', segments: cutSegs },
    crease: { role: 'crease', color: '#fa0000', dash: true, segments: folds },
    bleed: { role: 'bleed', color: '#46ba00', segments: bleeds },
  }

  return {
    schema: 'boxcraft.knife.v3',
    unit: 'mm',
    template: `packative-geom:${templateId}`,
    templateInfo: {
      id: `packative-geom:${templateId}`,
      label: meta.label || templateId,
      labelEn: 'Packative official SVG sample',
      standard: '官方样本刀版（Packative SVG）',
      sizeRule: 'locked-sample',
    },
    geomMode: true,
    fromPackativeGeom: true,
    dimensions: {
      length: L,
      width: W,
      height: H,
      thickness: T,
      sizeMode: 'inner',
      fluteDirection: 'L',
      inner: { length: L, width: W, height: H },
      outer: { length: L, width: W, height: H },
      panel: { length: L, width: W, height: H },
    },
    material: { id: 'kraft', science: 'packative-sample', fluteDirection: 'L' },
    bleed: bleedSrc,
    bleedEffective: bleedEff,
    params: {},
    faces: [],
    cuts: cutSegs,
    bleeds,
    folds,
    hinges: [],
    foldStages: [],
    layers,
    holes: [],
    cutPath: cutPaths.join(' '),
    bleedPath: bleedPaths.join(' '),
    cutPaths,
    bleedPaths,
    meta: {
      anyPoly: false,
      fromPackativeGeom: true,
      geomRel: meta.geomRel || '',
      components: 0,
      foldStageCount: 0,
      bleedExtra: BLEED_EXTRA_MM,
      bleedEffective: bleedEff,
      cutCount: cutSegs.length,
      creaseCount: folds.length,
    },
    topology: {
      root: null,
      roots: [],
      faceCount: 0,
      hingeCount: 0,
      faceOrder: [],
      supportsClosedCheck: false,
      supportsPiece: false,
      holeCount: 0,
      anyPoly: false,
      components: 0,
    },
    animation: { groups: [], animations: [] },
    sizeArrowData: sizeArrowDataFromBounds(bounds, {
      length: L,
      width: W,
      height: H,
      sizeMode: 'inner',
    }),
    totalX: r3(bounds.maxX - bounds.minX),
    totalY: r3(bounds.maxY - bounds.minY),
    bounds,
    manufacturingReady: false,
    productionReady: false,
    validation: {
      ok: true,
      checks: [{ id: 'packative-geom', ok: true, detail: 'official Cutting/Creasing SVG playback (2D only)' }],
    },
  }
}

export function knifeFromPackativeSvgText(svgText, meta = {}) {
  const geom = parsePackativeOfficialSvg(svgText)
  return knifeFromPackativeGeom(geom, meta)
}

function cacheKey(templateId, L, W, H, geomRel) {
  return `${templateId}|${L}x${W}x${H}|${geomRel || ''}`
}

async function findCatalogRow(templateId, L, W, H) {
  const { listPackativeAssets } = await import('./catalog.js')
  const tid = String(templateId || '')
  return (
    listPackativeAssets().find(
      (r) =>
        r.template_id === tid &&
        Number(r.L_mm) === Number(L) &&
        Number(r.W_mm) === Number(W) &&
        Number(r.H_mm) === Number(H),
    ) || null
  )
}

/**
 * @param {{ templateId:string, L:number, W:number, H:number, geomRel?:string, label?:string, bleed?:number }} opts
 */
export async function loadPackativeGeomKnife(opts = {}) {
  const templateId = String(opts.templateId || 'productbox-crashlock')
  const L = Number(opts.L)
  const W = Number(opts.W)
  const H = Number(opts.H)
  const row = await findCatalogRow(templateId, L, W, H)
  const geomRel = String(opts.geomRel || row?.geom_rel || '').replace(/^\//, '')
  if (!geomRel) throw new Error(`missing geom_rel for ${templateId} ${L}x${W}x${H}`)
  const key = cacheKey(templateId, L, W, H, geomRel)
  if (cache.has(key)) return cache.get(key)
  if (inflight.has(key)) return inflight.get(key)

  const p = (async () => {
    const res = await fetch(publicAssetUrl(geomRel))
    if (!res.ok) throw new Error(`fetch ${geomRel} → ${res.status}`)
    const svgText = await res.text()
    const knife = knifeFromPackativeSvgText(svgText, {
      L,
      W,
      H,
      templateId,
      label: opts.label || row?.title_zh || templateId,
      geomRel,
      bleed: opts.bleed,
      thickness: opts.thickness,
    })
    cache.set(key, knife)
    return knife
  })().finally(() => inflight.delete(key))

  inflight.set(key, p)
  return p
}

export function clearPackativeGeomCache() {
  cache.clear()
  inflight.clear()
}
