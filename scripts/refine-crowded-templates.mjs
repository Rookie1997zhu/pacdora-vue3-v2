/**
 * 拆挤挂：对展示盒/多边形/挂盒中落在「粗默认」模板上的条目，按名称重新 pickTemplate。
 * 即使当前 templateId 仍落在 EXPECTED 白名单内也会重算（与 correct-subclass 互补）。
 */
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {primarySubclass,pickTemplate} from '../src/catalog/subclassTemplateRules.js'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')
const presetsPath=join(root,'src','catalog','presets.js')
const outDir=join(root,'未映射名单')
mkdirSync(outDir,{recursive:true})

/** 子类 → 视为挤挂/粗开顶默认、允许被更细规则替换的 templateId */
const CROWDED_DEFAULT=Object.freeze({
  display:Object.freeze(['display-pdq','polygon-tray','drawer-tray','sleeve']),
  polygon:Object.freeze(['polygon-tray','display-pdq','drawer-tray']),
  hanging:Object.freeze(['hanging-tuck'])
})

function csvEscape(v){
  const s=String(v??'')
  return /[",\n\r]/.test(s)?`"${s.replace(/"/g,'""')}"`:s
}

if(!existsSync(presetsPath)){
  console.error('missing',presetsPath)
  process.exit(1)
}

const raw=readFileSync(presetsPath,'utf8')
const data=JSON.parse(raw.replace(/^\/\*\*[\s\S]*?\*\/\s*export\s+default\s+/,'').trim())
const changes=[]

for(const p of data.presets||[]){
  if(!p.templateId)continue
  // structure-code 保留精确挂载；map-override 若落在挤挂开顶上仍允许按名称拆开
  if(p.templateSource==='structure-code')continue
  const ids=p.subclassIds||[]
  // 不只看主子类：展示+提手时主类常是 handle，仍需拆 display-pdq
  const crowdKeys=Object.keys(CROWDED_DEFAULT).filter(k=>ids.includes(k)&&CROWDED_DEFAULT[k].includes(p.templateId))
  if(!crowdKeys.length)continue
  const primary=primarySubclass(ids)||crowdKeys[0]
  // 优先用挤挂子类自己的 pick，避免主类 handle 把展示盒判成 handle-box 后又跳过
  const pickFrom=crowdKeys.includes(primary)?primary:crowdKeys[0]
  const next=pickTemplate(pickFrom,`${p.label||''}`,p.structureCode||'')
  if(!next||next===p.templateId)continue
  changes.push({
    sourceNum:p.sourceNum,
    label:p.label,
    primary:pickFrom,
    from:p.templateId,
    to:next,
    prevSource:p.templateSource||''
  })
  p.templateId=next
  p.templateSource='crowd-refine'
}

const header='/** auto-generated catalog — refine-crowded-templates.mjs */\nexport default '
writeFileSync(presetsPath,header+JSON.stringify(data,null,2)+'\n','utf8')

const csv=[
  'sourceNum,label,primary,from,to,prevSource',
  ...changes.map(c=>[c.sourceNum,c.label,c.primary,c.from,c.to,c.prevSource].map(csvEscape).join(','))
].join('\n')
writeFileSync(join(outDir,'13_挤挂拆分明细.csv'),csv+'\n','utf8')
console.log(`crowd-refine: ${changes.length} remapped → 未映射名单/13_挤挂拆分明细.csv`)
