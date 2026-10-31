/**
 * 把 inventory 中 H=0（CanCylinder）/ W=0（StarBox*）条目注入 presets（CSV 过滤器会丢掉它们）。
 */
import {readFileSync,writeFileSync,existsSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {resolveStructureTemplate,STARBOX_POINTS_BY_CODE} from '../src/catalog/structureCodeTemplates.js'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')
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

if(!existsSync(presetsPath)||!existsSync(detailPath)){
  console.error('missing presets or detail')
  process.exit(1)
}

const raw=readFileSync(presetsPath,'utf8')
const data=JSON.parse(raw.replace(/^\/\*\*[\s\S]*?\*\/\s*export\s+default\s+/,'').trim())
const existing=new Set((data.presets||[]).map(p=>String(p.sourceNum)))
let added=0

for(const r of loadCsv(detailPath)){
  const num=String(r['模型编号']||'')
  const code=String(r['结构code']||'').trim()
  if(!num||existing.has(num))continue
  const tid=resolveStructureTemplate(code)
  if(!tid)continue
  if(tid!=='rea-flat-sheet'&&tid!=='rea-star-box')continue

  const geomPath=join(root,'geometry','pacdora_boxes',`${num}.json`)
  if(!existsSync(geomPath))continue
  const g=JSON.parse(readFileSync(geomPath,'utf8'))
  const ks=g.knifeSize||{}
  let L=Number(ks.L)||0,W=Number(ks.W)||0,H=Number(ks.H)||0
  const D=Number(g.size?.D)||0.5
  if(tid==='rea-flat-sheet'){
    if(!(L>0&&W>0))continue
    H=0
  }else{
    // StarBox：W 金样为 0，用 L 作为平面外接尺寸
    if(!(L>0&&H>0))continue
    if(!(W>0))W=L
  }

  const label=(r['名称']||num).replace(/\s+dieline\s*$/i,'').trim()
  const preset={
    id:`import-${num}`,
    sourceNum:num,
    label,
    categoryId:'other',
    categoryLabel:'其他',
    length:L,width:W,height:H,
    thickness:D>0?D:0.5,
    materialId:'white',
    templateId:tid,
    templateSource:'structure-code',
    hasGeometry:true,
    cutCount:0,foldCount:0,sheetW:0,sheetH:0,
    geomRel:`geometry/pacdora_boxes/${num}.json`,
    subclassIds:String(r['官方子类']||'').split('|').map(s=>s.trim()).filter(Boolean).length
      ?[] // 子类标签中文，enrich 后再填；此处先空以免错挂
      :[],
    subclassLabels:[],
    structureCode:code
  }
  if(tid==='rea-star-box'){
    const P=STARBOX_POINTS_BY_CODE[code]
    if(P)preset.defaultParams={P}
  }
  data.presets.push(preset)
  existing.add(num)
  added++
}

data.presets.sort((a,b)=>String(a.sourceNum).localeCompare(String(b.sourceNum),'en',{numeric:true}))
let mapped=0
const byTemplate={},byCategory={}
for(const p of data.presets){
  if(p.templateId)mapped++
  byTemplate[p.templateId||'unmapped']=(byTemplate[p.templateId||'unmapped']||0)+1
  byCategory[p.categoryId]=(byCategory[p.categoryId]||0)+1
}
data.count=data.presets.length
data.mapped=mapped
data.byTemplate=byTemplate
data.byCategory=byCategory

writeFileSync(
  presetsPath,
  `/** auto-generated — zero-dim presets injected */\nexport default ${JSON.stringify(data,null,2)}\n`
)
console.log(JSON.stringify({added,total:data.presets.length,mapped},null,2))
