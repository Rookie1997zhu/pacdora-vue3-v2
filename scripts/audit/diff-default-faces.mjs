/**
 * At the catalogue default size, which faces of a spec template differ from the reference dieline?
 *   node scripts/audit/diff-default-faces.mjs <presetId> [...]   (no ids: presets marked fold3d:'differs')
 */
import fs from 'node:fs'
import {createKnife} from '../../src/knife.js'
import {PRESETS} from '../../src/catalog/index.js'
const ids=process.argv.slice(2)
const list=ids.length?ids:PRESETS.filter(p=>p.fold3d==='differs').map(p=>p.id)
const r=v=>Math.round(v*10)/10
for(const id of list){
  const p=PRESETS.find(x=>x.id===id)
  const raw=JSON.parse(fs.readFileSync(new URL(`../../public/${p.geomRel}`,import.meta.url),'utf8'))
  const ly=raw.layer.traditional||Object.values(raw.layer)[0]
  const run=T=>createKnife({templateId:p.templateId,length:p.length,width:p.width,height:Math.max(p.height,1),thickness:T,bleed:0,previewBleedExtra:0,sizeMode:'inner',thicknessMinMm:.1})
  const k=run(p.thickness||.5)
  const ref=new Map(ly.faces.map(f=>[f.name,f]))
  const F=ref.get(k.topology?.root)||ly.faces[0],O=k.faces.find(f=>f.name===F.name)||k.faces[0]
  const bad=[]
  for(const f of k.faces){
    const g=ref.get(f.name);if(!g){bad.push(f.name+':missing');continue}
    const dw=f.w-g.w,dh=f.h-g.h,dx=(f.x-O.x)-(g.x-F.x),dy=(f.y-O.y)-(g.y-F.y)
    if(Math.max(Math.abs(dw),Math.abs(dh),Math.abs(dx),Math.abs(dy))>1)bad.push(`${f.name}[dx${r(dx)} dy${r(dy)} dw${r(dw)} dh${r(dh)}]`)
  }
  console.log(id,p.templateId,`T preset ${p.thickness} sample ${raw.size.D} layer ${ly.thickness}`,`faces ${k.faces.length}/${ly.faces.length}`,bad.length?'DIFF '+bad.join(' '):'same')
}
