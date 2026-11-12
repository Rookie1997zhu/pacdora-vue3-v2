import fs from 'node:fs'
import path from 'node:path'
import {
  BODY_BOTTOM_ARTIFACT_BAND_UU,
  classifyZeroCutting,
  cuttingCountBreakdown,
  isClassAMaxXBodyBottom,
} from '../geometry/degenerateClassify.ts'
import { type CompactSeg } from '../geometry/segmentMatch.ts'
import { parseProductDimsFromName } from '../normalize/svgParse.ts'
import { dataNormalized, dataRules, reportsDir } from '../paths.ts'

type NormDoc = {
  sampleId: string
  normalized: {
    cuttingCount: number
    cuttingCountRaw?: number
    cuttingZeroLength?: number
    cuttingExportArtifact?: number
    cuttingCollapsedLockShelf?: number
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
    const segs = doc.normalized.segments
    const bd = cuttingCountBreakdown(segs, doc.normalized.cuttingCountRaw ?? doc.normalized.cuttingCount)
    const zeros = segs.filter((s) => s.style === 'Cutting' && (s.lengthUu ?? 0) < NEAR_ZERO)
    const zeroDetails = zeros.map((s, i) => {
      const pt = s.p0 || s.p1 || { x: NaN, y: NaN }
      const kind =
        s.exportArtifact
          ? 'export_artifact_maxX_bodyBottom'
          : s.collapsedLockShelf
            ? 'collapsed_lock_shelf'
            : classifyZeroCutting(s, segs)
      return {
        indexHint: i,
        lengthUu: s.lengthUu,
        kind,
        exportArtifact: kind === 'export_artifact_maxX_bodyBottom',
        collapsedLockShelf: kind === 'collapsed_lock_shelf',
        p0: s.p0,
        p1: s.p1,
        at_maxX_bodyBottom: isClassAMaxXBodyBottom(pt, segs),
      }
    })
    const classA = zeroDetails.filter((z) => z.kind === 'export_artifact_maxX_bodyBottom').length
    const classB = zeroDetails.filter((z) => z.kind === 'collapsed_lock_shelf').length
    rows.push({
      sampleId: doc.sampleId,
      L,
      W,
      H,
      role: L === hL && W === hW && H === hH ? 'holdout' : 'other',
      cuttingCountRaw: bd.cuttingCountRaw,
      cuttingZeroLength: bd.cuttingZeroLength,
      cuttingExportArtifact: bd.cuttingExportArtifact,
      cuttingCollapsedLockShelf: bd.cuttingCollapsedLockShelf,
      cuttingStructural: bd.cuttingStructural,
      classA,
      classB,
      note: classB > 0 ? `collapsed_lock_shelf×${classB}` : classA > 0 ? `export_artifact×${classA}` : '',
      zeros: zeroDetails,
      allClassAAtMaxXBodyBottom: classA > 0 && zeroDetails.filter((z) => z.exportArtifact).every((z) => z.at_maxX_bodyBottom),
    })
  }

  const holdout = rows.find((r) => r.role === 'holdout')
  const sample55 = rows.find((r) => r.L === 55 && r.W === 55 && r.H === 75)
  const out = {
    generated_at: new Date().toISOString(),
    notes: [
      `Class A exportArtifact: zero-length at geom maxX ∩ bodyBottom±${BODY_BOTTOM_ARTIFACT_BAND_UU}uu band`,
      'Class B collapsedLockShelf: other zero-length (e.g. lock kink shelf collapse on 55x55x75)',
      'Structural cutting = raw − Class A only (Class B stays in structural count)',
      'Prototype deliberately does not emit Class A stubs; do not fake raw 63',
      `holdout_frozen=${holdoutKey}`,
    ],
    holdout_key: holdoutKey,
    summary: {
      sample_count: rows.length,
      holdout_raw: holdout?.cuttingCountRaw ?? null,
      holdout_zero: holdout?.cuttingZeroLength ?? null,
      holdout_export_artifact: holdout?.cuttingExportArtifact ?? null,
      holdout_collapsed_lock_shelf: holdout?.cuttingCollapsedLockShelf ?? null,
      holdout_structural: holdout?.cuttingStructural ?? null,
      holdout_classA_at_maxX_bodyBottom: holdout?.allClassAAtMaxXBodyBottom ?? null,
      sample_55_55_75: sample55
        ? {
            raw: sample55.cuttingCountRaw,
            zero: sample55.cuttingZeroLength,
            classA: sample55.classA,
            classB: sample55.classB,
            structural: sample55.cuttingStructural,
            note: sample55.note,
          }
        : null,
    },
    rows,
  }

  fs.mkdirSync(reportsDir, { recursive: true })
  fs.writeFileSync(path.join(reportsDir, 'degenerate-segments.json'), JSON.stringify(out, null, 2))

  const md = `# Degenerate Cutting segments (Class A / Class B)

## Holdout \`${holdoutKey}\`
- raw Cutting = **${holdout?.cuttingCountRaw ?? 'n/a'}**
- zero-length = **${holdout?.cuttingZeroLength ?? 'n/a'}** (Class A=${holdout?.classA ?? 'n/a'}, Class B=${holdout?.classB ?? 'n/a'})
- structural = **${holdout?.cuttingStructural ?? 'n/a'}** (= raw − Class A)
- Class A at geom maxX ∩ bodyBottom±${BODY_BOTTOM_ARTIFACT_BAND_UU}uu: **${holdout?.allClassAAtMaxXBodyBottom ? 'yes' : 'no/partial'}**

## Classification
- **Class A** \`exportArtifact\`: duplicate zero-length \`<line>\` at maxX ∩ body-bottom fold band — **not** structural
- **Class B** \`collapsedLockShelf\`: lock kink shelf collapsed to zero (seen on \`55×55×75\`) — kept in structural count
- Prototype omits Class A; does not emit stubs to fake raw 63

## \`55×55×75\`
${
  sample55
    ? `- raw=${sample55.cuttingCountRaw} zero=${sample55.cuttingZeroLength} ClassA=${sample55.classA} ClassB=${sample55.classB} structural=${sample55.cuttingStructural} (${sample55.note})`
    : '- sample missing'
}

## Rows
| sample | role | raw | zero | A | B | structural | note |
|---|---|---:|---:|---:|---:|---:|---|
${rows
  .map(
    (r) =>
      `| ${Number.isFinite(r.L) ? `${r.L}x${r.W}x${r.H}` : r.sampleId} | ${r.role} | ${r.cuttingCountRaw} | ${r.cuttingZeroLength} | ${r.classA} | ${r.classB} | ${r.cuttingStructural} | ${r.note || '—'} |`,
  )
  .join('\n')}
`
  fs.writeFileSync(path.join(reportsDir, 'degenerate-segments.md'), md)
  console.log(
    'inventory-degenerates',
    holdout
      ? `holdout raw=${holdout.cuttingCountRaw} A=${holdout.classA} B=${holdout.classB} structural=${holdout.cuttingStructural}`
      : 'holdout missing',
    sample55 ? `55: A=${sample55.classA} B=${sample55.classB} structural=${sample55.cuttingStructural}` : '',
    `rows=${rows.length}`,
  )
  return out
}

runInventoryDegenerates()
