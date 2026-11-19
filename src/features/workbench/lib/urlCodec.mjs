/**
 * Workbench URL state codec (scheme v1).
 * /workbench/:slug?l=&w=&h=&t=&m=&sm=&fd=&b=&p=&u=&v=
 */
const SIZE_MODE = { dm: 'manufacturing', id: 'inner', ed: 'outer' }
const SIZE_MODE_REV = { manufacturing: 'dm', inner: 'id', outer: 'ed' }

function num(v, fallback = null) {
  // A key missing from the URL means "same as the default" (encodeWorkbenchUrl omits those).
  // Number(null) and Number('') are 0, so they must not reach the conversion.
  if (v == null || String(v).trim() === '') return fallback
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

/**
 * @param {URLSearchParams|string|Record<string,string>} input
 * @param {{ defaults: object, limits?: object }} ctx
 */
export function decodeWorkbenchUrl(input, ctx = {}) {
  const sp = input instanceof URLSearchParams
    ? input
    : typeof input === 'string'
      ? new URLSearchParams(input.startsWith('?') ? input.slice(1) : input)
      : new URLSearchParams(input || {})
  const defaults = ctx.defaults || {}
  const limits = ctx.limits || {}
  const out = {
    lengthMm: clampDim(num(sp.get('l'), defaults.lengthMm), limits.length),
    widthMm: clampDim(num(sp.get('w'), defaults.widthMm), limits.width),
    heightMm: clampDim(num(sp.get('h'), defaults.heightMm), limits.height),
    thicknessMm: clampDim(num(sp.get('t'), defaults.thicknessMm), limits.thickness),
    materialId: sanitizeId(sp.get('m'), defaults.materialId || 'kraft'),
    sizeMode: SIZE_MODE[sp.get('sm')] || defaults.sizeMode || 'inner',
    fluteDirection: sp.get('fd') === 'W' ? 'W' : 'L',
    bleedInputMm: clampDim(num(sp.get('b'), defaults.bleedInputMm ?? 3), [0, 10]),
    advanced: parseAdvanced(sp.get('p')),
    displayUnit: sp.get('u') === 'in' ? 'in' : 'mm',
  }
  return out
}

/**
 * Only write keys that differ from defaults (clean share URLs).
 * @param {object} params
 * @param {object} defaults
 */
export function encodeWorkbenchUrl(params, defaults = {}) {
  const sp = new URLSearchParams()
  const put = (k, v, d) => {
    if (v == null || v === '') return
    if (d != null && String(v) === String(d)) return
    sp.set(k, String(v))
  }
  put('l', round3(params.lengthMm), round3(defaults.lengthMm))
  put('w', round3(params.widthMm), round3(defaults.widthMm))
  put('h', round3(params.heightMm), round3(defaults.heightMm))
  put('t', round3(params.thicknessMm), round3(defaults.thicknessMm))
  put('m', params.materialId, defaults.materialId)
  const sm = SIZE_MODE_REV[params.sizeMode] || 'id'
  const smDef = SIZE_MODE_REV[defaults.sizeMode] || 'id'
  put('sm', sm, smDef)
  put('fd', params.fluteDirection || 'L', defaults.fluteDirection || 'L')
  put('b', round3(params.bleedInputMm), round3(defaults.bleedInputMm ?? 3))
  const adv = params.advanced || {}
  const defAdv = defaults.advanced || {}
  const parts = []
  for (const [k, v] of Object.entries(adv)) {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(k)) continue
    if (defAdv[k] != null && Number(defAdv[k]) === Number(v)) continue
    if (!Number.isFinite(Number(v))) continue
    parts.push(`${k}:${round3(Number(v))}`)
  }
  if (parts.length) sp.set('p', parts.join(','))
  if (params.displayUnit === 'in') sp.set('u', 'in')
  sp.set('v', '1')
  return sp
}

function parseAdvanced(raw) {
  const out = {}
  if (!raw) return out
  for (const part of String(raw).split(',')) {
    const [k, v] = part.split(':')
    if (!k || !/^[A-Za-z][A-Za-z0-9_]*$/.test(k)) continue
    const n = Number(v)
    if (!Number.isFinite(n)) continue
    out[k] = n
  }
  return out
}

function sanitizeId(v, fallback) {
  const s = String(v || '').trim()
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(s)) return fallback
  return s
}

function clampDim(v, range) {
  if (v == null || !Number.isFinite(v)) return v
  if (!Array.isArray(range) || range.length < 2) return round3(v)
  return round3(Math.min(range[1], Math.max(range[0], v)))
}

function round3(n) {
  return Math.round(Number(n) * 1000) / 1000
}

export const URL_CODEC_VERSION = 1
