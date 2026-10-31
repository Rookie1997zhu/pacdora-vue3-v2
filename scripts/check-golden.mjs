import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {dirname,join} from 'node:path'
import {createKnife} from '../src/knife.js'
import {FACE_ORDER,assertStableTopology} from '../src/knifeContract.js'
import {toDxf} from '../src/exportDieline.js'

const root=dirname(fileURLToPath(import.meta.url))
const fixture=JSON.parse(readFileSync(join(root,'fixtures/golden.json'),'utf8'))
const expect=fixture.expect||{}
const samples=fixture.samples||[]
assert.ok(samples.length>=3,'golden needs >=3 samples')

const knives={}
for(const s of samples){
  const k=createKnife({
    length:s.length,width:s.width,height:s.height,
    thickness:s.thickness,bleed:s.bleed,
    sizeMode:s.sizeMode||'inner',
    fluteDirection:s.fluteDirection||'L',
    materialId:s.materialId||'kraft'
  })
  knives[s.id]=k

  assert.equal(k.faces.length,expect.faceCount??19,`${s.id}: faceCount`)
  assert.equal(k.hinges.length,expect.hingeCount??18,`${s.id}: hingeCount`)
  assert.deepEqual(k.faces.map(f=>f.name),[...FACE_ORDER],`${s.id}: FACE_ORDER`)
  assert.equal(k.validation?.ok,true,`${s.id}: validation.ok`)
  assert.equal(k.productionReady,true,`${s.id}: productionReady`)
  assert.equal(k.manufacturingReady,expect.manufacturingReady??false,`${s.id}: manufacturingReady`)
  for(const role of ['trim','crease','bleed']){
    assert.ok(Array.isArray(k.layers?.[role]?.segments),`${s.id}: layers.${role}`)
  }
  const dxf=toDxf(k)
  assert.ok(dxf.includes('TRIM')&&dxf.includes('CREASE')&&dxf.includes('BLEED'),`${s.id}: DXF layers`)

  const foldCheck=(k.validation?.checks||[]).find(c=>c.id==='foldClosed')
  console.log(`ok golden ${s.id} foldClosed=${foldCheck?.ok} ${foldCheck?.message||''}`)
}

assertStableTopology(knives.default,knives.min)
assertStableTopology(knives.default,knives.large)
console.log('ok stable topology default↔min / default↔large')
console.log('check-golden: all passed')
