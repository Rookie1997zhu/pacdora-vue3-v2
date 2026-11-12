/**
 * Packative Lab catalog adapter (P2).
 * Reads docs/packative_lab_catalog — not presets.js.
 */

import data from '../../docs/packative_lab_catalog/packative_catalog.json'

export const PACKATIVE_CATALOG = Object.freeze(data)

/** @typedef {{ template_id:string, title_zh:string, title_ko:string, L_mm:number, W_mm:number, H_mm:number, dimension_basis:string, validation_status:'validated'|'holdout'|'unvalidated'|string, rule_or_geom_version?:string, evidence_ref?:string, default_flag?:boolean, sample_group?:string, product_page?:string, cdn_template?:string, id?:string }} PackativeAsset */

/** @returns {PackativeAsset[]} */
export function listPackativeAssets() {
  const assets = Array.isArray(PACKATIVE_CATALOG.assets) ? PACKATIVE_CATALOG.assets : []
  return assets.map((row, i) => ({
    ...row,
    id: row.id || `${row.template_id}-${row.L_mm}x${row.W_mm}x${row.H_mm}-${i}`,
  }))
}

/** @returns {PackativeAsset|null} */
export function getDefaultPackativeAsset() {
  const list = listPackativeAssets()
  return list.find((r) => r.default_flag) || list.find((r) => r.validation_status === 'validated') || list[0] || null
}

/** @param {string} [query] */
export function searchPackativeAssets(query = '') {
  const q = String(query || '').trim().toLowerCase()
  const list = listPackativeAssets()
  if (!q) return list
  return list.filter((r) => {
    const hay = [
      r.template_id,
      r.title_zh,
      r.title_ko,
      r.validation_status,
      r.sample_group,
      `${r.L_mm}x${r.W_mm}x${r.H_mm}`,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
}

/**
 * Axis-aligned bounds from validated catalog rows only.
 * @returns {{ length:[number,number], width:[number,number], height:[number,number] }|null}
 */
export function validatedBounds() {
  const validated = listPackativeAssets().filter((r) => r.validation_status === 'validated')
  if (!validated.length) return null
  const Ls = validated.map((r) => Number(r.L_mm))
  const Ws = validated.map((r) => Number(r.W_mm))
  const Hs = validated.map((r) => Number(r.H_mm))
  return {
    length: [Math.min(...Ls), Math.max(...Ls)],
    width: [Math.min(...Ws), Math.max(...Ws)],
    height: [Math.min(...Hs), Math.max(...Hs)],
  }
}

function sizeKey(L, W, H) {
  return `${Number(L)}x${Number(W)}x${Number(H)}`
}

/**
 * Classify a size against catalog rows + validated AABB.
 * Exact holdout row wins; exact unvalidated row → unvalidated; inside AABB → validated; else unvalidated.
 * @returns {'validated'|'holdout'|'unvalidated'}
 */
export function classifySize(L, W, H) {
  const key = sizeKey(L, W, H)
  const list = listPackativeAssets()
  const exact = list.find((r) => sizeKey(r.L_mm, r.W_mm, r.H_mm) === key)
  if (exact) {
    if (exact.validation_status === 'holdout') return 'holdout'
    if (exact.validation_status === 'unvalidated') return 'unvalidated'
    if (exact.validation_status === 'validated') return 'validated'
  }
  const b = validatedBounds()
  if (!b) return 'unvalidated'
  const l = Number(L)
  const w = Number(W)
  const h = Number(H)
  if (
    Number.isFinite(l) &&
    Number.isFinite(w) &&
    Number.isFinite(h) &&
    l >= b.length[0] &&
    l <= b.length[1] &&
    w >= b.width[0] &&
    w <= b.width[1] &&
    h >= b.height[0] &&
    h <= b.height[1]
  ) {
    return 'validated'
  }
  return 'unvalidated'
}

/** @param {number} L @param {number} W @param {number} H */
export function isWithinValidatedBounds(L, W, H) {
  return classifySize(L, W, H) === 'validated'
}

/** @param {PackativeAsset|null|undefined} row */
export function canEnterPackativeRow(row) {
  if (!row) return false
  return row.validation_status === 'validated' || row.validation_status === 'holdout'
}
