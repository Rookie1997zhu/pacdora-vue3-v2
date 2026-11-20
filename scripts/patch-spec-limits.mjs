/**
 * 把结构规格的尺寸范围（spec.limits）收窄到刀版轮廓仍然完整的范围，其余内容原样不动。
 * 原来的范围只按「最小、最大两档能过契约校验」收窄，而契约校验看不出面板脱开；
 * 结果是范围内有些尺寸会被轮廓检查（OUTLINE_BROKEN，src/outlineIntegrity.js）拦住。
 * 做法（参数取规格默认值，多件盒每件都测）：
 *   1. 三个尺寸同比例缩放，从默认尺寸向两头逐档试，停在第一档坏掉之前
 *   2. 再逐个尺寸单独拉到新范围的两端（其余保持默认），坏了就把这一端往默认值收
 * 只收窄、不放宽；默认尺寸必须留在范围内。范围内的非同比例组合仍可能被轮廓检查拦住。
 * 之后需运行 build-spec-chunks、export-workbench-templates-seed，并在后端重新 seed_catalog。
 * 用法：node scripts/patch-spec-limits.mjs [--dry]
 */
import {readFileSync,writeFileSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createKnife} from '../src/knife.js'
import {TEMPLATES} from '../src/templates/index.js'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')
const specPath=join(root,'src','catalog','structureSpecs.js')
const dry=process.argv.includes('--dry')
const text=readFileSync(specPath,'utf8')
const header=text.slice(0,text.indexOf('export default '))
const data=JSON.parse(text.slice(text.indexOf('export default ')+15).trim())
const DIMS=['length','width','height']
const STEP=0.05
const usable=r=>Array.isArray(r)&&r.length===2&&Number(r[1])>Number(r[0])&&!(Number(r[0])===0&&Number(r[1])>=2000)
const r1=v=>Math.round(v*10)/10

const changed=[]
let unusable=0
for(const spec of data.specs){
  const t=TEMPLATES[`spec-${spec.code}`]
  if(!t||!spec.limits)continue
  const def=spec.defaults
  const dims=DIMS.filter(d=>usable(spec.limits[d])&&Number(def[d])>0)
  if(!dims.length)continue
  const pieces=(t.pieces||[]).map(p=>p.id)
  const whole=size=>{
    for(const piece of pieces.length?pieces:[undefined]){
      let k
      try{k=createKnife({templateId:t.id,...def,...size,thickness:def.thickness,bleed:0,sizeMode:'inner',piece,previewBleedExtra:0})}
      catch{return false}
      if(!k.validation?.ok)return false
    }
    return true
  }
  if(!whole({})){unusable++;continue}
  const lim=Object.fromEntries(dims.map(d=>[d,[...spec.limits[d]]]))
  const clampTo=(d,v)=>r1(Math.max(spec.limits[d][0],Math.min(spec.limits[d][1],v)))
  const at=k=>Object.fromEntries(dims.map(d=>[d,clampTo(d,def[d]*k)]))
  // 1. 同比例：向下 / 向上逐档
  const loK=Math.min(...dims.map(d=>spec.limits[d][0]/def[d])),hiK=Math.max(...dims.map(d=>spec.limits[d][1]/def[d]))
  let kLo=1,kHi=1
  for(let k=1-STEP;k>loK-STEP;k-=STEP){const kk=Math.max(k,loK);if(!whole(at(kk)))break;kLo=kk;if(kk===loK)break}
  for(let k=1+STEP;k<hiK+STEP;k+=STEP){const kk=Math.min(k,hiK);if(!whole(at(kk)))break;kHi=kk;if(kk===hiK)break}
  for(const d of dims){
    lim[d][0]=Math.min(def[d],Math.max(lim[d][0],Math.ceil(def[d]*kLo)))
    lim[d][1]=Math.max(def[d],Math.min(lim[d][1],Math.floor(def[d]*kHi)))
  }
  // 2. 单个尺寸拉到两端
  for(const d of dims){
    for(const end of [0,1]){
      let v=lim[d][end],guard=0
      while(Math.abs(v-def[d])>0.05&&!whole({[d]:v})&&guard++<40){
        v=end===0?Math.min(def[d],Math.ceil(v+(def[d]-v)*0.25)):Math.max(def[d],Math.floor(v-(v-def[d])*0.25))
      }
      lim[d][end]=v
    }
  }
  const before=JSON.stringify(Object.fromEntries(dims.map(d=>[d,spec.limits[d]])))
  if(JSON.stringify(lim)===before)continue
  changed.push({code:spec.code,sample:spec.sampleNum,def:dims.map(d=>def[d]).join('x'),from:dims.map(d=>spec.limits[d].join('–')).join(' / '),to:dims.map(d=>lim[d].join('–')).join(' / ')})
  if(!dry){spec.limits={...spec.limits,...lim};t.limits={...t.limits,...lim}}
}
if(!dry&&changed.length)writeFileSync(specPath,`${header}export default ${JSON.stringify(data)}\n`)
console.log(`patch-spec-limits: ${changed.length} specs ${dry?'would change':'updated'}; ${unusable} skipped (default size itself invalid)`)
for(const c of changed)console.log(`  ${c.code} (样本 ${c.sample}, 默认 ${c.def}): ${c.from}  →  ${c.to}`)
