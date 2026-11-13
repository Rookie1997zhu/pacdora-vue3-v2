/**
 * Engineering-domain registry for trusted (non-production) dieline export.
 * Domains live in ./domains/<templateId>-engineering-domain.json
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const cache = new Map()

function domainPath(templateId) {
  const safe = String(templateId || '').trim()
  return join(__dirname, 'domains', `${safe}-engineering-domain.json`)
}

/** Load domain JSON for templateId; null if no registered domain. */
export function loadEngineeringDomain(templateId) {
  const tid = String(templateId || '').trim()
  if (!tid) return null
  if (cache.has(tid)) return cache.get(tid)
  const path = domainPath(tid)
  if (!existsSync(path)) {
    cache.set(tid, null)
    return null
  }
  const doc = JSON.parse(readFileSync(path, 'utf8'))
  cache.set(tid, doc)
  return doc
}

/** @deprecated use loadEngineeringDomain('fefco-0201') */
export function loadFefco0201EngineeringDomain() {
  return loadEngineeringDomain('fefco-0201')
}

function inRange(n, range) {
  if (!Array.isArray(range) || range.length !== 2) return false
  return Number(n) >= Number(range[0]) && Number(n) <= Number(range[1])
}

/**
 * @param {object} input normalized geometry input ({ templateId, lengthMm, ... })
 * @param {object} [domain] optional preloaded domain
 * @returns {{ ok: boolean, code?: string, detail?: string|object }}
 */
export function checkEngineeringDomain(input, domain = null) {
  const tid = String(input?.templateId || '')
  const d = domain || loadEngineeringDomain(tid)
  if (!d) {
    return {
      ok: false,
      code: 'OUT_OF_ENGINEERING_DOMAIN',
      detail: `no engineering domain registered for template ${tid || '(empty)'}`,
    }
  }
  if (String(d.templateId || '') !== tid) {
    return {
      ok: false,
      code: 'OUT_OF_ENGINEERING_DOMAIN',
      detail: `domain templateId mismatch: file=${d.templateId} input=${tid}`,
    }
  }
  const sizeMode = String(input.sizeMode || 'inner')
  if (sizeMode !== (d.dimensionBasis || 'inner')) {
    return {
      ok: false,
      code: 'OUT_OF_ENGINEERING_DOMAIN',
      detail: `dimensionBasis must be ${d.dimensionBasis}, got ${sizeMode}`,
    }
  }
  const failures = []
  if (!inRange(input.lengthMm, d.lengthMm)) failures.push({ field: 'length_mm', range: d.lengthMm, value: input.lengthMm })
  if (!inRange(input.widthMm, d.widthMm)) failures.push({ field: 'width_mm', range: d.widthMm, value: input.widthMm })
  if (!inRange(input.heightMm, d.heightMm)) failures.push({ field: 'height_mm', range: d.heightMm, value: input.heightMm })
  if (!inRange(input.thicknessMm, d.thicknessMm)) {
    failures.push({ field: 'thickness_mm', range: d.thicknessMm, value: input.thicknessMm })
  }
  const materials = Array.isArray(d.materialIds) ? d.materialIds : ['kraft']
  if (!materials.includes(String(input.materialId || ''))) {
    failures.push({ field: 'material_id', allowed: materials, value: input.materialId })
  }
  const flutes = Array.isArray(d.fluteDirections) ? d.fluteDirections : ['L']
  if (!flutes.includes(String(input.fluteDirection || ''))) {
    failures.push({ field: 'flute_direction', allowed: flutes, value: input.fluteDirection })
  }
  if (failures.length) {
    return { ok: false, code: 'OUT_OF_ENGINEERING_DOMAIN', detail: { failures } }
  }
  return {
    ok: true,
    code: 'ENGINEERING_DOMAIN',
    detail: {
      qualificationStatus: d.qualificationStatus || 'engineering_review',
      compensationNote: d.compensationNote || '',
    },
  }
}

export function assertEngineeringDomain(input, domain = null) {
  const result = checkEngineeringDomain(input, domain)
  if (!result.ok) {
    const err = new Error(
      typeof result.detail === 'string'
        ? result.detail
        : `input outside ${input?.templateId || 'template'} engineering domain`,
    )
    err.code = result.code || 'OUT_OF_ENGINEERING_DOMAIN'
    err.detail = result.detail
    throw err
  }
  return result
}
