/**
 * 只更新结构规格里的 3D 折叠步骤（spec.fs），其余内容原样不动。
 * 用途：参考回放的折叠读法有修正（geomRig.pickFoldStages）时，让已编译的规格跟上，
 * 而不必重跑整套 build-structure-specs（那会重新编译几何并牵动保真度打分）。
 * 新的 fs 与 build-structure-specs 现在生成的一致。之后需运行 build-spec-chunks。
 * 用法：node scripts/patch-spec-fold-stages.mjs [--dry]
 */
import {readFileSync,writeFileSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {knifeFromPacdoraGeom} from '../src/pacdoraGeomKnife.js'
import {pickFoldStages} from '../src/geomRig.js'
import {pickCompileLayer} from './lib/pickCompileLayer.mjs'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')
const specPath=join(root,'src','catalog','structureSpecs.js')
const dry=process.argv.includes('--dry')
const text=readFileSync(specPath,'utf8')
const header=text.slice(0,text.indexOf('export default '))
const data=JSON.parse(text.slice(text.indexOf('export default ')+15).trim())
const presets=JSON.parse(readFileSync(join(root,'src','catalog','presets.js'),'utf8').replace(/^\/\*\*[\s\S]*?\*\/\s*export\s+default\s+/,'').trim()).presets||[]
const r3=n=>Math.round(n*1000)/1000
const changed=[]
for(const spec of data.specs){
  if(!Array.isArray(spec.fs)||!spec.fs.length)continue
  const p=presets.find(x=>String(x.sourceNum)===String(spec.sampleNum)&&x.templateId===`spec-${spec.code}`)
    ||presets.find(x=>String(x.sourceNum)===String(spec.sampleNum)&&x.structureCode===spec.code)
  const rel=p&&(p.geomPublicRel||p.geomRel)
  if(!rel)continue
  let raw
  try{raw=JSON.parse(readFileSync(join(root,'public',rel),'utf8'))}catch{continue}
  let rk
  try{
    let ly=null
    try{ly=pickCompileLayer(raw)}catch{ly=null}
    if(!ly?.faces?.length)ly=raw.layer?.traditional
    rk=knifeFromPacdoraGeom({...raw,layer:{traditional:ly}},{sourceNum:spec.sampleNum})
  }catch{continue}
  if(!rk.foldStagesAlt)continue
  const picked=pickFoldStages(rk)
  if(picked!==rk.foldStagesAlt)continue
  const known=new Set(spec.fs.flat().map(s=>s.c||s.f))
  const fs=picked.map(stage=>(stage||[]).map(s=>{
    if(s.child&&known.has(s.child)&&Number.isFinite(s.rotate))return {c:s.child,r:r3(s.rotate)}
    if(s.face&&known.has(s.face)&&s.move)return {f:s.face,m:[r3(s.move.x||0),r3(s.move.y||0),r3(s.move.z||0)]}
    return null
  }).filter(Boolean)).filter(stage=>stage.length)
  if(JSON.stringify(fs)===JSON.stringify(spec.fs))continue
  changed.push(`${spec.code} (样本 ${spec.sampleNum}): ${spec.fs.flat().length} → ${fs.flat().length} 步`)
  spec.fs=fs
}
if(!dry&&changed.length)writeFileSync(specPath,`${header}export default ${JSON.stringify(data)}\n`)
console.log(`patch-spec-fold-stages: ${changed.length} specs ${dry?'would change':'updated'}`)
for(const c of changed)console.log('  '+c)
