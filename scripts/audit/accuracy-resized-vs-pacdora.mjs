/**
 * Accuracy of resized dielines against the official Pacdora dielines at the same size.
 * Reference: docs/pacdora-multisize/<num>_<tag>.json — official dielines of the main boxes at sizes
 * other than the captured one (L / W / H one at a time, plus four mixed sizes a–d).
 * For every sample two templates are measured with the workbench default structure parameters:
 *   spec    the structure-spec template (what the ~560 boxes without multi-size samples use)
 *   live    the template the catalogue actually uses for this box (size-interpolated where enabled)
 * Grades as in check-pacdora-fidelity: A / B = panels match and sheet size within 0.5% / 2%, C = not.
 * A sample outside the allowed size range, or blocked by validation, is counted separately: the
 * user cannot get that dieline. Note: L / W / H samples were used to build the interpolated
 * templates, so for `live` only the mixed sizes a–d are an independent test.
 *   node scripts/audit/accuracy-resized-vs-pacdora.mjs out.json [samplesDir]
 */
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {TEMPLATES} from '../../src/templates/index.js'
import {PRESETS} from '../../src/catalog/index.js'
import {measure,gradeOf,sampleInput,presetParams} from '../check-pacdora-fidelity.mjs'

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..')
const DIR=process.argv[3]||path.join(ROOT,'docs','pacdora-multisize')
const DIMS=['length','width','height']
const rows=[]
for(const file of fs.readdirSync(DIR).filter(f=>f.endsWith('.json')).sort()){
  const m=/^(\d+)_(.+)\.json$/.exec(file)
  if(!m)continue
  const [,num,tag]=m
  const preset=PRESETS.find(p=>String(p.sourceNum)===num&&p.templateId&&TEMPLATES[p.templateId])
  if(!preset)continue
  let geom
  try{geom=JSON.parse(fs.readFileSync(path.join(DIR,file),'utf8'))}catch{continue}
  if(!geom?.layer)continue
  const input=sampleInput(geom)
  const live=TEMPLATES[preset.templateId]
  const specId=preset.templateId.startsWith('spec-')?preset.templateId:live.sampledFallback
  const row={num,tag,cat:preset.categoryId,size:`${input.length}x${input.width}x${input.height}`,liveTpl:preset.templateId,specTpl:specId||''}
  const scale=Math.max(...DIMS.map(d=>{const b=Number(preset[d])||0;return b>0?Math.abs(input[d]/b-1):0}))
  row.change=Math.round(scale*100)
  for(const [key,tid] of [['spec',specId],['live',preset.templateId]]){
    const t=tid&&TEMPLATES[tid]
    if(!t){row[key]='none';continue}
    const lim=t.limits||t.verifiedRange||{}
    const out=DIMS.some(d=>Array.isArray(lim[d])&&lim[d][1]>lim[d][0]&&!(lim[d][0]===0&&lim[d][1]>=2000)&&(input[d]<lim[d][0]-0.05||input[d]>lim[d][1]+0.05))
    if(out&&key==='spec'){row[key]='range';continue}
    const r=measure(tid,geom,{...input,params:presetParams({templateId:tid,openParams:preset.openParams})})
    if(r.error){row[key]='error';row[key+'Err']=r.error;continue}
    if(!r.valid){row[key]='blocked';continue}
    row[key]=gradeOf(r)
    row[key+'Sheet']=+(100*Math.max(r.sheetWErr,r.sheetHErr)).toFixed(2)
    row[key+'Cut']=+(100*r.cutErr).toFixed(2)
    row[key+'Faces']=`${r.faces}/${r.refFaces}`
  }
  rows.push(row)
}
fs.writeFileSync(process.argv[2],JSON.stringify(rows))
const tally=(k,f=()=>true)=>rows.filter(f).reduce((a,r)=>{a[r[k]]=(a[r[k]]||0)+1;return a},{})
console.log('samples',rows.length,'boxes',new Set(rows.map(r=>r.num)).size)
console.log('spec',tally('spec'))
console.log('live (mixed sizes a–d only)',tally('live',r=>/^[a-d]$/.test(r.tag)))
