/**
 * 3D 合盖回归：结构规格模板带的折叠配方（fold3d）折出来的合盖包围盒，
 * 应与直接回放金样折叠动画的结果一致（三个方向各差 ≤15%）。
 * 覆盖工作台开放定制的折叠盒与托盘盒；另在放大后的尺寸上确认仍能合成接近外尺寸的盒子。
 */
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {fold3dKnife} from '../src/foldRecipe.js'
import {PRESETS} from '../src/catalog/index.js'
import {compareFold,closedDims,ratio,outerDims,presetKnife} from './lib/foldCompare.mjs'

let total=0,noRecipe=0,match=0,resizedOk=0,resizedTotal=0
const misses=[]
// 目录里已标注 fold3d:'differs' 的盒型是已知缺陷（页面上不提供 3D 合盖），不算回归
const knownMisses=[]
for(const p of PRESETS){
  if(!['folding','tray'].includes(p.categoryId))continue
  if(!String(p.templateId||'').startsWith('spec-')||p.fidelity==='none')continue
  total++
  const raw=JSON.parse(readFileSync(new URL(`../public/${p.geomRel}`,import.meta.url),'utf8'))
  const cmp=compareFold(p,raw)
  if(cmp.status==='none'){noRecipe++;continue}
  const note=`${p.id} ${cmp.parts.map(x=>`${x.piece?x.piece+' ':''}ours=${x.ours.map(v=>v.toFixed(0)).join('x')} ref=${x.ref.map(v=>v.toFixed(0)).join('x')}`).join('; ')}`
  if(cmp.status==='ok')match++
  else (p.fold3d==='differs'?knownMisses:misses).push(note)
  // 改尺寸后：参考样本本身能合成接近外尺寸的盒子时，放大后的也应如此（单件盒）
  const out=outerDims(raw)
  if(out[0]>0&&cmp.parts.length===1&&ratio(cmp.parts[0].ref,out)<=1.35){
    resizedTotal++
    const k2=presetKnife(p,undefined,true)
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
assert.ok(knownMisses.length<=2,`known fold3d defects must not grow (got ${knownMisses.length})`)
assert.ok(resizedOk/Math.max(1,resizedTotal)>=.93,`resized boxes must still close (got ${resizedOk}/${resizedTotal})`)
