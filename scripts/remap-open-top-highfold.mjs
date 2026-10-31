/**
 * 对「开顶模板 + foldCount≥12」强制按 structureCode / 主子类重挂。
 * 在 backfill + apply-structure-code(--prefixes) + correct-subclass 之后仍残留的开顶错挂上再扫一轮。
 */
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {resolveStructureTemplate} from '../src/catalog/structureCodeTemplates.js'
import {primarySubclass,pickTemplate,shouldCorrectSubclass} from '../src/catalog/subclassTemplateRules.js'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')
const presetsPath=join(root,'src','catalog','presets.js')
const outDir=join(root,'未映射名单')
mkdirSync(outDir,{recursive:true})

const OPEN=new Set(['display-pdq','drawer-tray','sleeve','polygon-tray'])

function csvEscape(v){
  const s=String(v??'')
  return /[",\n\r]/.test(s)?`"${s.replace(/"/g,'""')}"`:s
}

const raw=readFileSync(presetsPath,'utf8')
const data=JSON.parse(raw.replace(/^\/\*\*[\s\S]*?\*\/\s*export\s+default\s+/,'').trim())
const rows=[]

for(const p of data.presets||[]){
  const folds=p.foldCount||0
  if(!p.templateId||!OPEN.has(p.templateId)||folds<12)continue
  const from=p.templateId
  const code=p.structureCode||''
  let to=resolveStructureTemplate(code,{usePrefixes:true})
  let reason='structure-code-prefix'
  if(!to){
    const primary=primarySubclass(p.subclassIds||[])
    if(primary&&shouldCorrectSubclass(primary)){
      to=pickTemplate(primary,p.label||'',code)
      reason=`primary-subclass=${primary}`
    }
  }
  // 有盖子类兜底：不要留在开顶
  if(!to||OPEN.has(to)){
    const ids=p.subclassIds||[]
    if(ids.includes('hanging')){to='hanging-tuck';reason='fallback-hanging'}
    else if(ids.includes('window')){to='tuck-window';reason='fallback-window'}
    else if(ids.includes('tuck')||ids.includes('folding')||ids.includes('product')){
      to='tuck-end-straight';reason='fallback-tuck'
    }else if(ids.includes('mailer')){to='rea-aircraft';reason='fallback-mailer'}
    else if(ids.includes('lid')||ids.includes('square')){to='lid-base';reason='fallback-lid'}
  }
  if(!to||to===from){
    rows.push({sourceNum:p.sourceNum,label:p.label,from,to:from,foldCount:folds,code,reason:'unchanged',changed:0})
    continue
  }
  p.templateId=to
  p.templateSource='open-top-highfold-remap'
  rows.push({sourceNum:p.sourceNum,label:p.label,from,to,foldCount:folds,code,reason,changed:1})
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
  `/** auto-generated — open-top high-fold remap */\nexport default ${JSON.stringify(data,null,2)}\n`
)

const changed=rows.filter(r=>r.changed)
const csv=['sourceNum,label,from,to,foldCount,structureCode,reason,changed']
for(const r of rows.sort((a,b)=>String(a.sourceNum).localeCompare(String(b.sourceNum),'en',{numeric:true}))){
  csv.push([r.sourceNum,r.label,r.from,r.to,r.foldCount,r.code,r.reason,r.changed].map(csvEscape).join(','))
}
writeFileSync(join(outDir,'15_开顶高折线重挂明细.csv'),csv.join('\n'),'utf8')

const remain= (data.presets||[]).filter(p=>p.templateId&&OPEN.has(p.templateId)&&(p.foldCount||0)>=12).length
console.log(JSON.stringify({
  scanned:rows.length,
  changed:changed.length,
  remainOpenHighFold:remain,
  sample100022:rows.find(r=>String(r.sourceNum)==='100022')||null
},null,2))
