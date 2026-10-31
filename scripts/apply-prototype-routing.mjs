/**
 * KnifePrototype 按名称分流到已有模板；templateSource=prototype-name（非权威）。
 * 输出 structure_inventory/13_KnifePrototype分流.csv
 */
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {resolvePrototypeTemplate} from '../src/catalog/structureCodeTemplates.js'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')
const presetsPath=join(root,'src','catalog','presets.js')
const detailPath=join(root,'structure_inventory','03_模型结构归类明细.csv')
const outDir=join(root,'structure_inventory')
mkdirSync(outDir,{recursive:true})

function parseCSV(t){
  const rows=[];let row=[],cur='',q=false
  for(let i=0;i<t.length;i++){
    const c=t[i],n=t[i+1]
    if(q){
      if(c==='"'&&n==='"'){cur+='"';i++}
      else if(c==='"')q=false
      else cur+=c
    }else if(c==='"')q=true
    else if(c===','){row.push(cur);cur=''}
    else if(c==='\n'||(c==='\r'&&n==='\n')){
      if(c==='\r')i++
      row.push(cur);rows.push(row);row=[];cur=''
    }else cur+=c
  }
  if(cur.length||row.length){row.push(cur);rows.push(row)}
  return rows
}

function loadCsv(path){
  const rows=parseCSV(readFileSync(path,'utf8').replace(/^\ufeff/,''))
  const headers=rows[0]
  return rows.slice(1).map(cols=>{
    const o={}
    headers.forEach((h,i)=>o[h]=cols[i]??'')
    return o
  })
}

function csvEscape(v){
  const s=String(v??'')
  return /[",\n\r]/.test(s)?`"${s.replace(/"/g,'""')}"`:s
}

if(!existsSync(presetsPath)||!existsSync(detailPath)){
  console.error('missing presets or detail')
  process.exit(1)
}

const protoNums=new Map()
for(const r of loadCsv(detailPath)){
  if(String(r['结构code']||'').trim()!=='KnifePrototype')continue
  protoNums.set(String(r['模型编号']),r['名称']||'')
}

const raw=readFileSync(presetsPath,'utf8')
const data=JSON.parse(raw.replace(/^\/\*\*[\s\S]*?\*\/\s*export\s+default\s+/,'').trim())
const rows=[]
let applied=0,missed=0

for(const p of data.presets||[]){
  const num=String(p.sourceNum)
  if(!protoNums.has(num))continue
  // 已有权威 structure-code 的不覆盖
  if(p.templateSource==='structure-code'){
    rows.push({num,name:p.label||protoNums.get(num),rule:'(skip structure-code)',template:p.templateId||'',corrected:''})
    continue
  }
  const hit=resolvePrototypeTemplate(`${p.label||''} ${protoNums.get(num)||''}`)
  if(!hit){
    missed++
    rows.push({num,name:p.label||protoNums.get(num),rule:'',template:'',corrected:''})
    continue
  }
  p.templateId=hit.templateId
  p.templateSource='prototype-name'
  applied++
  rows.push({num,name:p.label||protoNums.get(num),rule:hit.rule,template:hit.templateId,corrected:''})
}

let mapped=0
const byTemplate={}
for(const p of data.presets||[]){
  if(p.templateId)mapped++
  byTemplate[p.templateId||'unmapped']=(byTemplate[p.templateId||'unmapped']||0)+1
}
data.mapped=mapped
data.byTemplate=byTemplate

writeFileSync(
  presetsPath,
  `/** auto-generated — KnifePrototype name routing applied */\nexport default ${JSON.stringify(data,null,2)}\n`
)

const csv=[
  ['编号','名称','命中规则','模板','纠错回退'].join(','),
  ...rows.map(r=>[r.num,r.name,r.rule,r.template,r.corrected].map(csvEscape).join(','))
].join('\n')
writeFileSync(join(outDir,'13_KnifePrototype分流.csv'),csv+'\n')

console.log(JSON.stringify({prototypeInPresets:rows.length,applied,missed,mapped},null,2))
