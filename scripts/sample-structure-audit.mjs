/**
 * 抽样验收：未映射 + 展示/多边形/挂盒挤挂相关条目，对照本地 geometry 与 templateId，
 * 产出 未映射名单/14_抽样验收.md（不访问外网；官网对照步骤写在表中）。
 */
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {structureKind} from '../src/renderClosedThumb.js'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')
const outDir=join(root,'未映射名单')
mkdirSync(outDir,{recursive:true})

const geomCandidates=[
  join(root,'exports','geometry','pacdora_boxes'),
  join(root,'..','..','Desktop','信息搜集','webspider','data search','data_search','exports','geometry','pacdora_boxes'),
  join('C:\\Users\\ROG STRIX\\Desktop\\信息搜集\\webspider\\data search\\data_search\\exports\\geometry\\pacdora_boxes')
]
const geomDir=geomCandidates.find(p=>existsSync(p))||null

const OPEN_TOP=new Set(['display-pdq','drawer-tray','sleeve','polygon-tray'])

function loadPresets(){
  const raw=readFileSync(join(root,'src','catalog','presets.js'),'utf8')
  return JSON.parse(raw.replace(/^\/\*\*[\s\S]*?\*\/\s*export\s+default\s+/,'').trim())
}

function hasGeometry(num){
  if(!geomDir)return 'unknown'
  const p=join(geomDir,`${num}.json`)
  if(!existsSync(p))return 'missing'
  try{
    const j=JSON.parse(readFileSync(p,'utf8'))
    const layer=j?.data?.layer||j?.layer||{}
    const first=Object.values(layer)[0]||{}
    const faces=first.faces||j.faces
    const folds=first.folds||j.folds
    const anim=first.animation||j.animation
    if((faces&&faces.length)||(folds&&folds.length)||anim)return 'ok'
    return 'thin'
  }catch{
    return 'error'
  }
}

function classify(p,geom){
  if(!p.templateId){
    return geom==='ok'
      ? '需新模板（采集有几何，Demo 未挂模板）'
      : geom==='missing'
        ? '仅尺寸或几何缺失'
        : '未映射'
  }
  const kind=structureKind(p.templateId)
  if(OPEN_TOP.has(p.templateId)||kind.id==='openTop'){
    const s=`${p.label||''}`.toLowerCase()
    if(/lid|cover|with lid|天地|磁吸|tuck end|插舌|插口|mailer|飞机/.test(s)){
      return '疑似错挂开顶（名称像有盖）'
    }
    return '真开顶或托盘族'
  }
  if(kind.id==='lidded'||kind.id==='telescoping')return '有盖映射'
  if(kind.id==='flat')return '平板'
  return `其它(${kind.label})`
}

function pick(list,n){
  if(list.length<=n)return list
  const step=Math.max(1,Math.floor(list.length/n))
  const out=[]
  for(let i=0;i<list.length&&out.length<n;i+=step)out.push(list[i])
  return out
}

const data=loadPresets()
const presets=data.presets||[]
const unmapped=presets.filter(p=>!p.templateId)
const displayPdq=presets.filter(p=>(p.subclassIds||[]).includes('display')&&p.templateId==='display-pdq')
const displayOther=presets.filter(p=>(p.subclassIds||[]).includes('display')&&p.templateId&&p.templateId!=='display-pdq')
const polygonTray=presets.filter(p=>(p.subclassIds||[]).includes('polygon')&&p.templateId==='polygon-tray')
const polygonOther=presets.filter(p=>(p.subclassIds||[]).includes('polygon')&&p.templateId&&p.templateId!=='polygon-tray')
const hanging=presets.filter(p=>(p.subclassIds||[]).includes('hanging')&&p.templateId)

const samples=[
  ...pick(unmapped,10).map(p=>({bucket:'未映射',p})),
  ...pick(displayPdq,8).map(p=>({bucket:'展示盒→display-pdq',p})),
  ...pick(displayOther,6).map(p=>({bucket:'展示盒→其它模板',p})),
  ...pick(polygonTray,6).map(p=>({bucket:'多边形→polygon-tray',p})),
  ...pick(polygonOther,4).map(p=>({bucket:'多边形→其它模板',p})),
  ...pick(hanging,6).map(p=>({bucket:'挂盒',p}))
]

const rows=samples.map(({bucket,p})=>{
  const geom=hasGeometry(p.sourceNum)
  const verdict=classify(p,geom)
  return {bucket,num:p.sourceNum,label:p.label,templateId:p.templateId||'',geom,verdict,pacdoraCheck:`https://www.pacdora.cn/mockups/box-mockups 搜索 ${p.sourceNum}`}
})

const counts={}
for(const r of rows)counts[r.verdict]=(counts[r.verdict]||0)+1

const md=[]
md.push('# 抽样验收：结构不完整 / 没有盖子')
md.push('')
md.push(`> 生成时间：${new Date().toISOString()}`)
md.push(`> Demo 目录条数：${presets.length}；未映射：${unmapped.length}`)
md.push(`> geometry 目录：${geomDir||'（未找到，geom 列=unknown）'}`)
md.push('')
md.push('## 结论口径')
md.push('')
md.push('- **采集有几何 + 未映射** → 不是漏采，是缺自研模板挂载')
md.push('- **名称像有盖 + 本地开顶模板** → 疑似错挂，应改 map / pickTemplate')
md.push('- **真开顶托盘/套筒** → 官网本就无顶盖，属正常')
md.push('- 官网人工核对：打开链接搜索编号，看 3D 是否有盖')
md.push('')
md.push('## 抽样汇总')
md.push('')
md.push('| 判定 | 条数 |')
md.push('|---|---:|')
for(const [k,v] of Object.entries(counts).sort((a,b)=>b[1]-a[1]))md.push(`| ${k} | ${v} |`)
md.push('')
md.push('## 明细')
md.push('')
md.push('| 桶 | 编号 | 名称 | templateId | geometry | 判定 | Pacdora 核对 |')
md.push('|---|---|---|---|---|---|---|')
for(const r of rows){
  md.push(`| ${r.bucket} | ${r.num} | ${String(r.label).replace(/\|/g,'/')} | ${r.templateId||'—'} | ${r.geom} | ${r.verdict} | ${r.pacdoraCheck} |`)
}
md.push('')
md.push('## 子类占用快照（全量）')
md.push('')
md.push(`| 指标 | 值 |`)
md.push(`|---|---:|`)
md.push(`| 展示盒 display-pdq | ${displayPdq.length} |`)
md.push(`| 展示盒 其它已映射 | ${displayOther.length} |`)
md.push(`| 多边形 polygon-tray | ${polygonTray.length} |`)
md.push(`| 多边形 其它已映射 | ${polygonOther.length} |`)
md.push(`| 挂盒已映射 | ${hanging.length} |`)
md.push('')

writeFileSync(join(outDir,'14_抽样验收.md'),md.join('\n'),'utf8')
writeFileSync(join(outDir,'14_抽样验收.json'),JSON.stringify({geomDir,counts,rows},null,2),'utf8')
console.log('wrote',join(outDir,'14_抽样验收.md'),'samples',rows.length)
