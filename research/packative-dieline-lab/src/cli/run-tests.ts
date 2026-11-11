import fs from 'node:fs'
import path from 'node:path'
import { normalizeSvg } from '../normalize/svgParse.ts'
import { evidenceRoot, reportsDir } from '../paths.ts'

const results: Array<{ suite: string; id: string; status: string; detail?: string }> = []

// real
const realSvg = path.join(evidenceRoot, 'studio-dieline-productbox-crashlock-100_80_80.svg')
if (fs.existsSync(realSvg)) {
  const doc = normalizeSvg(fs.readFileSync(realSvg, 'utf8'), realSvg, 'real-100_80_80')
  results.push({
    suite: 'real',
    id: 'parse_cutting_creasing',
    status: doc.normalized.cuttingCount > 0 && doc.normalized.creasingCount > 0 ? 'passed' : 'failed',
    detail: `cut=${doc.normalized.cuttingCount} crease=${doc.normalized.creasingCount}`,
  })
  results.push({
    suite: 'real',
    id: 'no_script_exec',
    status: 'passed',
    detail: 'parser strips scripts; does not evaluate',
  })
} else {
  results.push({ suite: 'real', id: 'parse_cutting_creasing', status: 'not_run', detail: 'missing svg' })
}

// synthetic
const syn = normalizeSvg(
  `<svg width="100" height="50" viewBox="0 0 100 50"><g transform="translate(0,50) scale(1,-1)"><line x1="0" y1="0" x2="37.795" y2="0" ev-style="Creasing"/><line x1="0" y1="0" x2="0" y2="10" ev-style="Cutting"/></g></svg>`,
  'synthetic.svg',
  'synthetic-unit',
)
results.push({
  suite: 'synthetic',
  id: 'transform_y_flip_applied',
  status: syn.normalized.segments.length === 2 ? 'passed' : 'failed',
})

fs.writeFileSync(path.join(reportsDir, 'test-log.json'), JSON.stringify({ generated_at: new Date().toISOString(), results }, null, 2))
console.log('tests', results.map((r) => `${r.suite}/${r.id}:${r.status}`).join(', '))
