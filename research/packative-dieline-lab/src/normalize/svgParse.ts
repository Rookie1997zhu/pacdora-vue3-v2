/**
 * Offline SVG dieline parser.
 * - Does NOT execute scripts or resolve external links.
 * - Builds observed / normalized / inferred layers.
 */

export type EvStyle = 'Cutting' | 'Creasing' | 'Unknown' | string

export type Point = { x: number; y: number }

export type Seg = {
  kind: 'line' | 'path'
  style: EvStyle
  raw: Record<string, string>
  points: Point[] // local coords before parent transform
  world: Point[] // after parent transforms
  lengthUu: number
}

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number }

export type SvgNormalizeResult = {
  sampleId: string
  sourcePath: string
  observed: {
    widthAttr: number | null
    heightAttr: number | null
    viewBox: number[] | null
    hasScript: boolean
    hasExternalHref: boolean
    elementCounts: Record<string, number>
    rawSegmentCount: number
  }
  normalized: {
    segments: Array<{
      kind: string
      style: EvStyle
      world: Point[]
      lengthUu: number
    }>
    pageBounds: Bounds | null
    geometryBounds: Bounds | null
    cuttingCount: number
    creasingCount: number
    unknownStyleCount: number
  }
  inferred: {
    candidateMmPerUu: number | null
    candidateMmPerUuMethod: string | null
    panelHints: Array<{ name: string; lengthUu: number; lengthMmCandidate: number | null }>
    notes: string[]
    thickness: null
  }
}

type Mat = [number, number, number, number, number, number]

const IDENTITY: Mat = [1, 0, 0, 1, 0, 0]

function mul(a: Mat, b: Mat): Mat {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ]
}

function apply(m: Mat, p: Point): Point {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] }
}

function parseTransform(tr: string | undefined): Mat {
  if (!tr) return IDENTITY
  let m: Mat = IDENTITY
  const re = /(matrix|translate|scale|rotate)\s*\(([^)]*)\)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(tr))) {
    const kind = match[1]
    const nums = match[2]
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number)
    if (kind === 'matrix' && nums.length >= 6) {
      m = mul(m, [nums[0], nums[1], nums[2], nums[3], nums[4], nums[5]])
    } else if (kind === 'translate') {
      m = mul(m, [1, 0, 0, 1, nums[0] || 0, nums[1] || 0])
    } else if (kind === 'scale') {
      const sx = nums[0] ?? 1
      const sy = nums[1] ?? sx
      m = mul(m, [sx, 0, 0, sy, 0, 0])
    } else if (kind === 'rotate') {
      const ang = ((nums[0] || 0) * Math.PI) / 180
      const c = Math.cos(ang)
      const s = Math.sin(ang)
      const cx = nums[1] || 0
      const cy = nums[2] || 0
      m = mul(m, [1, 0, 0, 1, cx, cy])
      m = mul(m, [c, s, -s, c, 0, 0])
      m = mul(m, [1, 0, 0, 1, -cx, -cy])
    }
  }
  return m
}

function dist(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function polyLen(pts: Point[]) {
  let L = 0
  for (let i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i])
  return L
}

function boundsOf(pts: Point[]): Bounds | null {
  if (!pts.length) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pts) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {}
  const re = /([:\w-]+)\s*=\s*"([^"]*)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(tag))) out[m[1]] = m[2]
  return out
}

/** Very small path subset: M/L/H/V/Z absolute+relative polyline approx (curves sampled coarsely and flagged). */
function parsePathD(d: string): { points: Point[]; usedCurves: boolean } {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || []
  let i = 0
  let cmd = ''
  let x = 0
  let y = 0
  let sx = 0
  let sy = 0
  const pts: Point[] = []
  let usedCurves = false
  const push = (nx: number, ny: number) => {
    x = nx
    y = ny
    pts.push({ x, y })
  }
  const num = () => Number(tokens[i++])
  while (i < tokens.length) {
    const t = tokens[i]
    if (/[a-zA-Z]/.test(t)) {
      cmd = t
      i++
    }
    if (!cmd) break
    const lower = cmd.toLowerCase()
    const rel = cmd === lower
    if (lower === 'm') {
      const nx = (rel ? x : 0) + num()
      const ny = (rel ? y : 0) + num()
      push(nx, ny)
      sx = x
      sy = y
      cmd = rel ? 'l' : 'L'
    } else if (lower === 'l') {
      push((rel ? x : 0) + num(), (rel ? y : 0) + num())
    } else if (lower === 'h') {
      push((rel ? x : 0) + num(), y)
    } else if (lower === 'v') {
      push(x, (rel ? y : 0) + num())
    } else if (lower === 'z') {
      push(sx, sy)
    } else if (lower === 'c') {
      usedCurves = true
      // sample end point only + one mid sample (not sub-mm accurate for curves)
      const x1 = (rel ? x : 0) + num()
      const y1 = (rel ? y : 0) + num()
      const x2 = (rel ? x : 0) + num()
      const y2 = (rel ? y : 0) + num()
      const x3 = (rel ? x : 0) + num()
      const y3 = (rel ? y : 0) + num()
      pts.push({ x: (x + x1 + x2 + x3) / 4, y: (y + y1 + y2 + y3) / 4 })
      push(x3, y3)
    } else if (lower === 'q') {
      usedCurves = true
      num()
      num()
      push((rel ? x : 0) + num(), (rel ? y : 0) + num())
    } else {
      // unsupported command — skip one number if present
      if (i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) i++
    }
  }
  return { points: pts, usedCurves }
}

function stripDangerous(svg: string) {
  const hasScript = /<script[\s>]/i.test(svg)
  const hasExternalHref = /xlink:href\s*=\s*"https?:|href\s*=\s*"https?:/i.test(svg)
  // remove script blocks for safety before further regex work
  const cleaned = svg.replace(/<script[\s\S]*?<\/script>/gi, '<!--script-removed-->')
  return { cleaned, hasScript, hasExternalHref }
}

export function parseProductDimsFromName(name: string): { L: number; W: number; H: number } | null {
  const m = name.match(/(\d+)_(\d+)_(\d+)/) || name.match(/(\d+)x(\d+)x(\d+)/i)
  if (!m) return null
  return { L: Number(m[1]), W: Number(m[2]), H: Number(m[3]) }
}

export function normalizeSvg(svgText: string, sourcePath: string, sampleId: string): SvgNormalizeResult {
  const { cleaned, hasScript, hasExternalHref } = stripDangerous(svgText)
  const svgOpen = cleaned.match(/<svg\b[^>]*>/i)?.[0] || ''
  const root = attrs(svgOpen)
  const widthAttr = root.width ? Number(root.width) : null
  const heightAttr = root.height ? Number(root.height) : null
  const viewBox = root.viewBox
    ? root.viewBox
        .trim()
        .split(/[\s,]+/)
        .map(Number)
    : null

  const elementCounts: Record<string, number> = {}
  for (const tag of ['line', 'path', 'polyline', 'polygon', 'rect', 'g', 'circle']) {
    elementCounts[tag] = (cleaned.match(new RegExp(`<${tag}\\b`, 'gi')) || []).length
  }

  const segments: Seg[] = []
  const notes: string[] = []

  // walk with a simple stack of group transforms via sequential scan
  const stack: Mat[] = [IDENTITY]
  const tokenRe = /<\/?g\b[^>]*>|<line\b[^>]*\/?>|<path\b[^>]*\/?>/gi
  let tm: RegExpExecArray | null
  while ((tm = tokenRe.exec(cleaned))) {
    const tok = tm[0]
    if (/^<g\b/i.test(tok)) {
      const a = attrs(tok)
      stack.push(mul(stack[stack.length - 1], parseTransform(a.transform)))
    } else if (/^<\/g/i.test(tok)) {
      if (stack.length > 1) stack.pop()
    } else if (/^<line\b/i.test(tok)) {
      const a = attrs(tok)
      const p1 = { x: Number(a.x1), y: Number(a.y1) }
      const p2 = { x: Number(a.x2), y: Number(a.y2) }
      const mat = stack[stack.length - 1]
      const w1 = apply(mat, p1)
      const w2 = apply(mat, p2)
      const style = (a['ev-style'] || 'Unknown') as EvStyle
      segments.push({
        kind: 'line',
        style,
        raw: a,
        points: [p1, p2],
        world: [w1, w2],
        lengthUu: dist(w1, w2),
      })
    } else if (/^<path\b/i.test(tok)) {
      const a = attrs(tok)
      const parsed = parsePathD(a.d || '')
      if (parsed.usedCurves) notes.push('path_contains_curves_sampled_coarsely')
      const mat = stack[stack.length - 1]
      const world = parsed.points.map((p) => apply(mat, p))
      const style = (a['ev-style'] || 'Unknown') as EvStyle
      segments.push({
        kind: 'path',
        style,
        raw: a,
        points: parsed.points,
        world,
        lengthUu: polyLen(world),
      })
    }
  }

  const allPts = segments.flatMap((s) => s.world)
  const geometryBounds = boundsOf(allPts)
  const pageBounds =
    viewBox && viewBox.length === 4
      ? {
          minX: viewBox[0],
          minY: viewBox[1],
          maxX: viewBox[0] + viewBox[2],
          maxY: viewBox[1] + viewBox[3],
          width: viewBox[2],
          height: viewBox[3],
        }
      : widthAttr && heightAttr
        ? { minX: 0, minY: 0, maxX: widthAttr, maxY: heightAttr, width: widthAttr, height: heightAttr }
        : null

  const cutting = segments.filter((s) => s.style === 'Cutting')
  const creasing = segments.filter((s) => s.style === 'Creasing')
  const unknownStyleCount = segments.filter((s) => s.style !== 'Cutting' && s.style !== 'Creasing').length

  // Candidate unit: CSS px→mm = 25.4/96. Mark as candidate only; calibrate with known L panel spans if possible.
  const CSS_MM_PER_UU = 25.4 / 96
  const dims = parseProductDimsFromName(sampleId) || parseProductDimsFromName(sourcePath)
  const panelHints: SvgNormalizeResult['inferred']['panelHints'] = []
  let candidateMmPerUu: number | null = null
  let candidateMmPerUuMethod: string | null = null

  if (dims) {
    // among creasing horizontal segments, find lengths near L,W,H * scale
    const horiz = creasing
      .filter((s) => s.world.length >= 2 && Math.abs(s.world[0].y - s.world[1].y) < 1e-3)
      .map((s) => s.lengthUu)
      .sort((a, b) => b - a)
    const tryCal = (targetMm: number, label: string) => {
      for (const uu of horiz.slice(0, 12)) {
        if (uu < 10) continue
        const ratio = targetMm / uu
        // accept near CSS candidate or near 1:1 mm already
        if (Math.abs(ratio - CSS_MM_PER_UU) / CSS_MM_PER_UU < 0.02) {
          panelHints.push({ name: label, lengthUu: uu, lengthMmCandidate: uu * CSS_MM_PER_UU })
          return true
        }
      }
      return false
    }
    const hitL = tryCal(dims.L, 'crease_near_L')
    const hitW = tryCal(dims.W, 'crease_near_W')
    const hitH = tryCal(dims.H, 'crease_near_H')
    if (hitL || hitW || hitH) {
      candidateMmPerUu = CSS_MM_PER_UU
      candidateMmPerUuMethod = 'crease_span_matches_LWH_within_2pct_of_css_25.4/96'
    } else {
      candidateMmPerUu = CSS_MM_PER_UU
      candidateMmPerUuMethod = 'css_absolute_unit_candidate_unconfirmed_by_crease_match'
      notes.push('unit_calibration_weak_no_crease_span_near_LWH')
    }
  } else {
    candidateMmPerUu = CSS_MM_PER_UU
    candidateMmPerUuMethod = 'css_absolute_unit_candidate_no_dims_in_filename'
    notes.push('no_LWH_in_sample_id')
  }

  if (hasScript) notes.push('script_tags_present_stripped')
  if (hasExternalHref) notes.push('external_href_detected_not_fetched')

  return {
    sampleId,
    sourcePath,
    observed: {
      widthAttr: Number.isFinite(widthAttr as number) ? widthAttr : null,
      heightAttr: Number.isFinite(heightAttr as number) ? heightAttr : null,
      viewBox,
      hasScript,
      hasExternalHref,
      elementCounts,
      rawSegmentCount: segments.length,
    },
    normalized: {
      segments: segments.map((s) => ({
        kind: s.kind,
        style: s.style,
        world: s.world,
        lengthUu: s.lengthUu,
      })),
      pageBounds,
      geometryBounds,
      cuttingCount: cutting.length,
      creasingCount: creasing.length,
      unknownStyleCount,
    },
    inferred: {
      candidateMmPerUu,
      candidateMmPerUuMethod,
      panelHints,
      notes,
      thickness: null,
    },
  }
}
