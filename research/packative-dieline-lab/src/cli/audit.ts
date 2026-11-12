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
  const accessScope = JSON.parse(fs.readFileSync(path.join(reportsDir, '..', 'config', 'access-scope.json'), 'utf8'))
  const snap = {
    at: new Date().toISOString(),
    inventory_count: data.count,
    vector_svg_count: data.vector_svg_count,
    access_scope: accessScope,
    notes: [
      'docs/packative-research evidence may be updated by authorized lab ingest',
      `live_collection=${Boolean(accessScope.live_collection)}`,
      `paid_actions=${Boolean(accessScope.paid_actions)}`,
      `online_collection_count=${accessScope.online_collection_count ?? 0}`,
      'research_allows_unauth_crawl_for_crashlock_whitelist',
    ],
  }
  fs.writeFileSync(path.join(reportsDir, 'phase1-audit-summary.json'), JSON.stringify(snap, null, 2))
  console.log('phase1 ok', { svg: data.vector_svg_count, files: data.count })
}

main()
