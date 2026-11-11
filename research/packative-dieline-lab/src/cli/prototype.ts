import fs from 'node:fs'
import path from 'node:path'
import { generateCrashlockPartial, setFitCoeffs } from '../prototype/crashlock.ts'
import { dataRules, labRoot, reportsDir } from '../paths.ts'

export function runPrototype() {
  const fitPath = path.join(dataRules, 'fit-coeffs.json')
  if (fs.existsSync(fitPath)) {
    const fit = JSON.parse(fs.readFileSync(fitPath, 'utf8'))
    if (fit.geomWidthUu && fit.geomHeightUu) {
      setFitCoeffs(
        { a: fit.geomWidthUu.a, b: fit.geomWidthUu.b, c: fit.geomWidthUu.c, d: fit.geomWidthUu.d },
        { a: fit.geomHeightUu.a, b: fit.geomHeightUu.b, c: fit.geomHeightUu.c, d: fit.geomHeightUu.d },
      )
    }
  }

  const targets = [
    { L: 100, W: 80, H: 80 },
    { L: 55, W: 55, H: 75 },
    { L: 200, W: 150, H: 100 }, // holdout generate-only
  ]
  const outDir = path.join(labRoot, 'data', 'normalized', 'prototype-svg')
  fs.mkdirSync(outDir, { recursive: true })
  const results = []
  for (const p of targets) {
    const r = generateCrashlockPartial(p)
    const name = `proto-crashlock-${p.L}_${p.W}_${p.H}.svg`
    fs.writeFileSync(path.join(outDir, name), r.svg)
    results.push({ file: name, widthUu: r.widthUu, heightUu: r.heightUu, implemented: r.implemented, gaps: r.gaps })
  }

  const gapsMd = `# Prototype gaps (crashlock partial)

## Implemented
- Outer envelope size from linear L/W/H fit (SVG user units)
- Cutting outer rectangle + heuristic Creasing cross

## Not implemented (explicit)
- Auto-bottom / crash-lock flap topology
- Glue flap / dust flap reconstruction
- Curve segments
- Material thickness (unobserved)

## Generated files
${results.map((r) => `- \`${r.file}\` widthUu=${r.widthUu.toFixed(3)} heightUu=${r.heightUu.toFixed(3)}`).join('\n')}
`
  fs.writeFileSync(path.join(reportsDir, 'gaps.md'), gapsMd)
  fs.writeFileSync(path.join(reportsDir, 'prototype-run.json'), JSON.stringify({ generated_at: new Date().toISOString(), results }, null, 2))
  console.log('prototype', results.length, 'svgs')
  return results
}

runPrototype()
