/**
 * 标记「仅 3D 样机」：主图层 1 面 0 折、且未改挂到 cylinder-box 的预设。
 * 在 apply-manual-map-overrides 之后运行。
 */
import {readFileSync,writeFileSync,existsSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {pickCompileLayer} from './lib/pickCompileLayer.mjs'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')
const presetsPath=join(root,'src','catalog','presets.js')
const geomDir=join(root,'geometry','pacdora_boxes')

function isFlatDieline(num){
  const file=join(geomDir,`${num}.json`)
  if(!existsSync(file))return false
  try{
    const j=JSON.parse(readFileSync(file,'utf8'))
    const ly=pickCompileLayer(j)
    if(!ly)return false
    return (ly.faces||[]).length===1&&(ly.folds||[]).length===0
  }catch{return false}
}

const raw=readFileSync(presetsPath,'utf8')
const data=JSON.parse(raw.replace(/^\/\*\*[\s\S]*?\*\/\s*export\s+default\s+/,'').trim())

let marked=0,cleared=0
for(const p of data.presets||[]){
  const was=!!p.modelOnly
  // 圆筒族有真实刀版示意，不算 modelOnly
  if(p.templateId==='cylinder-box'){
    if(was){delete p.modelOnly;cleared++}
    continue
  }
  const flat=isFlatDieline(p.sourceNum)
  if(flat&&p.templateId==='rea-flat-sheet'){
    if(!was){p.modelOnly=true;marked++}
  }else if(was){
    delete p.modelOnly
    cleared++
  }
}

writeFileSync(
  presetsPath,
  `/** auto-generated — modelOnly flags applied */\nexport default ${JSON.stringify(data,null,2)}\n`
)
console.log(JSON.stringify({marked,cleared,total:(data.presets||[]).filter(p=>p.modelOnly).length},null,2))
