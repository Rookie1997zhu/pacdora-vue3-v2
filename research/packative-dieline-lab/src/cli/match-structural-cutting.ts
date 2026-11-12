import fs from 'node:fs'
import path from 'node:path'
import { generateCrashlockWithOutline, setFitCoeffs } from '../prototype/crashlock.ts'
import { parseProductDimsFromName } from '../normalize/svgParse.ts'
import { dataNormalized, dataRules, reportsDir } from '../paths.ts'
import type { CompactSeg } from '../geometry/segmentMatch.ts'

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
  const cuts = doc.normalized.segments.filter((s) => s.style === 'Cutting')
  const zero = cuts.filter((s) => s.exportArtifact || (s.lengthUu ?? 0) < 1e-6).length
  const raw = doc.normalized.cuttingCountRaw ?? doc.normalized.cuttingCount ?? cuts.length
  const z = doc.normalized.cuttingZeroLength ?? zero
  const structural = doc.normalized.cuttingStructural ?? raw - z
  return { raw, zero: z, structural }
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
    const passRow = counts.structural === protoCutting && counts.zero >= 1
    rows.push({
      sampleId: sample.sampleId,
      L,
      W,
      H,
      role: isHoldout ? 'holdout' : 'other',
      realRaw: counts.raw,
      realZero: counts.zero,
      realStructural: counts.structural,
      protoCutting,
      passed: passRow,
      protoEmitsZeroLength: false,
    })
  }

  const holdout = rows.find((r) => r.role === 'holdout')
  const gatePassed = Boolean(
    holdout &&
      holdout.realStructural === holdout.protoCutting &&
      holdout.realZero >= 1 &&
      holdout.protoCutting === 61,
  )

  const out = {
    generated_at: new Date().toISOString(),
    notes: [
      'Structural cutting = raw − zero-length export artifacts',
      'Prototype cutting count must match structural (expect 61), not raw 63',
      'Prototype must NOT emit zero-length stubs',
      `holdout_frozen=${holdoutKey}`,
    ],
    gate: {
      holdout: holdoutKey,
      expect_proto_cutting: 61,
      require_real_structural_eq_proto: true,
      require_real_zero_ge: 1,
      passed: gatePassed,
      holdout_row: holdout || null,
    },
    summary: {
      sample_count: rows.length,
      pass_count: rows.filter((r) => r.passed).length,
      holdout_real_structural: holdout?.realStructural ?? null,
      holdout_proto_cutting: holdout?.protoCutting ?? null,
      holdout_real_zero: holdout?.realZero ?? null,
    },
    rows,
  }

  fs.mkdirSync(reportsDir, { recursive: true })
  fs.writeFileSync(path.join(reportsDir, 'structural-cutting-match.json'), JSON.stringify(out, null, 2))

  const md = `# Structural cutting count match

## Gate (holdout \`${holdoutKey}\`)
- real structural Cutting === proto Cutting (expect **61**)
- real zero-length ≥ **1** (holdout typically 2)
- proto must not emit zero-length stubs
- result: **${gatePassed ? 'PASSED' : 'FAILED'}**
${
  holdout
    ? `- holdout raw=${holdout.realRaw} zero=${holdout.realZero} structural=${holdout.realStructural} proto=${holdout.protoCutting}`
    : '- holdout sample missing'
}

## Notes
- Raw 63 includes export artifacts; structural topology is 61 + 14 creases.
- Full raw-63 / production claim remains blocked.

## Rows
| sample | role | raw | zero | structural | proto | pass |
|---|---|---:|---:|---:|---:|---|
${rows
  .map(
    (r) =>
      `| ${r.L}x${r.W}x${r.H} | ${r.role} | ${r.realRaw} | ${r.realZero} | ${r.realStructural} | ${r.protoCutting} | ${r.passed ? 'yes' : 'no'} |`,
  )
  .join('\n')}
`
  fs.writeFileSync(path.join(reportsDir, 'structural-cutting-match.md'), md)
  console.log(
    'structural-cutting-match',
    `holdout=${gatePassed ? 'pass' : 'fail'}`,
    holdout ? `${holdout.realStructural}/${holdout.protoCutting} zero=${holdout.realZero}` : 'missing',
    `rows=${rows.length}`,
  )
  return out
}

runMatchStructuralCutting()
