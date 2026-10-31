/**
 * 非 spec-* 预设分桶 → 未映射名单/19_非规格剩余分桶.csv
 */
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import presets from '../src/catalog/presets.js'
import {resolveStructureTemplate} from '../src/catalog/structureCodeTemplates.js'
import {REA_TEMPLATES} from '../src/templates/rea/index.js'
import {pickCompileLayer} from './lib/pickCompileLayer.mjs'
import {faceSignature} from '../src/templates/spec/specTemplate.js'
import specData from '../src/catalog/structureSpecs.js'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')
const geomDir=join(root,'geometry','pacdora_boxes')
const outDir=join(root,'未映射名单')
mkdirSync(outDir,{recursive:true})

const FAMILY=new Set(['cylinder-box','sleeve-drawer','rea-flat-sheet'])
const REA_BY_ID=Object.fromEntries(REA_TEMPLATES.map(t=>[t.id,t]))
const specsByCode=new Map()
for(const s of specData?.specs||[]){
  const sc=s.structureCode||(String(s.code).includes('__')?String(s.code).split('__')[0]:s.code)
  if(!specsByCode.has(sc))specsByCode.set(sc,[])
  specsByCode.get(sc).push(s)
}

function sampleFaceCount(num){
  const f=join(geomDir,`${num}.json`)
  if(!existsSync(f))return 0
  try{return (pickCompileLayer(JSON.parse(readFileSync(f,'utf8')))?.faces||[]).length}catch{return 0}
}
function sampleSig(num){
  const f=join(geomDir,`${num}.json`)
  if(!existsSync(f))return null
  try{
    const ly=pickCompileLayer(JSON.parse(readFileSync(f,'utf8')))
    return ly?faceSignature((ly.faces||[]).map(x=>x.name)):null
  }catch{return null}
}
function reaFaceCount(tid){
  const t=REA_BY_ID[tid]
  return Array.isArray(t?.faceOrder)?t.faceOrder.length:0
}
function jaccard(a,b){
  const A=new Set(String(a||'').split('|').filter(Boolean))
  const B=new Set(String(b||'').split('|').filter(Boolean))
  if(!A.size&&!B.size)return 1
  let inter=0
  for(const x of A)if(B.has(x))inter++
  return inter/(A.size+B.size-inter||1)
}
function compileSkipReason(num){
  const f=join(geomDir,`${num}.json`)
  if(!existsSync(f))return 'geometry-missing'
  try{
    const j=JSON.parse(readFileSync(f,'utf8'))
    const ly=pickCompileLayer(j)
    if(!ly)return 'multi-layer'
    if((ly.faces||[]).length<2)return 'too-few-faces'
    return null
  }catch{return 'geometry-unreadable'}
}

const rows=[['sourceNum','structureCode','templateId','templateSource','bucket','detail']]
const counts={}
for(const p of presets.presets||[]){
  const tid=p.templateId||''
  if(String(tid).startsWith('spec-'))continue
  let bucket='other',detail=''
  if(!tid){bucket='unmapped';detail='no template'}
  else if(p.modelOnly){bucket='modelOnly';detail='flat 3d mock'}
  else if(tid==='cylinder-box'||tid==='sleeve-drawer'){bucket='newFamily';detail=tid}
  else if(p.templateSource==='map-override-manual'){bucket='manual';detail=tid}
  else{
    const exact=resolveStructureTemplate(p.structureCode)
    if(exact&&FAMILY.has(exact)){bucket='newFamily';detail=exact}
    else if(exact&&REA_BY_ID[exact]){
      const sn=sampleFaceCount(p.sourceNum),rn=reaFaceCount(exact)
      const mismatch=rn>0&&sn>0&&Math.abs(rn-sn)/Math.max(rn,sn)>.4
      if(!mismatch){bucket='reaOk';detail=`faces ${sn}~${rn}`}
      else{
        bucket='reaMismatch'
        detail=`faces sample=${sn} rea=${rn}`
        const skip=compileSkipReason(p.sourceNum)
        if(skip){bucket=`compileSkip:${skip}`;detail+=`;${skip}`}
      }
    }else{
      const list=specsByCode.get(p.structureCode)||[]
      const sig=sampleSig(p.sourceNum)
      const hit=list.find(s=>s.sig===sig||s.sampleNum===String(p.sourceNum))
      if(hit){bucket='specAvailable';detail=`should mount ${hit.code}`}
      else if(list.length){
        let best=0,bestCode=''
        for(const s of list){
          const j=jaccard(sig,s.sig)
          if(j>best){best=j;bestCode=s.code}
        }
        if(best>=.85){bucket='sigFuzzy';detail=`jaccard=${best.toFixed(2)} → ${bestCode}`}
        else{bucket='sigMismatch';detail=`bestJ=${best.toFixed(2)}`}
      }else if(p.structureCode==='KnifePrototype'){
        bucket='prototypeOk'
        detail='KnifePrototype accepted — no structure spec'
      }else{
        const skip=compileSkipReason(p.sourceNum)
        bucket=skip?`compileSkip:${skip}`:'noSpec'
        detail=skip||'no compiled spec'
      }
    }
  }
  counts[bucket]=(counts[bucket]||0)+1
  rows.push([p.sourceNum,p.structureCode||'',tid,p.templateSource||'',bucket,detail.replace(/,/g,';')])
}

writeFileSync(join(outDir,'19_非规格剩余分桶.csv'),rows.map(r=>r.join(',')).join('\n'),'utf8')
console.log(JSON.stringify({total:rows.length-1,counts},null,2))
