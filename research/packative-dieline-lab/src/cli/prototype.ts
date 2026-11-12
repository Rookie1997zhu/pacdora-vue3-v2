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
    const outline = generateCrashlockWithOutline(p)
    const partialName = `proto-crashlock-${p.L}_${p.W}_${p.H}.svg`
    const lockName = `proto-crashlock-${p.L}_${p.W}_${p.H}-lockbottom.svg`
    const topName = `proto-crashlock-${p.L}_${p.W}_${p.H}-topflaps.svg`
    const outlineName = `proto-crashlock-${p.L}_${p.W}_${p.H}-outline.svg`
    fs.writeFileSync(path.join(outDir, partialName), partial.svg)
    fs.writeFileSync(path.join(outDir, lockName), lock.svg)
    fs.writeFileSync(path.join(outDir, topName), top.svg)
    fs.writeFileSync(path.join(outDir, outlineName), outline.svg)
    results.push({
      file: outlineName,
      topFile: topName,
      lockFile: lockName,
      partialFile: partialName,
      widthUu: outline.widthUu,
      heightUu: outline.heightUu,
      cutting: outline.cutting?.length ?? 0,
      creasing: outline.creasing?.length ?? 0,
      curve_approx: outline.curveApprox,
      fillets_exact: outline.filletsExact,
      implemented: outline.implemented,
      gaps: outline.gaps,
    })
  }

  const gapsMd = `# Prototype gaps (crashlock structural topology)

## Status
- **research phase complete (structural)** — lab only; not production

## Implemented
- Outer envelope size from L/W/H fit (SVG user units)
- Parametric **14** body Creasing lines
- Parametric lock-bottom **Cutting** (~21)
- Parametric top dust flaps + tuck + glue (~26–29)
- Parametric body outline: right outer, L-bottom cut, micro bridge (~11 leftovers)
- Body fillet corners: **exact cubic** (\`filletsExact\`; 8 \`<path C>\`)
- Zero-length Class A = \`exportArtifact\` (maxX∩bodyBottom); Class B = \`collapsedLockShelf\` (kept in structural)
- Structural cutting = raw − Class A only (**61**)

## Not implemented (explicit / optional later)
- Material thickness / kerf compensation
- BOXCRAFT production wiring (Vue/Django)
- Emitting Class A zero-length stubs to fake raw 63

## Generated files
${results
  .map(
    (r) =>
      `- \`${r.file}\` cuts=${r.cutting} creases=${r.creasing} fillets_exact=${r.fillets_exact} widthUu=${r.widthUu.toFixed(3)} heightUu=${r.heightUu.toFixed(3)}`,
  )
  .join('\n')}
`
  fs.writeFileSync(path.join(reportsDir, 'gaps.md'), gapsMd)
  fs.writeFileSync(
    path.join(reportsDir, 'prototype-run.json'),
    JSON.stringify({ generated_at: new Date().toISOString(), results }, null, 2),
  )
  console.log('prototype', results.length, 'outline svgs')
  return results
}

runPrototype()
