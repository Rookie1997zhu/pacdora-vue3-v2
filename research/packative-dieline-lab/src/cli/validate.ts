import fs from 'node:fs'
import path from 'node:path'
import {
  generateCrashlockPartial,
  generateCrashlockWithLockBottom,
  generateCrashlockWithOutline,
  generateCrashlockWithTopFlaps,
  setFitCoeffs,
} from '../prototype/crashlock.ts'
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
    const topPath = path.join(reportsDir, 'top-flap-match.json')
    const top = fs.existsSync(topPath) ? JSON.parse(fs.readFileSync(topPath, 'utf8')) : null
    const topPass = Boolean(top?.gate?.passed)
    tests.push({
      id: 'top_flap_cutting_correspondence',
      kind: 'real_sample',
      status: top ? (topPass ? 'passed' : 'failed') : 'not_run',
      note: top
        ? `holdout=${top.gate?.holdout}; matched=${top.gate?.holdout_row?.matched}/${top.gate?.holdout_row?.realCount}; medianNorm=${Number(top.gate?.holdout_row?.medianNormPosErr ?? NaN).toFixed(4)}; curve_approx`
        : 'top-flap-match.json missing — run match-top-flaps',
    })
    const outlinePath = path.join(reportsDir, 'body-outline-match.json')
    const outline = fs.existsSync(outlinePath) ? JSON.parse(fs.readFileSync(outlinePath, 'utf8')) : null
    const outlinePass = Boolean(outline?.gate?.passed)
    const outlineRow = outline?.gate?.holdout_row
    const outlineCurveExact = Boolean(outlineRow?.curve_exact ?? outline?.summary?.holdout_curve_exact)
    tests.push({
      id: 'body_outline_cutting_correspondence',
      kind: 'real_sample',
      status: outline ? (outlinePass ? 'passed' : 'failed') : 'not_run',
      note: outline
        ? `holdout=${outline.gate?.holdout}; matched=${outlineRow?.matched}/${outlineRow?.realCount}; medianNorm=${Number(outlineRow?.medianNormPosErr ?? NaN).toFixed(4)}; cubicPairs=${outlineRow?.cubicPairCount ?? '?'}; medianCubicNorm=${Number(outlineRow?.medianCubicNormErr ?? NaN).toFixed(4)}; ${outlineCurveExact ? 'curve_exact' : 'endpoint_only'}`
        : 'body-outline-match.json missing — run match-body-outline',
    })
    const structuralPath = path.join(reportsDir, 'structural-cutting-match.json')
    const structural = fs.existsSync(structuralPath) ? JSON.parse(fs.readFileSync(structuralPath, 'utf8')) : null
    const structuralPass = Boolean(structural?.gate?.passed)
    const structuralRow = structural?.gate?.holdout_row
    tests.push({
      id: 'structural_cutting_count_correspondence',
      kind: 'real_sample',
      status: structural ? (structuralPass ? 'passed' : 'failed') : 'not_run',
      note: structural
        ? `holdout=${structural.gate?.holdout}; realStructural=${structuralRow?.realStructural}; proto=${structuralRow?.protoCutting}; exportArtifact=${structuralRow?.realExportArtifact}; collapsedLockShelf=${structuralRow?.realCollapsedLockShelf ?? 0}`
        : 'structural-cutting-match.json missing — run match-structural-cutting',
    })
    tests.push({
      id: 'holdout_full_crashlock_topology',
      kind: 'real_sample',
      status: 'blocked',
      reason:
        lockPass && topPass && outlinePass && outlineCurveExact && structuralPass
          ? 'raw_63_includes_export_zero_length_artifacts_not_emitted'
          : lockPass && topPass && outlinePass && outlineCurveExact
            ? 'degenerate_segments_remain'
            : lockPass && topPass && outlinePass
              ? 'curve_approx_and_degenerate_segments_remain'
              : lockPass && topPass
                ? 'top_and_lock_partial_not_full_topology'
                : lockPass
                  ? 'lock_bottom_partial_not_full_topology'
                  : segPass
                    ? 'lock_bottom_geometry_not_implemented'
                    : 'blocked_until_crease_segment_correspondence_and_lock_bottom_impl',
    })
  }

  // synthetic unit check (explicitly separated)
  const synPartial = generateCrashlockPartial({ L: 100, W: 80, H: 80 })
  const synLock = generateCrashlockWithLockBottom({ L: 100, W: 80, H: 80 })
  const synTop = generateCrashlockWithTopFlaps({ L: 100, W: 80, H: 80 })
  const synOutline = generateCrashlockWithOutline({ L: 100, W: 80, H: 80 })
  tests.push({
    id: 'synthetic_svg_emits_ev_style',
    kind: 'synthetic',
    status:
      synPartial.svg.includes('ev-style="Cutting"') &&
      synPartial.svg.includes('ev-style="Creasing"') &&
      synLock.svg.includes('ev-style="Cutting"') &&
      synLock.svg.includes('ev-style="Creasing"') &&
      synTop.svg.includes('ev-style="Cutting"') &&
      synTop.svg.includes('ev-style="Creasing"') &&
      synOutline.svg.includes('ev-style="Cutting"') &&
      /C\s/.test(synOutline.svg) &&
      Boolean(synOutline.filletsExact) &&
      (synLock.cutting?.length || 0) >= 18 &&
      (synLock.creasing?.length || 0) === 14 &&
      (synTop.cutting?.length || 0) >= 40 &&
      (synTop.creasing?.length || 0) === 14 &&
      (synOutline.cutting?.length || 0) >= 50 &&
      (synOutline.creasing?.length || 0) === 14
        ? 'passed'
        : 'failed',
  })

  const synOutlineZero = generateCrashlockWithOutline({ L: 100, W: 80, H: 90, thicknessMm: 0, kerfMm: 0 })
  const synOutlineBare = generateCrashlockWithOutline({ L: 100, W: 80, H: 90 })
  const synOutlineThick = generateCrashlockWithOutline({ L: 100, W: 80, H: 90, thicknessMm: 1, kerfMm: 0.2 })
  const segsEqual = (a?: { lengthUu: number; p0: unknown; p1: unknown }[], b?: typeof a) => {
    if (!a || !b || a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (Math.abs(a[i].lengthUu - b[i].lengthUu) > 1e-9) return false
      const ap0 = a[i].p0 as { x: number; y: number } | null
      const bp0 = b[i].p0 as { x: number; y: number } | null
      const ap1 = a[i].p1 as { x: number; y: number } | null
      const bp1 = b[i].p1 as { x: number; y: number } | null
      if (!ap0 || !bp0 || !ap1 || !bp1) return false
      if (Math.abs(ap0.x - bp0.x) > 1e-9 || Math.abs(ap0.y - bp0.y) > 1e-9) return false
      if (Math.abs(ap1.x - bp1.x) > 1e-9 || Math.abs(ap1.y - bp1.y) > 1e-9) return false
    }
    return true
  }
  tests.push({
    id: 'material_hooks_identity_at_zero',
    kind: 'synthetic',
    status:
      synOutlineZero.svg === synOutlineBare.svg &&
      segsEqual(synOutlineZero.cutting, synOutlineBare.cutting) &&
      segsEqual(synOutlineZero.creasing, synOutlineBare.creasing) &&
      (synOutlineThick.layout?.yBodyTop ?? 0) > (synOutlineBare.layout?.yBodyTop ?? 0) &&
      (synOutlineThick.layout?.tipDepthMm ?? 0) > (synOutlineBare.layout?.tipDepthMm ?? 0)
        ? 'passed'
        : 'failed',
    note: 't=k=0 bit-identical to bare params; t>0/k>0 moves bodyExtraH/tip hooks',
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
  const topGate = fs.existsSync(path.join(reportsDir, 'top-flap-match.json'))
    ? JSON.parse(fs.readFileSync(path.join(reportsDir, 'top-flap-match.json'), 'utf8'))
    : null
  const outlineGate = fs.existsSync(path.join(reportsDir, 'body-outline-match.json'))
    ? JSON.parse(fs.readFileSync(path.join(reportsDir, 'body-outline-match.json'), 'utf8'))
    : null
  const structuralGate = fs.existsSync(path.join(reportsDir, 'structural-cutting-match.json'))
    ? JSON.parse(fs.readFileSync(path.join(reportsDir, 'structural-cutting-match.json'), 'utf8'))
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
- Top-flap / glue cutting correspondence: **${topGate?.gate?.passed ? 'passed' : 'failed/not_run'}** (see top-flap-match.md; curve_approx).
- Body-outline cutting correspondence: **${outlineGate?.gate?.passed ? 'passed' : 'failed/not_run'}** (see body-outline-match.md; endpoint + cubic residual).
- Structural cutting count: **${structuralGate?.gate?.passed ? 'passed' : 'failed/not_run'}** (see structural-cutting-match.md; expect 61).
- Full crashlock topology: **blocked** (\`${tests.find((t) => t.id === 'holdout_full_crashlock_topology')?.reason || 'n/a'}\`) — raw 63 includes export artifacts not emitted; not production.
- Research phase: **complete (structural)** — see \`PHASE-CLOSEOUT.md\` / \`DELIVERY.md\`.
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
        top_flap_match_gate: topGate?.gate,
        body_outline_match_gate: outlineGate?.gate,
        structural_cutting_match_gate: structuralGate?.gate,
      },
      null,
      2,
    ),
  )

  const next = `# Next actions

1. **Lab mainline closed** (structural crashlock research). Holdout \`${holdoutKey}\`; envelope width=${tests.find((t) => t.id === 'holdout_envelope_width')?.status}; height=${tests.find((t) => t.id === 'holdout_envelope_height')?.status}.
2. Gates — lock: **${lockGate?.gate?.passed ? 'passed' : 'fail/not_run'}**; top: **${topGate?.gate?.passed ? 'passed' : 'fail/not_run'}**; outline: **${outlineGate?.gate?.passed ? 'passed' : 'fail/not_run'}**; structural: **${structuralGate?.gate?.passed ? 'passed' : 'fail/not_run'}**.
3. Full topology remains **blocked** (\`raw_63_includes_export_zero_length_artifacts_not_emitted\`) — intentional; see \`PHASE-CLOSEOUT.md\`.
4. Thickness/kerf hooks exist as **unvalidated sensitivity** (see \`thickness-sensitivity.md\`); coefficients still unobserved. Optional later: BOXCRAFT production wiring — still not production.
5. Do not use EPS BoundingBox as dieline size; keep \`paid_actions=false\`; do not emit fake zero-length stubs.
`
  fs.writeFileSync(path.join(reportsDir, 'next-actions.md'), next)
  console.log('validate', tests.map((t) => `${t.id}:${t.status}`).join(', '))
  return tests
}

runValidate()
