// 「按尺寸插值」的样本整理：把一个盒型的全部官方样本看成 (长, 宽, 高) 空间里的点，按刀版拓扑分段，
// 每一段围绕一个「锚点」做逐维插值。
//
//   主锚点   = 原始尺寸；沿三个维度各取与它拓扑相同、且连续的一段采样点。
//   次锚点   = 主锚点某条轴线上、拓扑变了的那一段里的一个点（如「长度超过 138 后多一道锁扣」那一段）；
//              它自己的三条轴线同样各取连续的一段。次锚点的另外两条轴线需要补采样本。
import fs from 'node:fs'
import path from 'node:path'
import {numericSlots,STRUCTURAL_KEYS} from '../../src/templates/sampled/sampledGeometry.js'

export const DIMS=['L','W','H']
export const FACTORS=[0.7,0.85,1.15,1.3,1.6]
const round=v=>Math.round(v*1000)/1000
const same=(a,b)=>Math.abs(a-b)<0.05

/** 只保留重建刀版需要的字段 */
export function trim(geom){
  const layer={}
  for(const [name,ly] of Object.entries(geom.layer||{})){
    if(!ly||!Array.isArray(ly.faces)){layer[name]=ly;continue}
    // bleeds：出血线的拓扑随尺寸变化频繁，不插值，运行时由面片轮廓外扩得到
    const {sizeArrowData,bleeds,...rest}=ly
    // dlistStr 是 dlist 的字符串副本（含坐标），重建时用不到
    rest.faces=rest.faces.map(({dlistStr,...f})=>f)
    layer[name]=stripText(rest)
  }
  return {
    cate_no:geom.cate_no,
    modeCate:{name:geom.modeCate?.name,code:geom.modeCate?.code,cate_no:geom.modeCate?.cate_no,layerList:geom.modeCate?.layerList||[]},
    size:geom.size,outSize:geom.outSize,knifeSize:geom.knifeSize,
    extra:{cutlineLength:geom.extra?.cutlineLength,foldlineLength:geom.extra?.foldlineLength},
    layer,
  }
}

/** 命令上的 tag / tagData 是坐标的文字副本（随尺寸变），重建时用不到，也不应算作拓扑差异 */
const TEXT_KEYS=new Set(['tag','tagData','dlistStr'])
function stripText(node){
  if(Array.isArray(node))return node.map(stripText)
  if(node&&typeof node==='object'){
    const out={}
    for(const k of Object.keys(node))if(!TEXT_KEYS.has(k))out[k]=stripText(node[k])
    return out
  }
  return node
}

/** 拓扑签名：键、类型、数组长度、字符串值、结构标志 */
export function signature(node){
  if(Array.isArray(node))return '['+node.map(signature).join(',')+']'
  if(node&&typeof node==='object'){
    return '{'+Object.keys(node).map(k=>{
      const v=node[k]
      if(STRUCTURAL_KEYS.has(k))return `${k}=${JSON.stringify(v)}`
      return `${k}:${signature(v)}`
    }).join(',')+'}'
  }
  if(typeof node==='number')return 'n'
  return JSON.stringify(node)
}
export const vectorOf=obj=>numericSlots(obj).map(([o,k])=>o[k])
const sizeOf=g=>({L:Number(g.knifeSize.L),W:Number(g.knifeSize.W),H:Number(g.knifeSize.H)})

/** 一个盒型的全部样本点。验证样本（_a.._d、_v<n>）单独标出，不参与插值。 */
export function loadPoints(root,cat,num){
  const dir=path.join(root,'docs','pacdora-multisize')
  const baseRaw=JSON.parse(fs.readFileSync(path.join(root,'public',`${cat}-geom`,`${num}.json`),'utf8'))
  const mk=(raw,file,kind)=>{const geom=trim(raw);return {k:sizeOf(geom),geom,sig:signature(geom),file,kind}}
  const base=mk(baseRaw,null,'base')
  const grid=[],validation=[]
  if(fs.existsSync(dir)){
    for(const f of fs.readdirSync(dir)){
      if(!f.startsWith(`${num}_`)||!f.endsWith('.json'))continue
      let raw
      try{raw=JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'))}catch{continue}
      if(!raw?.layer||!raw.knifeSize)continue
      const isValidation=/_[a-d]\.json$|_v\d+\.json$/.test(f)
      ;(isValidation?validation:grid).push(mk(raw,f,isValidation?'validation':'grid'))
    }
  }
  return {base,grid,validation,limits:{
    L:limitOf(baseRaw.modeCate?.lengthLimit),W:limitOf(baseRaw.modeCate?.widthLimit),H:limitOf(baseRaw.modeCate?.heightLimit),
  }}
}
function limitOf(s){const m=/^\s*([\d.]+)\s*,\s*([\d.]+)/.exec(String(s||''));return m?[Number(m[1]),Number(m[2])]:[0,Infinity]}

/** 过 center、只有 dim 变化的那条线上的采样点（含 center），按 dim 升序 */
function lineThrough(center,all,dim){
  const others=DIMS.filter(d=>d!==dim)
  const seen=new Set()
  const out=[]
  for(const p of [center,...all]){
    if(!others.every(d=>same(p.k[d],center.k[d])))continue
    const key=round(p.k[dim])
    if(seen.has(key))continue
    seen.add(key)
    out.push(p)
  }
  return out.sort((a,b)=>a.k[dim]-b.k[dim])
}

/** 围绕 center 的逐维插值数据：每条轴线只取与 center 拓扑相同、且连续包含 center 的一段 */
export function anchorData(center,all){
  const v0=vectorOf(center.geom)
  const dims={},range={},dropped=[]
  for(const dim of DIMS){
    const line=lineThrough(center,all,dim)
    const at=line.indexOf(center)
    let lo=at,hi=at
    while(lo>0&&line[lo-1].sig===center.sig)lo--
    while(hi<line.length-1&&line[hi+1].sig===center.sig)hi++
    for(let i=0;i<line.length;i++)if(i<lo||i>hi)dropped.push(`${dim}${line[i].k[dim]}`)
    const pts=line.slice(lo,hi+1).map(p=>({v:p.k[dim],d:p===center?null:vectorOf(p.geom).map((x,i)=>round(x-v0[i]))}))
    const idx=[]
    for(let i=0;i<v0.length;i++)if(pts.some(p=>p.d&&p.d[i]!==0))idx.push(i)
    dims[dim]={v:pts.map(p=>p.v),idx,d:pts.map(p=>p.d?idx.map(i=>p.d[i]):idx.map(()=>0))}
    range[dim]=[pts[0].v,pts[pts.length-1].v]
  }
  return {baseKnife:{...center.k},range,dims,base:center.geom,dropped,values:v0.length}
}

/**
 * 次锚点：主锚点每条轴线上，拓扑与原始刀版不同的每一段连续采样点各出一个，取该段中间的点。
 * @returns {Array<{center:object,dim:string}>}
 */
export function secondaryCenters(base,grid){
  const out=[]
  for(const dim of DIMS){
    const line=lineThrough(base,grid,dim)
    let run=[]
    const flush=()=>{
      // 只有一个采样点的段没有可插值的范围（拓扑随尺寸不停变化的盒型就是这样），不设锚点
      if(run.length>=2&&run[0].sig!==base.sig){
        // 优先用已经补采过另外两条轴线的那个点（否则加密采样后中间点会变，之前补的样本就用不上了）
        const support=p=>grid.filter(q=>q!==p&&same(q.k[dim],p.k[dim])).length
        const mid=run[Math.floor((run.length-1)/2)]
        let center=mid,best=support(mid)
        for(const p of run){const n=support(p);if(n>best){best=n;center=p}}
        out.push({center,dim})
      }
      run=[]
    }
    for(const p of line){
      if(run.length&&p.sig!==run[0].sig)flush()
      run.push(p)
    }
    flush()
  }
  return out
}

/** 次锚点另外两条轴线上要补采的点（沿用原始尺寸的采样倍数，钳在官方允许的尺寸范围内） */
export function neededPoints(base,centers,limits){
  const pts=[]
  for(const {center,dim} of centers){
    for(const d2 of DIMS){
      if(d2===dim)continue
      for(const f of FACTORS){
        const v=Math.max(limits[d2][0],Math.min(limits[d2][1],Math.round(base.k[d2]*f)))
        if(same(v,center.k[d2]))continue
        pts.push({...center.k,[d2]:v})
      }
    }
  }
  const seen=new Set()
  return pts.filter(p=>{const k=`${p.L}x${p.W}x${p.H}`;if(seen.has(k))return false;seen.add(k);return true})
}

export const pointName=p=>`p${p.L}x${p.W}x${p.H}`
