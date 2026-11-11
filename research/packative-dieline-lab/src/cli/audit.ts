import fs from 'node:fs'
import path from 'node:path'
import { reportsDir } from '../paths.ts'

/** Phase 1 helper: ensure inventory exists and write workspace snapshot note. */
async function main() {
  const inv = path.join(reportsDir, 'evidence-inventory.json')
  if (!fs.existsSync(inv)) {
    console.error('missing evidence-inventory.json — run inventory script first')
    process.exit(1)
  }
  const data = JSON.parse(fs.readFileSync(inv, 'utf8'))
  const snap = {
    at: new Date().toISOString(),
    inventory_count: data.count,
    vector_svg_count: data.vector_svg_count,
    access_scope: JSON.parse(fs.readFileSync(path.join(reportsDir, '..', 'config', 'access-scope.json'), 'utf8')),
    notes: [
      'docs/packative-research remains read-only',
      'live_collection=false',
      'online_collection_count=0',
    ],
  }
  fs.writeFileSync(path.join(reportsDir, 'phase1-audit-summary.json'), JSON.stringify(snap, null, 2))
  console.log('phase1 ok', { svg: data.vector_svg_count, files: data.count })
}

main()
