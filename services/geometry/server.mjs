import http from 'node:http'
import {fileURLToPath, pathToFileURL} from 'node:url'
import {dirname, join} from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..', '..')
const srcRoot = join(repoRoot, 'src')
const geomSchemaRoot = join(repoRoot, 'packages', 'geometry-schema')

const {createKnife} = await import(pathToFileURL(join(srcRoot, 'knife.js')).href)
const {TEMPLATES} = await import(pathToFileURL(join(srcRoot, 'templates', 'index.js')).href)
const {knifeFromPacdoraGeom} = await import(pathToFileURL(join(srcRoot, 'pacdoraGeomKnife.js')).href)
const {readFileSync, existsSync} = await import('node:fs')

// Fixed-snapshot products replay a captured reference dieline as is: `fixed-<num>` (shipping,
// legacy) or `fixed-<category>-<num>`. The geometry file ships with the image under public/.
const FIXED_TEMPLATE_RE = /^fixed-(?:(shipping|mailer|gift|square|folding|tray)-)?(\d+)$/
function fixedGeomFile(templateId) {
  const m = FIXED_TEMPLATE_RE.exec(templateId)
  if (!m) return null
  const file = join(repoRoot, 'public', `${m[1] || 'shipping'}-geom`, `${m[2]}.json`)
  return existsSync(file) ? {file, sourceNum: m[2]} : null
}
const {toDxf, toSvgDieline, toPdf, toAi} = await import(
  pathToFileURL(join(srcRoot, 'exportDieline.js')).href
)
const {
  geometryDocumentFromKnife,
  isTrustedUnit,
} = await import(pathToFileURL(join(geomSchemaRoot, 'geometryDocument.mjs')).href)
// Material profiles (kraft-250, flute-e, …) are what the workbench saves; the engine itself only
// knows kraft|white|blue. Unknown ids are passed through so strict mode still rejects them.
const {getMaterialProfile} = await import(
  pathToFileURL(join(repoRoot, 'packages', 'geometry-engine', 'materialProfiles.js')).href
)
const {
  assertEngineeringDomain,
  checkEngineeringDomain,
} = await import(pathToFileURL(join(geomSchemaRoot, 'engineeringDomain.mjs')).href)
const {
  choosePacking,
  computeOutboxSize,
  fitInFixedOutbox,
  packingStats,
  maxQuantityWithinLimits,
  DEFAULT_OUTBOX_GAP,
  DEFAULT_OUTBOX_THICKNESS,
  OUTBOX_TEMPLATE_ID,
} = await import(pathToFileURL(join(srcRoot, 'outbox.js')).href)

const PORT = Number(process.env.PORT || 3100)
const HOST = process.env.HOST || '0.0.0.0'
const MAX_BODY_BYTES = 256 * 1024
// Exports carry the design's artwork images (base64) so they can be drawn into the file
const MAX_EXPORT_BODY_BYTES = 64 * 1024 * 1024
const GEOMETRY_TIMEOUT_MS = 5_000

function readJson(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let totalBytes = 0
    let settled = false
    req.on('data', (chunk) => {
      if (settled) return
      totalBytes += chunk.length
      if (totalBytes > maxBytes) {
        settled = true
        chunks.length = 0
        const err = new Error(`request body exceeds ${Math.round(maxBytes / 1024)}KB`)
        err.code = 'BODY_TOO_LARGE'
        err.status = 413
        reject(err)
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (settled) return
      settled = true
      try {
        const raw = Buffer.concat(chunks).toString('utf8') || '{}'
        resolve(JSON.parse(raw))
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

function withGeometryTimeout(operation) {
  let timeoutId
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const err = new Error('geometry calculation timed out')
      err.code = 'GEOMETRY_TIMEOUT'
      err.status = 504
      reject(err)
    }, GEOMETRY_TIMEOUT_MS)
  })
  return Promise.race([Promise.resolve().then(operation), timeout]).finally(() => {
    clearTimeout(timeoutId)
  })
}

function send(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

function requireNumber(name, value) {
  const n = Number(value)
  if (!Number.isFinite(n)) {
    const err = new Error(`${name} must be a finite number`)
    err.code = 'INVALID_NUMBER'
    err.field = name
    throw err
  }
  return n
}

/** Normalize request body once for validate + export. */
function normalizeGeometryInput(body) {
  const templateId = String(body.template_id || body.templateId || '').trim()
  const fixed = templateId ? fixedGeomFile(templateId) : null
  if (!templateId || (!TEMPLATES[templateId] && !fixed)) {
    const err = new Error('unknown template_id')
    err.code = 'UNKNOWN_TEMPLATE'
    throw err
  }
  const lengthMm = requireNumber('length_mm', body.length_mm ?? body.lengthMm)
  const widthMm = requireNumber('width_mm', body.width_mm ?? body.widthMm)
  const heightMm = requireNumber('height_mm', body.height_mm ?? body.heightMm)
  const thicknessMm = requireNumber('thickness_mm', body.thickness_mm ?? body.thicknessMm ?? 1.5)
  const bleedMm = requireNumber('bleed_mm', body.bleed_mm ?? body.bleedMm ?? 3)
  const sizeMode = body.size_mode || body.sizeMode || 'inner'
  if (!['inner', 'outer', 'manufacturing'].includes(sizeMode)) {
    const err = new Error('size_mode must be inner|outer|manufacturing')
    err.code = 'INVALID_SIZE_MODE'
    throw err
  }
  const fluteDirection = body.flute_direction || body.fluteDirection || 'L'
  const rawMaterialId = body.material_id || body.materialId || 'kraft'
  const materialId = getMaterialProfile(rawMaterialId)?.engineMaterialId || rawMaterialId
  const params = body.params && typeof body.params === 'object' ? body.params : {}
  // Multi-piece templates (lid + base, inserts…): which piece to generate. Unknown ids are rejected.
  const pieceRaw = body.piece_id ?? body.pieceId ?? null
  const pieceId = pieceRaw == null || pieceRaw === '' ? null : String(pieceRaw)
  if (pieceId != null && !fixed) {
    const pieces = Array.isArray(TEMPLATES[templateId].pieces) ? TEMPLATES[templateId].pieces : []
    if (!pieces.some((p) => p.id === pieceId)) {
      const err = new Error('unknown piece_id')
      err.code = 'UNKNOWN_PIECE'
      err.field = 'piece_id'
      throw err
    }
  }
  const unitConfidence = String(body.unit_confidence || body.unitConfidence || 'trusted')
  const template = TEMPLATES[templateId] || {}
  const limits = template.limits || {}
  for (const [key, val, label] of [
    ['length', lengthMm, 'length_mm'],
    ['width', widthMm, 'width_mm'],
    ['height', heightMm, 'height_mm'],
  ]) {
    const range = limits[key]
    if (Array.isArray(range) && range.length === 2) {
      if (val < range[0] || val > range[1]) {
        const err = new Error(`${label} out of range [${range[0]}, ${range[1]}]`)
        err.code = 'OUT_OF_RANGE'
        err.field = label
        throw err
      }
    }
  }
  return {
    templateId,
    fixed,
    lengthMm,
    widthMm,
    heightMm,
    thicknessMm,
    bleedMm,
    sizeMode,
    fluteDirection,
    materialId,
    params,
    pieceId,
    unitConfidence,
    source: body.source || 'parametric',
    lockedSample: !!body.locked_sample || !!body.lockedSample,
    mmPerUnit: body.mm_per_unit ?? body.mmPerUnit ?? null,
    viewBox: body.viewBox || null,
    physicalWidthMm: body.physical_width_mm ?? body.physicalWidthMm ?? null,
    physicalHeightMm: body.physical_height_mm ?? body.physicalHeightMm ?? null,
    conversionLoss: body.conversion_loss || body.conversionLoss || [],
    templateVersion: body.template_version || body.templateVersion || '1',
  }
}

/** Single knife build shared by validate and export. */
function generateOnce(input) {
  if (input.fixed) {
    // Replay of the captured reference dieline (size is locked; all layers on one sheet)
    const raw = JSON.parse(readFileSync(input.fixed.file, 'utf8'))
    const knife = knifeFromPacdoraGeom(raw, {
      sourceNum: input.fixed.sourceNum,
      label: input.templateId,
      length: input.lengthMm,
      width: input.widthMm,
      height: input.heightMm,
      thickness: input.thicknessMm,
    })
    // Windows and hang holes are kept apart from the outline in the replay knife; exported files
    // need them on the cut layer.
    const holeCuts = (knife.holes || []).map((h) => h.pathCommands).filter((c) => Array.isArray(c) && c.length)
    if (holeCuts.length) {
      const trim = [...(knife.paths?.trim || []), ...holeCuts]
      knife.paths = {...knife.paths, trim}
      if (knife.layers?.trim) knife.layers = {...knife.layers, trim: {...knife.layers.trim, paths: trim}}
    }
    const doc = geometryDocumentFromKnife(knife, {...input, source: 'pacdora-geom', lockedSample: true})
    return {knife, doc, input}
  }
  const knife = createKnife({
    templateId: input.templateId,
    length: input.lengthMm,
    width: input.widthMm,
    height: input.heightMm,
    thickness: input.thicknessMm,
    bleed: input.bleedMm,
    sizeMode: input.sizeMode,
    fluteDirection: input.fluteDirection,
    materialId: input.materialId,
    params: input.params,
    piece: input.pieceId || undefined,
    strict: true,
  })
  if (knife.template !== input.templateId) {
    const err = new Error('template fallback refused')
    err.code = 'TEMPLATE_FALLBACK'
    throw err
  }
  const doc = geometryDocumentFromKnife(knife, input)
  return {knife, doc, input}
}

function resolveIntent(body) {
  const tier = String(body.quality_tier || body.qualityTier || '').trim().toLowerCase()
  const intent = String(body.intent || '').trim().toLowerCase()
  if (tier === 'engineering' || intent === 'engineering') return 'engineering'
  if (tier === 'manufacturing' || intent === 'manufacturing') return 'manufacturing'
  return tier || intent || 'validate'
}

function validateGeometry(body) {
  const input = normalizeGeometryInput(body)
  const intent = resolveIntent(body)
  let engineeringDomain = null
  if (intent === 'engineering') {
    engineeringDomain = checkEngineeringDomain(input)
    if (!engineeringDomain.ok) {
      const err = new Error(
        typeof engineeringDomain.detail === 'string'
          ? engineeringDomain.detail
          : 'input outside FEFCO 0201 engineering domain',
      )
      err.code = engineeringDomain.code || 'OUT_OF_ENGINEERING_DOMAIN'
      err.detail = engineeringDomain.detail
      throw err
    }
  }
  const {knife, doc} = generateOnce(input)
  const meta = knife.meta || {}
  return {
    ok: !!knife.validation?.ok,
    template_id: input.templateId,
    production_ready: !!knife.productionReady,
    manufacturing_ready: !!knife.manufacturingReady,
    cut_approx: !!meta.cutApprox,
    bleed_approx: !!meta.bleedApprox,
    cut_approx_reason: meta.cutApprox ? meta.cutApproxReason || null : null,
    face_count: Array.isArray(knife.faces) ? knife.faces.length : 0,
    sheet_mm: knife.sheet || null,
    dimensions: knife.dimensions || null,
    validation: knife.validation || null,
    stats: knife.stats ?? null,
    issues: knife.issues ?? null,
    geometry_hash: doc.canonicalHash,
    unit_confidence: doc.provenance?.unitConfidence || input.unitConfidence,
    unit_trusted: isTrustedUnit(doc.provenance?.unitConfidence || input.unitConfidence),
    geometry_document: doc,
    engineering_domain_ok: engineeringDomain ? !!engineeringDomain.ok : null,
    engineering_domain: engineeringDomain,
    intent,
  }
}

function solvePacking(body) {
  const inbox = body.inbox || {}
  const lengthMm = requireNumber('inbox.length_mm', inbox.length_mm ?? inbox.lengthMm ?? body.length_mm)
  const widthMm = requireNumber('inbox.width_mm', inbox.width_mm ?? inbox.widthMm ?? body.width_mm)
  const heightMm = requireNumber('inbox.height_mm', inbox.height_mm ?? inbox.heightMm ?? body.height_mm)
  const quantity = requireNumber('quantity', body.quantity ?? 1)
  if (!Number.isInteger(quantity) || quantity < 1) {
    const err = new Error('quantity must be positive integer')
    err.code = 'INVALID_QUANTITY'
    throw err
  }
  const sizingMode = body.sizing_mode || body.sizingMode || 'grow'
  const gaps = body.gaps_mm || body.gapsMm || DEFAULT_OUTBOX_GAP
  const thickness = requireNumber(
    'thickness_mm',
    body.thickness_mm ?? body.thicknessMm ?? DEFAULT_OUTBOX_THICKNESS,
  )
  const outer = {length: lengthMm, width: widthMm, height: heightMm}
  const manual = body.manual_layout || body.manualLayout || null
  const fixedInner = body.fixed_inner_mm || body.fixedInnerMm || null
  let packing
  let plan
  let error = null
  let hint = null
  if (sizingMode === 'fixed') {
    packing = fitInFixedOutbox(outer, fixedInner, gaps)
    if (!packing || packing.error) {
      error = packing?.error || 'noneFit'
      hint = {maxFit: maxQuantityWithinLimits(outer, gaps)}
      plan = null
    } else {
      plan = computeOutboxSize(outer, gaps, packing, {fixedInner})
    }
  } else {
    packing = choosePacking(outer, quantity, gaps, {manual})
    plan = computeOutboxSize(outer, gaps, packing)
    if (plan?.warnings?.includes('overLimit')) {
      error = 'overLimit'
      hint = {maxFit: maxQuantityWithinLimits(outer, gaps), overflow: plan.overflow || null}
    }
  }
  const stats = plan && !error ? packingStats(outer, packing?.quantity || quantity, plan) : null
  return {
    algorithm_version: 'boxcraft.outbox.v1',
    outbox_template_id: OUTBOX_TEMPLATE_ID,
    thickness_mm: thickness,
    packing,
    plan,
    stats,
    error,
    hint,
  }
}

async function exportDieline(body) {
  const format = String(body.format || '').trim().toLowerCase()
  if (!['svg', 'dxf', 'pdf', 'ai'].includes(format)) {
    const err = new Error('format must be svg|dxf|pdf|ai')
    err.code = 'INVALID_FORMAT'
    throw err
  }
  const qualityTier = String(body.quality_tier || body.qualityTier || '').trim().toLowerCase()
  const input = normalizeGeometryInput(body)
  if (qualityTier === 'engineering') {
    assertEngineeringDomain(input)
  }
  const {knife, doc} = generateOnce(input)
  const validated = {
    ok: !!knife.validation?.ok,
    template_id: input.templateId,
    geometry_hash: doc.canonicalHash,
    unit_confidence: doc.provenance?.unitConfidence || input.unitConfidence,
    unit_trusted: isTrustedUnit(doc.provenance?.unitConfidence || input.unitConfidence),
  }
  if (qualityTier === 'manufacturing' || qualityTier === 'engineering') {
    if (!validated.ok) {
      const err = new Error('geometry validation failed')
      err.code = 'GEOMETRY_INVALID'
      throw err
    }
    if (!validated.unit_trusted) {
      const err = new Error('unit not trusted for engineering/manufacturing export')
      err.code = 'UNIT_UNTRUSTED'
      throw err
    }
    if (knife.meta?.cutApprox || knife.meta?.bleedApprox) {
      const err = new Error('approximate geometry cannot be engineering/manufacturing-exported')
      err.code = 'GEOMETRY_APPROX'
      throw err
    }
  }
  const base = `${input.templateId}-${input.lengthMm}x${input.widthMm}x${input.heightMm}`
  const options = normalizeExportOptions(body.options)
  // Artwork placed in the design editor. DXF is a cutting file and stays line-only.
  const artwork = body.artwork && typeof body.artwork === 'object' && !Array.isArray(body.artwork) ? body.artwork : null
  const artworkImages = body.artwork_images && typeof body.artwork_images === 'object' ? body.artwork_images : {}
  const artworkWarnings = Array.isArray(body.artwork_warnings) ? body.artwork_warnings.map(String) : []
  const drawArtwork = !!artwork && format !== 'dxf'
  const exportOpts = {
    qualityTier: qualityTier || 'vector_proof',
    includeDims: options.showDimensions ?? true,
    ...options,
    ...(drawArtwork ? {artwork, artworkImages, artworkWarnings} : {}),
  }
  let mime
  let filename
  let bytes
  let physicalMm = false
  if (format === 'svg') {
    mime = 'image/svg+xml'
    filename = `${base}.svg`
    const svg = toSvgDieline(knife, exportOpts)
    bytes = Buffer.from(svg, 'utf8')
    physicalMm =
      (qualityTier === 'manufacturing' || qualityTier === 'engineering') &&
      /width="[\d.]+mm"/i.test(svg)
  } else if (format === 'dxf') {
    mime = 'application/dxf'
    filename = `${base}.dxf`
    bytes = Buffer.from(toDxf(knife, exportOpts), 'utf8')
    physicalMm = true
  } else if (format === 'pdf') {
    mime = 'application/pdf'
    filename = `${base}.pdf`
    const u8 = await toPdf(knife, exportOpts)
    bytes = Buffer.from(u8)
    physicalMm = false
  } else {
    mime = 'application/pdf'
    filename = `${base}.ai`
    const u8 = await toAi(knife, exportOpts)
    bytes = Buffer.from(u8)
    physicalMm = false
  }
  const meta = knife.meta || {}
  const disclaimer =
    qualityTier === 'engineering'
      ? 'ENGINEERING CANDIDATE · COMPENSATION UNVERIFIED · NOT FOR PRODUCTION DIE'
      : qualityTier === 'manufacturing'
        ? 'TEMPLATE_APPROVED · NOT A LICENSED PRODUCTION DIE'
        : 'DEMO · NOT FOR DIE CUTTING · PROOF ONLY'
  return {
    mime,
    filename,
    content_base64: bytes.toString('base64'),
    preflight: {
      manufacturing_ready: false,
      production_ready: !!knife.productionReady,
      cut_approx: !!meta.cutApprox,
      bleed_approx: !!meta.bleedApprox,
      cut_approx_reason: meta.cutApprox ? meta.cutApproxReason || null : null,
      disclaimer,
      physical_mm: physicalMm,
      geometry_hash: doc.canonicalHash,
      unit_confidence: validated.unit_confidence,
      unit_trusted: validated.unit_trusted,
      format,
      quality_tier: qualityTier || null,
      exporter_version: 'boxcraft.export.v1',
      geometry_document_schema: doc.schema,
      qualification_status: qualityTier === 'engineering' ? 'engineering_review' : null,
      artwork_layers: Array.isArray(artwork?.layers) ? artwork.layers.length : 0,
      artwork_included: drawArtwork && Array.isArray(artwork?.layers) && artwork.layers.length > 0,
      artwork_warnings: [...new Set(artworkWarnings)].slice(0, 20),
    },
  }
}

function normalizeExportOptions(rawOptions) {
  if (!rawOptions || typeof rawOptions !== 'object' || Array.isArray(rawOptions)) return {}
  const options = {}
  for (const key of ['showDimensions', 'showBleed', 'showFaceNames', 'showTitleBlock']) {
    if (!(key in rawOptions)) continue
    if (typeof rawOptions[key] !== 'boolean') {
      const err = new Error(`options.${key} must be boolean`)
      err.code = 'INVALID_EXPORT_OPTION'
      err.field = `options.${key}`
      throw err
    }
    options[key] = rawOptions[key]
  }
  if ('displayUnit' in rawOptions) {
    if (!['mm', 'in'].includes(rawOptions.displayUnit)) {
      const err = new Error('options.displayUnit must be mm|in')
      err.code = 'INVALID_EXPORT_OPTION'
      err.field = 'options.displayUnit'
      throw err
    }
    options.displayUnit = rawOptions.displayUnit
  }
  if ('locale' in rawOptions) {
    if (!['zh-CN', 'ko-KR'].includes(rawOptions.locale)) {
      const err = new Error('options.locale must be zh-CN|ko-KR')
      err.code = 'INVALID_EXPORT_OPTION'
      err.field = 'options.locale'
      throw err
    }
    options.locale = rawOptions.locale
  }
  return options
}

function compactNumber(value) {
  const rounded = Math.round(value * 1000) / 1000
  return Object.is(rounded, -0) ? '0' : String(rounded)
}

function thumbnailPath(segments, minX, minY) {
  return segments
    .map(
      ({x1, y1, x2, y2}) =>
        `M${compactNumber(x1 - minX)} ${compactNumber(y1 - minY)}L${compactNumber(
          x2 - minX,
        )} ${compactNumber(y2 - minY)}`,
    )
    .join('')
}

function renderThumbnailSvg(knife) {
  const trim = Array.isArray(knife?.layers?.trim?.segments) ? knife.layers.trim.segments : []
  const crease = Array.isArray(knife?.layers?.crease?.segments) ? knife.layers.crease.segments : []
  const segments = [...trim, ...crease]
  if (!segments.length) {
    const err = new Error('thumbnail geometry has no trim or crease segments')
    err.code = 'GEOMETRY_INVALID'
    throw err
  }
  const xs = segments.flatMap(({x1, x2}) => [x1, x2])
  const ys = segments.flatMap(({y1, y2}) => [y1, y2])
  if (![...xs, ...ys].every(Number.isFinite)) {
    const err = new Error('thumbnail geometry contains invalid coordinates')
    err.code = 'GEOMETRY_INVALID'
    throw err
  }
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const width = Math.max(0, Math.max(...xs) - minX)
  const height = Math.max(0, Math.max(...ys) - minY)
  const trimPath = thumbnailPath(trim, minX, minY)
  const creasePath = thumbnailPath(crease, minX, minY)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${compactNumber(
    width,
  )} ${compactNumber(
    height,
  )}" fill="none"><path id="trim" d="${trimPath}" stroke="#2028b0"/><path id="crease" d="${creasePath}" stroke="#fa0000" stroke-dasharray="6 4"/></svg>`
}

function thumbnailGeometry(body) {
  const input = normalizeGeometryInput(body)
  const {knife} = generateOnce(input)
  const svg = renderThumbnailSvg(knife)
  return {
    svg,
    mime: 'image/svg+xml',
    byte_length: Buffer.byteLength(svg),
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      return send(res, 200, {ok: true, service: 'boxcraft-geometry'})
    }
    if (req.method === 'POST' && req.url === '/validate') {
      const body = await readJson(req)
      const data = await withGeometryTimeout(() => validateGeometry(body))
      return send(res, 200, {code: 'OK', data})
    }
    if (req.method === 'POST' && req.url === '/packing/solve') {
      const body = await readJson(req)
      const data = solvePacking(body)
      return send(res, 200, {code: 'OK', data})
    }
    if (req.method === 'POST' && req.url === '/export') {
      const body = await readJson(req, MAX_EXPORT_BODY_BYTES)
      const data = await withGeometryTimeout(() => exportDieline(body))
      return send(res, 200, {code: 'OK', data})
    }
    if (req.method === 'POST' && req.url === '/thumbnail') {
      const body = await readJson(req)
      const data = await withGeometryTimeout(() => thumbnailGeometry(body))
      return send(res, 200, {code: 'OK', data})
    }
    return send(res, 404, {code: 'NOT_FOUND', message: 'not found'})
  } catch (e) {
    const status = e.status || 400
    return send(res, status, {
      code: e.code || 'ERROR',
      message: e.message || 'error',
      field: e.field || null,
    })
  }
})

server.listen(PORT, HOST, () => {
  console.log(`geometry listening on ${HOST}:${PORT}`)
})
