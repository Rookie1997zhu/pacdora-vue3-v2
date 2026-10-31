import assert from 'node:assert/strict'
import {createKnife,derivePanelSizes} from '../src/knife.js'
import {neutralMeshOffset,foldRotation,estimateClosedCollisions,gapBetween,aabbOverlap} from '../src/foldSim.js'
import {TEMPLATE_LIST} from '../src/templates/index.js'

// 中性层与旋转符号
assert.deepEqual(neutralMeshOffset(2),{x:0,y:0,z:-1})
assert.deepEqual(foldRotation('top',1),{x:1,y:0,z:0})
assert.deepEqual(foldRotation('bottom',1),{x:-1,y:0,z:0})
assert.deepEqual(foldRotation('left',1),{x:0,y:1,z:0})
assert.deepEqual(foldRotation('right',1),{x:0,y:-1,z:0})

// inner / outer 在同一物理外廓下 panel 一致
const T=1.5
const innerIn={length:315,width:202,height:62,thickness:T,sizeMode:'inner'}
const dInner=derivePanelSizes(innerIn)
const outerIn={
  length:dInner.outer.length,width:dInner.outer.width,height:dInner.outer.height,
  thickness:T,sizeMode:'outer'
}
const dOuter=derivePanelSizes(outerIn)
assert.deepEqual(dInner.panel,dOuter.panel,'inner/outer panel parity')
assert.deepEqual(dInner.inner,dOuter.inner,'inner/outer inner parity')
assert.deepEqual(dInner.outer,dOuter.outer,'inner/outer outer parity')

const kInner=createKnife({...innerIn,bleed:5,fluteDirection:'L'})
const kOuter=createKnife({...outerIn,bleed:5,fluteDirection:'L'})
assert.deepEqual(kInner.dimensions.panel,kOuter.dimensions.panel,'knife panel parity')
assert.equal(kInner.faces.length,19)
assert.equal(kInner.dimensions.sizeMode,'inner')
assert.equal(kOuter.dimensions.sizeMode,'outer')
assert.equal(kInner.dimensions.fluteDirection,'L')

// 固定内尺寸，增大 T → outer 变大
const thin=derivePanelSizes({length:315,width:202,height:62,thickness:1,sizeMode:'inner'})
const thick=derivePanelSizes({length:315,width:202,height:62,thickness:3,sizeMode:'inner'})
assert.equal(thin.inner.length,thick.inner.length)
assert.ok(thick.outer.length>thin.outer.length,'outer grows with T')
assert.ok(thick.panel.length>thin.panel.length,'panel grows with T')

// 合盖检测结构合法；默认尺寸应通过（翼/插舌与墙有嵌入）
const coll=estimateClosedCollisions(kInner,T)
assert.equal(typeof coll.ok,'boolean')
assert.ok(Array.isArray(coll.issues))
assert.equal(coll.ok,true,`default closed should pass, got ${JSON.stringify(coll.issues)}`)
assert.equal(coll.skipped,undefined,'mailer should not skip')

// gapBetween / aabbOverlap 可测
const a={min:[0,0,0],max:[1,1,1]},b={min:[.5,.5,.5],max:[2,2,2]},c={min:[3,0,0],max:[4,1,1]}
assert.equal(aabbOverlap(a,b),true)
assert.equal(gapBetween(a,b),0)
assert.ok(gapBetween(a,c)>0)

// 每个模板默认尺寸合盖通过且非 skipped（supportsClosedCheck===false 的弧面族跳过）
for(const t of TEMPLATE_LIST){
  if(t.supportsClosedCheck===false){
    console.log(`skip closed ${t.id} (no closedCheck)`)
    continue
  }
  assert.ok(t.closedCheck,'closedCheck on '+t.id)
  const k=createKnife({templateId:t.id,...t.defaults,bleed:3})
  const r=estimateClosedCollisions(k,t.defaults.thickness)
  assert.notEqual(r.skipped,true,`${t.id}: must not skip`)
  assert.equal(r.ok,true,`${t.id}: closed ok, issues=${JSON.stringify(r.issues)}`)
  assert.equal(k.topology.supportsClosedCheck,true,`${t.id}: supportsClosedCheck`)
  console.log(`ok closed ${t.id}`)
}

console.log('check-fold: all passed')
