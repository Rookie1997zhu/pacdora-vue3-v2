/**
 * INBOX → OUTBOX 尺寸联动
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

/**
 * 外箱内空 = 内盒外廓 + 2×间隙；夹紧到模板 limits
 * @returns {{inner:{length,width,height},clamped:boolean,warnings:string[],gap:object}|null}
 */
export function computeOutboxSize(outer,gap=DEFAULT_OUTBOX_GAP){
  if(!outer)return null
  const g={
    length:Math.max(0,Number(gap.length)||0),
    width:Math.max(0,Number(gap.width)||0),
    height:Math.max(0,Number(gap.height)||0)
  }
  let length=roundUpMm(outer.length+2*g.length)
  let width=roundUpMm(outer.width+2*g.width)
  let height=roundUpMm(outer.height+2*g.height)
  const tpl=getTemplate(OUTBOX_TEMPLATE_ID)
  const lim=tpl.limits||{}
  const warnings=[]
  let clamped=false
  const dims=['length','width','height']
  for(const key of dims){
    const range=lim[key]
    if(!Array.isArray(range)||range.length<2)continue
    const before=key==='length'?length:key==='width'?width:height
    const after=clamp(before,range[0],range[1])
    if(after!==before){
      clamped=true
      warnings.push(`${key}:${before}->${after}`)
    }
    if(key==='length')length=after
    else if(key==='width')width=after
    else height=after
  }
  return {inner:{length,width,height},clamped,warnings,gap:g}
}

/**
 * 生成外箱 knife（内尺寸 = 计算后的内空）
 * @returns {{knife:object,plan:object,outer:object}|null}
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
  enabled=true
}={}){
  if(!canBuildOutbox({knife:inboxKnife,modelOnly,flatHeight,enabled}))return null
  const outer=inboxOuterDims(inboxKnife)
  const plan=computeOutboxSize(outer,gap)
  if(!plan)return null
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
  return {knife,plan,outer}
}
