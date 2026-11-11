import fs from 'node:fs'
import path from 'node:path'
import { generateCrashlockPartial, setFitCoeffs } from '../prototype/crashlock.ts'
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
      { a: fit.geomWidthUu.a, b: fit.geomWidthUu.b, c: fit.geomWidthUu.c, d: fit.geomWidthUu.d },
      { a: fit.geomHeightUu.a, b: fit.geomHeightUu.b, c: fit.geomHeightUu.c, d: fit.geomHeightUu.d },
    )
  }

  const sum = JSON.parse(fs.readFileSync(path.join(reportsDir, 'normalize-summaries.json'), 'utf8'))
  const holdout = (sum.samples as any[]).find(
    (s) => s.L === 200 && s.W === 150 && s.H === 100 && s.geomWidthUu != null && s.cuttingCount > 0,
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
    const proto = generateCrashlockPartial({ L: 200, W: 150, H: 100 })
    const errW = Math.abs(proto.widthUu - holdout.geomWidthUu)
    const errH = Math.abs(proto.heightUu - holdout.geomHeightUu)
    const passW = errW <= 25 // sparse-fit tolerance in uu (~6.6mm); documented, not hidden by rescale
    const passH = errH <= 25
    tests.push({
      id: 'holdout_envelope_width',
      kind: 'real_sample',
      status: passW ? 'passed' : 'failed',
      predicted_uu: proto.widthUu,
      observed_uu: holdout.geomWidthUu,
      abs_err_uu: errW,
      note: 'fixed_scale_no_rescaling; partial_prototype_envelope_only; holdout=200x150x100',
    })
    tests.push({
      id: 'holdout_envelope_height',
      kind: 'real_sample',
      status: passH ? 'passed' : 'failed',
      predicted_uu: proto.heightUu,
      observed_uu: holdout.geomHeightUu,
      abs_err_uu: errH,
      note: 'fixed_scale_no_rescaling; partial_prototype_envelope_only; holdout=200x150x100',
    })
    tests.push({
      id: 'holdout_full_crashlock_topology',
      kind: 'real_sample',
      status: 'not_run',
      reason: 'lock_bottom_geometry_not_implemented',
    })
  }

  // synthetic unit check (explicitly separated)
  const syn = generateCrashlockPartial({ L: 100, W: 80, H: 80 })
  tests.push({
    id: 'synthetic_svg_emits_ev_style',
    kind: 'synthetic',
    status: syn.svg.includes('ev-style="Cutting"') && syn.svg.includes('ev-style="Creasing"') ? 'passed' : 'failed',
  })

  const online = JSON.parse(fs.readFileSync(path.join(reportsDir, 'online-collect-log.json'), 'utf8'))
  const privacyHits = privacyScan(labRoot)

  const reportMd = `# Validation report (phase 4)

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
- Envelope width model: evaluated on frozen holdout \`200x150x100\` without rescaling.
- Envelope height: may fail holdout with sparse offline sizes — see test table (do not claim).
- Full crashlock structure: **not claimed**.
`

  fs.writeFileSync(path.join(reportsDir, 'validation-report.md'), reportMd)
  fs.writeFileSync(path.join(reportsDir, 'validation-results.json'), JSON.stringify({ generated_at: new Date().toISOString(), tests, privacyHits, online }, null, 2))

  const next = `# Next actions

1. Obtain additional offline single-variable SVG samples (L±10 / W±10 / H±10) — currently mostly multi-var cross-scale points.
2. If authorized later: enable live_collection only with explicit contract review; keep paid_actions=false.
3. Segment-level matching (not just envelope) for crease chains before claiming lock-bottom recovery.
4. EPS isolation parser experiment remains optional; do not use EPS BoundingBox as dieline size.
5. Independent physical/print check before any manufacturing claim.
`
  fs.writeFileSync(path.join(reportsDir, 'next-actions.md'), next)
  console.log('validate', tests.map((t) => `${t.id}:${t.status}`).join(', '))
  return tests
}

runValidate()
