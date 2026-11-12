import fs from 'node:fs'
import path from 'node:path'
import { ZERO_LENGTH_UU } from '../geometry/features.ts'
import { boundsFromSegs, type CompactSeg } from '../geometry/segmentMatch.ts'
import { inferBodyTopY } from '../geometry/topFlapFeatures.ts'
import { parseProductDimsFromName } from '../normalize/svgParse.ts'
import { dataNormalized, dataRules, reportsDir } from '../paths.ts'

type NormDoc = {
  sampleId: string
  normalized: {
    cuttingCount: number
    cuttingCountRaw?: number
    cuttingZeroLength?: number
    cuttingStructural?: number
    segments: CompactSeg[]
  }
}

const NEAR_ZERO = 0.1

function loadCrashlockDocs(): NormDoc[] {
  if (!fs.existsSync(dataNormalized)) return []
  const out: NormDoc[] = []
  for (const name of fs.readdirSync(dataNormalized)) {
    if (!/crashlock.*\.json$/i.test(name) && !/^studio-dieline-\d+_\d+_\d+\.json$/.test(name)) continue
    if (!name.endsWith('.json')) continue
    const doc = JSON.parse(fs.readFileSync(path.join(dataNormalized, name), 'utf8')) as NormDoc
    if ((doc.normalized.cuttingCount || 0) < 20) continue
    out.push(doc)
  }
  return out.sort((a, b) => a.sampleId.localeCompare(b.sampleId))
}

function atMaxXBodyTop(pt: { x: number; y: number }, segs: CompactSeg[]): boolean {
  const b = boundsFromSegs(segs)
  const bodyTopY = inferBodyTopY(segs)
  if (!b || bodyTopY == null) return false
  const epsX = Math.max(1, b.width * 0.002)
  const epsY = Math.max(1, b.height * 0.002)
  return Math.abs(pt.x - (b.minX + b.width)) <= epsX && Math.abs(pt.y - bodyTopY) <= epsY
}

export function runInventoryDegenerates() {
  const fitPath = path.join(dataRules, 'fit-coeffs.json')
  let holdoutKey = '100x80x90'
  if (fs.existsSync(fitPath)) {
    const fit = JSON.parse(fs.readFileSync(fitPath, 'utf8'))
    if (typeof fit.holdout_frozen === 'string') holdoutKey = fit.holdout_frozen
  }
  const [hL, hW, hH] = holdoutKey.split('x').map(Number)

  const rows = []
  for (const doc of loadCrashlockDocs()) {
    const dims = parseProductDimsFromName(doc.sampleId + '.json') || parseProductDimsFromName(doc.sampleId)
    const m = doc.sampleId.match(/(\d+)_(\d+)_(\d+)/)
    const L = dims?.L ?? (m ? Number(m[1]) : NaN)
    const W = dims?.W ?? (m ? Number(m[2]) : NaN)
    const H = dims?.H ?? (m ? Number(m[3]) : NaN)
    const cuts = doc.normalized.segments.filter((s) => s.style === 'Cutting')
    const zeros = cuts.filter((s) => (s.lengthUu ?? 0) < NEAR_ZERO)
    const cuttingCountRaw = doc.normalized.cuttingCountRaw ?? cuts.length
    const cuttingZeroLength = doc.normalized.cuttingZeroLength ?? zeros.length
    const cuttingStructural = doc.normalized.cuttingStructural ?? cuttingCountRaw - cuttingZeroLength
    const zeroDetails = zeros.map((s, i) => {
      const pt = s.p0 || s.p1 || { x: NaN, y: NaN }
      return {
        indexHint: i,
        lengthUu: s.lengthUu,
        exportArtifact: Boolean(s.exportArtifact || s.lengthUu < ZERO_LENGTH_UU),
        p0: s.p0,
        p1: s.p1,
        at_maxX_bodyTop: atMaxXBodyTop(pt, doc.normalized.segments),
      }
    })
    rows.push({
      sampleId: doc.sampleId,
      L,
      W,
      H,
      role: L === hL && W === hW && H === hH ? 'holdout' : 'other',
      cuttingCountRaw,
      cuttingZeroLength,
      cuttingStructural,
      zeros: zeroDetails,
      allZerosAtMaxXBodyTop: zeroDetails.length > 0 && zeroDetails.every((z) => z.at_maxX_bodyTop),
    })
  }

  const holdout = rows.find((r) => r.role === 'holdout')
  const out = {
    generated_at: new Date().toISOString(),
    notes: [
      'Zero-length Cutting segments are Packative SVG export artifacts',
      'Prototype deliberately does not emit them (structural cutting = raw − zero)',
      'Do not fake raw 63 by inserting stubs',
      `holdout_frozen=${holdoutKey}`,
    ],
    holdout_key: holdoutKey,
    summary: {
      sample_count: rows.length,
      holdout_raw: holdout?.cuttingCountRaw ?? null,
      holdout_zero: holdout?.cuttingZeroLength ?? null,
      holdout_structural: holdout?.cuttingStructural ?? null,
      holdout_zeros_at_maxX_bodyTop: holdout?.allZerosAtMaxXBodyTop ?? null,
    },
    rows,
  }

  fs.mkdirSync(reportsDir, { recursive: true })
  fs.writeFileSync(path.join(reportsDir, 'degenerate-segments.json'), JSON.stringify(out, null, 2))

  const md = `# Degenerate / export-artifact Cutting segments

## Holdout \`${holdoutKey}\`
- raw Cutting = **${holdout?.cuttingCountRaw ?? 'n/a'}**
- zero-length = **${holdout?.cuttingZeroLength ?? 'n/a'}**
- structural = **${holdout?.cuttingStructural ?? 'n/a'}**
- zeros at geom maxX ∩ body-top: **${holdout?.allZerosAtMaxXBodyTop ? 'yes' : 'no/partial'}**

## Classification
- These are **export artifacts** (duplicate zero-length \`<line>\`), not structural knife paths.
- Prototype omits them on purpose; raw 63 ≠ structural topology.

## Rows
| sample | role | raw | zero | structural | all@maxX∩bodyTop |
|---|---|---:|---:|---:|---|
${rows
  .map(
    (r) =>
      `| ${Number.isFinite(r.L) ? `${r.L}x${r.W}x${r.H}` : r.sampleId} | ${r.role} | ${r.cuttingCountRaw} | ${r.cuttingZeroLength} | ${r.cuttingStructural} | ${r.allZerosAtMaxXBodyTop ? 'yes' : 'no'} |`,
  )
  .join('\n')}
`
  fs.writeFileSync(path.join(reportsDir, 'degenerate-segments.md'), md)
  console.log(
    'inventory-degenerates',
    holdout
      ? `holdout raw=${holdout.cuttingCountRaw} zero=${holdout.cuttingZeroLength} structural=${holdout.cuttingStructural}`
      : 'holdout missing',
    `rows=${rows.length}`,
  )
  return out
}

runInventoryDegenerates()
