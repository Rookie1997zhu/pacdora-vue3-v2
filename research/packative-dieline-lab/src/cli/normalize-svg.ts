import fs from 'node:fs'
import path from 'node:path'
import { summarizeFeatures } from '../geometry/features.ts'
import { normalizeSvg, parseProductDimsFromName } from '../normalize/svgParse.ts'
import { dataNormalized, dataRaw, reportsDir } from '../paths.ts'

export function runNormalize() {
  const manifest = JSON.parse(fs.readFileSync(path.join(dataRaw, 'manifest.json'), 'utf8'))
  fs.mkdirSync(dataNormalized, { recursive: true })
  const summaries = []
  for (const it of manifest.items) {
    if (!it.name.endsWith('.svg') || !it.import_ok) continue
    const text = fs.readFileSync(it.abs_readonly, 'utf8')
    if (/AccessDenied/i.test(text)) {
      summaries.push({
        sampleId: it.sample_id,
        L: parseProductDimsFromName(it.name)?.L ?? null,
        W: parseProductDimsFromName(it.name)?.W ?? null,
        H: parseProductDimsFromName(it.name)?.H ?? null,
        cuttingCount: 0,
        creasingCount: 0,
        geomWidthUu: null,
        geomHeightUu: null,
        pageWidthUu: null,
        pageHeightUu: null,
        topCreaseLengthsUu: [],
        candidateMmPerUu: null,
        rejected: 'cdn_access_denied_stub',
      } as any)
      continue
    }
    const dims = parseProductDimsFromName(it.name)
    const doc = normalizeSvg(text, it.abs_readonly, it.sample_id)
    const outPath = path.join(dataNormalized, `${it.sample_id}.json`)
    // Store compact segments for size: keep lengths + style + endpoints only
    const compact = {
      ...doc,
      normalized: {
        ...doc.normalized,
        segments: doc.normalized.segments.map((s) => ({
          kind: s.kind,
          style: s.style,
          lengthUu: s.lengthUu,
          p0: s.world[0] || null,
          p1: s.world[s.world.length - 1] || null,
          pointCount: s.world.length,
        })),
      },
    }
    fs.writeFileSync(outPath, JSON.stringify(compact, null, 2))
    summaries.push(summarizeFeatures(doc, dims))
  }
  fs.writeFileSync(path.join(reportsDir, 'normalize-summaries.json'), JSON.stringify({ generated_at: new Date().toISOString(), samples: summaries }, null, 2))
  console.log('normalize-svg', summaries.length)
  return summaries
}

runNormalize()
