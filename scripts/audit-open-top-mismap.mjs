/**
 * 导出：开顶模板且 foldCount≥12；缺 structureCode；回填前快照。
 */
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')
const presetsPath=join(root,'src','catalog','presets.js')
const geomDir=join(root,'geometry','pacdora_boxes')
const outDir=join(root,'未映射名单')
mkdirSync(outDir,{recursive:true})

const OPEN=new Set(['display-pdq','drawer-tray','sleeve','polygon-tray'])

function csvEscape(v){
  const s=String(v??'')
  return /[",\n\r]/.test(s)?`"${s.replace(/"/g,'""')}"`:s
}

function loadPresets(){
  const raw=readFileSync(presetsPath,'utf8')
  return JSON.parse(raw.replace(/^\/\*\*[\s\S]*?\*\/\s*export\s+default\s+/,'').trim())
}

function readCode(num){
  const p=join(geomDir,`${num}.json`)
  if(!existsSync(p))return {code:'',faces:0,folds:0,cuts:0}
  try{
    const d=JSON.parse(readFileSync(p,'utf8'))
    const tr=d?.layer?.traditional||{}
    return {
      code:d?.modeCate?.code||'',
      faces:(tr.faces||[]).length,
      folds:(tr.folds||[]).length,
      cuts:(tr.cuts||[]).length
    }
  }catch{
    return {code:'',faces:0,folds:0,cuts:0}
  }
}

const data=loadPresets()
const presets=data.presets||[]

const openHigh=[]
const missingCode=[]
let hasGeomFalse=0

for(const p of presets){
  const num=String(p.sourceNum||'')
  const g=readCode(num)
  const folds=p.foldCount??g.folds
  if(p.hasGeometry===false)hasGeomFalse++
  if(!p.structureCode){
    missingCode.push({
      sourceNum:num,
      label:p.label||'',
      templateId:p.templateId||'',
      foldCount:folds,
      geomCode:g.code,
      subclassIds:(p.subclassIds||[]).join(';'),
      categoryId:p.categoryId||''
    })
  }
  if(p.templateId&&OPEN.has(p.templateId)&&(folds||0)>=12){
    openHigh.push({
      sourceNum:num,
      label:p.label||'',
      templateId:p.templateId,
      foldCount:folds,
      cutCount:p.cutCount??g.cuts,
      geomFaces:g.faces,
      geomCode:g.code||p.structureCode||'',
      structureCode:p.structureCode||'',
      subclassIds:(p.subclassIds||[]).join(';'),
      categoryId:p.categoryId||'',
      templateSource:p.templateSource||''
    })
  }
}

function writeCsv(name,rows,headers){
  const lines=[headers.join(',')]
  for(const r of rows){
    lines.push(headers.map(h=>csvEscape(r[h])).join(','))
  }
  const path=join(outDir,name)
  writeFileSync(path,lines.join('\n'),'utf8')
  return path
}

openHigh.sort((a,b)=>String(a.sourceNum).localeCompare(String(b.sourceNum),'en',{numeric:true}))
missingCode.sort((a,b)=>String(a.sourceNum).localeCompare(String(b.sourceNum),'en',{numeric:true}))

const p1=writeCsv('13_开顶且折线ge12.csv',openHigh,[
  'sourceNum','label','templateId','foldCount','cutCount','geomFaces','geomCode','structureCode','subclassIds','categoryId','templateSource'
])
const p2=writeCsv('14_缺structureCode.csv',missingCode,[
  'sourceNum','label','templateId','foldCount','geomCode','subclassIds','categoryId'
])

const summary={
  presets:presets.length,
  hasGeometryFalse:hasGeomFalse,
  missingStructureCode:missingCode.length,
  openTopFoldGe12:openHigh.length,
  byOpenTemplate:Object.fromEntries(
    [...OPEN].map(t=>[t,openHigh.filter(r=>r.templateId===t).length])
  ),
  sample100022:openHigh.find(r=>r.sourceNum==='100022')||null,
  out:[p1,p2]
}
writeFileSync(join(outDir,'13_开顶错挂审计摘要.json'),JSON.stringify(summary,null,2))
console.log(JSON.stringify(summary,null,2))
