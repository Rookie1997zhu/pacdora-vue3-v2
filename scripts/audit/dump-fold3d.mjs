/**
 * Dump the folded (closed) state of a box as face quads in world space, for our fold recipe and for
 * the reference replay, so the two can be drawn side by side.
 *   node scripts/audit/dump-fold3d.mjs out.json <presetId> [...]     (no ids: every preset marked fold3d:'differs')
 */
import fs from 'node:fs'
import * as THREE from 'three'
import {createKnife} from '../../src/knife.js'
import {knifeFromPacdoraGeom} from '../../src/pacdoraGeomKnife.js'
import {buildGeomRig} from '../../src/geomRig.js'
import {fold3dKnife} from '../../src/foldRecipe.js'
import {PRESETS} from '../../src/catalog/index.js'
import {TEMPLATES} from '../../src/templates/index.js'
import {pieceGeometry} from '../../src/templates/sampled/sampledTemplate.js'
// face quad = bounding box of the real outline (see scripts/lib/foldCompare.mjs)
const plane=f=>{
  const o=Array.isArray(f.outline3d)&&f.outline3d.length>=3?f.outline3d:(Array.isArray(f.outline)&&f.outline.length>=3?f.outline:null)
  let x0=f.x,x1=f.x+f.w,y0=f.y,y1=f.y+f.h
  if(o){const xs=o.map(a=>+a[0]),ys=o.map(a=>+a[1]);x0=Math.min(...xs);x1=Math.max(...xs);y0=Math.min(...ys);y1=Math.max(...ys)}
  const cx=f.x+f.w/2,cy=f.y+f.h/2
  const m=new THREE.Mesh(new THREE.BoxGeometry(Math.max(f.w,.1),Math.max(f.h,.1),.1))
  m.userData.box=[x0-cx,-(y1-cy),x1-cx,-(y0-cy)]
  return m
}
export function foldedQuads(knife,s=1){
  const rig=buildGeomRig(knife,{makeMesh:plane,zOff:0,verifyAssembly:false})
  rig.apply(s);rig.root.updateMatrixWorld(true)
  const out={}
  for(const [name,n] of rig.nodes){
    const m=n.mesh
    if(!m?.userData?.box)continue
    const [ax,ay,bx,by]=m.userData.box
    out[name]=[[ax,ay],[bx,ay],[bx,by],[ax,by]].map(([x,y])=>{const v=new THREE.Vector3(x,y,0).applyMatrix4(m.matrixWorld);return [v.x,v.y,v.z].map(a=>Math.round(a*10)/10)})
  }
  return out
}
const [,,outFile,...args]=process.argv
const pieceArg=args.find(a=>a.startsWith('--piece='))?.slice(8)
const ids=args.filter(a=>!a.startsWith('--'))
const list=ids.length?ids:PRESETS.filter(p=>p.fold3d==='differs').map(p=>p.id)
const dump={}
for(const id of list){
  const p=PRESETS.find(x=>x.id===id)
  const k=createKnife({templateId:p.templateId,length:p.length,width:p.width,height:Math.max(p.height,1),thickness:p.thickness||.5,bleed:0,previewBleedExtra:0,sizeMode:'inner',thicknessMinMm:.1,piece:pieceArg})
  const raw=JSON.parse(fs.readFileSync(new URL(`../../public/${p.geomRel}`,import.meta.url),'utf8'))
  const pcs=TEMPLATES[p.templateId]?.pieces
  const ref=knifeFromPacdoraGeom(pieceArg&&pcs?pieceGeometry(raw,pcs,pieceArg):raw,{sourceNum:p.sourceNum})
  const rk=fold3dKnife(k)
  dump[id]={template:p.templateId,out:raw.outSize,ours:rk?foldedQuads(rk):{},ref:foldedQuads(ref),oursHalf:rk?foldedQuads(rk,.5):{},refHalf:foldedQuads(ref,.5)}
}
fs.writeFileSync(outFile,JSON.stringify(dump))
console.log('dumped',Object.keys(dump).length)
