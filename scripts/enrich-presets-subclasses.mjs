/**
 * 给 presets 打官方子类标签并生成侧栏统计。
 * 运输箱-only：无 structure_inventory 时，全部标为「运输箱」，并按名称启发式叠加 mailer/tuck/handle 等。
 */
import {readFileSync,writeFileSync,existsSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')

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

/** 运输箱页相关子类（去掉礼品/展示/塑料等空类） */
export const OFFICIAL_SUBCLASS_DEFS=[
  {id:'shipping',label:'运输箱',nameKey:'mailing-shipping-boxes'},
  {id:'mailer',label:'邮寄盒',nameKey:'mailer-box'},
  {id:'tuck',label:'插口盒',nameKey:'tuck-end-boxes'},
  {id:'folding',label:'折叠盒',nameKey:'folding-boxes'},
  {id:'handle',label:'带手柄的盒子',nameKey:'boxes-with-handle'},
  {id:'lid',label:'带盖盒',nameKey:'boxes-with-lid'},
  {id:'square',label:'方形盒',nameKey:'square-boxes'},
  {id:'other',label:'其他',nameKey:'boxes-others'}
]

const labelToId=Object.fromEntries(OFFICIAL_SUBCLASS_DEFS.map(d=>[d.label,d.id]))

function parseSubclassLabels(raw){
  return String(raw||'')
    .split(/[;|,，、]/)
    .map(s=>s.trim())
    .filter(Boolean)
    .filter(s=>labelToId[s])
}

function inferShippingSubs(p){
  const text=`${p.label||''} ${p.sourceNum||''}`.toLowerCase()
  const labels=new Set(['运输箱'])
  if(/mailer|邮寄|飞机|aircraft|flip.?top|翻盖/.test(text))labels.add('邮寄盒')
  if(/tuck|插舌|插口|反锁|锁底|snap.?lock|auto.?bottom/.test(text))labels.add('插口盒')
  if(/folding|折叠|配送/.test(text))labels.add('折叠盒')
  if(/handle|手柄|搬运|便携/.test(text))labels.add('带手柄的盒子')
  if(/lid|盖|zipper|拉链|撕拉/.test(text))labels.add('带盖盒')
  if(/square|方形/.test(text))labels.add('方形盒')
  return [...labels].filter(l=>labelToId[l]).map(l=>({id:labelToId[l],label:l}))
}

const detailPath=join(root,'structure_inventory','03_模型结构归类明细.csv')
const presetsPath=join(root,'src','catalog','presets.js')
const outDefs=join(root,'src','catalog','officialSubclasses.js')

if(!existsSync(presetsPath)){
  console.error('missing presets')
  process.exit(1)
}

const numToSubs={}
if(existsSync(detailPath)){
  const detail=loadCsv(detailPath)
  for(const r of detail){
    const num=String(r['模型编号']||'')
    if(!num)continue
    const labels=parseSubclassLabels(r['官方子类'])
    if(labels.length)numToSubs[num]=labels.map(l=>({id:labelToId[l],label:l})).filter(s=>s.id)
  }
}

const raw=readFileSync(presetsPath,'utf8')
const data=JSON.parse(raw.replace(/^\/\*\*[\s\S]*?\*\/\s*export\s+default\s+/,'').trim())

const counts=Object.fromEntries(OFFICIAL_SUBCLASS_DEFS.map(d=>[d.id,0]))
let withSub=0,without=0

for(const p of data.presets||[]){
  let subs=numToSubs[String(p.sourceNum)]||[]
  if(!subs.length)subs=inferShippingSubs(p)
  // 运输箱目录：保证至少有 shipping
  if(!subs.some(s=>s.id==='shipping')&&(p.categoryId==='shipping'||!p.categoryId)){
    subs=[{id:'shipping',label:'运输箱'},...subs]
  }
  p.subclassIds=subs.map(s=>s.id)
  p.subclassLabels=subs.map(s=>s.label)
  if(subs.length){
    withSub++
    for(const s of subs)counts[s.id]=(counts[s.id]||0)+1
  }else without++
}

const subclasses=OFFICIAL_SUBCLASS_DEFS.map(d=>({
  id:d.id,
  label:d.label,
  nameKey:d.nameKey,
  count:counts[d.id]||0
})).filter(s=>s.count>0||s.id==='shipping')

data.officialSubclasses=subclasses
data.subclassNote='Shipping-only official subclasses; a preset may belong to multiple.'

writeFileSync(
  presetsPath,
  `/** auto-generated — enriched with official subclasses */\nexport default ${JSON.stringify(data,null,2)}\n`
)

writeFileSync(
  outDefs,
  `/** Pacdora-aligned official box subclasses — shipping-only */\nexport const OFFICIAL_SUBCLASS_DEFS=${JSON.stringify(OFFICIAL_SUBCLASS_DEFS,null,2)}\n`
)

console.log(JSON.stringify({
  presets:data.presets.length,
  withSub,
  without,
  fromInventory:existsSync(detailPath),
  subclasses:subclasses.map(s=>`${s.label}:${s.count}`)
},null,2))
