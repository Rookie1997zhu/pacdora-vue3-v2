/**
 * 按结构 code 把导入尺寸挂到 rea-* 模板；可 --prefixes 启用前缀族。
 * 结构 code 取自预设 structureCode（backfill-structure-codes.mjs 从采集几何回填）；
 * structure_inventory 明细表存在时作为补充来源，不存在也可运行。
 */
import {readFileSync,writeFileSync,existsSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {resolveStructureTemplate,STRUCTURE_CODE_EXACT} from '../src/catalog/structureCodeTemplates.js'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')
const usePrefixes=process.argv.includes('--prefixes')
const presetsPath=join(root,'src','catalog','presets.js')
const detailPath=join(root,'structure_inventory','03_模型结构归类明细.csv')

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

if(!existsSync(presetsPath)){
  console.error('missing presets')
  process.exit(1)
}
const hasDetail=existsSync(detailPath)
if(!hasDetail)console.warn('structure_inventory detail missing — using presets[].structureCode only')

const numToCode={}
const codeHits={}
for(const r of (hasDetail?loadCsv(detailPath):[])){
  const num=String(r['模型编号']||'')
  const code=String(r['结构code']||'').trim()
  if(!num||!code)continue
  numToCode[num]=code
  codeHits[code]=(codeHits[code]||0)+1
}

const raw=readFileSync(presetsPath,'utf8')
const data=JSON.parse(raw.replace(/^\/\*\*[\s\S]*?\*\/\s*export\s+default\s+/,'').trim())

let applied=0,already=0,skipped=0
const byTpl={}
const byCategory={}
const prefixPreview={}

for(const p of data.presets||[]){
  const code=p.structureCode||numToCode[String(p.sourceNum)]
  if(code&&!p.structureCode)p.structureCode=code
  if(!code){skipped++;continue}
  const tid=resolveStructureTemplate(code,{usePrefixes})
  if(!tid){
    // 预览前缀命中（即便未启用）
    const preview=resolveStructureTemplate(code,{usePrefixes:true})
    if(preview&&!STRUCTURE_CODE_EXACT[code]){
      prefixPreview[code]=(prefixPreview[code]||0)+1
    }
    skipped++
    continue
  }
  if(p.templateId===tid){already++;continue}
  p.templateId=tid
  p.templateSource='structure-code'
  applied++
  byTpl[tid]=(byTpl[tid]||0)+1
  const cat=p.categoryId||'(none)'
  byCategory[cat]=(byCategory[cat]||0)+1
}
const appliedByCategory=byCategory

const byTemplate={},countByCategory={}
let mapped=0
for(const p of data.presets||[]){
  const k=p.templateId||'unmapped'
  if(p.templateId)mapped++
  byTemplate[k]=(byTemplate[k]||0)+1
  countByCategory[p.categoryId]=(countByCategory[p.categoryId]||0)+1
}
data.mapped=mapped
data.byTemplate=byTemplate
data.byCategory=countByCategory
if(Array.isArray(data.categories)){
  data.categories=data.categories.map(c=>({...c,count:countByCategory[c.id]||0}))
}

writeFileSync(
  presetsPath,
  `/** auto-generated — structure-code templates applied */\nexport default ${JSON.stringify(data,null,2)}\n`
)

console.log(JSON.stringify({
  usePrefixes,
  applied,
  already,
  skipped,
  mapped:data.mapped,
  byTpl,
  appliedByCategory,
  exactCodes:Object.keys(STRUCTURE_CODE_EXACT).length,
  prefixPreviewTop:Object.entries(prefixPreview).sort((a,b)=>b[1]-a[1]).slice(0,15)
},null,2))
