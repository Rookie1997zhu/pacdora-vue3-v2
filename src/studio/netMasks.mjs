/** Shared bake / registration scale constants (mm → px). */
export const NET_PX_PER_MM = 4
export const NET_MAX_EDGE_PX = 1024
export const NET_POLARITY = 'white_printable'

function roundPt(n) {
  return Math.round(Number(n) * 1000) / 1000
}

function normalizeRing(points) {
  if (!Array.isArray(points) || points.length < 6) return null
  const out = []
  for (let i = 0; i < points.length; i += 2) {
    out.push(roundPt(points[i]), roundPt(points[i + 1]))
  }
  if (out.length >= 4) {
    const fx = out[0]
    const fy = out[1]
    const lx = out[out.length - 2]
    const ly = out[out.length - 1]
    if (fx !== lx || fy !== ly) out.push(fx, fy)
  }
  return out.length >= 6 ? out : null
}

function ringArea(points) {
  let a = 0
  const n = points.length
  for (let i = 0; i < n - 2; i += 2) {
    const x1 = points[i]
    const y1 = points[i + 1]
    const x2 = points[i + 2]
    const y2 = points[i + 3]
    a += x1 * y2 - x2 * y1
  }
  return Math.abs(a) / 2
}

function djb2Hex(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = (h * 33) ^ str.charCodeAt(i)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

/**
 * @param {import('./knifeAdapter').StudioKnife} knife
 * @param {string} geometryHash
 */
export function buildNetRegistration(knife, geometryHash) {
  const printableMask = []
  for (const face of knife.faces || []) {
    const ring = normalizeRing(face.points)
    if (ring) printableMask.push(ring)
  }

  const totalMask = []
  for (const path of knife.cutPaths || []) {
    const ring = normalizeRing(path.points)
    if (ring) totalMask.push(ring)
  }
  if (!totalMask.length && printableMask.length) {
    for (const ring of printableMask) totalMask.push([...ring])
  }

  let mainMask = []
  let bestArea = -1
  for (const face of knife.faces || []) {
    const ring = normalizeRing(face.points)
    if (!ring) continue
    const area = face.w * face.h || ringArea(ring)
    if (area > bestArea) {
      bestArea = area
      mainMask = [ring]
    }
  }
  if (!mainMask.length && printableMask.length) {
    mainMask = [[...printableMask[0]]]
  }

  const netBoundingBoxMm = {
    minX: roundPt(knife.minX),
    minY: roundPt(knife.minY),
    widthMm: roundPt(knife.widthMm),
    heightMm: roundPt(knife.heightMm),
  }

  const payload = JSON.stringify({
    bbox: netBoundingBoxMm,
    polarity: NET_POLARITY,
    total: totalMask,
    printable: printableMask,
    main: mainMask,
  })
  const maskHash = djb2Hex(payload)

  return {
    netBoundingBoxMm,
    pxPerMm: NET_PX_PER_MM,
    maxEdgePx: NET_MAX_EDGE_PX,
    polarity: NET_POLARITY,
    totalMask,
    printableMask,
    mainMask,
    geometryHash: String(geometryHash || ''),
    maskHash,
  }
}
