/** Offline/safe EPS header parser — reads BoundingBox only; does not execute PS. */

export type EpsNormalizeResult = {
  sampleId: string
  sourcePath: string
  observed: {
    creator: string | null
    title: string | null
    boundingBoxPt: [number, number, number, number] | null
    hiResBoundingBoxPt: [number, number, number, number] | null
    bytes: number
    headerPreview: string
  }
  normalized: {
    bboxWidthPt: number | null
    bboxHeightPt: number | null
    bboxWidthMm: number | null
    bboxHeightMm: number | null
  }
  inferred: {
    notes: string[]
    thickness: null
    layer: 'observed_bbox_not_cut_crease'
  }
}

function parseBox(line: string): [number, number, number, number] | null {
  const m = line.match(/([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/)
  if (!m) return null
  return [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])]
}

export function normalizeEps(buf: Buffer, sourcePath: string, sampleId: string): EpsNormalizeResult {
  // Binary EPS may start with C5 header; skip to ASCII if present
  let start = 0
  if (buf[0] === 0xc5 && buf.length > 32) {
    // DOS EPS preview header: offset at bytes 4..7 little-endian
    start = buf.readUInt32LE(4)
    if (start <= 0 || start >= buf.length) start = 0
  }
  const text = buf.subarray(start, Math.min(buf.length, start + 64_000)).toString('latin1')
  const lines = text.split(/\r?\n/).slice(0, 80)
  let creator: string | null = null
  let title: string | null = null
  let boundingBoxPt: [number, number, number, number] | null = null
  let hiRes: [number, number, number, number] | null = null
  for (const line of lines) {
    if (line.startsWith('%%Creator:')) creator = line.slice(10).trim()
    if (line.startsWith('%%Title:')) title = line.slice(8).trim()
    if (line.startsWith('%%BoundingBox:') && !line.includes('(atend)')) boundingBoxPt = parseBox(line)
    if (line.startsWith('%%HiResBoundingBox:')) hiRes = parseBox(line)
  }
  const box = hiRes || boundingBoxPt
  const widthPt = box ? box[2] - box[0] : null
  const heightPt = box ? box[3] - box[1] : null
  const PT_TO_MM = 25.4 / 72
  return {
    sampleId,
    sourcePath,
    observed: {
      creator,
      title,
      boundingBoxPt,
      hiResBoundingBoxPt: hiRes,
      bytes: buf.length,
      headerPreview: text.slice(0, 180),
    },
    normalized: {
      bboxWidthPt: widthPt,
      bboxHeightPt: heightPt,
      bboxWidthMm: widthPt != null ? widthPt * PT_TO_MM : null,
      bboxHeightMm: heightPt != null ? heightPt * PT_TO_MM : null,
    },
    inferred: {
      notes: [
        'eps_bbox_is_page_envelope_not_cut_path',
        'do_not_equate_bbox_to_dieline_cut_geometry',
        'no_ev-style_cutting_creasing_in_eps',
      ],
      thickness: null,
      layer: 'observed_bbox_not_cut_crease',
    },
  }
}
