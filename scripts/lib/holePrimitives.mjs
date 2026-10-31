/**
 * 金样孔位路径 → 面内相对 UV 图元（无刀版绝对坐标）。
 * 圆角矩形识别为 {u,v,w,h,fw,fh,r,sc}；其余展平为折线 ol（孔 bbox 内 UV）。
 */
import {flattenPath} from '../../src/geom/flattenPath.js'

const r2=n=>Math.round(n*100)/100
const r4=n=>Math.round(n*10000)/10000
const WINDOW_FRAC=.3
const MAX_OL=48

export {flattenPath}

function bboxOf(pts){
  const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1])
  const x=Math.min(...xs),y=Math.min(...ys)
  return {x,y,w:Math.max(...xs)-x,h:Math.max(...ys)-y}
}

/** 轴对齐 L + 等半径 A 的圆角矩形识别；成功返回 r，否则 null */
function detectRoundedRect(cmds){
  if(!Array.isArray(cmds)||cmds.length<4)return null
  const arcs=cmds.filter(c=>c.mtd==='A')
  const lines=cmds.filter(c=>c.mtd==='L')
  const moves=cmds.filter(c=>c.mtd==='M')
  if(moves.length!==1)return null
  // 纯直线矩形
  if(!arcs.length&&lines.length>=3&&cmds.every(c=>c.mtd==='M'||c.mtd==='L'||c.mtd==='Z')){
    const pts=flattenPath(cmds)
    if(pts.length!==4)return null
    const b=bboxOf(pts)
    const onCorner=pts.every(p=>
      (Math.abs(p[0]-b.x)<.2||Math.abs(p[0]-b.x-b.w)<.2)&&
      (Math.abs(p[1]-b.y)<.2||Math.abs(p[1]-b.y-b.h)<.2)
    )
    return onCorner?0:null
  }
  if(arcs.length!==4)return null
  const rs=arcs.map(a=>Number(a.rx)||0)
  const r=rs[0]
  if(r<.05||rs.some(v=>Math.abs(v-r)>.3)||arcs.some(a=>Math.abs((a.ry||0)-r)>.3))return null
  // 直线应轴对齐
  let px=Number(moves[0].x),py=Number(moves[0].y)
  for(const c of cmds){
    if(c.mtd==='L'){
      if(Math.abs(c.x-px)>.3&&Math.abs(c.y-py)>.3)return null
      px=c.x;py=c.y
    }else if(c.mtd==='A'){px=c.x;py=c.y}
  }
  return r
}

function simplify(pts,maxN){
  if(pts.length<=maxN)return pts
  const step=pts.length/maxN
  const out=[]
  for(let i=0;i<maxN;i++)out.push(pts[Math.min(pts.length-1,Math.floor(i*step))])
  return out
}

/**
 * @param {object[]} cmds 金样孔路径命令
 * @param {{x,y,w,h}} faceBox 所属面 bbox
 * @returns {object|null} 孔位图元
 */
export function toHolePrimitive(cmds,faceBox){
  if(!faceBox||faceBox.w<.5||faceBox.h<.5)return null
  const list=Array.isArray(cmds)?cmds:(cmds?.dlist||[])
  if(!list.length)return null
  const pts=flattenPath(list)
  if(pts.length<3)return null
  const hb=bboxOf(pts)
  if(hb.w<.5||hb.h<.5)return null
  const cx=hb.x+hb.w/2,cy=hb.y+hb.h/2
  const u=r4((cx-faceBox.x)/faceBox.w)
  const v=r4((cy-faceBox.y)/faceBox.h)
  if(u<-.05||u>1.05||v<-.05||v>1.05)return null
  const fw=r4(hb.w/faceBox.w),fh=r4(hb.h/faceBox.h)
  const sc=fw>=WINDOW_FRAC&&fh>=WINDOW_FRAC?1:0
  const prim={
    u:r4(Math.min(1,Math.max(0,u))),
    v:r4(Math.min(1,Math.max(0,v))),
    w:r2(hb.w),h:r2(hb.h),
    fw,fh,sc
  }
  const rr=detectRoundedRect(list)
  if(rr!=null){
    if(rr>0)prim.r=r2(rr)
    return prim
  }
  // 非矩形：孔 bbox 内 UV 折线
  const ol=simplify(pts,MAX_OL).map(([px,py])=>[
    r4(Math.min(1,Math.max(0,(px-hb.x)/Math.max(hb.w,1e-6)))),
    r4(Math.min(1,Math.max(0,(py-hb.y)/Math.max(hb.h,1e-6))))
  ])
  if(ol.length>=3)prim.ol=ol
  return prim
}

/** 孔中心（用于未归属 layer.holes 的分配） */
export function holeCenter(cmds){
  const list=Array.isArray(cmds)?cmds:(cmds?.dlist||[])
  const pts=flattenPath(list)
  if(pts.length<2)return null
  const b=bboxOf(pts)
  return {x:b.x+b.w/2,y:b.y+b.h/2,w:b.w,h:b.h}
}
