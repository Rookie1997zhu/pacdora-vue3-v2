/**
 * Outline integrity of a dieline, measured so that a resized dieline can be compared with the
 * same template at its default size.
 *
 * Structure parameters of the imported templates are fixed millimetre values taken from one
 * sample. When the box is resized they may no longer fit the panels: panels drift apart or the
 * cut line no longer goes round them. The contract checks (face count, sizes …) do not see that.
 * Two signals, both only meaningful relative to the default size of the same template:
 *   islands  groups of panels that touch each other (a healthy dieline is normally one group)
 *   open     panels the cut line does not enclose on all four sides
 *   overlap  share of the panel area where two panels lie on top of each other (in a flat sheet
 *            they cannot; some templates model a gusset as a panel on top of its parent, which is
 *            why this too is compared with the default size instead of with zero)
 */
import polygonClipping from 'polygon-clipping'

/** Overlap may grow by this share of the total panel area before the dieline counts as broken */
const OVERLAP_GROWTH_MAX=0.01
const TOUCH_MM=0.6
const MIN_FACE_MM=1
const MIN_PROBE_FACE_MM=2

function pointInLoop(pt,loop){
  let c=false
  for(let i=0,j=loop.length-1;i<loop.length;j=i++){
    const [xi,yi]=loop[i],[xj,yj]=loop[j]
    if((yi>pt[1])!==(yj>pt[1])&&pt[0]<(xj-xi)*(pt[1]-yi)/(yj-yi)+xi)c=!c
  }
  return c
}

/** A point inside the face outline (bbox centre, else the centroid of a fan triangle). */
function probePoint(f){
  const loop=Array.isArray(f.outline)&&f.outline.length>=3
    ?f.outline.map(p=>[Number(p[0]),Number(p[1])])
    :[[f.x,f.y],[f.x+f.w,f.y],[f.x+f.w,f.y+f.h],[f.x,f.y+f.h]]
  const c=[f.x+f.w/2,f.y+f.h/2]
  if(pointInLoop(c,loop))return c
  for(let i=1;i<loop.length-1;i++){
    const p=[(loop[0][0]+loop[i][0]+loop[i+1][0])/3,(loop[0][1]+loop[i][1]+loop[i+1][1])/3]
    if(pointInLoop(p,loop))return p
  }
  return c
}

/** Number of groups of panels whose bounding boxes touch. */
export function countFaceIslands(knife){
  const f=(knife?.faces||[]).filter(a=>a.w>MIN_FACE_MM&&a.h>MIN_FACE_MM)
  const par=f.map((_,i)=>i)
  const find=i=>par[i]===i?i:(par[i]=find(par[i]))
  for(let i=0;i<f.length;i++){
    for(let j=i+1;j<f.length;j++){
      const a=f[i],b=f[j]
      const ox=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)
      const oy=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)
      if(ox>-TOUCH_MM&&oy>-TOUCH_MM)par[find(i)]=find(j)
    }
  }
  return new Set(par.map((_,i)=>find(i))).size
}

/** Names of panels the cut line does not enclose (a ray from inside reaches the sheet edge). */
export function openFaces(knife){
  const segs=knife?.layers?.trim?.segments||[]
  const out=[]
  for(const f of knife?.faces||[]){
    if(!(f.w>MIN_PROBE_FACE_MM&&f.h>MIN_PROBE_FACE_MM))continue
    const [px,py]=probePoint(f)
    let L=false,R=false,U=false,D=false
    for(const s of segs){
      if((s.y1-py)*(s.y2-py)<=0&&s.y1!==s.y2){
        const x=s.x1+(py-s.y1)*(s.x2-s.x1)/(s.y2-s.y1)
        if(x<px)L=true;else R=true
      }
      if((s.x1-px)*(s.x2-px)<=0&&s.x1!==s.x2){
        const y=s.y1+(px-s.x1)*(s.y2-s.y1)/(s.x2-s.x1)
        if(y<py)U=true;else D=true
      }
      if(L&&R&&U&&D)break
    }
    if(!(L&&R&&U&&D))out.push(f.name)
  }
  return out
}

const faceLoop=f=>Array.isArray(f.outline)&&f.outline.length>=3
  ?f.outline.map(p=>[Number(p[0]),Number(p[1])])
  :[[f.x,f.y],[f.x+f.w,f.y],[f.x+f.w,f.y+f.h],[f.x,f.y+f.h]]

function multiPolygonArea(mp){
  let a=0
  for(const poly of mp||[]){
    poly.forEach((ring,i)=>{
      let s=0
      for(let j=0;j<ring.length-1;j++)s+=ring[j][0]*ring[j+1][1]-ring[j+1][0]*ring[j][1]
      a+=(i?-1:1)*Math.abs(s)/2
    })
  }
  return a
}

/** Area where panels lie on top of each other, as a share of the total panel (bbox) area. */
export function faceOverlapRatio(knife){
  const f=(knife?.faces||[]).filter(a=>a.w>MIN_FACE_MM&&a.h>MIN_FACE_MM)
  let over=0,net=0
  const loops=f.map(()=>null)
  for(let i=0;i<f.length;i++){
    net+=f[i].w*f[i].h
    for(let j=i+1;j<f.length;j++){
      const a=f[i],b=f[j]
      const ox=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)
      const oy=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)
      if(ox<0.5||oy<0.5)continue
      try{
        loops[i]=loops[i]||faceLoop(a)
        loops[j]=loops[j]||faceLoop(b)
        const area=multiPolygonArea(polygonClipping.intersection([loops[i]],[loops[j]]))
        if(area>1)over+=area
      }catch{/* degenerate outline: not counted */}
    }
  }
  return net>0?over/net:0
}

export function outlineStats(knife){
  return {islands:countFaceIslands(knife),open:openFaces(knife),overlap:faceOverlapRatio(knife)}
}

/**
 * Compare a knife with the outline stats of the same template at its default size.
 * Returns null when the outline is as whole as at the default size, else what got worse.
 */
export function outlineRegression(knife,baseStats){
  if(!knife||!baseStats)return null
  const a=outlineStats(knife)
  const split=a.islands>baseStats.islands
  // Panels that are already open at the default size are that template's normal shape
  const opened=a.open.length>baseStats.open.length
  // Templates that overlap a lot by design (star box: 18%) get proportionally more room
  const baseOverlap=Number(baseStats.overlap)||0
  const overlapping=a.overlap>baseOverlap*1.5+OVERLAP_GROWTH_MAX
  if(!split&&!opened&&!overlapping)return null
  const baseOpen=new Set(baseStats.open)
  const newlyOpen=a.open.filter(n=>!baseOpen.has(n))
  return {
    islands:a.islands,baseIslands:baseStats.islands,
    open:opened?(newlyOpen.length?newlyOpen:a.open):[],
    split,opened,overlapping,overlap:a.overlap,baseOverlap:Number(baseStats.overlap)||0,
  }
}
