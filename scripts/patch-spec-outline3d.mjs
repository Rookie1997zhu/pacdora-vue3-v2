/**
 * 给结构规格里个别面片补「只用于 3D 的外轮廓」（face.o3），其余内容原样不动。
 *
 * 这些面片在规格里是简化的矩形，参考刀版里它们带着伸出矩形的舌片 / 耳朵（插在相邻面的缺口里）。
 * 2D 没问题 —— 缺口那一侧已经把这条切线画出来了；但 3D 的面片网格少了这一块，合盖外形与参考对不上
 * （150330 的 T1、158030 的 B1R / B1L）。o3 记成该面矩形内的 UV（可超出 0..1），由参考轮廓按
 * 「两边主折线重合」对位得到，运行时套到当前尺寸。
 * 之后需运行 build-spec-chunks。用法：node scripts/patch-spec-outline3d.mjs [--dry]
 */
import {readFileSync,writeFileSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createKnife} from '../src/knife.js'
import {knifeFromPacdoraGeom} from '../src/pacdoraGeomKnife.js'
import {fold3dKnife} from '../src/foldRecipe.js'
import {pickCompileLayer} from './lib/pickCompileLayer.mjs'

/** 结构代号 → 要补的面片 */
const TARGETS={
  TracelessBottomDisplayAircraftBox:['T1'],
  SplitFlapLiftingBox:['B1R','B1L'],
}
const root=join(dirname(fileURLToPath(import.meta.url)),'..')
const specPath=join(root,'src','catalog','structureSpecs.js')
const dry=process.argv.includes('--dry')
const text=readFileSync(specPath,'utf8')
const header=text.slice(0,text.indexOf('export default '))
const data=JSON.parse(text.slice(text.indexOf('export default ')+15).trim())
const presets=JSON.parse(readFileSync(join(root,'src','catalog','presets.js'),'utf8').replace(/^\/\*\*[\s\S]*?\*\/\s*export\s+default\s+/,'').trim()).presets||[]
const u4=n=>Math.round(n*10000)/10000
const mid=l=>[(l[0][0]+l[1][0])/2,(l[0][1]+l[1][1])/2]
const log=[]
let changed=0
for(const spec of data.specs){
  const names=TARGETS[spec.code]
  if(!names)continue
  const p=presets.find(x=>String(x.sourceNum)===String(spec.sampleNum)&&x.geomRel)
  const raw=JSON.parse(readFileSync(join(root,'public',p.geomPublicRel||p.geomRel),'utf8'))
  let ly=null
  try{ly=pickCompileLayer(raw)}catch{ly=null}
  if(!ly?.faces?.length)ly=raw.layer?.traditional
  const ref=knifeFromPacdoraGeom({...raw,layer:{traditional:ly}},{sourceNum:spec.sampleNum})
  const d=spec.defaults
  for(const name of names){
    const entry=spec.faces.find(f=>f.n===name)
    const rf=ref.faces.find(f=>f.name===name)
    if(!entry||!rf||!Array.isArray(rf.outline)||!Array.isArray(rf.hingeLine)){log.push(`${spec.code} ${name}: no reference outline / hinge`);continue}
    const ours=fold3dKnife(createKnife({templateId:`spec-${spec.code}`,length:d.length,width:d.width,height:d.height,thickness:d.thickness,bleed:0,previewBleedExtra:0,sizeMode:'inner',thicknessMinMm:.1,piece:entry.piece}))
    const of=ours.faces.find(f=>f.name===name)
    if(!of||!Array.isArray(of.hingeLine)){log.push(`${spec.code} ${name}: no hinge in our knife`);continue}
    const [ax,ay]=mid(of.hingeLine),[bx,by]=mid(rf.hingeLine)
    const dx=ax-bx,dy=ay-by
    const o3=rf.outline.map(([x,y])=>[u4((x+dx-of.x)/of.w),u4((y+dy-of.y)/of.h)])
    if(JSON.stringify(entry.o3)===JSON.stringify(o3))continue
    entry.o3=o3
    changed++
    const us=o3.map(a=>a[0]),vs=o3.map(a=>a[1])
    log.push(`${spec.code} ${name}: ${o3.length} 点，u ${Math.min(...us)}..${Math.max(...us)}，v ${Math.min(...vs)}..${Math.max(...vs)}`)
  }
}
if(!dry&&changed)writeFileSync(specPath,`${header}export default ${JSON.stringify(data)}\n`)
console.log(`patch-spec-outline3d: ${changed} faces ${dry?'would change':'updated'}`)
for(const l of log)console.log('  '+l)
