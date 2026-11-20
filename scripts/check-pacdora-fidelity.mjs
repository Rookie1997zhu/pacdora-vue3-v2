/**
 * 吻合度评分：在金样尺寸下用预设当前所挂模板（或 --specs 时用每份结构规格）生成刀版，
 * 与采集的金样刀版比较。只读预设与几何；输出 未映射名单/19_吻合度*.csv 与汇总。
 *
 * 等级：A 精确 / B 近似 / C 不达标（见 gradeOf）。
 * 用法：node scripts/check-pacdora-fidelity.mjs [--specs] [--categories folding,tray] [--json out.json]
 */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {createKnife} from '../src/knife.js'
import {knifeFromPacdoraGeom} from '../src/pacdoraGeomKnife.js'
import {pieceGeometry} from '../src/templates/sampled/sampledTemplate.js'
import {TEMPLATES} from '../src/templates/index.js'
import specData from '../src/catalog/structureSpecs.js'
import {pickCompileLayer} from './lib/pickCompileLayer.mjs'
import {createGeomResolver} from './lib/presetGeom.mjs'
import {splitHoleSubpaths,holeCenter} from './lib/holePrimitives.mjs'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')

const rel=(a,b)=>(b>0?Math.abs(a-b)/b:(a>0?1:0))

/** 金样孔数：按子路径计，并按中心与尺寸去重（faces[].holes 与 layer.holes 常重复登记） */
function referenceHoleCount(ly){
  const seen=new Set()
  const add=h=>{
    for(const cmds of splitHoleSubpaths(h)){
      const c=holeCenter(cmds)
      if(!c||c.w<.5&&c.h<.5)continue
      seen.add([c.x,c.y,c.w,c.h].map(v=>Math.round(v*10)/10).join(','))
    }
  }
  for(const f of ly.faces||[])for(const h of f.holes||[])add(h)
  for(const h of ly.holes||[])add(h)
  return seen.size
}

/** 金样参考量（可编译主图层） */
export function referenceOf(geom){
  const ly=pickCompileLayer(geom)||geom?.layer?.traditional||Object.values(geom?.layer||{})[0]
  if(!ly)return null
  return {
    faces:(ly.faces||[]).length,
    holes:referenceHoleCount(ly),
    sheetW:Number(ly.totalX)||0,
    sheetH:Number(ly.totalY)||0,
    cutLen:Number(geom?.extra?.cutlineLength)||0,
    foldLen:Number(geom?.extra?.foldlineLength)||0,
    multiLayer:Object.keys(geom?.layer||{}).length>1,
    knife:geom.knifeSize||{},
  }
}

/** A：拓扑一致且尺寸类指标都很近；B：拓扑一致、尺寸略超；C：其余 */
export function gradeOf(m){
  if(!m||m.error||!m.valid)return 'C'
  const topo=m.facesEq&&m.holesEq
  const sheet=Math.max(m.sheetWErr,m.sheetHErr)
  if(topo&&sheet<=.005&&m.cutErr<=.02&&m.panelErr<=.05)return 'A'
  if(topo&&sheet<=.02&&m.cutErr<=.06)return 'B'
  return 'C'
}

/** 是否可以挂给预设：结构对得上、展开尺寸在 2% 内（切线细节不足可接受，结构不对不可接受） */
export function acceptable(m){
  return !!m&&!m.error&&m.valid&&m.facesEq&&Math.max(m.sheetWErr,m.sheetHErr)<=.02
}

/** 综合偏差分（越小越好），用于在两个候选模板之间取舍 */
export function scoreOf(m){
  if(!m||m.error)return 100
  return (m.valid?0:10)
    +(m.facesEq?0:2+Math.abs(m.faces-m.refFaces)/Math.max(1,m.refFaces))
    +(m.holesEq?0:.3)
    +5*Math.max(m.sheetWErr,m.sheetHErr)
    +2*m.cutErr
}

/** 金样全部面片的 bbox 面积之和（多件套没有统一的展开尺寸，用它代替） */
function referenceFaceArea(geom){
  const ly=pickCompileLayer(geom)||geom?.layer?.traditional||Object.values(geom?.layer||{})[0]
  return (ly?.faces||[]).reduce((s,f)=>s+(Number(f.w)||0)*(Number(f.h)||0),0)
}

/**
 * 在给定内尺寸下生成并与金样比较。
 * 多件套（盖 + 底、多块隔板等）逐件生成后累加面片数、孔数、切线与折线长度；
 * 各件分开排版，没有可比的整体展开尺寸，改用「面片面积之和」的偏差填入 sheetWErr / sheetHErr。
 */
export function measure(templateId,geom,{length,width,height,thickness,params={}}={}){
  const ref=referenceOf(geom)
  if(!ref)return {error:'no-layer'}
  const template=TEMPLATES[templateId]
  if(!template)return {error:'template-missing'}
  const pieceIds=template.supportsPiece&&Array.isArray(template.pieces)&&template.pieces.length>1
    ?template.pieces.map(p=>p.id)
    :[undefined]
  const knives=[]
  try{
    for(const piece of pieceIds){
      knives.push(createKnife({
        templateId,length,width,height,thickness,bleed:0,sizeMode:'inner',
        materialId:'white',params,previewBleedExtra:0,thicknessMinMm:.1,piece,
      }))
    }
  }catch(e){
    return {error:String(e?.code||e?.message||e).slice(0,60)}
  }
  // 按图层分件的插值模板（精装盒：面纸 + 灰板）：金样的参照值（ref）只统计灰板那一层，对不上四层的输出；
  // 改为逐层与官方该层的刀版比较 —— 面片数、开孔数、该层版面尺寸、切线与折线长度。
  if(template.sampled&&Array.isArray(template.pieces)&&template.pieces.every(p=>p.layer)&&knives.length===template.pieces.length){
    const seg=list=>(list||[]).reduce((t,g)=>t+Math.hypot((g.x2??0)-(g.x1??0),(g.y2??0)-(g.y1??0)),0)
    let facesEq=true,holesEq=true,sheetErr=0,cut=0,refCut=0,fold=0,refFold=0,faces=0,refFaces=0
    for(let i=0;i<knives.length;i++){
      const k=knives[i]
      const one=pieceGeometry(geom,template.pieces,template.pieces[i].id)
      if(!one)return {error:'layer-missing'}
      const r=knifeFromPacdoraGeom(one,{})
      faces+=k.faces.length;refFaces+=r.faces.length
      if(k.faces.length!==r.faces.length)facesEq=false
      if((k.holes||[]).length!==(r.holes||[]).length)holesEq=false
      sheetErr=Math.max(sheetErr,rel(k.totalX,r.totalX),rel(k.totalY,r.totalY))
      cut+=seg(k.cuts);refCut+=seg(r.cuts);fold+=seg(k.folds);refFold+=seg(r.folds)
    }
    const valid=knives.every(k=>k.validation?.ok!==false&&!(k.issues||[]).some(i=>i.severity==='blocking')&&!k.meta?.cutApprox)
    const pn=knives[0].dimensions?.panel||{},kz=ref.knife
    return {
      valid,facesEq,faces,refFaces,holesEq,sheetWErr:sheetErr,sheetHErr:sheetErr,
      cutErr:refCut?rel(cut,refCut):0,foldErr:refFold?rel(fold,refFold):0,
      panelErr:Math.max(Math.abs((pn.length||0)-(Number(kz.L)||0)),Math.abs((pn.width||0)-(Number(kz.W)||0)),Math.abs((pn.height||0)-(Number(kz.H)||0))),
      multiLayer:true,pieces:knives.length,
    }
  }
  const sum=fn=>knives.reduce((s,k)=>s+fn(k),0)
  const valid=knives.every(k=>k.validation?.ok!==false
    &&!(k.issues||[]).some(i=>i.severity==='blocking')&&!k.meta?.cutApprox)
  const faces=sum(k=>k.faces.length)
  const k0=knives[0]
  const p=k0.dimensions?.panel||{}
  const ks=ref.knife
  let sheetWErr,sheetHErr
  if(knives.length>1){
    const area=sum(k=>k.faces.reduce((s,f)=>s+(Number(f.w)||0)*(Number(f.h)||0),0))
    sheetWErr=sheetHErr=rel(area,referenceFaceArea(geom))
  }else{
    sheetWErr=rel(k0.totalX,ref.sheetW)
    sheetHErr=rel(k0.totalY,ref.sheetH)
  }
  return {
    valid,
    facesEq:faces===ref.faces,
    faces,
    refFaces:ref.faces,
    holesEq:sum(k=>(k.holes||[]).length)===ref.holes,
    sheetWErr,
    sheetHErr,
    cutErr:ref.cutLen?rel(sum(k=>k.stats?.cutLengthMm||0),ref.cutLen):0,
    foldErr:ref.foldLen?rel(sum(k=>k.stats?.creaseLengthMm||0),ref.foldLen):0,
    panelErr:Math.max(
      Math.abs((p.length||0)-(Number(ks.L)||0)),
      Math.abs((p.width||0)-(Number(ks.W)||0)),
      Math.abs((p.height||0)-(Number(ks.H)||0)),
    ),
    multiLayer:ref.multiLayer,
    pieces:knives.length,
  }
}

/** 金样的内尺寸与厚度 */
export function sampleInput(geom){
  const s=geom.size||{}
  return {
    length:Number(s.L),
    width:Number(s.W)||Number(s.L),
    height:Number(s.H)||0,
    thickness:Number(geom.science?.thickness)||Number(s.D)||.5,
  }
}

/** 预设的采集结构参数 → 模板可用的参数（与工作台初始值同一规则） */
export function presetParams(preset){
  const out={}
  for(const d of TEMPLATES[preset.templateId]?.paramDefs||[]){
    const row=preset.openParams?.[d.code]
    if(!Array.isArray(row))continue
    let v=Number(row[0])
    if(!Number.isFinite(v))continue
    if(typeof d.min==='number')v=Math.max(d.min,v)
    if(typeof d.max==='number')v=Math.min(d.max,v)
    out[d.code]=v
  }
  return out
}

export function loadPresets(){
  const raw=readFileSync(join(root,'src','catalog','presets.js'),'utf8')
  return JSON.parse(raw.replace(/^\/\*\*[\s\S]*?\*\/\s*export\s+default\s+/,'').trim()).presets||[]
}

function main(){
  const arg=(name,def)=>{
    const i=process.argv.indexOf(`--${name}`)
    return i>=0&&process.argv[i+1]&&!process.argv[i+1].startsWith('--')?process.argv[i+1]:def
  }
  const SPECS_MODE=process.argv.includes('--specs')
  const CATEGORIES=arg('categories','all')
  const CATEGORY_SET=CATEGORIES==='all'?null:new Set(CATEGORIES.split(','))
  const JSON_OUT=arg('json','')

  const presets=loadPresets()
  const geomFileOf=createGeomResolver(root,presets)
  const geomCache=new Map()
  const loadGeom=num=>{
    if(geomCache.has(num))return geomCache.get(num)
    const file=geomFileOf(num)
    let out=null
    if(file){
      try{out=JSON.parse(readFileSync(file,'utf8'))}catch{out=null}
    }
    geomCache.set(num,out)
    return out
  }

  const rows=[]
  if(SPECS_MODE){
    for(const spec of specData.specs||[]){
      const id=`spec-${spec.code}`
      const geom=loadGeom(String(spec.sampleNum))
      const m=geom?measure(id,geom,sampleInput(geom)):{error:'geometry-missing'}
      rows.push({id,num:spec.sampleNum,code:spec.structureCode||spec.code,tpl:id,m})
    }
  }else{
    for(const p of presets){
      if(CATEGORY_SET&&!CATEGORY_SET.has(p.categoryId))continue
      const base={id:p.id,num:p.sourceNum,cat:p.categoryId,code:p.structureCode,tpl:p.templateId||'',src:p.templateSource||''}
      if(!p.templateId){rows.push({...base,m:{error:'unmapped'}});continue}
      const geom=loadGeom(String(p.sourceNum))
      if(!geom){rows.push({...base,m:{error:'geometry-missing'}});continue}
      rows.push({
        ...base,
        m:measure(p.templateId,geom,{
          length:p.length,width:p.width,height:p.height,thickness:p.thickness||.5,params:presetParams(p),
        }),
      })
    }
  }
  for(const r of rows)r.grade=gradeOf(r.m)

  const outDir=join(root,'未映射名单')
  mkdirSync(outDir,{recursive:true})
  const pc=v=>(Number.isFinite(v)?(v*100).toFixed(2):'')
  const csv=['id,sourceNum,category,structureCode,templateId,source,grade,faces,refFaces,holesEq,sheetWErr%,sheetHErr%,cutErr%,foldErr%,panelErrMm,valid,error']
  for(const r of rows){
    const m=r.m||{}
    csv.push([
      r.id,r.num,r.cat||'',r.code||'',r.tpl||'',r.src||'',r.grade,
      m.faces??'',m.refFaces??'',m.holesEq??'',
      pc(m.sheetWErr),pc(m.sheetHErr),pc(m.cutErr),pc(m.foldErr),
      Number.isFinite(m.panelErr)?m.panelErr.toFixed(2):'',m.valid??'',m.error||'',
    ].join(','))
  }
  writeFileSync(join(outDir,SPECS_MODE?'19_吻合度_规格.csv':'19_吻合度.csv'),csv.join('\n'),'utf8')
  if(JSON_OUT)writeFileSync(JSON_OUT,JSON.stringify(rows))

  const summary={}
  for(const r of rows){
    const key=SPECS_MODE?'specs':(r.cat||'-')
    const s=summary[key]??={total:0,A:0,B:0,C:0,unmapped:0,error:0}
    s.total++
    s[r.grade]++
    if(r.m?.error==='unmapped')s.unmapped++
    else if(r.m?.error)s.error++
  }
  console.log(JSON.stringify({mode:SPECS_MODE?'specs':'presets',categories:CATEGORIES,summary},null,1))
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main()
