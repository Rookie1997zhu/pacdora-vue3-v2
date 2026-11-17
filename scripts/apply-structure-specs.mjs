/**
 * 把结构规格模板（spec-*）挂到导入预设：structureCode 命中且金样面片签名一致才接管。
 * 精确 REA 映射优先；面数偏差 >40% 且有匹配规格时接管（structure-spec-takeover）。
 * 支持 code__num 多签名规格；templateSource=structure-spec，specFrom 记录接管前模板。
 */
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import specData from '../src/catalog/structureSpecs.js'
import {faceSignature} from '../src/templates/spec/specTemplate.js'
import {resolveStructureTemplate} from '../src/catalog/structureCodeTemplates.js'
import {REA_TEMPLATES} from '../src/templates/rea/index.js'
import {pickCompileLayer} from './lib/pickCompileLayer.mjs'
import {createGeomResolver,legacyGeomFile} from './lib/presetGeom.mjs'
import {measure,sampleInput,presetParams,acceptable,scoreOf} from './check-pacdora-fidelity.mjs'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')
const presetsPath=join(root,'src','catalog','presets.js')
const geomDir=join(root,'geometry','pacdora_boxes')
const outDir=join(root,'未映射名单')
mkdirSync(outDir,{recursive:true})

const FAMILY_TEMPLATE_IDS=new Set(['cylinder-box','sleeve-drawer','rea-flat-sheet'])
/** 编号 → 几何文件；读入预设后初始化 */
let geomFileOf=()=>null
const REA_BY_ID=Object.fromEntries(REA_TEMPLATES.map(t=>[t.id,t]))

/** code → [specs]；同时按完整 spec.code 索引 */
const specsByStructure=new Map()
const specById=new Map()
for(const s of specData?.specs||[]){
  specById.set(s.code,s)
  const sc=s.structureCode||(String(s.code).includes('__')?String(s.code).split('__')[0]:s.code)
  if(!specsByStructure.has(sc))specsByStructure.set(sc,[])
  specsByStructure.get(sc).push(s)
}

function geometrySignature(num){
  const file=geomFileOf(num)
  if(!file)return null
  try{
    const j=JSON.parse(readFileSync(file,'utf8'))
    const ly=pickCompileLayer(j)
    if(!ly)return null
    return faceSignature((ly?.faces||[]).map(f=>f.name))
  }catch(e){
    console.warn(`apply-structure-specs: geometry ${num} unreadable: ${e.message}`)
    return null
  }
}

function sampleFaceCount(num){
  const file=geomFileOf(num)
  if(!file)return 0
  try{
    const j=JSON.parse(readFileSync(file,'utf8'))
    return (pickCompileLayer(j)?.faces||[]).length
  }catch{return 0}
}

function reaFaceCount(templateId){
  const t=REA_BY_ID[templateId]
  return Array.isArray(t?.faceOrder)?t.faceOrder.length:0
}

function faceCountMismatch(reaN,sampleN){
  if(!(reaN>0&&sampleN>0))return false
  return Math.abs(reaN-sampleN)/Math.max(reaN,sampleN)>.4
}

function sigNames(sig){return new Set(String(sig||'').split('|').filter(Boolean))}
function jaccardSig(a,b){
  const A=sigNames(a),B=sigNames(b)
  if(!A.size&&!B.size)return 1
  let inter=0
  for(const x of A)if(B.has(x))inter++
  return inter/(A.size+B.size-inter||1)
}

/** 按 code + 签名找规格；优先精确 code__num，再签名，再 Jaccard≥0.85（不要求面数相等） */
function findSpec(structureCode,sourceNum,sig){
  const list=specsByStructure.get(structureCode)||[]
  if(!list.length)return null
  // 1) 精确 sample：code__num / sampleNum（同号金样即权威）
  const byNum=list.find(s=>s.code===`${structureCode}__${sourceNum}`||s.sampleNum===String(sourceNum))
  if(byNum)return byNum
  // 2) 签名精确匹配
  if(sig){
    const bySig=list.find(s=>s.sig===sig)
    if(bySig)return bySig
  }
  // 3) Jaccard ≥0.85（允许面名集合大小略差）
  if(sig){
    let best=null,bestJ=0
    for(const s of list){
      const j=jaccardSig(sig,s.sig)
      if(j>=.85&&j>bestJ){bestJ=j;best=s}
    }
    if(best)return best
  }
  // 4) 主规格（code 本身）
  return list.find(s=>s.code===structureCode)||null
}

function sigOk(sampleSig,specSig){
  if(!sampleSig||!specSig)return true
  if(sampleSig===specSig)return true
  return jaccardSig(sampleSig,specSig)>=.85
}

/** 同号样本编译的规格免签；否则走 sigOk */
function mountSigOk(sourceNum,spec,sampleSig){
  if(spec?.sampleNum!=null&&String(spec.sampleNum)===String(sourceNum))return true
  if(spec?.code===`${spec?.structureCode||''}__${sourceNum}`)return true
  // code__num 形式：spec.code 以 __sourceNum 结尾
  if(spec?.code&&String(spec.code).endsWith(`__${sourceNum}`))return true
  return !(sampleSig&&!sigOk(sampleSig,spec.sig))
}

const raw=readFileSync(presetsPath,'utf8')
const data=JSON.parse(raw.replace(/^\/\*\*[\s\S]*?\*\/\s*export\s+default\s+/,'').trim())
geomFileOf=createGeomResolver(root,data.presets)
const rows=[]
let applied=0,takeover=0,restored=0

// 增量构建时先还原上一轮的规格接管
for(const p of data.presets||[]){
  if(p.templateSource!=='structure-spec'&&p.templateSource!=='structure-spec-takeover')continue
  p.templateId=p.specFrom||null
  delete p.templateSource
  delete p.specFrom
  restored++
}

/**
 * 吻合度把关：规格在金样尺寸下必须结构对得上（acceptable），且比当前模板更接近金样，才接管。
 * @returns {null|string} null=可接管；否则为不接管的原因
 */
function fidelityVeto(p,spec){
  const file=geomFileOf(p.sourceNum)
  if(!file)return null
  let geom
  try{geom=JSON.parse(readFileSync(file,'utf8'))}catch{return null}
  const mSpec=measure(`spec-${spec.code}`,geom,sampleInput(geom))
  if(!acceptable(mSpec)){
    // 早期全库样本（geometry/pacdora_boxes）里没有其它模板可用的条目沿用原行为，不因把关而变成未挂载
    if(!p.templateId&&existsSync(legacyGeomFile(root,p.sourceNum)))return null
    return 'fidelity-reject'
  }
  if(!p.templateId)return null
  const mCur=measure(p.templateId,geom,{
    length:p.length,width:p.width,height:p.height,thickness:p.thickness||.5,
    params:presetParams(p),
  })
  return scoreOf(mSpec)<scoreOf(mCur)?null:'fidelity-keep-current'
}

const restoreOnly=process.argv.includes('--restore')
for(const p of restoreOnly?[]:data.presets||[]){
  const code=p.structureCode
  if(!code||!specsByStructure.has(code))continue
  const exact=resolveStructureTemplate(code)
  if(exact&&FAMILY_TEMPLATE_IDS.has(exact))continue

  const sig=geometrySignature(p.sourceNum)
  const spec=findSpec(code,p.sourceNum,sig)
  if(!spec){
    rows.push([p.sourceNum,code,p.templateId||'','','no-spec'])
    continue
  }

  // 精确 REA：仅当面数失配时接管
  if(exact){
    const sn=sampleFaceCount(p.sourceNum)
    const rn=reaFaceCount(exact)
    // 面数失配，或该样本有自己的规格（精确模板吻合度不达标时才会编出）才考虑接管
    const ownSpec=String(spec.sampleNum)===String(p.sourceNum)
    if(!faceCountMismatch(rn,sn)&&!ownSpec)continue
    if(!mountSigOk(p.sourceNum,spec,sig)){
      rows.push([p.sourceNum,code,p.templateId||'',`spec-${spec.code}`,'takeover-sig-mismatch'])
      continue
    }
    const vetoT=fidelityVeto(p,spec)
    if(vetoT){
      rows.push([p.sourceNum,code,p.templateId||'',`spec-${spec.code}`,vetoT])
      continue
    }
    const from=p.templateId
    const id=`spec-${spec.code}`
    rows.push([p.sourceNum,code,from||'',id,'takeover'])
    p.specFrom=from||null
    p.templateId=id
    p.templateSource='structure-spec-takeover'
    takeover++
    continue
  }

  if(!mountSigOk(p.sourceNum,spec,sig)){
    rows.push([p.sourceNum,code,p.templateId||'',`spec-${spec.code}`,'signature-mismatch'])
    continue
  }
  const veto=fidelityVeto(p,spec)
  if(veto){
    rows.push([p.sourceNum,code,p.templateId||'',`spec-${spec.code}`,veto])
    continue
  }
  const from=p.templateId
  const id=`spec-${spec.code}`
  rows.push([p.sourceNum,code,from||'',id,'applied'])
  p.specFrom=from||null
  p.templateId=id
  p.templateSource='structure-spec'
  applied++
}

const byTemplate={},byCategory={}
let mapped=0
for(const p of data.presets||[]){
  if(p.templateId)mapped++
  const k=p.templateId||'unmapped'
  byTemplate[k]=(byTemplate[k]||0)+1
  byCategory[p.categoryId]=(byCategory[p.categoryId]||0)+1
}
data.mapped=mapped
data.byTemplate=byTemplate
data.byCategory=byCategory
if(Array.isArray(data.categories)){
  data.categories=data.categories.map(c=>({...c,count:byCategory[c.id]||0}))
}

writeFileSync(
  presetsPath,
  `/** auto-generated — structure specs applied */\nexport default ${JSON.stringify(data,null,2)}\n`
)
const csv=['sourceNum,structureCode,from,to,status',...rows.map(r=>r.join(','))]
writeFileSync(join(outDir,'18_结构规格挂载明细.csv'),csv.join('\n'),'utf8')
console.log(JSON.stringify({
  specs:specById.size,restored,applied,takeover,
  mismatch:rows.filter(r=>r[4]==='signature-mismatch').length,
  mapped
},null,2))
