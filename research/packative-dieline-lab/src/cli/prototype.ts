import fs from 'node:fs'
import path from 'node:path'
import {
  generateCrashlockPartial,
  generateCrashlockWithLockBottom,
  generateCrashlockWithTopFlaps,
  setFitCoeffs,
} from '../prototype/crashlock.ts'
import { dataRules, labRoot, reportsDir } from '../paths.ts'

export function runPrototype() {
  const fitPath = path.join(dataRules, 'fit-coeffs.json')
  let holdout = { L: 100, W: 80, H: 90 }
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
    if (typeof fit.holdout_frozen === 'string') {
      const [L, W, H] = fit.holdout_frozen.split('x').map(Number)
      if ([L, W, H].every((n: number) => Number.isFinite(n))) holdout = { L, W, H }
    }
  }
  const targets = [
    { L: 100, W: 80, H: 80 },
    { L: 55, W: 55, H: 75 },
    { L: 100, W: 90, H: 80 },
    holdout,
  ]
  const outDir = path.join(labRoot, 'data', 'normalized', 'prototype-svg')
  fs.mkdirSync(outDir, { recursive: true })
  const results = []
  for (const p of targets) {
    const partial = generateCrashlockPartial(p)
    const lock = generateCrashlockWithLockBottom(p)
    const top = generateCrashlockWithTopFlaps(p)
    const partialName = `proto-crashlock-${p.L}_${p.W}_${p.H}.svg`
    const lockName = `proto-crashlock-${p.L}_${p.W}_${p.H}-lockbottom.svg`
    const topName = `proto-crashlock-${p.L}_${p.W}_${p.H}-topflaps.svg`
    fs.writeFileSync(path.join(outDir, partialName), partial.svg)
    fs.writeFileSync(path.join(outDir, lockName), lock.svg)
    fs.writeFileSync(path.join(outDir, topName), top.svg)
    results.push({
      file: topName,
      lockFile: lockName,
      partialFile: partialName,
      widthUu: top.widthUu,
      heightUu: top.heightUu,
      cutting: top.cutting?.length ?? 0,
      creasing: top.creasing?.length ?? 0,
      curve_approx: top.curveApprox,
      implemented: top.implemented,
      gaps: top.gaps,
    })
  }

  const gapsMd = `# Prototype gaps (crashlock lock+top second slice)

## Implemented
- Outer envelope size from L/W/H fit (SVG user units)
- Parametric **14** body Creasing lines (panel layout glue|L|W|L|W)
- Parametric lock-bottom **Cutting** polyline (~21 lines)
- Parametric top **dust flaps + tuck tongues + glue outer** (~26–29 lines)
- Cubic corners: **curve_approx** (chord / fixed mm notches)

## Not implemented (explicit)
- Body side outer / back top edge closure
- Bottom corner fillet paths
- Exact cubic corner paths
- Full 63 Cutting / production claim

## Generated files
${results
  .map(
    (r) =>
      `- \`${r.file}\` cuts=${r.cutting} creases=${r.creasing} widthUu=${r.widthUu.toFixed(3)} heightUu=${r.heightUu.toFixed(3)}`,
  )
  .join('\n')}
`
  fs.writeFileSync(path.join(reportsDir, 'gaps.md'), gapsMd)
  fs.writeFileSync(
    path.join(reportsDir, 'prototype-run.json'),
    JSON.stringify({ generated_at: new Date().toISOString(), results }, null, 2),
  )
  console.log('prototype', results.length, 'topflaps svgs')
  return results
}

runPrototype()
