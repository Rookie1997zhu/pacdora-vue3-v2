import fs from 'node:fs'
import path from 'node:path'
import { configDir, dataRaw, reportsDir } from '../paths.ts'

function key(p: { L: number; W: number; H: number }) {
  return `${p.L}x${p.W}x${p.H}`
}

export function runSampleMatrix() {
  const plan = JSON.parse(fs.readFileSync(path.join(configDir, 'sample-matrix.json'), 'utf8'))
  const manifest = JSON.parse(fs.readFileSync(path.join(dataRaw, 'manifest.json'), 'utf8'))
  const available = new Set<string>()
  const denied = new Set<string>()
  for (const it of manifest.items) {
    if (!it.name.endsWith('.svg')) continue
    const m = it.name.match(/(\d+)_(\d+)_(\d+)/)
    if (!m) continue
    const k = `${m[1]}x${m[2]}x${m[3]}`
    if (it.import_ok) available.add(k)
    else if (String(it.import_reason || '').includes('access_denied')) denied.add(k)
  }

  const rows: Array<Record<string, unknown>> = []
  for (const [group, pts] of Object.entries(plan.planned_groups) as Array<[string, Array<{ L: number; W: number; H: number; note?: string }>]>) {
    for (const p of pts) {
      const k = key(p)
      const status = available.has(k) ? 'available' : denied.has(k) ? 'local_stub_access_denied' : 'missing_offline'
      rows.push({ group, ...p, key: k, status, holdout_frozen: plan.holdout_frozen.some((h: any) => key(h) === k) })
    }
  }

  const report = {
    generated_at: new Date().toISOString(),
    live_collection: false,
    available_count: rows.filter((r) => r.status === 'available').length,
    missing_count: rows.filter((r) => r.status === 'missing_offline').length,
    rows,
  }
  fs.writeFileSync(path.join(reportsDir, 'sample-matrix-status.json'), JSON.stringify(report, null, 2))
  console.log('sample-matrix', report.available_count, 'available', report.missing_count, 'missing_offline')
  return report
}

runSampleMatrix()
