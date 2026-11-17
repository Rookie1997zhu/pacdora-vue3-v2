/**
 * 从采集几何 JSON 回填 presets[].structureCode 与 openParams，并同步 foldCount/cutCount（若缺失）。
 * 几何查找顺序：预设自带 geomPublicRel/geomRel（public/ 下）→ docs/pacdora_{类目}_boxes/geometry
 * → 旧目录 geometry/pacdora_boxes。定点类目（折叠盒、托盘盒等）的几何不在旧目录里。
 * openParams 只存紧凑数值 {code:[value,min,max,grade]}，不含刀版坐标。
 */
import {readFileSync,writeFileSync,existsSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')
const presetsPath=join(root,'src','catalog','presets.js')
const geomDir=join(root,'geometry','pacdora_boxes')

const raw=readFileSync(presetsPath,'utf8')
const data=JSON.parse(raw.replace(/^\/\*\*[\s\S]*?\*\/\s*export\s+default\s+/,'').trim())

/** 预设 → 采集几何文件的候选路径 */
function geomCandidates(p,num){
  const out=[]
  for(const rel of [p.geomPublicRel,p.geomRel]){
    if(!rel)continue
    out.push(join(root,'public',rel),join(root,rel))
  }
  if(p.categoryId)out.push(join(root,'docs',`pacdora_${p.categoryId}_boxes`,'geometry',`${num}.json`))
  out.push(join(geomDir,`${num}.json`))
  return out
}

/** openParams（分级二维数组）→ {code:[value,min,max,grade]}；非有限数值的参数丢弃 */
function compactOpenParams(openParams){
  const out={}
  for(const p of (Array.isArray(openParams)?openParams.flat():[])){
    const code=String(p?.name||'').trim()
    const value=Number(p?.value)
    if(!code||!Number.isFinite(value))continue
    const num=v=>(Number.isFinite(Number(v))?Number(v):null)
    out[code]=[value,num(p.min),num(p.max),num(p.grade)]
  }
  return out
}

let filled=0,updated=0,missingGeom=0,unchanged=0,withParams=0
const byCategory={}

for(const p of data.presets||[]){
  const num=String(p.sourceNum||'')
  if(!num)continue
  const gp=geomCandidates(p,num).find(f=>existsSync(f))
  if(!gp){missingGeom++;continue}
  let d
  try{d=JSON.parse(readFileSync(gp,'utf8'))}catch{missingGeom++;continue}
  const code=d?.modeCate?.code||''
  const tr=d?.layer?.traditional||Object.values(d?.layer||{})[0]||{}
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
  const openParams=compactOpenParams(d?.openParams)
  if(Object.keys(openParams).length){
    if(JSON.stringify(p.openParams||null)!==JSON.stringify(openParams)){p.openParams=openParams;changed=true}
    withParams++
  }else if(p.openParams){delete p.openParams;changed=true}
  if(code){
    const cat=p.categoryId||'(none)'
    byCategory[cat]=(byCategory[cat]||0)+1
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

console.log(JSON.stringify({filled,updated,unchanged,missingGeom,withParams,byCategory,presets:(data.presets||[]).length},null,2))
