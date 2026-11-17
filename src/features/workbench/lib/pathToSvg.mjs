/** Convert knife segment lists / cmd arrays to SVG path `d`. */

export function segmentsToPath(segments = []) {
  return segments
    .map((e) => `M ${e.x1} ${e.y1} L ${e.x2} ${e.y2}`)
    .join(' ')
}

export function loopToPath(loop = []) {
  if (!loop.length) return ''
  let d = `M ${loop[0][0]} ${loop[0][1]}`
  for (let i = 1; i < loop.length; i++) d += ` L ${loop[i][0]} ${loop[i][1]}`
  return `${d} Z`
}

export function faceToPath(face) {
  if (Array.isArray(face?.outline) && face.outline.length >= 3) return loopToPath(face.outline)
  if (face?.x == null) return ''
  const { x, y, w, h } = face
  return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`
}

export function cmdsToPath(cmds = []) {
  const parts = []
  for (const c of cmds) {
    if (!c || !c.mtd) continue
    if (c.mtd === 'M' || c.mtd === 'L') parts.push(`${c.mtd} ${c.x} ${c.y}`)
    else if (c.mtd === 'A') {
      parts.push(`A ${c.rx || 0} ${c.ry || 0} ${c.xAxisRotation || 0} ${c.large || 0} ${c.sweep || 0} ${c.x} ${c.y}`)
    } else if (c.mtd === 'C') {
      parts.push(`C ${c.x1} ${c.y1} ${c.x2} ${c.y2} ${c.x} ${c.y}`)
    } else if (c.mtd === 'Z') parts.push('Z')
  }
  return parts.join(' ')
}
