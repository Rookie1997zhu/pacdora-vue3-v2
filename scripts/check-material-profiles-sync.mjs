/**
 * Compare packages/geometry-engine/materialProfiles.js with GET /api/v1/material-profiles/
 * when API_BASE is set; otherwise only assert engine package loads.
 */
import { listMaterialProfiles } from '../packages/geometry-engine/materialProfiles.js'

const engine = listMaterialProfiles({ includeLegacy: true })
if (!engine.length) {
  console.error('engine material profiles empty')
  process.exit(1)
}

const apiBase = process.env.API_BASE || ''
if (!apiBase) {
  console.log(`check-material-profiles-sync: engine ok (${engine.length}); skip API (no API_BASE)`)
  process.exit(0)
}

const res = await fetch(`${apiBase.replace(/\/$/, '')}/api/v1/material-profiles/?include_legacy=1`)
if (!res.ok) {
  console.error('material-profiles HTTP', res.status)
  process.exit(1)
}
const body = await res.json()
const items = body?.data?.items || []
const byCode = new Map(items.map((r) => [r.code, r]))
let drift = 0
for (const p of engine) {
  const row = byCode.get(p.id)
  if (!row) {
    console.error('missing in API:', p.id)
    drift++
    continue
  }
  if (Number(row.thickness_default) !== Number(p.thickness.default)) {
    console.error('thickness_default drift', p.id, row.thickness_default, p.thickness.default)
    drift++
  }
  if (row.engine_material_id !== p.engineMaterialId) {
    console.error('engine_material_id drift', p.id)
    drift++
  }
}
if (drift) process.exit(1)
console.log(`check-material-profiles-sync: ok (${engine.length})`)
