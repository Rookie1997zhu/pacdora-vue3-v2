import fs from 'node:fs'
import path from 'node:path'
import { generateCrashlockWithOutline, setFitCoeffs } from '../prototype/crashlock.ts'
import { buildBodyOutlineSegments } from '../geometry/bodyOutlineFeatures.ts'
import { matchBodyOutline } from '../geometry/bodyOutlineMatch.ts'
import type { CompactSeg } from '../geometry/segmentMatch.ts'
import { parseProductDimsFromName } from '../normalize/svgParse.ts'
import { dataNormalized, dataRules, reportsDir } from '../paths.ts'

type NormDoc = {
  sampleId: string
  normalized: {
    cuttingCount: number
    creasingCount: number
    segments: CompactSeg[]
  }
}

const TARGET_MATCHED = 8
const TARGET_REAL_LINES = 11
const NORM_LE = 0.06

function loadReal(): NormDoc[] {
  if (!fs.existsSync(dataNormalized)) return []
  const out: NormDoc[] = []
  for (const name of fs.readdirSync(dataNormalized)) {
    if (!/crashlock-\d+_\d+_\d+\.json$/.test(name)) continue
    const doc = JSON.parse(fs.readFileSync(path.join(dataNormalized, name), 'utf8')) as NormDoc
    if ((doc.normalized.cuttingCount || 0) < 20) continue
    out.push(doc)
  }
  return out.sort((a, b) => a.sampleId.localeCompare(b.sampleId))
}

export function runMatchBodyOutline() {
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

  const samples = loadReal()
  const rows = []
  for (const sample of samples) {
    const dims = parseProductDimsFromName(sample.sampleId + '.json') || parseProductDimsFromName(sample.sampleId)
    const m = sample.sampleId.match(/(\d+)_(\d+)_(\d+)/)
    const L = dims?.L ?? (m ? Number(m[1]) : NaN)
    const W = dims?.W ?? (m ? Number(m[2]) : NaN)
    const H = dims?.H ?? (m ? Number(m[3]) : NaN)
    if (![L, W, H].every(Number.isFinite)) continue
    const proto = generateCrashlockWithOutline({ L, W, H })
    // Outline cuts + creases only (creases needed for body Y). Exclude lock/top cuts so
    // big-flap fillet chords below bodyBottom are not reclassified into the lock filter.
    const outlineCuts = buildBodyOutlineSegments(proto.layout!).cutting
    const genSegs = [...outlineCuts, ...(proto.creasing || [])]
    const r = matchBodyOutline(genSegs, sample.normalized.segments, { L, W, H })
    const isHoldout = L === hL && W === hW && H === hH
    const isPressure = L === 120 && W === 90 && H === 60
    const passRow =
      r.matched >= TARGET_MATCHED &&
      r.realCount >= TARGET_REAL_LINES - 3 &&
      r.medianNormPosErr <= NORM_LE
    rows.push({
      sampleId: sample.sampleId,
      L,
      W,
      H,
      role: isHoldout ? 'holdout' : isPressure ? 'pressure' : 'train_or_other',
      matched: r.matched,
      genCount: r.genCount,
      realCount: r.realCount,
      matchRate: r.matchRate,
      medianNormPosErr: r.medianNormPosErr,
      medianEndpointErrUu: r.medianEndpointErrUu,
      maxNormPosErr: r.maxNormPosErr,
      unmatchedGen: r.unmatchedGen,
      unmatchedReal: r.unmatchedReal,
      passed: passRow,
      curve_approx: true,
      cutting_total_diag: proto.cutting?.length ?? 0,
    })
  }

  const holdout = rows.find((r) => r.role === 'holdout')
  const baseline = rows.find((r) => r.L === 100 && r.W === 80 && r.H === 80)
  const pressure = rows.find((r) => r.role === 'pressure')
  const gatePassed = Boolean(holdout?.passed)
  const counterexamples = rows.filter((r) => !r.passed && r.role !== 'pressure')

  const out = {
    generated_at: new Date().toISOString(),
    notes: [
      'Body-outline leftovers: right outer, L-bottom cut, micro bridge, fillet chords vs real (path→chord)',
      'curve_approx: path fillets matched as endpoint chords',
      'zero_length_degenerates excluded from gate',
      'full_63_count is diagnostic only',
      `holdout_frozen=${holdoutKey}`,
    ],
    gate: {
      holdout: holdoutKey,
      require_matched_ge: TARGET_MATCHED,
      expect_real_lines_about: TARGET_REAL_LINES,
      median_norm_pos_err_le: NORM_LE,
      passed: gatePassed,
      holdout_row: holdout || null,
    },
    summary: {
      sample_count: rows.length,
      pass_count: rows.filter((r) => r.passed).length,
      baseline_matched: baseline?.matched ?? null,
      holdout_matched: holdout?.matched ?? null,
      pressure_matched: pressure?.matched ?? null,
      holdout_cutting_total: holdout?.cutting_total_diag ?? null,
    },
    rows,
    counterexamples,
  }

  fs.mkdirSync(reportsDir, { recursive: true })
  fs.writeFileSync(path.join(reportsDir, 'body-outline-match.json'), JSON.stringify(out, null, 2))

  const md = `# Body-outline cutting match

## Gate (holdout \`${holdoutKey}\`)
- require matched ≥ **${TARGET_MATCHED}** / ~${TARGET_REAL_LINES} meaningful leftover lines
- median norm pos err ≤ **${NORM_LE}**
- result: **${gatePassed ? 'PASSED' : 'FAILED'}**
${holdout ? `- holdout matched=${holdout.matched}/${holdout.realCount} medianNorm=${holdout.medianNormPosErr.toFixed(4)} cuttingTotal=${holdout.cutting_total_diag}` : '- holdout sample missing'}

## Notes
- Parametric outline + fillet chords (\`curve_approx\`); zero-length omitted
- Full 63/14 topology still **not** claimed

## Rows
| sample | role | matched | real | medianNorm | pass |
|---|---|---:|---:|---:|---|
${rows
  .map(
    (r) =>
      `| ${r.L}x${r.W}x${r.H} | ${r.role} | ${r.matched} | ${r.realCount} | ${r.medianNormPosErr.toFixed(4)} | ${r.passed ? 'yes' : 'no'} |`,
  )
  .join('\n')}

## Counterexamples
${counterexamples.length ? counterexamples.map((c) => `- ${c.L}x${c.W}x${c.H}: matched=${c.matched} norm=${c.medianNormPosErr.toFixed(4)}`).join('\n') : '- none (excluding pressure row)'}
`
  fs.writeFileSync(path.join(reportsDir, 'body-outline-match.md'), md)
  console.log(
    'body-outline-match',
    `holdout=${gatePassed ? 'pass' : 'fail'}`,
    holdout ? `${holdout.matched}/${holdout.realCount}` : 'missing',
    `rows=${rows.length}`,
  )
  return out
}

runMatchBodyOutline()
