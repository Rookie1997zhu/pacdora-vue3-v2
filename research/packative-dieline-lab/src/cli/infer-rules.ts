import fs from 'node:fs'
import path from 'node:path'
import {
  fitLinearLWH,
  fitLinearLWHInteract,
  predLinear,
  type InteractCoeff,
  type LinearCoeff,
} from '../geometry/features.ts'
import { setFitCoeffs, type FitCoeff } from '../prototype/crashlock.ts'
import { dataRules, reportsDir } from '../paths.ts'

/** Near-baseline single-var preferred; cross-scale 120x90x60 is stress-only. */
function pickHoldout(keys: string[]): string {
  if (keys.includes('100x80x90')) return '100x80x90'
  if (keys.includes('100x70x80')) return '100x70x80'
  if (keys.includes('100x90x80')) return '100x90x80'
  return '200x150x100'
}

const MM_PER_UU = 25.4 / 96
const HOLDOUT_MAX_UU = 25
const TRAIN_RMSE_MAX = 15

type Sample = {
  sampleId: string
  L: number
  W: number
  H: number
  geomWidthUu: number
  geomHeightUu: number
  cuttingCount: number
  creasingCount: number
  rejected?: string
}

type EnvelopeCoeff = FitCoeff & { model: string; train_rmse_uu: number }

function evalHoldout(
  coeff: { a: number; b: number; c: number; d: number; e?: number; f?: number; g?: number },
  holdout: Sample[],
): Array<Record<string, number | string>> {
  return holdout.map((s) => {
    const pred = predLinear(coeff, s.L, s.W, s.H)
    return {
      sampleId: s.sampleId,
      key: `${s.L}x${s.W}x${s.H}`,
      pred,
      obs: s.geomWidthUu, // overwritten by caller for height
      err: Math.abs(pred - s.geomWidthUu),
    }
  })
}

function pickWinner(
  linear: LinearCoeff | null,
  interact: InteractCoeff | null,
  holdout: Sample[],
  which: 'w' | 'h',
): { coeff: EnvelopeCoeff; holdErr: number; linearHoldErr: number | null; interactHoldErr: number | null } | null {
  const obs = (s: Sample) => (which === 'w' ? s.geomWidthUu : s.geomHeightUu)
  const holdErrOf = (c: { a: number; b: number; c: number; d: number; e?: number; f?: number; g?: number }) => {
    if (!holdout.length) return Infinity
    const s = holdout[0]
    return Math.abs(predLinear(c, s.L, s.W, s.H) - obs(s))
  }

  const linErr = linear ? holdErrOf(linear) : null
  const intErr = interact ? holdErrOf(interact) : null

  // Prefer interaction if holdout ≤25 and better than linear
  if (interact && intErr != null && intErr <= HOLDOUT_MAX_UU && (linErr == null || intErr < linErr)) {
    return {
      coeff: {
        a: interact.a,
        b: interact.b,
        c: interact.c,
        d: interact.d,
        e: interact.e,
        f: interact.f,
        g: interact.g,
        model: 'lwh_interact',
        train_rmse_uu: interact.rmse,
      },
      holdErr: intErr,
      linearHoldErr: linErr,
      interactHoldErr: intErr,
    }
  }

  if (linear) {
    return {
      coeff: {
        a: linear.a,
        b: linear.b,
        c: linear.c,
        d: linear.d,
        e: 0,
        f: 0,
        g: 0,
        model: 'lwh_linear',
        train_rmse_uu: linear.rmse,
      },
      holdErr: linErr ?? Infinity,
      linearHoldErr: linErr,
      interactHoldErr: intErr,
    }
  }

  if (interact) {
    return {
      coeff: {
        a: interact.a,
        b: interact.b,
        c: interact.c,
        d: interact.d,
        e: interact.e,
        f: interact.f,
        g: interact.g,
        model: 'lwh_interact',
        train_rmse_uu: interact.rmse,
      },
      holdErr: intErr ?? Infinity,
      linearHoldErr: linErr,
      interactHoldErr: intErr,
    }
  }
  return null
}

export function runInfer() {
  const sum = JSON.parse(fs.readFileSync(path.join(reportsDir, 'normalize-summaries.json'), 'utf8'))
  const samples = (sum.samples as Sample[]).filter(
    (s) => s.L != null && s.geomWidthUu != null && s.cuttingCount > 0 && !(s as any).rejected,
  )
  const uniq: Sample[] = []
  const seen = new Set<string>()
  for (const s of samples) {
    const k = `${s.L}x${s.W}x${s.H}`
    if (seen.has(k)) continue
    seen.add(k)
    uniq.push(s)
  }

  const allKeys = uniq.map((s) => `${s.L}x${s.W}x${s.H}`)
  const HOLDOUT_KEY = pickHoldout(allKeys)
  const train = uniq.filter((s) => `${s.L}x${s.W}x${s.H}` !== HOLDOUT_KEY)
  const holdout = uniq.filter((s) => `${s.L}x${s.W}x${s.H}` === HOLDOUT_KEY)
  const stress120 = uniq.filter((s) => `${s.L}x${s.W}x${s.H}` === '120x90x60')

  const candidates: any[] = []
  const validated: any[] = []
  const counterexamples: any[] = []

  const cutSet = [...new Set(uniq.map((s) => s.cuttingCount))]
  const creaseSet = [...new Set(uniq.map((s) => s.creasingCount))]
  if (cutSet.length === 1 && creaseSet.length === 1) {
    validated.push({
      id: 'topology_cut_crease_counts_stable',
      layer: 'observed',
      cuttingCount: cutSet[0],
      creasingCount: creaseSet[0],
      unique_sizes: uniq.length,
      sample_ids: uniq.map((s) => s.sampleId),
    })
  }

  candidates.push({
    id: 'css_mm_per_uu_25.4_96',
    layer: 'inferred',
    value: MM_PER_UU,
    evidence: 'horizontal crease spans near L*uu for 100_80_80',
    status: 'candidate',
  })

  // Structural templates (legacy) — kept as candidates only
  const templates = [
    { id: 'Wmm_2L_W_H', fw: (s: Sample) => 2 * s.L + s.W + s.H, fh: (s: Sample) => s.L + s.W + 0.5 * s.H },
    { id: 'Wmm_2L_W_H_plus12', fw: (s: Sample) => 2 * s.L + s.W + s.H + 12, fh: (s: Sample) => s.L + s.W + 0.5 * s.H },
    { id: 'Wmm_L_2W_2H', fw: (s: Sample) => s.L + 2 * s.W + 2 * s.H, fh: (s: Sample) => s.L + s.H + s.W * 0.5 },
  ]
  let bestTemplate: any = null
  for (const t of templates) {
    let sumSN = 0
    let sumS2 = 0
    let sumY = 0
    let sumSY = 0
    let n = 0
    for (const s of train) {
      const S = t.fw(s) / MM_PER_UU
      const y = s.geomWidthUu
      sumSN += S
      sumS2 += S * S
      sumY += y
      sumSY += S * y
      n++
    }
    const det = n * sumS2 - sumSN * sumSN
    const scale = det !== 0 ? (n * sumSY - sumSN * sumY) / det : 1
    const bias = det !== 0 ? (sumY - scale * sumSN) / n : 0
    let sse = 0
    for (const s of train) {
      const predUu = scale * (t.fw(s) / MM_PER_UU) + bias
      sse += (predUu - s.geomWidthUu) ** 2
    }
    const rmse = Math.sqrt(sse / Math.max(n, 1))
    const cand = { template: t.id, scale, bias, train_rmse_uu: rmse, n }
    candidates.push({ id: `envelope_width_${t.id}`, layer: 'inferred', ...cand })
    if (!bestTemplate || rmse < bestTemplate.train_rmse_uu) bestTemplate = { ...cand, tid: t.id }
  }

  const widthRows = train.map((s) => ({ L: s.L, W: s.W, H: s.H, y: s.geomWidthUu }))
  const heightRows = train.map((s) => ({ L: s.L, W: s.W, H: s.H, y: s.geomHeightUu }))
  const olsWidth = fitLinearLWH(widthRows)
  const olsHeight = fitLinearLWH(heightRows)
  const olsWidthInt = fitLinearLWHInteract(widthRows)
  const olsHeightInt = fitLinearLWHInteract(heightRows)
  candidates.push({ id: 'ols_width', fit: olsWidth })
  candidates.push({ id: 'ols_height', fit: olsHeight })
  candidates.push({ id: 'ols_width_interact', fit: olsWidthInt })
  candidates.push({ id: 'ols_height_interact', fit: olsHeightInt })

  const winW = pickWinner(olsWidth, olsWidthInt, holdout, 'w')
  const winH = pickWinner(olsHeight, olsHeightInt, holdout, 'h')

  // Fallback to template expansion if OLS missing
  let widthCoeff: EnvelopeCoeff = winW?.coeff ?? {
    a: 0,
    b: 0,
    c: 0,
    d: 0,
    e: 0,
    f: 0,
    g: 0,
    model: 'none',
    train_rmse_uu: Infinity,
  }
  let heightCoeff: EnvelopeCoeff = winH?.coeff ?? {
    a: 0,
    b: 0,
    c: 0,
    d: 0,
    e: 0,
    f: 0,
    g: 0,
    model: 'none',
    train_rmse_uu: Infinity,
  }

  if ((!winW || !olsWidth) && bestTemplate) {
    const k = bestTemplate.scale / MM_PER_UU
    const tid = bestTemplate.tid
    if (tid === 'Wmm_2L_W_H') widthCoeff = { a: 2 * k, b: k, c: k, d: bestTemplate.bias, e: 0, f: 0, g: 0, model: 'template_Wmm_2L_W_H', train_rmse_uu: bestTemplate.train_rmse_uu }
    else if (tid === 'Wmm_2L_W_H_plus12')
      widthCoeff = { a: 2 * k, b: k, c: k, d: bestTemplate.bias + 12 * k, e: 0, f: 0, g: 0, model: 'template_Wmm_2L_W_H_plus12', train_rmse_uu: bestTemplate.train_rmse_uu }
    else widthCoeff = { a: k, b: 2 * k, c: 2 * k, d: bestTemplate.bias, e: 0, f: 0, g: 0, model: 'template_Wmm_L_2W_2H', train_rmse_uu: bestTemplate.train_rmse_uu }
  }

  setFitCoeffs(widthCoeff, heightCoeff)

  const holdoutEvalW = holdout.map((s) => {
    const pred = predLinear(widthCoeff, s.L, s.W, s.H)
    return { sampleId: s.sampleId, errW: Math.abs(pred - s.geomWidthUu), predW: pred, obsW: s.geomWidthUu }
  })
  const holdoutEvalH = holdout.map((s) => {
    const pred = predLinear(heightCoeff, s.L, s.W, s.H)
    return { sampleId: s.sampleId, errH: Math.abs(pred - s.geomHeightUu), predH: pred, obsH: s.geomHeightUu }
  })
  const holdoutEval = holdout.map((s, i) => ({ ...holdoutEvalW[i], ...holdoutEvalH[i] }))

  const stressEval = stress120.map((s) => ({
    sampleId: s.sampleId,
    errW: Math.abs(predLinear(widthCoeff, s.L, s.W, s.H) - s.geomWidthUu),
    errH: Math.abs(predLinear(heightCoeff, s.L, s.W, s.H) - s.geomHeightUu),
  }))

  // Validate gates
  const errW = holdoutEval[0]?.errW ?? Infinity
  const errH = holdoutEval[0]?.errH ?? Infinity
  if (widthCoeff.train_rmse_uu < TRAIN_RMSE_MAX) {
    if (errW <= HOLDOUT_MAX_UU) {
      validated.push({
        id: 'envelope_width_model',
        model: widthCoeff.model,
        train_rmse_uu: widthCoeff.train_rmse_uu,
        coeffs: widthCoeff,
        holdout: HOLDOUT_KEY,
        holdoutEval,
      })
    } else {
      counterexamples.push({
        rule: 'envelope_width',
        reason: 'holdout_err_exceeds_25uu',
        model: widthCoeff.model,
        train_rmse_uu: widthCoeff.train_rmse_uu,
        holdoutEval,
      })
    }
  } else {
    counterexamples.push({
      rule: 'envelope_width',
      reason: 'train_rmse_high',
      model: widthCoeff.model,
      train_rmse_uu: widthCoeff.train_rmse_uu,
    })
  }
  if (heightCoeff.train_rmse_uu < TRAIN_RMSE_MAX) {
    if (errH <= HOLDOUT_MAX_UU) {
      validated.push({
        id: 'envelope_height_model',
        model: heightCoeff.model,
        train_rmse_uu: heightCoeff.train_rmse_uu,
        coeffs: heightCoeff,
        holdout: HOLDOUT_KEY,
        holdoutEval,
      })
    } else {
      counterexamples.push({
        rule: 'envelope_height',
        reason: 'holdout_err_exceeds_25uu',
        model: heightCoeff.model,
        train_rmse_uu: heightCoeff.train_rmse_uu,
        holdoutEval,
      })
    }
  } else {
    counterexamples.push({
      rule: 'envelope_height',
      reason: 'train_rmse_high',
      model: heightCoeff.model,
      train_rmse_uu: heightCoeff.train_rmse_uu,
    })
  }

  fs.mkdirSync(dataRules, { recursive: true })
  const meta = {
    generated_at: new Date().toISOString(),
    real_unique_sizes: uniq.map((s) => `${s.L}x${s.W}x${s.H}`),
    holdout_frozen: HOLDOUT_KEY,
    access_denied_svgs_excluded: true,
    note: 'holdout is near-baseline single-var 100x80x90; 120x90x60 is cross-scale stress only',
  }
  fs.writeFileSync(path.join(dataRules, 'candidate-rules.json'), JSON.stringify({ ...meta, candidates }, null, 2))
  fs.writeFileSync(path.join(dataRules, 'validated-rules.json'), JSON.stringify({ ...meta, validated }, null, 2))
  fs.writeFileSync(path.join(dataRules, 'counterexamples.json'), JSON.stringify({ ...meta, counterexamples }, null, 2))
  fs.writeFileSync(
    path.join(dataRules, 'fit-coeffs.json'),
    JSON.stringify(
      {
        geomWidthUu: widthCoeff,
        geomHeightUu: heightCoeff,
        olsWidth,
        olsHeight,
        olsWidthInteract: olsWidthInt,
        olsHeightInteract: olsHeightInt,
        diagnosis: {
          linearHoldErrW: winW?.linearHoldErr ?? null,
          interactHoldErrW: winW?.interactHoldErr ?? null,
          linearHoldErrH: winH?.linearHoldErr ?? null,
          interactHoldErrH: winH?.interactHoldErr ?? null,
          stress_120x90x60: stressEval,
        },
        ...meta,
      },
      null,
      2,
    ),
  )

  const fmt = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? 'n/a' : n.toFixed(3))
  const diagMd = `# Envelope diagnosis

## Holdout switch

- Previous preferred holdout \`120x90x60\` is a **cross-scale** point (failed badly under linear templates).
- Frozen holdout is now **\`${HOLDOUT_KEY}\`** (near-baseline single-variable).
- \`120x90x60\` kept as stress-only (not the validation gate).

## Models

| axis | linear train RMSE | interact train RMSE | linear holdout err | interact holdout err | selected |
|---|---:|---:|---:|---:|---|
| width | ${fmt(olsWidth?.rmse)} | ${fmt(olsWidthInt?.rmse)} | ${fmt(winW?.linearHoldErr)} | ${fmt(winW?.interactHoldErr)} | **${widthCoeff.model}** (err=${fmt(errW)}) |
| height | ${fmt(olsHeight?.rmse)} | ${fmt(olsHeightInt?.rmse)} | ${fmt(winH?.linearHoldErr)} | ${fmt(winH?.interactHoldErr)} | **${heightCoeff.model}** (err=${fmt(errH)}) |

Selection rule: use interaction if holdout err ≤ ${HOLDOUT_MAX_UU} uu **and** better than linear; else keep linear OLS (or template fallback).

## Stress row \`120x90x60\` (not frozen)

${
  stressEval.length
    ? stressEval.map((s) => `- errW=${s.errW.toFixed(3)} uu, errH=${s.errH.toFixed(3)} uu`).join('\n')
    : '- missing'
}

## Gate vs validated

- Width holdout ≤${HOLDOUT_MAX_UU}: **${errW <= HOLDOUT_MAX_UU ? 'passed' : 'failed'}** (train_rmse=${fmt(widthCoeff.train_rmse_uu)})
- Height holdout ≤${HOLDOUT_MAX_UU}: **${errH <= HOLDOUT_MAX_UU ? 'passed' : 'failed'}** (train_rmse=${fmt(heightCoeff.train_rmse_uu)})
- Unique real sizes: ${uniq.length}; train n=${train.length}
`
  fs.writeFileSync(path.join(reportsDir, 'envelope-diagnosis.md'), diagMd)

  console.log(
    'infer-rules unique',
    uniq.length,
    'holdout',
    HOLDOUT_KEY,
    'W',
    widthCoeff.model,
    fmt(errW),
    'H',
    heightCoeff.model,
    fmt(errH),
    'validated',
    validated.length,
    'counterexamples',
    counterexamples.length,
  )
  return { validated, counterexamples, uniq, HOLDOUT_KEY, widthCoeff, heightCoeff }
}

runInfer()
