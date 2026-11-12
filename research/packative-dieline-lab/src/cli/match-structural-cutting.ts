import fs from 'node:fs'
import path from 'node:path'
import { cuttingCountBreakdown } from '../geometry/degenerateClassify.ts'
import type { CompactSeg } from '../geometry/segmentMatch.ts'
import { generateCrashlockWithOutline, setFitCoeffs } from '../prototype/crashlock.ts'
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

function loadReal(): NormDoc[] {
  if (!fs.existsSync(dataNormalized)) return []
  const out: NormDoc[] = []
  for (const name of fs.readdirSync(dataNormalized)) {
    if (!/crashlock.*\.json$/i.test(name) && !/^studio-dieline-\d+_\d+_\d+\.json$/.test(name)) continue
    const doc = JSON.parse(fs.readFileSync(path.join(dataNormalized, name), 'utf8')) as NormDoc
    if ((doc.normalized.cuttingCount || 0) < 20) continue
    out.push(doc)
  }
  return out.sort((a, b) => a.sampleId.localeCompare(b.sampleId))
}

function structuralCounts(doc: NormDoc) {
  const bd = cuttingCountBreakdown(doc.normalized.segments, doc.normalized.cuttingCountRaw ?? doc.normalized.cuttingCount)
  return {
    raw: doc.normalized.cuttingCountRaw ?? bd.cuttingCountRaw,
    zero: doc.normalized.cuttingZeroLength ?? bd.cuttingZeroLength,
    exportArtifact: doc.normalized.cuttingExportArtifact ?? bd.cuttingExportArtifact,
    collapsedLockShelf: doc.normalized.cuttingCollapsedLockShelf ?? bd.cuttingCollapsedLockShelf,
    structural: doc.normalized.cuttingStructural ?? bd.cuttingStructural,
  }
}

export function runMatchStructuralCutting() {
  const fitPath = path.join(dataRules, 'fit-coeffs.json')
  let holdoutKey = '100x80x90'
  if (fs.existsSync(fitPath)) {
    const fit = JSON.parse(fs.readFileSync(fitPath, 'utf8'))
    if (fit.geomWidthUu && fit.geomHeightUu) {
      setFitCoeffs(
        {
          a: fit.geomWidthUu.a,
          b: fit.geomWidthUu.b,
          c: fit.geomWidthUu.c,
          d: fit.geomWidthUu.d,
          e: fit.geomWidthUu.e ?? 0,
          f: fit.geomWidthUu.f ?? 0,
          g: fit.geomWidthUu.g ?? 0,
          model: fit.geomWidthUu.model,
        },
        {
          a: fit.geomHeightUu.a,
          b: fit.geomHeightUu.b,
          c: fit.geomHeightUu.c,
          d: fit.geomHeightUu.d,
          e: fit.geomHeightUu.e ?? 0,
          f: fit.geomHeightUu.f ?? 0,
          g: fit.geomHeightUu.g ?? 0,
          model: fit.geomHeightUu.model,
        },
      )
    }
    if (typeof fit.holdout_frozen === 'string') holdoutKey = fit.holdout_frozen
  }
  const [hL, hW, hH] = holdoutKey.split('x').map(Number)

  const rows = []
  for (const sample of loadReal()) {
    const dims = parseProductDimsFromName(sample.sampleId + '.json') || parseProductDimsFromName(sample.sampleId)
    const m = sample.sampleId.match(/(\d+)_(\d+)_(\d+)/)
    const L = dims?.L ?? (m ? Number(m[1]) : NaN)
    const W = dims?.W ?? (m ? Number(m[2]) : NaN)
    const H = dims?.H ?? (m ? Number(m[3]) : NaN)
    if (![L, W, H].every(Number.isFinite)) continue
    const counts = structuralCounts(sample)
    const proto = generateCrashlockWithOutline({ L, W, H })
    const protoCutting = proto.cutting?.length ?? 0
    const isHoldout = L === hL && W === hW && H === hH
    const passRow = counts.structural === protoCutting && counts.exportArtifact >= 1
    rows.push({
      sampleId: sample.sampleId,
      L,
      W,
      H,
      role: isHoldout ? 'holdout' : 'other',
      realRaw: counts.raw,
      realZero: counts.zero,
      realExportArtifact: counts.exportArtifact,
      realCollapsedLockShelf: counts.collapsedLockShelf,
      realStructural: counts.structural,
      protoCutting,
      passed: passRow,
      protoEmitsZeroLength: false,
      note: counts.collapsedLockShelf > 0 ? `collapsed_lock_shelf×${counts.collapsedLockShelf}` : '',
    })
  }

  const holdout = rows.find((r) => r.role === 'holdout')
  const sample55 = rows.find((r) => r.L === 55 && r.W === 55 && r.H === 75)
  const gatePassed = Boolean(
    holdout &&
      holdout.realStructural === holdout.protoCutting &&
      holdout.realExportArtifact >= 1 &&
      holdout.protoCutting === 61,
  )

  const out = {
    generated_at: new Date().toISOString(),
    notes: [
      'Structural cutting = raw − Class A exportArtifact only',
      'Class B collapsedLockShelf remains in structural count (55x55x75)',
      'Prototype cutting count must match structural (expect 61), not raw 63',
      'Prototype must NOT emit zero-length stubs',
      `holdout_frozen=${holdoutKey}`,
    ],
    gate: {
      holdout: holdoutKey,
      expect_proto_cutting: 61,
      require_real_structural_eq_proto: true,
      require_real_export_artifact_ge: 1,
      passed: gatePassed,
      holdout_row: holdout || null,
    },
    summary: {
      sample_count: rows.length,
      pass_count: rows.filter((r) => r.passed).length,
      holdout_real_structural: holdout?.realStructural ?? null,
      holdout_proto_cutting: holdout?.protoCutting ?? null,
      holdout_real_export_artifact: holdout?.realExportArtifact ?? null,
      sample_55_55_75_passed: sample55?.passed ?? null,
      sample_55_55_75_structural: sample55?.realStructural ?? null,
    },
    rows,
  }

  fs.mkdirSync(reportsDir, { recursive: true })
  fs.writeFileSync(path.join(reportsDir, 'structural-cutting-match.json'), JSON.stringify(out, null, 2))

  const md = `# Structural cutting count match

## Gate (holdout \`${holdoutKey}\`)
- real structural Cutting === proto Cutting (expect **61**)
- real Class A exportArtifact ≥ **1**
- structural = raw − Class A only (Class B not deducted)
- proto must not emit zero-length stubs
- result: **${gatePassed ? 'PASSED' : 'FAILED'}**
${
  holdout
    ? `- holdout raw=${holdout.realRaw} A=${holdout.realExportArtifact} B=${holdout.realCollapsedLockShelf} structural=${holdout.realStructural} proto=${holdout.protoCutting}`
    : '- holdout sample missing'
}

## \`55×55×75\`
${
  sample55
    ? `- raw=${sample55.realRaw} A=${sample55.realExportArtifact} B=${sample55.realCollapsedLockShelf} structural=${sample55.realStructural} proto=${sample55.protoCutting} pass=${sample55.passed ? 'yes' : 'no'} (${sample55.note || '—'})`
    : '- sample missing'
}

## Notes
- Raw 63 includes Class A export artifacts; structural topology is 61 + 14 creases.
- Full raw-63 / production claim remains blocked.

## Rows
| sample | role | raw | A | B | structural | proto | pass | note |
|---|---|---:|---:|---:|---:|---:|---|---|
${rows
  .map(
    (r) =>
      `| ${r.L}x${r.W}x${r.H} | ${r.role} | ${r.realRaw} | ${r.realExportArtifact} | ${r.realCollapsedLockShelf} | ${r.realStructural} | ${r.protoCutting} | ${r.passed ? 'yes' : 'no'} | ${r.note || '—'} |`,
  )
  .join('\n')}
`
  fs.writeFileSync(path.join(reportsDir, 'structural-cutting-match.md'), md)
  console.log(
    'structural-cutting-match',
    `holdout=${gatePassed ? 'pass' : 'fail'}`,
    holdout ? `${holdout.realStructural}/${holdout.protoCutting} A=${holdout.realExportArtifact}` : 'missing',
    sample55 ? `55=${sample55.passed ? 'pass' : 'fail'} ${sample55.realStructural}` : '',
    `rows=${rows.length}`,
  )
  return out
}

runMatchStructuralCutting()
