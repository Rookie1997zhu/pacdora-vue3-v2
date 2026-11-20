/**
 * 3D 合盖外形的比较（annotate-preset-fold3d / check-fold3d 共用）。
 *
 * 面片的「大小」取真实外轮廓的包围盒，不取名义矩形：官方几何里面片的 x/y/w/h 是名义矩形，
 * 插舌、提手等会画到矩形外面；结构规格模板的面片矩形则本来就是外轮廓的包围盒。
 * 用名义矩形量，同一个盒子两边量出来会差出一截（曾经因此把 7 个折得一样的盒型判成「有差异」）。
 *
 * 多件盒（单图层）：逐件比较 —— 模板一次只出一件，参考刀版按同一份面片名单取出那一件。
 */
import * as THREE from 'three'
import {createKnife} from '../../src/knife.js'
import {TEMPLATES} from '../../src/templates/index.js'
import {knifeFromPacdoraGeom} from '../../src/pacdoraGeomKnife.js'
import {buildGeomRig} from '../../src/geomRig.js'
import {fold3dKnife} from '../../src/foldRecipe.js'
import {pieceGeometry} from '../../src/templates/sampled/sampledTemplate.js'

export function shapedMesh(f){
  const o=Array.isArray(f.outline)&&f.outline.length>=3?f.outline:null
  let w=Math.max(f.w,.1),h=Math.max(f.h,.1),ox=0,oy=0
  if(o){
    const xs=o.map(a=>Number(a[0])),ys=o.map(a=>Number(a[1]))
    const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys)
    if([x0,x1,y0,y1].every(Number.isFinite)){
      w=Math.max(x1-x0,.1);h=Math.max(y1-y0,.1)
      ox=(x0+x1)/2-(f.x+f.w/2);oy=-((y0+y1)/2-(f.y+f.h/2))
    }
  }
  const g=new THREE.BoxGeometry(w,h,.1)
  g.translate(ox,oy,0)
  return new THREE.Mesh(g)
}
export function closedDims(knife){
  const rig=buildGeomRig(knife,{makeMesh:shapedMesh,zOff:0})
  rig.apply(1)
  rig.root.updateMatrixWorld(true)
  const s=new THREE.Box3().setFromObject(rig.root).getSize(new THREE.Vector3())
  return [s.x,s.y,s.z].sort((a,b)=>b-a)
}
export const ratio=(X,Y)=>Math.max(
  ...X.map((v,i)=>Math.max(v,1)/Math.max(Y[i],1)),
  ...Y.map((v,i)=>Math.max(v,1)/Math.max(X[i],1)),
)
export const outerDims=raw=>{const o=raw?.outSize||{};return [+o.L||0,+o.W||0,+o.H||0].sort((a,b)=>b-a)}

export const presetKnife=(p,piece,scale)=>createKnife({
  templateId:p.templateId,
  length:p.length*(scale?1.3:1),width:p.width*(scale?1.2:1),height:Math.max(p.height,1)*(scale?1.15:1),
  thickness:p.thickness||.5,bleed:0,previewBleedExtra:0,sizeMode:'inner',thicknessMinMm:.1,piece,
})

/**
 * 模板的折叠配方与参考回放比较。
 * @returns {{status:'ok'|'differs'|'none',worst:number,parts:Array<{piece:string|null,ours:number[],ref:number[],ratio:number}>}}
 */
export function compareFold(p,raw){
  const t=TEMPLATES[p.templateId]
  const pieces=Array.isArray(t?.pieces)&&t.pieces.length>1&&t.pieces.every(x=>Array.isArray(x.faces))
    &&Object.keys(raw.layer||{}).length===1?t.pieces:null
  const parts=[]
  for(const pc of pieces||[null]){
    const recipe=fold3dKnife(presetKnife(p,pc?.id))
    if(!recipe)return {status:'none',worst:Infinity,parts}
    const refRaw=pc?pieceGeometry(raw,pieces,pc.id):raw
    if(!refRaw)return {status:'none',worst:Infinity,parts}
    const ours=closedDims(recipe),ref=closedDims(knifeFromPacdoraGeom(refRaw,{sourceNum:p.sourceNum}))
    parts.push({piece:pc?.id||null,ours,ref,ratio:ratio(ours,ref)})
  }
  let worst=Math.max(...parts.map(x=>x.ratio))
  let status=worst<=1.15?'ok':'differs'
  // 参考回放本身合不拢、而配方折出来的更接近官方标称外尺寸：算配方是对的（只对单件盒有意义）
  if(status==='differs'&&!pieces){
    const out=outerDims(raw),x=parts[0]
    if(out[2]>0&&ratio(x.ours,out)<=1.1&&ratio(x.ours,out)<ratio(x.ref,out))status='ok'
  }
  return {status,worst,parts}
}
