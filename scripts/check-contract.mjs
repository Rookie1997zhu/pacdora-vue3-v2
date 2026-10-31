import assert from 'node:assert/strict'
import {createKnife} from '../src/knife.js'
import {FACE_ORDER,assertStableTopology,validateKnife} from '../src/knifeContract.js'

const def=createKnife({length:315,width:202,height:62,thickness:1.5,bleed:5,materialId:'kraft'})
assert.equal(def.schema,'boxcraft.knife.v3')
assert.equal(def.validation.ok,true,'default validation.ok')
assert.equal(def.productionReady,true,'productionReady === validation.ok')
assert.equal(def.manufacturingReady,false,'manufacturingReady always false')
assert.equal(def.material.id,'kraft')
assert.equal(def.material.science,'demo-board')
assert.deepEqual(def.faces.map(f=>f.name),[...FACE_ORDER])
for(const role of ['trim','crease','bleed']){
  assert.ok(def.layers[role],'layers.'+role)
  assert.ok(Array.isArray(def.layers[role].segments),role+' segments')
}
assert.equal(def.layers.trim.segments,def.cuts)
assert.equal(def.layers.crease.segments,def.folds)
assert.equal(def.layers.bleed.segments,def.bleeds)
console.log('ok default contract')

const a=createKnife({length:200,width:150,height:40,thickness:1.5,materialId:'white'})
const b=createKnife({length:400,width:280,height:90,thickness:2,materialId:'blue'})
assertStableTopology(a,b)
assert.equal(a.material.id,'white')
assert.equal(b.material.id,'blue')
assert.equal(a.manufacturingReady,false)
assert.equal(b.manufacturingReady,false)
console.log('ok stable topology across sizes')

const broken={...def,faces:def.faces.slice(0,-1),hinges:def.hinges.slice(0,-1),layers:def.layers}
delete broken.validation
delete broken.productionReady
const bad=validateKnife(broken)
assert.equal(bad.ok,false,'missing face fails validation')
assert.ok(bad.checks.some(c=>c.id==='faceCount'&&!c.ok))
console.log('ok broken faceCount fails gate')

console.log('check-contract: all passed')
