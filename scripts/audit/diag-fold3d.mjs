/**
 * Why does a box's fold recipe not match the reference replay? Folds both to the closed state and
 * lists, per face, how far the face ends up from where the reference puts it (relative to the root).
 *   node scripts/audit/diag-fold3d.mjs <presetId> [...]
 */
import {readFileSync} from 'node:fs'
import * as THREE from 'three'
import {createKnife} from '../../src/knife.js'
import {knifeFromPacdoraGeom} from '../../src/pacdoraGeomKnife.js'
import {buildGeomRig} from '../../src/geomRig.js'
import {fold3dKnife} from '../../src/foldRecipe.js'
import {PRESETS} from '../../src/catalog/index.js'
const plane=f=>new THREE.Mesh(new THREE.BoxGeometry(Math.max(f.w,.1),Math.max(f.h,.1),.1))
function folded(knife){
  const rig=buildGeomRig(knife,{makeMesh:plane,zOff:0})
  rig.apply(1);rig.root.updateMatrixWorld(true)
  const out={}
  const nodes=rig.nodes instanceof Map?[...rig.nodes.entries()]:Object.entries(rig.nodes||{})
  for(const [name,n] of nodes){
    const obj=n.mesh||n.group||n.pivot||n
    if(!obj?.isObject3D)continue
    const b=new THREE.Box3().setFromObject(n.mesh||obj)
    const c=b.getCenter(new THREE.Vector3()),s=b.getSize(new THREE.Vector3())
    out[name]={c,s}
  }
  const size=new THREE.Box3().setFromObject(rig.root).getSize(new THREE.Vector3())
  return {out,size,stages:rig.stageCount,root:knife.topology?.root}
}
for(const id of process.argv.slice(2)){
  const p=PRESETS.find(x=>x.id===id)
  const k=createKnife({templateId:p.templateId,length:p.length,width:p.width,height:Math.max(p.height,1),thickness:p.thickness||.5,bleed:0,previewBleedExtra:0,sizeMode:'inner',thicknessMinMm:.1})
  const raw=JSON.parse(readFileSync(new URL(`../../public/${p.geomRel}`,import.meta.url),'utf8'))
  const ref=knifeFromPacdoraGeom(raw,{sourceNum:p.sourceNum})
  const A=folded(fold3dKnife(k)),B=folded(ref)
  const f=v=>[v.x,v.y,v.z].map(n=>n.toFixed(0)).join(',')
  console.log(`\n${id} ${p.templateId} pieces=${k.piece||'-'} faces ours=${k.faces.length} ref=${ref.faces.length} stages ours=${A.stages} ref=${B.stages} size ours=${f(A.size)} ref=${f(B.size)}`)
  const names=Object.keys(B.out)
  const missing=names.filter(n=>!A.out[n])
  if(missing.length)console.log('  faces only in ref:',missing.join(' '))
  // align by the centroid of shared faces
  const shared=names.filter(n=>A.out[n])
  const rows=shared.map(n=>({n,ds:A.out[n].s.clone().sub(B.out[n].s),sa:A.out[n].s,sb:B.out[n].s}))
  const bad=rows.filter(r=>Math.max(Math.abs(r.ds.x),Math.abs(r.ds.y),Math.abs(r.ds.z))>5)
  console.log(`  shared ${shared.length}; faces whose folded orientation/extent differs: ${bad.length}`)
  for(const r of bad.slice(0,14))console.log(`   ${r.n} ours ${f(r.sa)} ref ${f(r.sb)}`)
}
