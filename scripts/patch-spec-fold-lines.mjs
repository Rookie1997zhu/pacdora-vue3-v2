/**
 * 给结构规格的 3D 折叠步骤（spec.fs）补上「这一步绕哪条折线转」，其余内容原样不动。
 *
 * 有些面在不同步骤里绕不同的折线转（如平口盒的防尘翼：先随侧板翻，再绕自己的斜折线折）。
 * 参考回放的每条转动指令带着折线名，骨架据此逐步复合（geomRig.multiFoldSteps）；
 * 规格里原先只记了 {面, 角度}，全都当成绕主折线转，这类面就被甩到盒外（156280 / 156281）。
 * 这里只给「折线不在该面主折线上」的指令补三个字段：
 *   l  折线两端，记成该面 bbox 内的 UV（与 fr.h 同一套基准，运行时套到当前尺寸）
 *   v  转轴方向（单位向量，沿用金样的正负号）
 *   n  折线名（同一步里区分多条折线用）
 * 之后需运行 build-spec-chunks。用法：node scripts/patch-spec-fold-lines.mjs [--dry]
 */
import {readFileSync,writeFileSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {knifeFromPacdoraGeom} from '../src/pacdoraGeomKnife.js'
import {pickFoldStages} from '../src/geomRig.js'
import {pickCompileLayer} from './lib/pickCompileLayer.mjs'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')
const specPath=join(root,'src','catalog','structureSpecs.js')
const dry=process.argv.includes('--dry')
const text=readFileSync(specPath,'utf8')
const header=text.slice(0,text.indexOf('export default '))
const data=JSON.parse(text.slice(text.indexOf('export default ')+15).trim())
const presets=JSON.parse(readFileSync(join(root,'src','catalog','presets.js'),'utf8').replace(/^\/\*\*[\s\S]*?\*\/\s*export\s+default\s+/,'').trim()).presets||[]
const r3=n=>Math.round(n*1000)/1000
const u4=n=>Math.round(n*10000)/10000
const changed=[],skipped=[]

/** 面的两种矩形：名义矩形、外轮廓包围盒。规格用哪一种，看哪一种能还原出已存的主折线 UV（fr.h） */
function basisOf(face,stored){
  const nominal={x:face.x,y:face.y,w:face.w,h:face.h}
  const o=Array.isArray(face.outline)&&face.outline.length>=3?face.outline:null
  let box=nominal
  if(o){
    const xs=o.map(a=>a[0]),ys=o.map(a=>a[1])
    box={x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)}
  }
  if(!Array.isArray(stored)||!Array.isArray(face.hingeLine))return box
  const err=b=>Math.max(...face.hingeLine.map(([px,py],i)=>Math.max(Math.abs((px-b.x)/b.w-stored[i][0]),Math.abs((py-b.y)/b.h-stored[i][1]))))
  return err(nominal)<err(box)?nominal:box
}

for(const spec of data.specs){
  if(!Array.isArray(spec.fs)||!spec.fs.length)continue
  const p=presets.find(x=>String(x.sourceNum)===String(spec.sampleNum)&&(x.templateId===`spec-${spec.code}`||x.structureCode===spec.code))
    ||presets.find(x=>String(x.sourceNum)===String(spec.sampleNum))
  const rel=p&&(p.geomPublicRel||p.geomRel)
  if(!rel)continue
  let rk
  try{
    const raw=JSON.parse(readFileSync(join(root,'public',rel),'utf8'))
    let ly=null
    try{ly=pickCompileLayer(raw)}catch{ly=null}
    if(!ly?.faces?.length)ly=raw.layer?.traditional
    rk=knifeFromPacdoraGeom({...raw,layer:{traditional:ly}},{sourceNum:spec.sampleNum})
  }catch{continue}
  const picked=pickFoldStages(rk)||rk.foldStages||[]
  const known=new Set(spec.fs.flat().map(s=>s.c||s.f))
  const faceBy=new Map((rk.faces||[]).map(f=>[f.name,f]))
  const specFace=new Map((spec.faces||[]).map(f=>[f.n,f]))
  const off=(line,x,y)=>{const [[ax,ay],[bx,by]]=line,len=Math.hypot(bx-ax,by-ay);return len<1e-6?0:Math.abs((x-ax)*(by-ay)-(y-ay)*(bx-ax))/len}
  let added=0
  const fs=picked.map(stage=>(stage||[]).map(s=>{
    if(s.child&&known.has(s.child)&&Number.isFinite(s.rotate)){
      const step={c:s.child,r:r3(s.rotate)}
      const face=faceBy.get(s.child)
      const main=face?.hingeLine
      const away=Array.isArray(s.line)&&Array.isArray(main)&&main.length===2
        &&(off(main,s.line[0][0],s.line[0][1])>0.5||off(main,s.line[1][0],s.line[1][1])>0.5)
      if(away&&face.w>1e-6&&face.h>1e-6){
        const b=basisOf(face,specFace.get(s.child)?.fr?.h)
        step.l=s.line.map(([px,py])=>[u4((px-b.x)/b.w),u4((py-b.y)/b.h)])
        const v=s.vector,len=v?Math.hypot(Number(v.x)||0,Number(v.y)||0,Number(v.z)||0):0
        if(len>1e-9)step.v=[r3((Number(v.x)||0)/len),r3((Number(v.y)||0)/len),r3((Number(v.z)||0)/len)]
        if(s.fold)step.n=String(s.fold)
        added++
      }
      return step
    }
    if(s.face&&known.has(s.face)&&s.move)return {f:s.face,m:[r3(s.move.x||0),r3(s.move.y||0),r3(s.move.z||0)]}
    return null
  }).filter(Boolean)).filter(stage=>stage.length)
  if(!added)continue
  // 只在步骤本身（面、角度、顺序）与规格里已有的完全一致时才补，避免顺手改了别的
  const strip=list=>JSON.stringify(list.map(st=>st.map(s=>s.c?{c:s.c,r:s.r}:s)))
  if(strip(fs)!==strip(spec.fs)){skipped.push(`${spec.code} (样本 ${spec.sampleNum})`);continue}
  if(JSON.stringify(fs)===JSON.stringify(spec.fs))continue
  changed.push(`${spec.code} (样本 ${spec.sampleNum}): ${added} 条指令`)
  spec.fs=fs
}
if(!dry&&changed.length)writeFileSync(specPath,`${header}export default ${JSON.stringify(data)}\n`)
console.log(`patch-spec-fold-lines: ${changed.length} specs ${dry?'would change':'updated'}; ${skipped.length} skipped (steps differ from the spec)`)
for(const c of changed)console.log('  '+c)
for(const c of skipped)console.log('  skipped '+c)
