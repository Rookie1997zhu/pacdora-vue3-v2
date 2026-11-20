/**
 * 3D 合盖回归：结构规格模板带的折叠配方（fold3d）折出来的合盖包围盒，
 * 应与直接回放金样折叠动画的结果一致（三个方向各差 ≤15%）。
 * 覆盖工作台开放定制的折叠盒与托盘盒；另在放大后的尺寸上确认仍能合成接近外尺寸的盒子。
 */
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import * as THREE from 'three'
import {createKnife} from '../src/knife.js'
import {knifeFromPacdoraGeom} from '../src/pacdoraGeomKnife.js'
import {buildGeomRig} from '../src/geomRig.js'
import {fold3dKnife} from '../src/foldRecipe.js'
import {PRESETS} from '../src/catalog/index.js'

const plane=f=>new THREE.Mesh(new THREE.BoxGeometry(Math.max(f.w,.1),Math.max(f.h,.1),.1))
function closedDims(knife){
  const rig=buildGeomRig(knife,{makeMesh:plane,zOff:0})
  rig.apply(1)
  rig.root.updateMatrixWorld(true)
  const s=new THREE.Box3().setFromObject(rig.root).getSize(new THREE.Vector3())
  return [s.x,s.y,s.z].sort((a,b)=>b-a)
}
const ratio=(X,Y)=>Math.max(
  ...X.map((v,i)=>Math.max(v,1)/Math.max(Y[i],1)),
  ...Y.map((v,i)=>Math.max(v,1)/Math.max(X[i],1)),
)
const make=(p,k=1)=>createKnife({
  templateId:p.templateId,length:p.length*(k>1?1.3:1),width:p.width*(k>1?1.2:1),height:Math.max(p.height,1)*(k>1?1.15:1),
  thickness:p.thickness||.5,bleed:0,previewBleedExtra:0,sizeMode:'inner',thicknessMinMm:.1,
})

let total=0,noRecipe=0,match=0,resizedOk=0,resizedTotal=0
const misses=[]
// 目录里已标注 fold3d:'differs' 的盒型是已知缺陷（页面上不提供 3D 合盖），不算回归
const knownMisses=[]
for(const p of PRESETS){
  if(!['folding','tray'].includes(p.categoryId))continue
  if(!String(p.templateId||'').startsWith('spec-')||p.fidelity==='none')continue
  total++
  const recipe=fold3dKnife(make(p))
  if(!recipe){noRecipe++;continue}
  const ours=closedDims(recipe)
  const raw=JSON.parse(readFileSync(new URL(`../public/${p.geomRel}`,import.meta.url),'utf8'))
  const ref=closedDims(knifeFromPacdoraGeom(raw,{sourceNum:p.sourceNum}))
  if(ratio(ours,ref)<=1.15)match++
  else (p.fold3d==='differs'?knownMisses:misses).push(`${p.id} ours=${ours.map(v=>v.toFixed(0)).join('x')} ref=${ref.map(v=>v.toFixed(0)).join('x')}`)
  // 改尺寸后：参考样本本身能合成接近外尺寸的盒子时，放大后的也应如此
  const o=raw.outSize||{}
  const out=[+o.L||0,+o.W||0,+o.H||0].sort((a,b)=>b-a)
  if(out[0]>0&&ratio(ref,out)<=1.35){
    resizedTotal++
    const k2=make(p,2)
    const o2=k2.dimensions.outer
    if(ratio(closedDims(fold3dKnife(k2)),[o2.length,o2.width,o2.height].sort((a,b)=>b-a))<=1.35)resizedOk++
  }
}
console.log(`check-fold3d: specs=${total} matchReplay=${match} knownDiffers=${knownMisses.length} noRecipe=${noRecipe} resizedOk=${resizedOk}/${resizedTotal}`)
if(misses.length)console.log('  not matching replay:\n  '+misses.slice(0,12).join('\n  '))
assert.equal(noRecipe,0,'every customizable spec box carries a fold recipe')
// 以前按比例（≥93%）把关；大批盒型改用按尺寸插值模板后，仍用规格模板的盒型变少，已知缺陷的占比被动升高。
// 改为：除已标注的以外不许有新的不一致，已知缺陷的个数也不许增加。
assert.equal(misses.length,0,`fold recipe differs from the reference replay on boxes not annotated as such: ${misses.join('; ')}`)
assert.ok(knownMisses.length<=13,`known fold3d defects must not grow (got ${knownMisses.length})`)
assert.ok(resizedOk/Math.max(1,resizedTotal)>=.93,`resized boxes must still close (got ${resizedOk}/${resizedTotal})`)
