/**
 * P3 runner (tsx): Lab-equivalent crashlock playback vs research gates.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  generateCrashlockWithOutline,
  setFitCoeffs,
} from '../research/packative-dieline-lab/src/prototype/crashlock.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const outIdx = args.indexOf('--out')
const outPath =
  outIdx >= 0
    ? args[outIdx + 1]
    : path.join(root, 'research/packative-dieline-lab/reports/p3-holdout-gates.json')

const fitCoeffs = JSON.parse(
  fs.readFileSync(
    path.join(root, 'research/packative-dieline-lab/data/rules/fit-coeffs.json'),
    'utf8',
  ),
)
if (fitCoeffs.geomWidthUu && fitCoeffs.geomHeightUu) {
  const w = fitCoeffs.geomWidthUu
  const h = fitCoeffs.geomHeightUu
  setFitCoeffs(
    {
      a: w.a,
      b: w.b,
      c: w.c,
      d: w.d,
      e: w.e ?? 0,
      f: w.f ?? 0,
      g: w.g ?? 0,
      model: w.model,
    },
    {
      a: h.a,
      b: h.b,
      c: h.c,
      d: h.d,
      e: h.e ?? 0,
      f: h.f ?? 0,
      g: h.g ?? 0,
      model: h.model,
    },
  )
}

const catalog = JSON.parse(
  fs.readFileSync(path.join(root, 'docs/packative_lab_catalog/packative_catalog.json'), 'utf8'),
)
const validationResults = JSON.parse(
  fs.readFileSync(
    path.join(root, 'research/packative-dieline-lab/reports/validation-results.json'),
    'utf8',
  ),
)
const validatedRules = JSON.parse(
  fs.readFileSync(
    path.join(root, 'research/packative-dieline-lab/data/rules/validated-rules.json'),
    'utf8',
  ),
)

type Asset = {
  validation_status: string
  evidence_ref?: string
  L_mm: number
  W_mm: number
  H_mm: number
}

const assets: Asset[] = Array.isArray(catalog.assets) ? catalog.assets : []
const byStatus = assets.reduce((acc: Record<string, number>, r) => {
  acc[r.validation_status] = (acc[r.validation_status] || 0) + 1
  return acc
}, {})

function validatedBounds() {
  const v = assets.filter((r) => r.validation_status === 'validated')
  if (!v.length) return null
  return {
    length: [Math.min(...v.map((r) => r.L_mm)), Math.max(...v.map((r) => r.L_mm))],
    width: [Math.min(...v.map((r) => r.W_mm)), Math.max(...v.map((r) => r.W_mm))],
    height: [Math.min(...v.map((r) => r.H_mm)), Math.max(...v.map((r) => r.H_mm))],
  }
}

function classifySize(L: number, W: number, H: number) {
  const key = `${L}x${W}x${H}`
  const exact = assets.find((r) => `${r.L_mm}x${r.W_mm}x${r.H_mm}` === key)
  if (exact?.validation_status === 'holdout') return 'holdout'
  if (exact?.validation_status === 'unvalidated') return 'unvalidated'
  if (exact?.validation_status === 'validated') return 'validated'
  const b = validatedBounds()
  if (
    b &&
    L >= b.length[0] &&
    L <= b.length[1] &&
    W >= b.width[0] &&
    W <= b.width[1] &&
    H >= b.height[0] &&
    H <= b.height[1]
  ) {
    return 'validated'
  }
  return 'unvalidated'
}

function canEnter(status: string) {
  return status === 'validated' || status === 'holdout'
}

const sizes = [
  { L: 100, W: 80, H: 80, label: 'baseline_validated' },
  { L: 55, W: 55, H: 75, label: 'cross_scale_validated' },
  { L: 100, W: 80, H: 90, label: 'holdout' },
]

const playback = sizes.map((s) => {
  const played = generateCrashlockWithOutline({ L: s.L, W: s.W, H: s.H })
  return {
    label: s.label,
    L: s.L,
    W: s.W,
    H: s.H,
    classify: classifySize(s.L, s.W, s.H),
    widthUu: played.widthUu,
    heightUu: played.heightUu,
    gaps: played.gaps,
    implemented: played.implemented,
    svgBytes: played.svg?.length || 0,
  }
})

const gateTests = (validationResults.tests || []).map((t: any) => ({
  id: t.id,
  status: t.status,
  abs_err_uu: t.abs_err_uu,
  predicted_uu: t.predicted_uu,
  observed_uu: t.observed_uu,
  note: t.note,
  reason: t.reason,
}))

const holdoutPlayback = playback.find((p) => p.label === 'holdout')
const holdoutW = gateTests.find((t: any) => t.id === 'holdout_envelope_width')
const holdoutH = gateTests.find((t: any) => t.id === 'holdout_envelope_height')

const summary = {
  generated_at: new Date().toISOString(),
  manufacturingReady: false,
  full_topology_claimed: false,
  holdout_frozen: validatedRules.holdout_frozen || '100x80x90',
  catalog: {
    total: assets.length,
    by_status: byStatus,
    evidence_with_ref: assets.filter((r) => !!r.evidence_ref).length,
    bounds: validatedBounds(),
    enter_rules: {
      validated_ok: canEnter('validated'),
      holdout_ok: canEnter('holdout'),
      unvalidated_blocked: !canEnter('unvalidated'),
    },
  },
  research_gate_tests: gateTests,
  lab_playback: playback,
  envelope_delta: {
    note: 'Lab playback + crashlock defaults use fit-coeffs.json (same OLS as validated-rules envelope). Lab pred should match research holdout pred; Δ vs obs is holdout residual.',
    lab_holdout_widthUu: holdoutPlayback?.widthUu ?? null,
    lab_holdout_heightUu: holdoutPlayback?.heightUu ?? null,
    research_holdout_obsW: holdoutW?.observed_uu ?? null,
    research_holdout_obsH: holdoutH?.observed_uu ?? null,
    research_holdout_predW: holdoutW?.predicted_uu ?? null,
    research_holdout_predH: holdoutH?.predicted_uu ?? null,
    abs_delta_lab_vs_obsW:
      holdoutPlayback && holdoutW
        ? Math.abs(holdoutPlayback.widthUu - Number(holdoutW.observed_uu))
        : null,
    abs_delta_lab_vs_obsH:
      holdoutPlayback && holdoutH
        ? Math.abs(holdoutPlayback.heightUu - Number(holdoutH.observed_uu))
        : null,
  },
  verdict: {
    research_gates_passed: gateTests
      .filter((t: any) => t.id !== 'holdout_full_crashlock_topology')
      .every((t: any) => t.status === 'passed'),
    full_topology_blocked: gateTests.some(
      (t: any) => t.id === 'holdout_full_crashlock_topology' && t.status === 'blocked',
    ),
    lab_playback_emits_svg: playback.every((p) => p.svgBytes > 100),
    note: 'Lab Packative playback is partial prototype SVG; research structural gates passed; full raw-63 topology remains blocked; manufacturingReady=false.',
  },
}

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, JSON.stringify(summary, null, 2))
console.log(JSON.stringify({ ok: true, out: outPath, verdict: summary.verdict }, null, 2))
