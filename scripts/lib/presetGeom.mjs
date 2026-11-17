/**
 * 预设 → 采集几何 JSON 文件。定点类目（折叠盒、托盘盒等）的几何在 public/{类目}-geom 与
 * docs/pacdora_{类目}_boxes/geometry，旧全库目录 geometry/pacdora_boxes 只有早期样本。
 */
import {existsSync} from 'node:fs'
import {join} from 'node:path'

export function legacyGeomFile(root,num){
  return join(root,'geometry','pacdora_boxes',`${num}.json`)
}

/** 单个预设的几何文件；找不到返回 null */
export function presetGeomFile(root,preset){
  const num=String(preset?.sourceNum||'')
  if(!num)return null
  const candidates=[]
  for(const rel of [preset.geomPublicRel,preset.geomRel]){
    if(!rel)continue
    candidates.push(join(root,'public',rel),join(root,rel))
  }
  if(preset.categoryId)candidates.push(join(root,'docs',`pacdora_${preset.categoryId}_boxes`,'geometry',`${num}.json`))
  candidates.push(legacyGeomFile(root,num))
  return candidates.find(f=>existsSync(f))||null
}

/**
 * 按编号查几何：同号可跨类目并存，优先旧目录（保持既有规格的编译输入不变），再按预设顺序取首个命中。
 * @returns {(num:string|number)=>string|null}
 */
export function createGeomResolver(root,presets){
  const byNum=new Map()
  for(const p of presets||[]){
    const num=String(p?.sourceNum||'')
    if(!num||byNum.has(num))continue
    const legacy=legacyGeomFile(root,num)
    const file=existsSync(legacy)?legacy:presetGeomFile(root,p)
    if(file)byNum.set(num,file)
  }
  return num=>{
    const key=String(num||'')
    if(byNum.has(key))return byNum.get(key)
    const legacy=legacyGeomFile(root,key)
    return existsSync(legacy)?legacy:null
  }
}
