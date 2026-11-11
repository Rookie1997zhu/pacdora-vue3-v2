import http from 'node:http'
import {fileURLToPath, pathToFileURL} from 'node:url'
import {dirname, join} from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..', '..')
const srcRoot = join(repoRoot, 'src')

const {createKnife} = await import(pathToFileURL(join(srcRoot, 'knife.js')).href)
const {TEMPLATES} = await import(pathToFileURL(join(srcRoot, 'templates', 'index.js')).href)
const {toDxf, toSvgDieline, toPdf} = await import(pathToFileURL(join(srcRoot, 'exportDieline.js')).href)
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

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
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

function validateGeometry(body) {
  const templateId = String(body.template_id || body.templateId || '').trim()
  if (!templateId || !TEMPLATES[templateId]) {
    const err = new Error('unknown template_id')
    err.code = 'UNKNOWN_TEMPLATE'
    throw err
  }
  const template = TEMPLATES[templateId]
  const lengthMm = requireNumber('length_mm', body.length_mm ?? body.lengthMm)
  const widthMm = requireNumber('width_mm', body.width_mm ?? body.widthMm)
  const heightMm = requireNumber('height_mm', body.height_mm ?? body.heightMm)
  const thicknessMm = requireNumber('thickness_mm', body.thickness_mm ?? body.thicknessMm ?? 1.5)
  const bleedMm = requireNumber('bleed_mm', body.bleed_mm ?? body.bleedMm ?? 3)
  const sizeMode = body.size_mode || body.sizeMode || 'inner'
  if (sizeMode !== 'inner' && sizeMode !== 'outer') {
    const err = new Error('size_mode must be inner|outer')
    err.code = 'INVALID_SIZE_MODE'
    throw err
  }
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
  const knife = createKnife({
    templateId,
    length: lengthMm,
    width: widthMm,
    height: heightMm,
    thickness: thicknessMm,
    bleed: bleedMm,
    sizeMode,
  })
  if (knife.template !== templateId) {
    const err = new Error('template fallback refused')
    err.code = 'TEMPLATE_FALLBACK'
    throw err
  }
  const meta = knife.meta || {}
  return {
    ok: !!knife.validation?.ok,
    template_id: templateId,
    production_ready: !!knife.productionReady,
    manufacturing_ready: !!knife.manufacturingReady,
    cut_approx: !!meta.cutApprox,
    bleed_approx: !!meta.bleedApprox,
    cut_approx_reason: meta.cutApprox ? (meta.cutApproxReason || null) : null,
    face_count: Array.isArray(knife.faces) ? knife.faces.length : 0,
    sheet_mm: knife.sheet || null,
    dimensions: knife.dimensions || null,
    validation: knife.validation || null,
    geometry_hash: `${templateId}:${lengthMm}x${widthMm}x${heightMm}:T${thicknessMm}:${sizeMode}`,
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
  if (!['svg', 'dxf', 'pdf'].includes(format)) {
    const err = new Error('format must be svg|dxf|pdf')
    err.code = 'INVALID_FORMAT'
    throw err
  }
  // Reuse validate gates (template/limits) then rebuild knife for layers.
  const validated = validateGeometry(body)
  const templateId = validated.template_id
  const lengthMm = requireNumber('length_mm', body.length_mm ?? body.lengthMm)
  const widthMm = requireNumber('width_mm', body.width_mm ?? body.widthMm)
  const heightMm = requireNumber('height_mm', body.height_mm ?? body.heightMm)
  const thicknessMm = requireNumber('thickness_mm', body.thickness_mm ?? body.thicknessMm ?? 1.5)
  const bleedMm = requireNumber('bleed_mm', body.bleed_mm ?? body.bleedMm ?? 3)
  const sizeMode = body.size_mode || body.sizeMode || 'inner'
  const knife = createKnife({
    templateId,
    length: lengthMm,
    width: widthMm,
    height: heightMm,
    thickness: thicknessMm,
    bleed: bleedMm,
    sizeMode,
    fluteDirection: body.flute_direction || body.fluteDirection || 'L',
    materialId: body.material_id || body.materialId || 'kraft',
    params: body.params || {},
  })
  const base = `${templateId}-${lengthMm}x${widthMm}x${heightMm}`
  let mime
  let filename
  let bytes
  if (format === 'svg') {
    mime = 'image/svg+xml'
    filename = `${base}.svg`
    bytes = Buffer.from(toSvgDieline(knife), 'utf8')
  } else if (format === 'dxf') {
    mime = 'application/dxf'
    filename = `${base}.dxf`
    bytes = Buffer.from(toDxf(knife), 'utf8')
  } else {
    mime = 'application/pdf'
    filename = `${base}.pdf`
    const u8 = await toPdf(knife)
    bytes = Buffer.from(u8)
  }
  const qualityTier = String(body.quality_tier || body.qualityTier || '').trim().toLowerCase()
  const meta = knife.meta || {}
  const disclaimer =
    qualityTier === 'manufacturing'
      ? 'TEMPLATE_APPROVED · NOT A LICENSED PRODUCTION DIE'
      : 'DEMO · NOT FOR DIE CUTTING'
  return {
    mime,
    filename,
    content_base64: bytes.toString('base64'),
    preflight: {
      manufacturing_ready: false,
      production_ready: !!knife.productionReady,
      cut_approx: !!meta.cutApprox,
      bleed_approx: !!meta.bleedApprox,
      cut_approx_reason: meta.cutApprox ? (meta.cutApproxReason || null) : null,
      disclaimer,
      physical_mm: format === 'dxf',
      geometry_hash: validated.geometry_hash,
      format,
      quality_tier: qualityTier || null,
      exporter_version: 'boxcraft.export.v1',
    },
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      return send(res, 200, {ok: true, service: 'boxcraft-geometry'})
    }
    if (req.method === 'POST' && req.url === '/validate') {
      const body = await readJson(req)
      const data = validateGeometry(body)
      return send(res, 200, {code: 'OK', data})
    }
    if (req.method === 'POST' && req.url === '/packing/solve') {
      const body = await readJson(req)
      const data = solvePacking(body)
      return send(res, 200, {code: 'OK', data})
    }
    if (req.method === 'POST' && req.url === '/export') {
      const body = await readJson(req)
      const data = await exportDieline(body)
      return send(res, 200, {code: 'OK', data})
    }
    return send(res, 404, {code: 'NOT_FOUND', message: 'not found'})
  } catch (e) {
    const status = e.code === 'UNKNOWN_TEMPLATE' || e.code === 'OUT_OF_RANGE' || e.code === 'INVALID_NUMBER'
      ? 400
      : 400
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
