/**
 * 按官方子类规则纠正已映射条目中的错挂 templateId；未映射不动。
 * 输出 未映射名单/12_子类纠错明细.csv
 */
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {
  EXPECTED,
  primarySubclass,
  templateFitsAnySubclass,
  pickTemplate,
  shouldCorrectSubclass
} from '../src/catalog/subclassTemplateRules.js'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')
const presetsPath=join(root,'src','catalog','presets.js')
const detailPath=join(root,'structure_inventory','03_模型结构归类明细.csv')
const outDir=join(root,'未映射名单')
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

if(!existsSync(presetsPath)){
  console.error('missing',presetsPath)
  process.exit(1)
}

const numToStruct={}
if(existsSync(detailPath)){
  for(const r of loadCsv(detailPath)){
    const num=String(r['模型编号']||'')
    if(!num)continue
    numToStruct[num]={
      structureCode:r['结构code']||'',
      name:r['名称']||''
    }
  }
}

const raw=readFileSync(presetsPath,'utf8')
const data=JSON.parse(raw.replace(/^\/\*\*[\s\S]*?\*\/\s*export\s+default\s+/,'').trim())
const corrections=[]
let skippedUnmapped=0,keptFit=0,noPrimary=0,unchanged=0

for(const p of data.presets||[]){
  if(!p.templateId){skippedUnmapped++;continue}
  // structure-code 视为权威映射，不因子类白名单纠错
  if(p.templateSource==='structure-code'){keptFit++;continue}
  const ids=p.subclassIds||[]
  if(!ids.length){unchanged++;continue}

  // 已落在任一所属子类合理列表 → 保留
  if(templateFitsAnySubclass(p.templateId,ids)){keptFit++;continue}

  const primary=primarySubclass(ids)
  if(!primary||!shouldCorrectSubclass(primary)){noPrimary++;continue}

  const struct=numToStruct[String(p.sourceNum)]||{}
  const label=`${p.label||p.name||''} ${struct.name||''}`
  const next=pickTemplate(primary,label,struct.structureCode||'')
  if(!next||next===p.templateId){unchanged++;continue}

  const from=p.templateId
  p.templateId=next
  p.templateSource='subclass-correction'
  corrections.push({
    sourceNum:p.sourceNum,
    label:p.label||p.name||struct.name||'',
    subclassIds:ids.join(';'),
    primary,
    from,
    to:next,
    reason:`主子类=${primary}；原模板不在任一所属子类 EXPECTED`
  })
}

const byTemplate={},byCategory={}
let mapped=0
for(const p of data.presets||[]){
  const k=p.templateId||'unmapped'
  if(p.templateId)mapped++
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
  `/** auto-generated — subclass template corrections applied */\nexport default ${JSON.stringify(data,null,2)}\n`
)

// 明细：本轮改动 + 仍带 subclass-correction 标记的存量（供抽检）
const tagged=new Map(corrections.map(c=>[String(c.sourceNum),c]))
for(const p of data.presets||[]){
  if(p.templateSource!=='subclass-correction')continue
  const key=String(p.sourceNum)
  if(tagged.has(key))continue
  tagged.set(key,{
    sourceNum:p.sourceNum,
    label:p.label||p.name||'',
    subclassIds:(p.subclassIds||[]).join(';'),
    primary:primarySubclass(p.subclassIds||[])||'',
    from:'(prior)',
    to:p.templateId,
    reason:'存量 templateSource=subclass-correction'
  })
}

const csvHeader=['编号','名称','子类','主子类','原模板','新模板','原因']
const csvRows=[...tagged.values()].sort((a,b)=>String(a.sourceNum).localeCompare(String(b.sourceNum),'en',{numeric:true}))
const csvLines=[
  csvHeader.join(','),
  ...csvRows.map(c=>[
    c.sourceNum,c.label,c.subclassIds,c.primary,c.from,c.to,c.reason
  ].map(csvEscape).join(','))
]
writeFileSync(join(outDir,'12_子类纠错明细.csv'),'\ufeff'+csvLines.join('\n')+'\n','utf8')

// 回写 KnifePrototype 分流表的「纠错回退」列
const protoCsv=join(root,'structure_inventory','13_KnifePrototype分流.csv')
if(existsSync(protoCsv)){
  const reverted=new Map(corrections.map(c=>[String(c.sourceNum),`${c.from}->${c.to}`]))
  const lines=readFileSync(protoCsv,'utf8').replace(/^\ufeff/,'').trimEnd().split(/\r?\n/)
  if(lines.length){
    const header=lines[0].split(',')
    const idx=header.indexOf('纠错回退')
    const numIdx=header.indexOf('编号')
    if(idx>=0&&numIdx>=0){
      const out=[lines[0]]
      for(const line of lines.slice(1)){
        // 简易 CSV：编号在首列
        const cols=line.split(',')
        const num=cols[numIdx]
        if(reverted.has(num))cols[idx]=csvEscape(reverted.get(num))
        out.push(cols.join(','))
      }
      writeFileSync(protoCsv,out.join('\n')+'\n')
    }
  }
}

console.log(JSON.stringify({
  corrected:corrections.length,
  taggedTotal:csvRows.length,
  keptFit,
  skippedUnmapped,
  noPrimary,
  unchanged,
  mapped:data.mapped,
  count:data.count||data.presets.length,
  byPrimary:corrections.reduce((acc,c)=>{
    acc[c.primary]=(acc[c.primary]||0)+1
    return acc
  },{}),
  sample:corrections.slice(0,8)
},null,2))
