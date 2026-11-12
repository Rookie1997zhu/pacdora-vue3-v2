import fs from 'node:fs'
import path from 'node:path'
import { applyMaterialHooks, DEFAULT_LOCK_PARAMS } from '../geometry/lockBottomFeatures.ts'
import {
  applyTopMaterialHooks,
  DEFAULT_TOP_PARAMS,
  tipDepthMm,
} from '../geometry/topFlapFeatures.ts'
import { generateCrashlockWithOutline, setFitCoeffs } from '../prototype/crashlock.ts'
import { dataRules, reportsDir } from '../paths.ts'

const THICKNESS_GRID = [0, 0.5, 1.0] as const
const KERF_GRID = [0, 0.2] as const

function loadFit() {
  const fitPath = path.join(dataRules, 'fit-coeffs.json')
  let holdoutKey = '100x80x90'
  if (!fs.existsSync(fitPath)) return { holdoutKey, L: 100, W: 80, H: 90 }
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
  const [L, W, H] = holdoutKey.split('x').map(Number)
  return { holdoutKey, L, W, H }
}

export function runThicknessSensitivity() {
  const { holdoutKey, L, W, H } = loadFit()
  const baseline = generateCrashlockWithOutline({ L, W, H, thicknessMm: 0, kerfMm: 0 })
  const baseCutting = baseline.cutting?.length ?? 0
  const baseCreasing = baseline.creasing?.length ?? 0
  const baseYBodyTop = baseline.layout?.yBodyTop ?? null
  const baseTip = baseline.layout?.tipDepthMm ?? null
  const baseTop = applyTopMaterialHooks(DEFAULT_TOP_PARAMS, 0, 0)
  const baseTopTipDepth = tipDepthMm(W, baseTop)

  const rows = []
  for (const thicknessMm of THICKNESS_GRID) {
    for (const kerfMm of KERF_GRID) {
      const proto = generateCrashlockWithOutline({ L, W, H, thicknessMm, kerfMm })
      const hooked = applyMaterialHooks(DEFAULT_LOCK_PARAMS, thicknessMm, kerfMm)
      const topHooked = applyTopMaterialHooks(DEFAULT_TOP_PARAMS, thicknessMm, kerfMm)
      const topTipDepth = tipDepthMm(W, topHooked)
      rows.push({
        thicknessMm,
        kerfMm,
        widthUu: proto.widthUu,
        heightUu: proto.heightUu,
        cutting: proto.cutting?.length ?? 0,
        creasing: proto.creasing?.length ?? 0,
        yBodyTopUu: proto.layout?.yBodyTop ?? null,
        tipDepthMm: proto.layout?.tipDepthMm ?? null,
        bodyExtraHMm: hooked.bodyExtraHMm,
        tipAddMm: hooked.tipAddMm,
        bigAddMm: hooked.bigAddMm,
        tuckOuterInsetMm: topHooked.tuckOuterInsetMm,
        tuckInnerInsetMm: topHooked.tuckInnerInsetMm,
        topTipAddMm: topHooked.tipAddMm,
        topTipDepthMm: topTipDepth,
        deltaCutting: (proto.cutting?.length ?? 0) - baseCutting,
        deltaCreasing: (proto.creasing?.length ?? 0) - baseCreasing,
        deltaYBodyTopUu: baseYBodyTop != null && proto.layout ? proto.layout.yBodyTop - baseYBodyTop : null,
        deltaTipDepthMm: baseTip != null && proto.layout ? proto.layout.tipDepthMm - baseTip : null,
        deltaTuckOuterInsetMm: topHooked.tuckOuterInsetMm - baseTop.tuckOuterInsetMm,
        deltaTuckInnerInsetMm: topHooked.tuckInnerInsetMm - baseTop.tuckInnerInsetMm,
        deltaTopTipAddMm: topHooked.tipAddMm - baseTop.tipAddMm,
        deltaTopTipDepthMm: topTipDepth - baseTopTipDepth,
        hooksActive: thicknessMm !== 0 || kerfMm !== 0,
        gaps: proto.gaps,
      })
    }
  }

  const identityRow = rows.find((r) => r.thicknessMm === 0 && r.kerfMm === 0)
  const out = {
    generated_at: new Date().toISOString(),
    notes: [
      'Research sensitivity catalog only — thickness/kerf coefficients are NOT fitted from samples',
      'All normalized samples still have inferred.thickness = null',
      't=0,k=0 must match default prototype (identity)',
      'Empirical bodyExtraHMm=0.5 competes with a hypothetical thicknessMm=0.5; equivalence is NOT proven',
      'Top tuck insets grow with thicknessMm; top tipAdd grows with kerfMm/2',
      `holdout=${holdoutKey}`,
    ],
    holdout: holdoutKey,
    dims: { L, W, H },
    competitive_explanations: [
      {
        claim: 'bodyExtraHMm=0.5 equals paper thickness compensation',
        status: 'rejected_unproven',
        note: 'Existing empirical constant; do not rename to thickness. Overlaps numerically with thicknessMm=0.5 hook but is a competing explanation only.',
      },
      {
        claim: 'sideBottomLiftMm=0.5 equals caliper',
        status: 'rejected_unproven',
        note: 'Not wired to thicknessMm in this slice; remains empirical.',
      },
      {
        claim: 'kerfMm half-applied to tipAdd/bigAdd is production kerf',
        status: 'unvalidated_hook',
        note: 'Conservative single-point research hook; not validated against cutter data.',
      },
      {
        claim: 'thicknessMm → tuckOuter/InnerInset equals fitted board clearance',
        status: 'unvalidated_hook',
        note: 'Sensitivity only; samples have no caliper. Does not touch dust/fillet/glue.',
      },
      {
        claim: 'kerfMm/2 → top tipAddMm equals production top tip kerf',
        status: 'unvalidated_hook',
        note: 'Mirrors lock half-kerf; unvalidated.',
      },
    ],
    identity: {
      thicknessMm: 0,
      kerfMm: 0,
      cutting: identityRow?.cutting ?? null,
      creasing: identityRow?.creasing ?? null,
      matches_baseline_counts:
        identityRow?.cutting === baseCutting && identityRow?.creasing === baseCreasing,
    },
    rows,
  }

  fs.mkdirSync(reportsDir, { recursive: true })
  fs.writeFileSync(path.join(reportsDir, 'thickness-sensitivity.json'), JSON.stringify(out, null, 2))

  const md = `# Thickness / kerf sensitivity (research)

## Scope
- Holdout \`${holdoutKey}\` (\`${L}×${W}×${H}\`)
- Lock: \`thicknessMm\` → \`bodyExtraHMm\`; \`kerfMm/2\` → lock \`tipAddMm\` + \`bigAddMm\`
- Top: \`thicknessMm\` → \`tuckOuter/InnerInsetMm\`; \`kerfMm/2\` → top \`tipAddMm\`
- **Not** a fitted paper-caliper rule; samples still \`thickness: null\`

## Identity (\`t=0,k=0\`)
- cutting=${identityRow?.cutting} creasing=${identityRow?.creasing}
- matches baseline counts: **${out.identity.matches_baseline_counts ? 'yes' : 'no'}**

## Competitive explanations
| claim | status |
|---|---|
${out.competitive_explanations.map((c) => `| ${c.claim} | ${c.status} |`).join('\n')}

## Grid
| t mm | k mm | cuts | ΔyBodyTop uu | ΔlockTip mm | tuckOut | tuckIn | topTipAdd | ΔtopTip mm |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${rows
  .map(
    (r) =>
      `| ${r.thicknessMm} | ${r.kerfMm} | ${r.cutting} | ${r.deltaYBodyTopUu == null ? '—' : r.deltaYBodyTopUu.toFixed(3)} | ${r.deltaTipDepthMm == null ? '—' : r.deltaTipDepthMm.toFixed(3)} | ${r.tuckOuterInsetMm.toFixed(2)} | ${r.tuckInnerInsetMm.toFixed(2)} | ${r.topTipAddMm.toFixed(2)} | ${r.deltaTopTipDepthMm.toFixed(3)} |`,
  )
  .join('\n')}

## Notes
- Dust / fillet / glue thickness hooks remain unwired.
- Do not treat this report as production kerf/caliper validation.
`
  fs.writeFileSync(path.join(reportsDir, 'thickness-sensitivity.md'), md)
  console.log(
    'thickness-sensitivity',
    holdoutKey,
    `rows=${rows.length}`,
    `identity=${out.identity.matches_baseline_counts ? 'ok' : 'FAIL'}`,
  )
  return out
}

runThicknessSensitivity()
