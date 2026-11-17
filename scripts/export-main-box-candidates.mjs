/**
 * 主力盒型候选清单：把导入盒型按「数据质量」排序，供业务挑选主力盒型。
 * 质量 = 2D 吻合度档位（exact/close）+ 3D 合盖是否与金样动画一致 + 可调结构参数个数。
 * 只是技术侧的候选排序，不含销量或业务判断。输出 docs/主力盒型候选清单.csv
 */
import {readFileSync,writeFileSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import * as THREE from 'three'
import {createKnife} from '../src/knife.js'
import {TEMPLATES} from '../src/templates/index.js'
import {knifeFromPacdoraGeom} from '../src/pacdoraGeomKnife.js'
import {buildGeomRig} from '../src/geomRig.js'
import {fold3dKnife} from '../src/foldRecipe.js'
import {PRESETS} from '../src/catalog/index.js'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')
const plane=f=>new THREE.Mesh(new THREE.BoxGeometry(Math.max(f.w,.1),Math.max(f.h,.1),.1))
const closed=k=>{const rig=buildGeomRig(k,{makeMesh:plane,zOff:0});rig.apply(1);rig.root.updateMatrixWorld(true);const s=new THREE.Box3().setFromObject(rig.root).getSize(new THREE.Vector3());return [s.x,s.y,s.z].sort((a,b)=>b-a)}
const ratio=(X,Y)=>Math.max(...X.map((v,i)=>Math.max(v,1)/Math.max(Y[i],1)),...Y.map((v,i)=>Math.max(v,1)/Math.max(X[i],1)))
const csvCell=v=>{const s=String(v??'');return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s}

const rows=[]
for(const p of PRESETS){
  if(p.fidelity!=='exact'&&p.fidelity!=='close')continue
  const t=TEMPLATES[p.templateId]
  if(!t)continue
  const pieces=Array.isArray(t.pieces)&&t.pieces.length>1?t.pieces.length:1
  let fold3d='n/a'
  try{
    const raw=JSON.parse(readFileSync(join(root,'public',p.geomRel),'utf8'))
    if(pieces===1){
      const k=createKnife({templateId:p.templateId,length:p.length,width:p.width,height:p.height,thickness:p.thickness||.5,bleed:0,previewBleedExtra:0,sizeMode:'inner',thicknessMinMm:.1})
      const rk=fold3dKnife(k)
      if(rk)fold3d=ratio(closed(rk),closed(knifeFromPacdoraGeom(raw,{sourceNum:p.sourceNum})))<=1.15?'ok':'differs'
      else fold3d='no-recipe'
    }
  }catch{fold3d='error'}
  const params=(t.paramDefs||[]).length
  // 排序分：精确 > 近似；3D 一致加分；单件优先；有可调参数加分
  const score=(p.fidelity==='exact'?100:50)+(fold3d==='ok'?30:0)+(pieces===1?10:0)+Math.min(10,params)
  rows.push({score,category:p.categoryLabel||p.categoryId,id:p.id,sourceNum:p.sourceNum,label:p.label,structureCode:p.structureCode||'',
    fidelity:p.fidelity,fold3d,pieces,params,L:p.length,W:p.width,H:p.height,T:p.thickness,url:`/workbench/${p.id}`})
}
rows.sort((a,b)=>b.score-a.score||String(a.category).localeCompare(String(b.category))||String(a.sourceNum).localeCompare(String(b.sourceNum)))
const cols=['score','category','sourceNum','label','structureCode','fidelity','fold3d','pieces','params','L','W','H','T','url','id']
const out='\uFEFF'+[cols.join(','),...rows.map(r=>cols.map(c=>csvCell(r[c])).join(','))].join('\n')
writeFileSync(join(root,'docs','主力盒型候选清单.csv'),out,'utf8')
const tier1=rows.filter(r=>r.fidelity==='exact'&&r.fold3d==='ok')
const byCat={}
for(const r of rows){const c=byCat[r.category]??={total:0,exact3d:0,close3d:0};c.total++;if(r.fold3d==='ok'){if(r.fidelity==='exact')c.exact3d++;else c.close3d++}}
console.log(JSON.stringify({candidates:rows.length,exactAnd3dOk:tier1.length,byCategory:byCat},null,1))
