import fs from 'node:fs'
import path from 'node:path'
import { reportsDir } from '../paths.ts'

export function runDiffGeometry() {
  const sum = JSON.parse(fs.readFileSync(path.join(reportsDir, 'normalize-summaries.json'), 'utf8'))
  const samples = (sum.samples as any[]).filter((s) => s.L != null).sort((a, b) => a.L - b.L || a.W - b.W || a.H - b.H)
  const pairs = []
  for (let i = 0; i < samples.length; i++) {
    for (let j = i + 1; j < samples.length; j++) {
      const a = samples[i]
      const b = samples[j]
      pairs.push({
        a: a.sampleId,
        b: b.sampleId,
        dL: b.L - a.L,
        dW: b.W - a.W,
        dH: b.H - a.H,
        dGeomW_uu: (b.geomWidthUu ?? 0) - (a.geomWidthUu ?? 0),
        dGeomH_uu: (b.geomHeightUu ?? 0) - (a.geomHeightUu ?? 0),
        cuttingEqual: a.cuttingCount === b.cuttingCount,
        creasingEqual: a.creasingCount === b.creasingCount,
        cuttingA: a.cuttingCount,
        cuttingB: b.cuttingCount,
        creasingA: a.creasingCount,
        creasingB: b.creasingCount,
      })
    }
  }
  const topology = {
    cuttingCounts: [...new Set(samples.map((s) => s.cuttingCount))],
    creasingCounts: [...new Set(samples.map((s) => s.creasingCount))],
    sameCuttingAcrossAll: new Set(samples.map((s) => s.cuttingCount)).size === 1,
    sameCreasingAcrossAll: new Set(samples.map((s) => s.creasingCount)).size === 1,
  }
  const out = { generated_at: new Date().toISOString(), topology, pairs }
  fs.writeFileSync(path.join(reportsDir, 'diff-geometry.json'), JSON.stringify(out, null, 2))
  console.log('diff-geometry pairs', pairs.length, 'topology', topology)
  return out
}

runDiffGeometry()
