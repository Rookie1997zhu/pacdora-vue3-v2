import fs from 'node:fs'
import path from 'node:path'
import { generateCrashlockPartial, generateCrashlockWithLockBottom, setFitCoeffs } from '../prototype/crashlock.ts'
import { dataRules, labRoot, reportsDir } from '../paths.ts'

function privacyScan(root: string) {
  const hits: string[] = []
  const bad = /(authorization\s*:|cookie\s*:|x-tenant-key\s*[:=]|bearer\s+[a-z0-9._\-]+|eyJ[a-zA-Z0-9_-]{20,})/i
  const walk = (dir: string) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.name === 'node_modules' || ent.name === 'data' && false) continue
      const p = path.join(dir, ent.name)
      if (ent.isDirectory()) {
        if (ent.name === 'node_modules' || ent.name === 'private') continue
        walk(p)
      } else if (/\.(md|json|ts|svg|txt)$/i.test(ent.name)) {
        const t = fs.readFileSync(p, 'utf8')
        if (bad.test(t)) hits.push(path.relative(root, p))
      }
    }
  }
  walk(root)
  return hits
}

export function runValidate() {
  const fit = JSON.parse(fs.readFileSync(path.join(dataRules, 'fit-coeffs.json'), 'utf8'))
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

  const sum = JSON.parse(fs.readFileSync(path.join(reportsDir, 'normalize-summaries.json'), 'utf8'))
  const fitMeta = fs.existsSync(path.join(dataRules, 'fit-coeffs.json'))
    ? JSON.parse(fs.readFileSync(path.join(dataRules, 'fit-coeffs.json'), 'utf8'))
    : {}
  const holdoutKey: string = fitMeta.holdout_frozen || '200x150x100'
  const [hL, hW, hH] = holdoutKey.split('x').map(Number)
  const holdout = (sum.samples as any[]).find(
    (s) => s.L === hL && s.W === hW && s.H === hH && s.geomWidthUu != null && s.cuttingCount > 0,
  )
  const tests: Array<Record<string, unknown>> = []

  // Document stub issue
  const manifest = JSON.parse(fs.readFileSync(path.join(labRoot, 'data', 'raw', 'manifest.json'), 'utf8'))
  const stubItems = (manifest.items as any[]).filter((i) => String(i.import_reason || '').includes('access_denied'))
  tests.push({
    id: 'detect_access_denied_stubs',
    kind: 'real_sample',
    status: stubItems.length >= 1 ? 'passed' : 'failed',
    note: `excluded_non_dieline_xml stubs; count=${stubItems.length}`,
  })

  if (!holdout) {
    tests.push({ id: 'holdout_200_150_100', status: 'not_run', reason: 'holdout_sample_missing_or_invalid' })
  } else {
    const proto = generateCrashlockPartial({ L: hL, W: hW, H: hH })
    const errW = Math.abs(proto.widthUu - holdout.geomWidthUu)
    const errH = Math.abs(proto.heightUu - holdout.geomHeightUu)
    const passW = errW <= 25
    const passH = errH <= 25
    const modelW = fit.geomWidthUu?.model || proto.modelWidth || 'unknown'
    const modelH = fit.geomHeightUu?.model || proto.modelHeight || 'unknown'
    tests.push({
      id: 'holdout_envelope_width',
      kind: 'real_sample',
      status: passW ? 'passed' : 'failed',
      predicted_uu: proto.widthUu,
      observed_uu: holdout.geomWidthUu,
      abs_err_uu: errW,
      note: `model=${modelW}; holdout=${holdoutKey}; see envelope-diagnosis.md`,
    })
    tests.push({
      id: 'holdout_envelope_height',
      kind: 'real_sample',
      status: passH ? 'passed' : 'failed',
      predicted_uu: proto.heightUu,
      observed_uu: holdout.geomHeightUu,
      abs_err_uu: errH,
      note: `model=${modelH}; holdout=${holdoutKey}; see envelope-diagnosis.md`,
    })
    const segPath = path.join(reportsDir, 'segment-match.json')
    const seg = fs.existsSync(segPath) ? JSON.parse(fs.readFileSync(segPath, 'utf8')) : null
    const segPass = Boolean(seg?.gate?.passed)
    tests.push({
      id: 'crease_segment_correspondence',
      kind: 'real_sample',
      status: seg ? (segPass ? 'passed' : 'failed') : 'not_run',
      note: seg
        ? `min_matched=${seg.summary?.min_matched}; worst_norm=${Number(seg.summary?.worst_median_norm_pos_err).toFixed(4)}; worst_uu=${Number(seg.summary?.worst_median_endpoint_err_uu).toFixed(2)}; pairs=${seg.summary?.pair_count}`
        : 'segment-match.json missing — run match-segments',
    })
    const lockPath = path.join(reportsDir, 'lock-bottom-match.json')
    const lock = fs.existsSync(lockPath) ? JSON.parse(fs.readFileSync(lockPath, 'utf8')) : null
    const lockPass = Boolean(lock?.gate?.passed)
    tests.push({
      id: 'lock_bottom_cutting_correspondence',
      kind: 'real_sample',
      status: lock ? (lockPass ? 'passed' : 'failed') : 'not_run',
      note: lock
        ? `holdout=${lock.gate?.holdout}; matched=${lock.gate?.holdout_row?.matched}/${lock.gate?.holdout_row?.realCount}; medianNorm=${Number(lock.gate?.holdout_row?.medianNormPosErr ?? NaN).toFixed(4)}; curve_approx`
        : 'lock-bottom-match.json missing — run match-lock-bottom',
    })
    tests.push({
      id: 'holdout_full_crashlock_topology',
      kind: 'real_sample',
      status: 'blocked',
      reason: lockPass
        ? 'lock_bottom_partial_not_full_topology'
        : segPass
          ? 'lock_bottom_geometry_not_implemented'
          : 'blocked_until_crease_segment_correspondence_and_lock_bottom_impl',
    })
  }

  // synthetic unit check (explicitly separated)
  const synPartial = generateCrashlockPartial({ L: 100, W: 80, H: 80 })
  const synLock = generateCrashlockWithLockBottom({ L: 100, W: 80, H: 80 })
  tests.push({
    id: 'synthetic_svg_emits_ev_style',
    kind: 'synthetic',
    status:
      synPartial.svg.includes('ev-style="Cutting"') &&
      synPartial.svg.includes('ev-style="Creasing"') &&
      synLock.svg.includes('ev-style="Cutting"') &&
      synLock.svg.includes('ev-style="Creasing"') &&
      (synLock.cutting?.length || 0) >= 18 &&
      (synLock.creasing?.length || 0) === 14
        ? 'passed'
        : 'failed',
  })

  const online = JSON.parse(fs.readFileSync(path.join(reportsDir, 'online-collect-log.json'), 'utf8'))
  const ingest = fs.existsSync(path.join(reportsDir, 'offline-ingest-log.json'))
    ? JSON.parse(fs.readFileSync(path.join(reportsDir, 'offline-ingest-log.json'), 'utf8'))
    : null
  const privacyHits = privacyScan(labRoot)
  const segGate = fs.existsSync(path.join(reportsDir, 'segment-match.json'))
    ? JSON.parse(fs.readFileSync(path.join(reportsDir, 'segment-match.json'), 'utf8'))
    : null
  const lockGate = fs.existsSync(path.join(reportsDir, 'lock-bottom-match.json'))
    ? JSON.parse(fs.readFileSync(path.join(reportsDir, 'lock-bottom-match.json'), 'utf8'))
    : null

  const reportMd = `# Validation report (phase 4)

## Offline ingest
- new priority single-var OK: **${ingest?.new_priority_single_var_ok ?? 'n/a'}** (target ≥3)
- note: ${ingest?.note || 'n/a'}

## Online collection
- collected: **${online.collected}**
- ${online.message}

## Tests
| id | kind | status | detail |
|---|---|---|---|
${tests
  .map((t) => `| ${t.id} | ${t.kind || ''} | **${t.status}** | ${t.abs_err_uu != null ? `err=${Number(t.abs_err_uu).toFixed(3)} uu` : t.reason || t.note || ''} |`)
  .join('\n')}

## Privacy scan
- hits: ${privacyHits.length ? privacyHits.join(', ') : 'none'}

## Verdict
- Envelope models (\`${fit.geomWidthUu?.model || '?'}\` / \`${fit.geomHeightUu?.model || '?'}\`) on frozen holdout \`${holdoutKey}\` — see \`envelope-diagnosis.md\` (linear vs interaction).
- Creasing segment correspondence: **${segGate?.gate?.passed ? 'passed' : 'failed/not_run'}** (see segment-match.md).
- Lock-bottom cutting correspondence: **${lockGate?.gate?.passed ? 'passed' : 'failed/not_run'}** (see lock-bottom-match.md; curve_approx).
- Full crashlock topology: **blocked** (\`${tests.find((t) => t.id === 'holdout_full_crashlock_topology')?.reason || 'n/a'}\`) — partial lock slice ≠ 63/14.
`

  fs.writeFileSync(path.join(reportsDir, 'validation-report.md'), reportMd)
  fs.writeFileSync(
    path.join(reportsDir, 'validation-results.json'),
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        tests,
        privacyHits,
        online,
        ingest,
        segment_match_gate: segGate?.gate,
        lock_bottom_match_gate: lockGate?.gate,
      },
      null,
      2,
    ),
  )

  const next = `# Next actions

1. Holdout is \`${holdoutKey}\`; envelope width=${tests.find((t) => t.id === 'holdout_envelope_width')?.status}; height=${tests.find((t) => t.id === 'holdout_envelope_height')?.status}.
2. Lock-bottom first slice: **${lockGate?.gate?.passed ? 'gate passed' : 'gate failed / not_run'}** — see \`lock-bottom-match.md\`.
3. Full topology still **blocked** (\`lock_bottom_partial_not_full_topology\` when partial gate passes).
4. Next geometry slice: top dust flaps / tuck tongue / glue flap outer cuts (still not production).
5. Do not use EPS BoundingBox as dieline size; keep \`paid_actions=false\`.
`
  fs.writeFileSync(path.join(reportsDir, 'next-actions.md'), next)
  console.log('validate', tests.map((t) => `${t.id}:${t.status}`).join(', '))
  return tests
}

runValidate()
