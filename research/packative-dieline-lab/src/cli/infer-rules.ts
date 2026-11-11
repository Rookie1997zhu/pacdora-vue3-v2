import fs from 'node:fs'
import path from 'node:path'
import { fitLinearLWH } from '../geometry/features.ts'
import { setFitCoeffs } from '../prototype/crashlock.ts'
import { configDir, dataRules, reportsDir } from '../paths.ts'

/** Freeze a real available sample (120_90_60 SVG is AccessDenied stub). */
const HOLDOUT_KEY = '200x150x100'
const MM_PER_UU = 25.4 / 96

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

function pred(c: { a: number; b: number; c: number; d: number }, s: Sample, which: 'w' | 'h') {
  const y = c.a * s.L + c.b * s.W + c.c * s.H + c.d
  return which === 'w' ? y : y
}

export function runInfer() {
  const sum = JSON.parse(fs.readFileSync(path.join(reportsDir, 'normalize-summaries.json'), 'utf8'))
  const samples = (sum.samples as Sample[]).filter(
    (s) => s.L != null && s.geomWidthUu != null && s.cuttingCount > 0 && !(s as any).rejected,
  )
  // de-dupe identical LWH (keep first)
  const uniq: Sample[] = []
  const seen = new Set<string>()
  for (const s of samples) {
    const k = `${s.L}x${s.W}x${s.H}`
    if (seen.has(k)) continue
    seen.add(k)
    uniq.push(s)
  }

  const train = uniq.filter((s) => `${s.L}x${s.W}x${s.H}` !== HOLDOUT_KEY)
  const holdout = uniq.filter((s) => `${s.L}x${s.W}x${s.H}` === HOLDOUT_KEY)

  const candidates: any[] = []
  const validated: any[] = []
  const counterexamples: any[] = []

  // Topology
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

  // Unit candidate from crease≈L
  candidates.push({
    id: 'css_mm_per_uu_25.4_96',
    layer: 'inferred',
    value: MM_PER_UU,
    evidence: 'horizontal crease spans near L*uu for 100_80_80',
    status: 'candidate',
  })

  // Structural template search in mm space (sparse data: only 2–3 unique sizes)
  const templates = [
    { id: 'Wmm_2L_W_H', fw: (s: Sample) => 2 * s.L + s.W + s.H, fh: (s: Sample) => s.L + s.W + 0.5 * s.H },
    { id: 'Wmm_2L_W_H_plus12', fw: (s: Sample) => 2 * s.L + s.W + s.H + 12, fh: (s: Sample) => s.L + s.W + 0.5 * s.H },
    { id: 'Wmm_L_2W_2H', fw: (s: Sample) => s.L + 2 * s.W + 2 * s.H, fh: (s: Sample) => s.L + s.H + s.W * 0.5 },
  ]

  let best: any = null
  for (const t of templates) {
    const widthRows = train.map((s) => {
      const target = s.geomWidthUu
      const struct = t.fw(s) / MM_PER_UU // expected uu if structure is mm
      return { L: s.L, W: s.W, H: s.H, y: target, struct }
    })
    // Fit y ≈ scale * struct + d using 2-param OLS via embedding into LWH fit with tied coeffs is hard;
    // instead evaluate pure structure (scale=1) RMSE and scale-only fit.
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
    if (!best || rmse < best.train_rmse_uu) best = { ...cand, fw: t.fw, fh: t.fh, tid: t.id }
  }

  // Height template companion using same bias/scale style for fh
  let heightFitLocal: { scale: number; bias: number; rmse: number; tid: string } | null = null
  if (best) {
    const t = templates.find((x) => x.id === best.tid)!
    let sumSN = 0
    let sumS2 = 0
    let sumY = 0
    let sumSY = 0
    let n = 0
    for (const s of train) {
      const S = t.fh(s) / MM_PER_UU
      const y = s.geomHeightUu
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
      const predUu = scale * (t.fh(s) / MM_PER_UU) + bias
      sse += (predUu - s.geomHeightUu) ** 2
    }
    heightFitLocal = { scale, bias, rmse: Math.sqrt(sse / Math.max(n, 1)), tid: t.id }
    candidates.push({ id: `envelope_height_${t.id}`, layer: 'inferred', ...heightFitLocal })
  }

  // Also try unconstrained OLS if enough points
  const widthFit = fitLinearLWH(train.map((s) => ({ L: s.L, W: s.W, H: s.H, y: s.geomWidthUu })))
  const heightFit = fitLinearLWH(train.map((s) => ({ L: s.L, W: s.W, H: s.H, y: s.geomHeightUu })))
  candidates.push({ id: 'ols_width', fit: widthFit, note: 'needs>=4 samples; often null with sparse offline set' })
  candidates.push({ id: 'ols_height', fit: heightFit })

  // Emit coeffs for prototype: prefer template scale model expanded to aL+bW+cH+d
  let widthCoeff = { a: 0, b: 0, c: 0, d: 0 }
  let heightCoeff = { a: 0, b: 0, c: 0, d: 0 }
  if (best && heightFitLocal) {
    const t = templates.find((x) => x.id === best.tid)!
    // Expand fw structure coefficients * scale / MM_PER_UU
    // For Wmm_2L_W_H: 2,1,1 ; plus12 adds to d
    const expand = (fwId: string, scale: number, bias: number, which: 'w' | 'h') => {
      const k = scale / MM_PER_UU
      if (fwId === 'Wmm_2L_W_H') {
        return which === 'w' ? { a: 2 * k, b: 1 * k, c: 1 * k, d: bias } : { a: 1 * k, b: 1 * k, c: 0.5 * k, d: bias }
      }
      if (fwId === 'Wmm_2L_W_H_plus12') {
        return which === 'w'
          ? { a: 2 * k, b: 1 * k, c: 1 * k, d: bias + 12 * k }
          : { a: 1 * k, b: 1 * k, c: 0.5 * k, d: bias }
      }
      // Wmm_L_2W_2H
      return which === 'w' ? { a: 1 * k, b: 2 * k, c: 2 * k, d: bias } : { a: 1 * k, b: 0.5 * k, c: 1 * k, d: bias }
    }
    widthCoeff = expand(best.tid, best.scale, best.bias, 'w')
    heightCoeff = expand(best.tid, heightFitLocal.scale, heightFitLocal.bias, 'h')
    setFitCoeffs(widthCoeff, heightCoeff)

    const holdoutEval = holdout.map((s) => {
      const pw = widthCoeff.a * s.L + widthCoeff.b * s.W + widthCoeff.c * s.H + widthCoeff.d
      const ph = heightCoeff.a * s.L + heightCoeff.b * s.W + heightCoeff.c * s.H + heightCoeff.d
      return {
        sampleId: s.sampleId,
        errW: Math.abs(pw - s.geomWidthUu),
        errH: Math.abs(ph - s.geomHeightUu),
        predW: pw,
        predH: ph,
        obsW: s.geomWidthUu,
        obsH: s.geomHeightUu,
      }
    })

    if (best.train_rmse_uu < 15) {
      validated.push({
        id: 'envelope_width_template_sparse',
        template: best.tid,
        train_rmse_uu: best.train_rmse_uu,
        coeffs: widthCoeff,
        holdout: HOLDOUT_KEY,
        holdoutEval,
        caution: 'sparse_offline_sizes_only_3_unique_real_svgs',
      })
    } else {
      counterexamples.push({ rule: 'envelope_width_template', reason: 'train_rmse_high', best })
    }
    if (heightFitLocal.rmse < 15) {
      const holdH = holdoutEval[0]?.errH ?? Infinity
      if (holdH <= 25) {
        validated.push({
          id: 'envelope_height_template_sparse',
          template: heightFitLocal.tid,
          train_rmse_uu: heightFitLocal.rmse,
          coeffs: heightCoeff,
          holdoutEval,
        })
      } else {
        counterexamples.push({
          rule: 'envelope_height_template',
          reason: 'holdout_err_exceeds_25uu',
          train_rmse_uu: heightFitLocal.rmse,
          holdoutEval,
          note: 'train fits sparse points but does not generalize; do not claim height formula',
        })
      }
    } else {
      counterexamples.push({ rule: 'envelope_height_template', reason: 'train_rmse_high', heightFitLocal })
    }
  } else {
    counterexamples.push({ rule: 'envelope_fit', reason: 'insufficient_real_svgs_or_no_template' })
  }

  fs.mkdirSync(dataRules, { recursive: true })
  const meta = {
    generated_at: new Date().toISOString(),
    real_unique_sizes: uniq.map((s) => `${s.L}x${s.W}x${s.H}`),
    holdout_frozen: HOLDOUT_KEY,
    access_denied_svgs_excluded: true,
    note: '120_90_60 and some sizes are CDN AccessDenied stubs — not usable vectors',
  }
  fs.writeFileSync(path.join(dataRules, 'candidate-rules.json'), JSON.stringify({ ...meta, candidates }, null, 2))
  fs.writeFileSync(path.join(dataRules, 'validated-rules.json'), JSON.stringify({ ...meta, validated }, null, 2))
  fs.writeFileSync(path.join(dataRules, 'counterexamples.json'), JSON.stringify({ ...meta, counterexamples }, null, 2))
  fs.writeFileSync(
    path.join(dataRules, 'fit-coeffs.json'),
    JSON.stringify({ geomWidthUu: widthCoeff, geomHeightUu: heightCoeff, olsWidth: widthFit, olsHeight: heightFit, ...meta }, null, 2),
  )
  console.log('infer-rules unique', uniq.length, 'validated', validated.length, 'counterexamples', counterexamples.length)
  return { validated, counterexamples, uniq }
}

runInfer()
