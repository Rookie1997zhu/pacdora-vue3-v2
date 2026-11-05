/**
 * INBOX → OUTBOX 尺寸联动 + 每箱数量排布
 * 外箱默认 rea-carton-0201（与运输箱目录 200010 对齐的参数化 0201）
 */
import {createKnife} from './knife.js'
import {getTemplate} from './templates/index.js'

export const OUTBOX_TEMPLATE_ID='rea-carton-0201'
export const DEFAULT_OUTBOX_GAP=Object.freeze({length:5,width:5,height:5})
export const DEFAULT_OUTBOX_THICKNESS=3

function roundUpMm(n){
  const v=Number(n)
  if(!Number.isFinite(v)||v<=0)return 0
  return Math.ceil(v)
}

function clamp(n,lo,hi){
  return Math.min(hi,Math.max(lo,n))
}

function mm3ToLiters(mm3){
  return Math.round((Number(mm3)||0)/1000)/1000 // L, 3 decimals from mm³→L then round to 0.001; plan says 2 decimals
}

function liters2(mm3){
  return Math.round((Number(mm3)||0)/10000)/100 // L with 2 decimals
}

/** 从内盒 knife 取外廓；缺省回退 length/width/height */
export function inboxOuterDims(knife){
  if(!knife)return null
  const d=knife.dimensions||{}
  const outer=d.outer||{}
  let length=Number(outer.length)
  let width=Number(outer.width)
  let height=Number(outer.height)
  if(!(length>0))length=Number(d.length)||0
  if(!(width>0))width=Number(d.width)||0
  if(!(height>0))height=Number(d.height)||0
  if(!(length>0&&width>0&&height>0))return null
  return {length,width,height}
}

/**
 * 是否可为该内盒生成外箱
 * @param {{knife?:object,modelOnly?:boolean,flatHeight?:boolean,enabled?:boolean}} opts
 */
export function canBuildOutbox({knife,modelOnly=false,flatHeight=false,enabled=true}={}){
  if(!enabled)return false
  if(modelOnly)return false
  if(flatHeight)return false
  if(!knife?.faces?.length)return false
  return !!inboxOuterDims(knife)
}

function normalizeGap(gap=DEFAULT_OUTBOX_GAP){
  return {
    length:Math.max(0,Number(gap.length)||0),
    width:Math.max(0,Number(gap.width)||0),
    height:Math.max(0,Number(gap.height)||0)
  }
}

function clampInner(inner){
  const tpl=getTemplate(OUTBOX_TEMPLATE_ID)
  const lim=tpl.limits||{}
  const warnings=[]
  let clamped=false
  const out={...inner}
  for(const key of ['length','width','height']){
    const range=lim[key]
    if(!Array.isArray(range)||range.length<2)continue
    const before=out[key]
    const after=clamp(before,range[0],range[1])
    if(after!==before){
      clamped=true
      warnings.push(`${key}:${before}->${after}`)
    }
    out[key]=after
  }
  return {inner:out,clamped,warnings}
}

function withinLimits(inner){
  const tpl=getTemplate(OUTBOX_TEMPLATE_ID)
  const lim=tpl.limits||{}
  for(const key of ['length','width','height']){
    const range=lim[key]
    if(!Array.isArray(range)||range.length<2)continue
    const v=inner[key]
    if(v<range[0]||v>range[1])return false
  }
  return true
}

function rawInnerFromPack(cell,gap,nx,ny,nz){
  const g=normalizeGap(gap)
  return {
    length:roundUpMm(nx*cell.length+2*g.length),
    width:roundUpMm(ny*cell.width+2*g.width),
    height:roundUpMm(nz*cell.height+2*g.height)
  }
}

/**
 * 枚举 nx*ny*nz===N 的因数组合；每种试 L/W 互换（直立不侧放）
 */
export function packingCandidates(outer,N=1){
  const n=Math.max(1,Math.floor(Number(N)||1))
  const base={length:outer.length,width:outer.width,height:outer.height}
  const orients=[
    {rotated:false,cell:{...base}},
    {rotated:true,cell:{length:base.width,width:base.length,height:base.height}}
  ]
  // 去重：正方形底时旋转相同
  const uniqOrients=[]
  const seen=new Set()
  for(const o of orients){
    const key=`${o.cell.length}x${o.cell.width}x${o.cell.height}`
    if(seen.has(key))continue
    seen.add(key)
    uniqOrients.push(o)
  }
  const out=[]
  for(let nx=1;nx<=n;nx++){
    if(n%nx)continue
    const rem=n/nx
    for(let ny=1;ny<=rem;ny++){
      if(rem%ny)continue
      const nz=rem/ny
      for(const o of uniqOrients){
        out.push({
          nx,ny,nz:Math.floor(nz),
          rotated:o.rotated,
          cell:{...o.cell},
          quantity:n
        })
      }
    }
  }
  return out
}

/**
 * 自动选最省体积；手动覆盖时校验乘积
 * @returns {{nx,ny,nz,rotated,cell,quantity,mode:'auto'|'manual',warnings:string[],rawInner,score}}
 */
export function choosePacking(outer,N=1,gap=DEFAULT_OUTBOX_GAP,{manual=null}={}){
  if(!outer)return null
  const n=Math.max(1,Math.floor(Number(N)||1))
  const g=normalizeGap(gap)
  const warnings=[]

  if(manual&&manual.nx&&manual.ny&&manual.nz){
    const nx=Math.max(1,Math.floor(Number(manual.nx)||1))
    const ny=Math.max(1,Math.floor(Number(manual.ny)||1))
    const nz=Math.max(1,Math.floor(Number(manual.nz)||1))
    const rotated=!!manual.rotated
    const cell=rotated
      ?{length:outer.width,width:outer.length,height:outer.height}
      :{length:outer.length,width:outer.width,height:outer.height}
    if(nx*ny*nz!==n)warnings.push('layoutMismatch')
    const rawInner=rawInnerFromPack(cell,g,nx,ny,nz)
    return {
      nx,ny,nz,rotated,cell,quantity:n,mode:'manual',warnings,
      rawInner,
      score:rawInner.length*rawInner.width*rawInner.height
    }
  }

  const cands=packingCandidates(outer,n)
  let best=null
  for(const c of cands){
    const rawInner=rawInnerFromPack(c.cell,g,c.nx,c.ny,c.nz)
    if(!withinLimits(rawInner))continue
    const vol=rawInner.length*rawInner.width*rawInner.height
    const area=2*(rawInner.length*rawInner.width+rawInner.length*rawInner.height+rawInner.width*rawInner.height)
    const score=vol
    const tie=area
    if(!best||score<best.score||(score===best.score&&tie<best.tie)){
      best={...c,rawInner,score,tie,mode:'auto',warnings:[]}
    }
  }
  // 若全部超限，仍取体积最小（后续夹紧）
  if(!best){
    for(const c of cands){
      const rawInner=rawInnerFromPack(c.cell,g,c.nx,c.ny,c.nz)
      const vol=rawInner.length*rawInner.width*rawInner.height
      const area=2*(rawInner.length*rawInner.width+rawInner.length*rawInner.height+rawInner.width*rawInner.height)
      if(!best||vol<best.score||(vol===best.score&&area<best.tie)){
        best={...c,rawInner,score:vol,tie:area,mode:'auto',warnings:['clampedFallback']}
      }
    }
  }
  return best
}

/**
 * 外箱内空 = 排布占用 + 2×间隙；夹紧到模板 limits
 * 兼容旧调用：无 packing 时按 1×1×1
 */
export function computeOutboxSize(outer,gap=DEFAULT_OUTBOX_GAP,packing=null){
  if(!outer)return null
  const g=normalizeGap(gap)
  const pack=packing||{
    nx:1,ny:1,nz:1,rotated:false,
    cell:{length:outer.length,width:outer.width,height:outer.height},
    quantity:1
  }
  const cell=pack.cell||outer
  const nx=Math.max(1,Number(pack.nx)||1)
  const ny=Math.max(1,Number(pack.ny)||1)
  const nz=Math.max(1,Number(pack.nz)||1)
  const raw={
    length:roundUpMm(nx*cell.length+2*g.length),
    width:roundUpMm(ny*cell.width+2*g.width),
    height:roundUpMm(nz*cell.height+2*g.height)
  }
  const {inner,clamped,warnings}=clampInner(raw)
  return {inner,clamped,warnings,gap:g,packing:pack,raw}
}

/** 体积与装载率（升 L，2 位小数） */
export function packingStats(outer,quantity,plan){
  if(!outer||!plan?.inner)return null
  const n=Math.max(1,Math.floor(Number(quantity)||1))
  const unitMm3=outer.length*outer.width*outer.height
  const totalMm3=unitMm3*n
  const cavityMm3=plan.inner.length*plan.inner.width*plan.inner.height
  const fillRate=cavityMm3>0?Math.round((totalMm3/cavityMm3)*1000)/10:0
  return {
    unitLiters:liters2(unitMm3),
    totalLiters:liters2(totalMm3),
    cavityLiters:liters2(cavityMm3),
    fillRate,
    quantity:n
  }
}

/** 内容物网格中心坐标（相对外箱内空原点，单位 mm，Y 向上） */
export function packingContentCells(packing){
  if(!packing?.cell)return []
  const {nx,ny,nz,cell}=packing
  const cells=[]
  for(let iz=0;iz<nz;iz++){
    for(let iy=0;iy<ny;iy++){
      for(let ix=0;ix<nx;ix++){
        cells.push({
          x:(ix+0.5)*cell.length,
          y:(iy+0.5)*cell.width,
          z:(iz+0.5)*cell.height,
          length:cell.length,
          width:cell.width,
          height:cell.height
        })
      }
    }
  }
  return cells
}

/**
 * 生成外箱 knife
 * @returns {{knife,plan,outer,packing,stats}|null}
 */
export function buildOutboxKnife({
  inboxKnife,
  gap=DEFAULT_OUTBOX_GAP,
  thickness=DEFAULT_OUTBOX_THICKNESS,
  bleed=5,
  materialId='kraft',
  fluteDirection='L',
  modelOnly=false,
  flatHeight=false,
  enabled=true,
  quantity=1,
  manualLayout=null
}={}){
  if(!canBuildOutbox({knife:inboxKnife,modelOnly,flatHeight,enabled}))return null
  const outer=inboxOuterDims(inboxKnife)
  const packing=choosePacking(outer,quantity,gap,{manual:manualLayout})
  if(!packing)return null
  const plan=computeOutboxSize(outer,gap,packing)
  if(!plan)return null
  // 合并排布告警
  if(packing.warnings?.length){
    plan.warnings=[...(plan.warnings||[]),...packing.warnings]
  }
  const T=Math.max(0.5,Number(thickness)||DEFAULT_OUTBOX_THICKNESS)
  const knife=createKnife({
    templateId:OUTBOX_TEMPLATE_ID,
    length:plan.inner.length,
    width:plan.inner.width,
    height:plan.inner.height,
    thickness:T,
    bleed,
    sizeMode:'inner',
    fluteDirection,
    materialId
  })
  const stats=packingStats(outer,packing.quantity,plan)
  return {knife,plan,outer,packing,stats}
}

// silence unused in case tree-shaken — mm3ToLiters kept for clarity
void mm3ToLiters
