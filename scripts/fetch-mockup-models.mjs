// Downloads the pre-made mock-up 3D models referenced by fixed-snapshot products that have no
// foldable dieline (docs/mockup-model-targets.json, see list-mockup-model-targets.mjs), keeps the
// original under docs/pacdora_<cat>_boxes/models/<num>.pda and writes a GLB for the app to
// public/<cat>-models/<num>.glb plus public/mockup-models-manifest.json.
// Usage: node scripts/fetch-mockup-models.mjs [--force] [--delay 800]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parsePda, pdaToGlb, describePda } from './lib/pda.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const force = process.argv.includes('--force')
const di = process.argv.indexOf('--delay')
const delay = di > 0 ? Number(process.argv[di + 1]) : 800
const targets = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/mockup-model-targets.json'), 'utf8'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const manifest = {}
const failed = []
let fetched = 0
for (const t of targets) {
  const key = `${t.category}/${t.num}`
  const file = (t.files || []).find((f) => /\.pda(\?|$)/i.test(f.url))
  if (!file) { failed.push({ key, reason: 'no model file referenced' }); continue }
  const srcDir = path.join(ROOT, 'docs', `pacdora_${t.category}_boxes`, 'models')
  const outDir = path.join(ROOT, 'public', `${t.category}-models`)
  fs.mkdirSync(srcDir, { recursive: true })
  fs.mkdirSync(outDir, { recursive: true })
  const src = path.join(srcDir, `${t.num}.pda`)
  try {
    if (force || !fs.existsSync(src)) {
      const res = await fetch(file.url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      fs.writeFileSync(src, Buffer.from(await res.arrayBuffer()))
      fetched++
      await sleep(delay)
    }
    const model = parsePda(fs.readFileSync(src))
    const glb = pdaToGlb(model)
    fs.writeFileSync(path.join(outDir, `${t.num}.glb`), glb)
    const d = describePda(model)
    manifest[key] = { rel: `${t.category}-models/${t.num}.glb`, bytes: glb.length, meshes: d.meshes, tris: d.tris }
    console.log(key, (glb.length / 1048576).toFixed(2) + 'MB', d.tris, d.meshes.join(','))
  } catch (e) {
    failed.push({ key, reason: String(e?.message || e), url: file.url })
    console.log(key, 'FAILED', String(e?.message || e))
  }
}
fs.writeFileSync(path.join(ROOT, 'public/mockup-models-manifest.json'), JSON.stringify({ schema: 'boxcraft.mockup-models.v1', models: manifest }, null, 1))
const total = Object.values(manifest).reduce((s, m) => s + m.bytes, 0)
console.log(`\nmodels ${Object.keys(manifest).length}/${targets.length}, downloaded now ${fetched}, total ${(total / 1048576).toFixed(1)}MB`)
if (failed.length) console.log('not available:', JSON.stringify(failed, null, 1))
