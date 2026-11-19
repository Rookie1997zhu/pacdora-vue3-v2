// Multi-layer boxes: compare our 3D assembly with Pacdora's own 3D result and derive, per layer and
// per animation step, the position correction that makes them coincide.
//
// Input : scripts/data/pacdora-3d-ref/<num>.json — per layer, the bounding box (mm, Pacdora's Y-up
//         frame) at the start and at the end of every animation step, taken from the model Pacdora
//         builds on its product page.
// Output: src/catalog/layerAssemblyRef.js — { <num>: { stages, ok, layers: { <layerId>: [[dx,dy,dz]…] } } }
// Usage : node scripts/build-layer-assembly-ref.mjs [--verbose]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { knifeFromPacdoraGeom } from '../src/pacdoraGeomKnife.js'
import { buildGeomRig } from '../src/geomRig.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REF_DIR = path.join(ROOT, 'scripts', 'data', 'pacdora-3d-ref')
const verbose = process.argv.includes('--verbose')
const CATS = ['square', 'gift', 'mailer', 'shipping']

function geomOf(num) {
  for (const c of CATS) {
    const f = path.join(ROOT, 'public', `${c}-geom`, `${num}.json`)
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'))
  }
  return null
}

function layerBoxes(rig) {
  rig.root.updateMatrixWorld(true)
  const out = {}
  const v = new THREE.Vector3()
  for (const it of rig.assembly.items) {
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]
    it.group.traverse((o) => {
      if (!o.isMesh) return
      const p = o.geometry.attributes.position
      for (let j = 0; j < p.count; j++) {
        v.fromBufferAttribute(p, j).applyMatrix4(o.matrixWorld).applyMatrix4(rig.assembly.toReference)
        const a = [v.x, v.y, v.z]
        for (let q = 0; q < 3; q++) { b[q] = Math.min(b[q], a[q]); b[q + 3] = Math.max(b[q + 3], a[q]) }
      }
    })
    out[it.piece.id] = b
  }
  return out
}

/** our rig without any correction; returns per stage the layer boxes */
function measure(geom, num, stages) {
  const knife = knifeFromPacdoraGeom(geom, { sourceNum: num, noAssemblyRef: true })
  if (stages && knife.foldStages.length > stages) knife.foldStages = knife.foldStages.slice(0, stages)
  const rig = buildGeomRig(knife, {
    verifyAssembly: false,
    makeMesh: (f) => new THREE.Mesh(new THREE.PlaneGeometry(Math.max(f.w, 0.01), Math.max(f.h, 0.01))),
  })
  const n = rig.stageCount
  const frames = []
  for (let i = 0; i <= n; i++) {
    if (i === 0) {
      rig.apply(0)
      for (const it of rig.assembly.items) if (!it.loose) { it.group.position.copy(it.pos); it.group.quaternion.copy(it.quat) }
    } else rig.apply(i >= n ? 1 : i / n + 1e-9)
    frames.push(layerBoxes(rig))
  }
  return { frames, n, signature: rig.assembly.items.map((it) => `${it.piece.id}:${Math.round(it.piece.w)}x${Math.round(it.piece.h)}`).join('|') }
}

const center = (b) => [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2]
const size = (b) => [b[3] - b[0], b[4] - b[1], b[5] - b[2]]
const result = {}
const report = []
const signatures = new Map()

for (const file of fs.readdirSync(REF_DIR).filter((f) => f.endsWith('.json')).sort()) {
  const ref = JSON.parse(fs.readFileSync(path.join(REF_DIR, file), 'utf8'))
  const num = String(ref.model)
  const geom = geomOf(num)
  if (!geom) { report.push(`${num}: no captured geometry`); continue }
  const stages = ref.all.length - 1
  const ours = measure(geom, num, stages)
  const count = Math.min(stages, ours.n)
  const layers = {}
  let worstFinal = 0
  let maxFix = 0
  for (const [id, boxes] of Object.entries(ref.layers)) {
    if (!ours.frames[0][id]) { report.push(`${num}: layer ${id} missing in our model`); continue }
    const offs = []
    for (let i = 0; i <= count; i++) {
      const rb = boxes[i].split(',').map(Number)
      const ob = ours.frames[i][id]
      const rc = center(rb), oc = center(ob)
      const d = rc.map((v, k) => Math.round((v - oc[k]) * 10) / 10)
      offs.push(d.map((v) => (Math.abs(v) < 1.5 ? 0 : v)))
      if (i === count) {
        const rs = size(rb), os = size(ob)
        worstFinal = Math.max(worstFinal, ...rs.map((v, k) => Math.abs(v - os[k])))
      }
      if (verbose) console.log(num, id.slice(-26).padEnd(26), 'step', i, 'fix', d.join(','), 'size ours', size(ob).map(Math.round).join('x'), 'ref', size(rb).map(Math.round).join('x'))
    }
    maxFix = Math.max(maxFix, ...offs.flat().map(Math.abs))
    if (offs.some((o) => o.some((v) => v !== 0))) layers[id] = offs
  }
  // "ok": after the position fix every layer has the reference's size at the end (rotations agree)
  const ok = worstFinal <= 12
  result[num] = { stages: count, ok, layers }
  signatures.set(ours.signature, num)
  report.push(`${num}: steps ${count}${ours.n !== stages ? ` (ours ${ours.n}, ref ${stages})` : ''}, layers fixed ${Object.keys(layers).length}/${Object.keys(ref.layers).length}, largest fix ${Math.round(maxFix)}mm, final size mismatch ${Math.round(worstFinal)}mm → ${ok ? 'OK' : 'NOT OK'} (ref final ${ref.all[ref.all.length - 1]})`)
}

// Same structure and same sheet sizes as a referenced box (a derived mock-up of it): reuse its data
for (const c of CATS) {
  const dir = path.join(ROOT, 'public', `${c}-geom`)
  if (!fs.existsSync(dir)) continue
  for (const f of fs.readdirSync(dir)) {
    const num = f.replace('.json', '')
    if (result[num]) continue
    const geom = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
    if (Object.values(geom.layer || {}).filter((l) => Array.isArray(l?.faces) && l.faces.length).length < 2) continue
    const src = signatures.get(measure(geom, num, 0).signature)
    if (src) { result[num] = { ...result[src], sameAs: src }; report.push(`${num}: same sheets as ${src} → reuses its data`) }
  }
}

const body = `// generated by scripts/build-layer-assembly-ref.mjs — do not edit\nexport default ${JSON.stringify(result)}\n`
fs.writeFileSync(path.join(ROOT, 'src', 'catalog', 'layerAssemblyRef.js'), body)
console.log(report.join('\n'))
console.log(`written ${Object.keys(result).length} entries, ${(body.length / 1024).toFixed(1)} KB`)
