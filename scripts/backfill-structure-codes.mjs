/**
 * 从 geometry/pacdora_boxes/{num}.json 回填 presets[].structureCode
 * 并同步 foldCount/cutCount（若缺失）。
 */
import {readFileSync,writeFileSync,existsSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')
const presetsPath=join(root,'src','catalog','presets.js')
const geomDir=join(root,'geometry','pacdora_boxes')

const raw=readFileSync(presetsPath,'utf8')
const data=JSON.parse(raw.replace(/^\/\*\*[\s\S]*?\*\/\s*export\s+default\s+/,'').trim())

let filled=0,updated=0,missingGeom=0,unchanged=0

for(const p of data.presets||[]){
  const num=String(p.sourceNum||'')
  if(!num)continue
  const gp=join(geomDir,`${num}.json`)
  if(!existsSync(gp)){missingGeom++;continue}
  let d
  try{d=JSON.parse(readFileSync(gp,'utf8'))}catch{missingGeom++;continue}
  const code=d?.modeCate?.code||''
  const tr=d?.layer?.traditional||{}
  const folds=(tr.folds||[]).length
  const cuts=(tr.cuts||[]).length
  let changed=false
  if(code&&p.structureCode!==code){
    p.structureCode=code
    filled++
    changed=true
  }else if(code&&p.structureCode===code){
    unchanged++
  }
  if(p.foldCount==null&&folds){p.foldCount=folds;changed=true}
  if(p.cutCount==null&&cuts){p.cutCount=cuts;changed=true}
  if(!p.geomRel){p.geomRel=`geometry/pacdora_boxes/${num}.json`;changed=true}
  if(p.hasGeometry!==true&&(folds||cuts||code)){p.hasGeometry=true;changed=true}
  if(changed)updated++
}

writeFileSync(
  presetsPath,
  `/** auto-generated — structureCode backfilled from geometry JSON */\nexport default ${JSON.stringify(data,null,2)}\n`
)

console.log(JSON.stringify({filled,updated,unchanged,missingGeom,presets:(data.presets||[]).length},null,2))
