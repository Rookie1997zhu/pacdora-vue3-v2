// Lists fixed-snapshot products whose captured dieline cannot be folded (no hinges in the replay
// knife) together with the pre-made mock-up model file Pacdora references for them (size_options[].pdaFile
// / glbFile). Output: docs/mockup-model-targets.json
// Usage: node scripts/list-mockup-model-targets.mjs [--all]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { knifeFromPacdoraGeom } from '../src/pacdoraGeomKnife.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const all = process.argv.includes('--all')
const presets = JSON.parse(fs.readFileSync(path.join(ROOT, 'backend/apps/catalog/data/box_mockups_presets.json'), 'utf8'))

function modelFiles(raw) {
  const out = []
  const re = /"(pdaFile|glbFile)":\s*"([^"]+)"/g
  let m
  while ((m = re.exec(raw))) {
    const url = m[2].startsWith('//') ? `https:${m[2]}` : m[2]
    if (!out.some((o) => o.url === url)) out.push({ kind: m[1], url })
  }
  return out
}

const rows = []
for (const it of presets.items) {
  const file = path.join(ROOT, 'public', `${it.category}-geom`, `${it.source_num}.json`)
  if (!fs.existsSync(file)) { rows.push({ category: it.category, num: it.source_num, error: 'no-geom' }); continue }
  const raw = fs.readFileSync(file, 'utf8')
  let hinges = -1
  let panels = 0
  let err = ''
  try {
    const knife = knifeFromPacdoraGeom(JSON.parse(raw), { sourceNum: it.source_num, L: it.length, W: it.width, H: it.height, T: it.thickness })
    hinges = (knife.hinges || []).length
    panels = (knife.panels || []).length
  } catch (e) { err = String(e?.message || e) }
  rows.push({ category: it.category, num: String(it.source_num), templateId: it.template_id, hinges, panels, err, files: modelFiles(raw) })
}
const targets = rows.filter((r) => all || r.hinges <= 0)
const byCat = {}
for (const r of targets) byCat[r.category] = (byCat[r.category] || 0) + 1
console.log('products', rows.length, 'targets', targets.length, JSON.stringify(byCat), 'with model file', targets.filter((r) => r.files?.length).length)
const hosts = {}
for (const r of targets) for (const f of r.files || []) { const k = `${f.kind} ${new URL(f.url).host}${path.dirname(new URL(f.url).pathname)}`; hosts[k] = (hosts[k] || 0) + 1 }
console.log(hosts)
console.log('errors', targets.filter((r) => r.err).slice(0, 5))
if (!all) fs.writeFileSync(path.join(ROOT, 'docs/mockup-model-targets.json'), JSON.stringify(targets, null, 1))
