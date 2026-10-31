/**
 * 诊断 cutApprox / bleedApprox / extraCutLoops / cutChosen。
 * 输出 未映射名单/21_外裁回退原因.csv + 21_外裁回退基线.json
 * 用法：node scripts/audit/cut-approx-report.mjs [--limit 500]
 */
import {writeFileSync,mkdirSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createKnife} from '../../src/knife.js'
import presets from '../../src/catalog/presets.js'

const root=join(dirname(fileURLToPath(import.meta.url)),'..','..')
const outDir=join(root,'未映射名单')
mkdirSync(outDir,{recursive:true})

const arg=(name,def)=>{
  const i=process.argv.indexOf(`--${name}`)
  return i>=0&&process.argv[i+1]?process.argv[i+1]:def
}
const LIMIT=Math.max(50,Number(arg('limit',800))||800)

const key=p=>p.map(n=>Math.round(n*1000)/1000).join(',')
const isSimpleLoop=loop=>{
  if(!loop||loop.length<3)return false
  return new Set(loop.map(p=>key(p))).size===loop.length
}

function reasonOf(k){
  if(!k?.meta?.anyPoly)return 'rectOnly'
  if(!k.meta.cutApprox)return 'ok'
  if(k.meta.cutApproxReason)return k.meta.cutApproxReason
  const loop=k.cutLoop||[]
  const b=k.bounds
  if(loop.length===4){
    const xs=loop.map(p=>p[0]),ys=loop.map(p=>p[1])
    const aabb=Math.min(...xs)<=b.minX+1e-3&&Math.max(...xs)>=b.maxX-1e-3
      &&Math.min(...ys)<=b.minY+1e-3&&Math.max(...ys)>=b.maxY-1e-3
    if(aabb)return 'aabbFallback'
  }
  if(!isSimpleLoop(loop))return 'notSimple'
  return 'notCoverOrNoBoundary'
}

function bleedBucket(k){
  if(!(k.bleed>0))return 'bleed0'
  if(!k.meta?.anyPoly)return 'rectBleed'
  if(k.meta?.cutApprox)return 'cutApproxBleed'
  if(k.meta?.bleedApprox)return 'aabbBleed'
  return 'polyBleed'
}

const rows=[['sourceNum','templateId','reason','chosen','faceCount','anyPoly','cutApprox','bleedApprox','extraCutLoops','outlineFaces','bleedBucket']]
const counts={},bleedCounts={},chosenCounts={},extraHist={0:0,1:0,2:0,'3+':0}
let n=0,approx=0,bleedApproxN=0,anyPolyN=0,extraSum=0,extraN=0

for(const p of presets.presets||[]){
  if(n>=LIMIT)break
  if(!p.templateId)continue
  if(p.modelOnly)continue
  try{
    const k=createKnife({
      templateId:p.templateId,
      length:p.length||100,width:p.width||80,height:Math.max(p.height||40,1),
      thickness:p.thickness||1.5,bleed:3
    })
    n++
    if(k.meta?.anyPoly)anyPolyN++
    if(k.meta?.cutApprox)approx++
    if(k.meta?.bleedApprox)bleedApproxN++
    const reason=reasonOf(k)
    counts[reason]=(counts[reason]||0)+1
    const chosen=k.meta?.cutChosen||(k.meta?.cutApprox?'rects':'?')
    chosenCounts[chosen]=(chosenCounts[chosen]||0)+1
    const bb=bleedBucket(k)
    bleedCounts[bb]=(bleedCounts[bb]||0)+1
    const ex=k.meta?.extraCutLoops||0
    extraSum+=ex;extraN++
    if(ex===0)extraHist[0]++
    else if(ex===1)extraHist[1]++
    else if(ex===2)extraHist[2]++
    else extraHist['3+']++
    const olN=(k.faces||[]).filter(f=>Array.isArray(f.outline)&&f.outline.length>=3).length
    if(k.meta?.cutApprox||k.meta?.bleedApprox||ex>0||reason!=='ok'||chosen==='rects'){
      rows.push([p.sourceNum,p.templateId,reason,chosen,k.faces.length,!!k.meta?.anyPoly,!!k.meta?.cutApprox,!!k.meta?.bleedApprox,ex,olN,bb])
    }
  }catch(e){
    counts.createKnifeFail=(counts.createKnifeFail||0)+1
    rows.push([p.sourceNum,p.templateId,`fail:${String(e.message||e).slice(0,60)}`,'fail',0,false,true,false,0,0,'fail'])
  }
}

writeFileSync(join(outDir,'21_外裁回退原因.csv'),rows.map(r=>r.join(',')).join('\n'),'utf8')
const baseline={
  sampled:n,anyPoly:anyPolyN,
  cutApprox:approx,
  cutApproxPct:n?+(approx/n*100).toFixed(1):0,
  bleedApprox:bleedApproxN,
  bleedApproxPct:n?+(bleedApproxN/n*100).toFixed(1):0,
  bleedBuckets:bleedCounts,
  chosen:chosenCounts,
  extraCutLoops:{sum:extraSum,avg:extraN?+(extraSum/extraN).toFixed(2):0,hist:extraHist},
  reasons:counts
}
writeFileSync(join(outDir,'21_外裁回退基线.json'),JSON.stringify(baseline,null,2),'utf8')
console.log(JSON.stringify(baseline,null,2))
