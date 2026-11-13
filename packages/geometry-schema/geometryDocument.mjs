/**
 * boxcraft.geometry/v1 — thin GeometryDocument + canonical hash (Phase 1).
 * Runtime preview may still use knife.v3; engineering validate/export bind this document.
 */
import { createHash } from 'node:crypto'

export const GEOMETRY_SCHEMA = 'boxcraft.geometry/v1'
export const HASH_PREFIX = 'g1:'
export const GENERATOR_ID = 'boxcraft.createKnife'
export const GENERATOR_VERSION = '1.0.0'

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const keys = Object.keys(value).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`
}

/** Round geometry numbers for stable hash (0.001 mm). */
function roundMm(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return null
  return Math.round(x * 1000) / 1000
}

function summarizeLoop(loop, maxPts = 32) {
  if (!Array.isArray(loop) || !loop.length) return []
  const step = Math.max(1, Math.ceil(loop.length / maxPts))
  const out = []
  for (let i = 0; i < loop.length; i += step) {
    const p = loop[i]
    if (!p) continue
    out.push([roundMm(p[0]), roundMm(p[1])])
  }
  return out
}

function summarizeSegments(segs, max = 64) {
  if (!Array.isArray(segs)) return []
  return segs.slice(0, max).map((s) => ({
    x1: roundMm(s.x1),
    y1: roundMm(s.y1),
    x2: roundMm(s.x2),
    y2: roundMm(s.y2),
  }))
}

/**
 * Build GeometryDocument from a knife.v3 + normalized input.
 * @param {object} knife
 * @param {object} input normalized engineering input
 */
export function geometryDocumentFromKnife(knife, input = {}) {
  const templateId = String(input.templateId || knife?.template || '')
  const unitConfidence = String(input.unitConfidence || knife?.provenance?.unitConfidence || 'trusted')
  const panels = Array.isArray(knife?.faces)
    ? knife.faces.map((f) => ({
        id: f.name,
        parent: f.parent || null,
        side: f.side || null,
        x: roundMm(f.x),
        y: roundMm(f.y),
        w: roundMm(f.w),
        h: roundMm(f.h),
      }))
    : []
  const paths = {
    trim: summarizeSegments(knife?.layers?.trim?.segments),
    crease: summarizeSegments(knife?.layers?.crease?.segments),
    bleed: summarizeSegments(knife?.layers?.bleed?.segments),
    cutLoop: summarizeLoop(knife?.cutLoop),
  }
  const doc = {
    schema: GEOMETRY_SCHEMA,
    template: {
      templateId,
      templateVersion: String(input.templateVersion || knife?.templateInfo?.version || '1'),
      generatorId: GENERATOR_ID,
      generatorVersion: GENERATOR_VERSION,
    },
    input: {
      dimensionBasis: input.sizeMode || knife?.dimensions?.sizeMode || 'inner',
      lengthMm: roundMm(input.lengthMm ?? knife?.dimensions?.length),
      widthMm: roundMm(input.widthMm ?? knife?.dimensions?.width),
      heightMm: roundMm(input.heightMm ?? knife?.dimensions?.height),
      thicknessMm: roundMm(input.thicknessMm ?? knife?.dimensions?.thickness),
      bleedMm: roundMm(input.bleedMm ?? knife?.bleed),
      fluteDirection: input.fluteDirection || knife?.material?.fluteDirection || 'L',
      materialId: input.materialId || knife?.material?.id || 'kraft',
      params: input.params && typeof input.params === 'object' ? input.params : {},
    },
    coordinateSystem: {
      unit: 'mm',
      origin: 'svg-y-down',
      axis: 'right-handed',
      precisionMm: 0.001,
    },
    panels,
    paths,
    foldGraph: {
      hinges: Array.isArray(knife?.hinges)
        ? knife.hinges.map((h) => ({
            parent: h.parent,
            child: h.child,
            side: h.side,
            angle: roundMm(h.angle),
          }))
        : [],
      foldStageCount: Array.isArray(knife?.foldStages) ? knife.foldStages.length : 0,
    },
    provenance: {
      source: input.source || 'parametric',
      unitConfidence,
      lockedSample: !!input.lockedSample,
      conversionLoss: input.conversionLoss || [],
      mmPerUnit: input.mmPerUnit ?? null,
      viewBox: input.viewBox || null,
      physicalWidthMm: input.physicalWidthMm ?? null,
      physicalHeightMm: input.physicalHeightMm ?? null,
    },
    validation: {
      ok: !!knife?.validation?.ok,
      productionReady: !!knife?.productionReady,
      cutApprox: !!knife?.meta?.cutApprox,
      bleedApprox: !!knife?.meta?.bleedApprox,
      cutApproxReason: knife?.meta?.cutApproxReason || null,
      checks: knife?.validation?.checks || [],
    },
    meta: {
      faceCount: panels.length,
      bounds: knife?.bounds
        ? {
            minX: roundMm(knife.bounds.minX),
            minY: roundMm(knife.bounds.minY),
            maxX: roundMm(knife.bounds.maxX),
            maxY: roundMm(knife.bounds.maxY),
          }
        : null,
    },
  }
  doc.canonicalHash = canonicalHash(doc)
  return doc
}

/** Hash payload excludes canonicalHash itself. */
export function canonicalHash(doc) {
  const { canonicalHash: _drop, ...rest } = doc || {}
  const payload = stableStringify(rest)
  const digest = createHash('sha256').update(payload).digest('hex')
  return `${HASH_PREFIX}${digest}`
}

export function isTrustedUnit(confidence) {
  return String(confidence || '') === 'trusted'
}
