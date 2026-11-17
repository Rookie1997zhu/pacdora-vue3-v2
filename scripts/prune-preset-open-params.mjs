/**
 * 预设 openParams 瘦身：只保留「当前所挂模板的 paramDefs 里有同名 code」的参数。
 * 全量结构参数仍在采集几何 JSON 里（离线脚本直接读），presets.js 会进前端包，不重复携带。
 * 在 catalog-build 末尾运行（模板挂载全部完成之后）。
 */
import {readFileSync,writeFileSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {TEMPLATES} from '../src/templates/index.js'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')
const presetsPath=join(root,'src','catalog','presets.js')
const raw=readFileSync(presetsPath,'utf8')
const data=JSON.parse(raw.replace(/^\/\*\*[\s\S]*?\*\/\s*export\s+default\s+/,'').trim())

let kept=0,dropped=0,keptCodes=0
const byCategory={}
for(const p of data.presets||[]){
  if(!p.openParams)continue
  const codes=new Set((TEMPLATES[p.templateId]?.paramDefs||[]).map(d=>d.code))
  const next={}
  for(const [code,row] of Object.entries(p.openParams)){
    if(codes.has(code))next[code]=row
  }
  if(Object.keys(next).length){
    p.openParams=next
    kept++
    keptCodes+=Object.keys(next).length
    byCategory[p.categoryId]=(byCategory[p.categoryId]||0)+1
  }else{
    delete p.openParams
    dropped++
  }
}

writeFileSync(
  presetsPath,
  `/** auto-generated — openParams pruned to template paramDefs */\nexport default ${JSON.stringify(data,null,2)}\n`
)
console.log(JSON.stringify({kept,dropped,keptCodes,byCategory},null,2))
