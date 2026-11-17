/**
 * 路径展平：SVG 圆弧 / 二次 / 三次贝塞尔 → 折线。
 * 编译期与运行期共用；三次贝塞尔经仿射变换后仍精确，故规格存 UV 三次段。
 */

const EPS=.05
const ARC_FIT_EPS=.025

const round=n=>Math.round(Number(n)*1000)/1000

/** 圆弧按弦高误差选取分段数。angleRad 默认四分之一圆。 */
export function arcSegmentCount(radius,angleRad=Math.PI/2,tol=.04,minSegments=1){
  const r=Math.abs(Number(radius)||0)
  if(r<1e-9)return Math.max(1,minSegments)
  const safeTol=Math.max(1e-4,Math.min(Math.abs(Number(tol)||.04),r))
  const maxStep=2*Math.acos(Math.max(-1,Math.min(1,1-safeTol/r)))
  return Math.max(1,minSegments,Math.ceil(Math.abs(angleRad)/Math.max(maxStep,1e-6)))
}

/** SVG 端点弧参数 → 圆心参数（与 SVG A 一致；large=大弧，sweep=扫掠方向） */
export function arcCenter(x1,y1,x2,y2,rx,ry,angDeg,large,sweep){
  rx=Math.abs(rx);ry=Math.abs(ry)
  if(rx<.1||ry<.1)return null
  const phi=(angDeg||0)*Math.PI/180
  const cos=Math.cos(phi),sin=Math.sin(phi)
  const dx=(x1-x2)/2,dy=(y1-y2)/2
  const x1p=cos*dx+sin*dy,y1p=-sin*dx+cos*dy
  let rx2=rx*rx,ry2=ry*ry,x1p2=x1p*x1p,y1p2=y1p*y1p
  const lam=x1p2/rx2+y1p2/ry2
  if(lam>1){const s=Math.sqrt(lam);rx*=s;ry*=s;rx2=rx*rx;ry2=ry*ry}
  const sign=large===sweep?-1:1
  const num=rx2*ry2-rx2*y1p2-ry2*x1p2
  const den=rx2*y1p2+ry2*x1p2
  const c=sign*Math.sqrt(Math.max(0,num/den))
  const cxp=c*(rx*y1p)/ry,cyp=c*(-ry*x1p)/rx
  const cx=cos*cxp-sin*cyp+(x1+x2)/2
  const cy=sin*cxp+cos*cyp+(y1+y2)/2
  const a=(ux,uy,vx,vy)=>{
    const n=Math.hypot(ux,uy)*Math.hypot(vx,vy)||1
    let ang=Math.acos(Math.min(1,Math.max(-1,(ux*vx+uy*vy)/n)))
    if(ux*vy-uy*vx<0)ang=-ang
    return ang
  }
  const t1=a(1,0,(x1p-cxp)/rx,(y1p-cyp)/ry)
  let dt=a((x1p-cxp)/rx,(y1p-cyp)/ry,(-x1p-cxp)/rx,(-y1p-cyp)/ry)
  if(!sweep&&dt>0)dt-=2*Math.PI
  if(sweep&&dt<0)dt+=2*Math.PI
  return {cx,cy,rx,ry,phi,t1,dt}
}

/** 椭圆点（参数角 t，已含旋转） */
function ellipsePt(c,t){
  const cos=Math.cos(c.phi),sin=Math.sin(c.phi)
  const x=c.rx*Math.cos(t),y=c.ry*Math.sin(t)
  return [c.cx+cos*x-sin*y,c.cy+sin*x+cos*y]
}

/**
 * SVG 圆弧 → 每段 ≤90° 的三次贝塞尔控制点列。
 * 返回 [{c1x,c1y,c2x,c2y,x,y}, ...]
 */
export function arcToCubics(x1,y1,x2,y2,rx,ry,angDeg,large,sweep){
  const c=arcCenter(x1,y1,x2,y2,rx,ry,angDeg,!!large,!!sweep)
  if(!c)return [{c1x:x1,c1y:y1,c2x:x2,c2y:y2,x:x2,y:y2}]
  const segs=Math.max(1,Math.ceil(Math.abs(c.dt)/(Math.PI/2)))
  const out=[]
  let t0=c.t1
  let [px,py]=[x1,y1]
  const cos=Math.cos(c.phi),sin=Math.sin(c.phi)
  for(let i=1;i<=segs;i++){
    const t1=c.t1+c.dt*(i/segs)
    const [qx,qy]=ellipsePt(c,t1)
    // 切向量：d/dt = R·(-rx sin t, ry cos t)
    const alpha=Math.tan((t1-t0)/4)*4/3
    const tx0=-c.rx*Math.sin(t0),ty0=c.ry*Math.cos(t0)
    const tx1=-c.rx*Math.sin(t1),ty1=c.ry*Math.cos(t1)
    const dx0=cos*tx0-sin*ty0,dy0=sin*tx0+cos*ty0
    const dx1=cos*tx1-sin*ty1,dy1=sin*tx1+cos*ty1
    out.push({
      c1x:px+alpha*dx0,c1y:py+alpha*dy0,
      c2x:qx-alpha*dx1,c2y:qy-alpha*dy1,
      x:qx,y:qy
    })
    px=qx;py=qy;t0=t1
  }
  return out
}

function circleThrough(a,b,c){
  const ax=a[0],ay=a[1],bx=b[0],by=b[1],cx=c[0],cy=c[1]
  const d=2*(ax*(by-cy)+bx*(cy-ay)+cx*(ay-by))
  if(Math.abs(d)<1e-7)return null
  const aa=ax*ax+ay*ay,bb=bx*bx+by*by,cc=cx*cx+cy*cy
  const ux=(aa*(by-cy)+bb*(cy-ay)+cc*(ay-by))/d
  const uy=(aa*(cx-bx)+bb*(ax-cx)+cc*(bx-ax))/d
  const r=Math.hypot(ax-ux,ay-uy)
  return Number.isFinite(r)&&r>.05?{cx:ux,cy:uy,r}:null
}

function signedAngle(a,b){
  return Math.atan2(a[0]*b[1]-a[1]*b[0],a[0]*b[0]+a[1]*b[1])
}

/** 单步圆心角上限：1/4 圆弧最少 3 段（30°）可过；矩形（90°）、正八边形（45°）不算圆弧 */
const ARC_MAX_STEP=.6
/** 弦长一致性：均匀细分的圆弧各段等长，长方形/梯形的边不等长 */
function chordsUniform(points,from,to){
  const chords=[]
  for(let i=from;i<to;i++)chords.push(Math.hypot(points[i+1][0]-points[i][0],points[i+1][1]-points[i][1]))
  const avg=chords.reduce((sum,c)=>sum+c,0)/chords.length
  return chords.every(c=>Math.abs(c-avg)<=Math.max(.02,avg*.2))
}

function arcRun(points,start,{fitTolerance=ARC_FIT_EPS,closed=true}={}){
  if(start+3>=points.length)return null
  const circle=circleThrough(points[start],points[start+1],points[start+2])
  if(!circle)return null
  const vectors=[]
  for(let i=start;i<=start+3;i++){
    const p=points[i]
    if(Math.abs(Math.hypot(p[0]-circle.cx,p[1]-circle.cy)-circle.r)>fitTolerance)return null
    vectors.push([p[0]-circle.cx,p[1]-circle.cy])
  }
  const steps=[]
  for(let i=1;i<vectors.length;i++)steps.push(signedAngle(vectors[i-1],vectors[i]))
  const sign=Math.sign(steps[0])
  if(!sign||steps.some(a=>Math.sign(a)!==sign||Math.abs(a)<1e-4))return null
  const avg=steps.reduce((sum,a)=>sum+Math.abs(a),0)/steps.length
  if(steps.some(a=>Math.abs(Math.abs(a)-avg)>Math.max(.025,avg*.22)))return null
  // 共圆 ≠ 圆弧：矩形四角天然共圆。要求小转角 + 等弦长才认作细分圆弧
  if(steps.some(a=>Math.abs(a)>ARC_MAX_STEP))return null
  if(!chordsUniform(points,start,start+3))return null
  const chord0=Math.hypot(points[start+1][0]-points[start][0],points[start+1][1]-points[start][1])

  let end=start+3
  let prev=vectors[vectors.length-1]
  while(end+1<points.length){
    const p=points[end+1]
    const radial=Math.abs(Math.hypot(p[0]-circle.cx,p[1]-circle.cy)-circle.r)
    if(radial>fitTolerance)break
    const next=[p[0]-circle.cx,p[1]-circle.cy]
    const step=signedAngle(prev,next)
    if(Math.sign(step)!==sign||Math.abs(step)<1e-4||Math.abs(Math.abs(step)-avg)>Math.max(.04,avg*.35))break
    const q=points[end]
    const chord=Math.hypot(p[0]-q[0],p[1]-q[1])
    if(Math.abs(chord-chord0)>Math.max(.03,chord0*.35))break
    prev=next
    end++
  }
  const first=[points[start][0]-circle.cx,points[start][1]-circle.cy]
  const last=[points[end][0]-circle.cx,points[end][1]-circle.cy]
  let sweep=signedAngle(first,last)
  if(sign>0&&sweep<0)sweep+=Math.PI*2
  if(sign<0&&sweep>0)sweep-=Math.PI*2
  if(Math.abs(sweep)<.08||Math.abs(sweep)>Math.PI*2-.02)return null
  // 闭合环整圈都落在同一圆上（正多边形）：保持折线，不输出单条 A
  if(closed&&start===0&&end===points.length-1)return null
  return {...circle,end,large:Math.abs(sweep)>Math.PI,dir:sign>0}
}

/**
 * 折线环重建为 M/L/A/Z 命令。仅把至少 3 条、等角且共圆的连续折线合并为 A；
 * 无法确认的片段保持 L，避免把普通拐角误判为圆弧。
 */
export function pathCommandsFromLoop(points,{closed=true,fitTolerance=ARC_FIT_EPS}={}){
  if(!Array.isArray(points)||!points.length)return []
  const pts=points
    .filter(p=>Array.isArray(p)&&Number.isFinite(Number(p[0]))&&Number.isFinite(Number(p[1])))
    .map(p=>[Number(p[0]),Number(p[1])])
  if(pts.length>=2&&Math.hypot(pts[0][0]-pts[pts.length-1][0],pts[0][1]-pts[pts.length-1][1])<1e-6)pts.pop()
  if(!pts.length)return []
  const out=[{mtd:'M',x:round(pts[0][0]),y:round(pts[0][1])}]
  let i=1
  while(i<pts.length){
    const arc=arcRun(pts,i-1,{fitTolerance,closed})
    if(arc){
      const end=pts[arc.end]
      out.push({
        mtd:'A',rx:round(arc.r),ry:round(arc.r),ang:0,
        arc:arc.large,dir:arc.dir,x:round(end[0]),y:round(end[1])
      })
      i=arc.end+1
      continue
    }
    out.push({mtd:'L',x:round(pts[i][0]),y:round(pts[i][1])})
    i++
  }
  if(closed)out.push({mtd:'Z'})
  return out
}

/** 轴对齐圆角矩形的精确路径命令。 */
export function roundedRectPathCommands(x,y,w,h,r=0){
  const radius=Math.max(0,Math.min(Number(r)||0,Number(w)/2,Number(h)/2))
  x=Number(x);y=Number(y);w=Number(w);h=Number(h)
  if(radius<1e-6)return pathCommandsFromLoop([[x,y],[x+w,y],[x+w,y+h],[x,y+h]])
  return [
    {mtd:'M',x:round(x+radius),y:round(y)},
    {mtd:'L',x:round(x+w-radius),y:round(y)},
    {mtd:'A',rx:round(radius),ry:round(radius),ang:0,arc:false,dir:true,x:round(x+w),y:round(y+radius)},
    {mtd:'L',x:round(x+w),y:round(y+h-radius)},
    {mtd:'A',rx:round(radius),ry:round(radius),ang:0,arc:false,dir:true,x:round(x+w-radius),y:round(y+h)},
    {mtd:'L',x:round(x+radius),y:round(y+h)},
    {mtd:'A',rx:round(radius),ry:round(radius),ang:0,arc:false,dir:true,x:round(x),y:round(y+h-radius)},
    {mtd:'L',x:round(x),y:round(y+radius)},
    {mtd:'A',rx:round(radius),ry:round(radius),ang:0,arc:false,dir:true,x:round(x+radius),y:round(y)},
    {mtd:'Z'}
  ]
}

export function commandsToPathData(cmds){
  const parts=[]
  for(const c of cmds||[]){
    if(c?.mtd==='M'||c?.mtd==='L')parts.push(`${c.mtd} ${c.x} ${c.y}`)
    else if(c?.mtd==='A')parts.push(`A ${c.rx||0} ${c.ry||0} ${c.ang||0} ${c.arc?1:0} ${c.dir?1:0} ${c.x} ${c.y}`)
    else if(c?.mtd==='Q')parts.push(`Q ${c.cx} ${c.cy} ${c.x} ${c.y}`)
    else if(c?.mtd==='C')parts.push(`C ${c.cx1??c.cx} ${c.cy1??c.cy} ${c.cx2??c.cx} ${c.cy2??c.cy} ${c.x} ${c.y}`)
    else if(c?.mtd==='Z')parts.push('Z')
  }
  return parts.join(' ')
}

export function flattenPaths(paths,opts){
  return (paths||[]).map(path=>flattenCubicPath(path,opts))
}

/** 二次贝塞尔精确升阶为三次 */
export function quadToCubic(x0,y0,cx,cy,x1,y1){
  return {
    c1x:x0+(2/3)*(cx-x0),c1y:y0+(2/3)*(cy-y0),
    c2x:x1+(2/3)*(cx-x1),c2y:y1+(2/3)*(cy-y1),
    x:x1,y:y1
  }
}

function cubicAt(x0,y0,c1x,c1y,c2x,c2y,x1,y1,t){
  const u=1-t
  return [
    u*u*u*x0+3*u*u*t*c1x+3*u*t*t*c2x+t*t*t*x1,
    u*u*u*y0+3*u*u*t*c1y+3*u*t*t*c2y+t*t*t*y1
  ]
}

/** 弦高误差：中点到弦的距离 */
function cubicFlatness(x0,y0,c1x,c1y,c2x,c2y,x1,y1){
  const [mx,my]=cubicAt(x0,y0,c1x,c1y,c2x,c2y,x1,y1,.5)
  const dx=x1-x0,dy=y1-y0
  const len=Math.hypot(dx,dy)||1
  return Math.abs((mx-x0)*dy-(my-y0)*dx)/len
}

function subdivideCubic(x0,y0,c1x,c1y,c2x,c2y,x1,y1,tol,out,budget){
  if(budget<=0||cubicFlatness(x0,y0,c1x,c1y,c2x,c2y,x1,y1)<=tol){
    out.push([x1,y1])
    return
  }
  // de Casteljau 中点拆分
  const ax=(x0+c1x)/2,ay=(y0+c1y)/2
  const bx=(c1x+c2x)/2,by=(c1y+c2y)/2
  const cx=(c2x+x1)/2,cy=(c2y+y1)/2
  const dx=(ax+bx)/2,dy=(ay+by)/2
  const ex=(bx+cx)/2,ey=(by+cy)/2
  const fx=(dx+ex)/2,fy=(dy+ey)/2
  const half=Math.floor(budget/2)
  subdivideCubic(x0,y0,ax,ay,dx,dy,fx,fy,tol,out,half)
  subdivideCubic(fx,fy,ex,ey,cx,cy,x1,y1,tol,out,budget-half)
}

/**
 * 把命令列展平为折线。
 * cmds 支持两种形态：
 *   1) Pacdora 对象：{mtd:'M'|'L'|'A'|'Q'|'C'|'Z', x,y,...}
 *   2) 紧凑数组：['M',u,v] | ['L',u,v] | ['C',u1,v1,u2,v2,u,v] | ['Z']
 * @param {object[]|array[]} cmds
 * @param {{tol?:number,maxPts?:number}} [opts]
 */
export function flattenCubicPath(cmds,{tol=.25,maxPts=96}={}){
  if(!Array.isArray(cmds)||!cmds.length)return []
  const pts=[]
  let x=0,y=0,started=false

  const pushPt=(px,py)=>{
    if(!pts.length||Math.hypot(px-pts[pts.length-1][0],py-pts[pts.length-1][1])>EPS){
      pts.push([px,py])
    }
  }

  const emitCubic=(c1x,c1y,c2x,c2y,ex,ey)=>{
    const remain=Math.max(2,maxPts-pts.length)
    subdivideCubic(x,y,c1x,c1y,c2x,c2y,ex,ey,tol,pts,remain)
    // subdivide 末点可能与 push 重复；统一去重
    if(pts.length>=2){
      const a=pts[pts.length-1],b=pts[pts.length-2]
      if(Math.hypot(a[0]-b[0],a[1]-b[1])<=EPS)pts.pop()
    }
    pushPt(ex,ey)
    x=ex;y=ey
  }

  for(const c of cmds){
    const isArr=Array.isArray(c)
    const m=isArr?c[0]:c?.mtd
    if(m==='M'){
      x=Number(isArr?c[1]:c.x)||0
      y=Number(isArr?c[2]:c.y)||0
      if(!started||pts.length){pushPt(x,y);started=true}
      else{pts[0]=[x,y]}
    }else if(m==='L'){
      x=Number(isArr?c[1]:c.x)||0
      y=Number(isArr?c[2]:c.y)||0
      pushPt(x,y)
    }else if(m==='A'&&!isArr){
      for(const seg of arcToCubics(x,y,c.x,c.y,c.rx||0,c.ry||0,c.ang||0,!!c.arc,!!(c.dir??1))){
        emitCubic(seg.c1x,seg.c1y,seg.c2x,seg.c2y,seg.x,seg.y)
      }
    }else if(m==='Q'){
      const cx=Number(isArr?c[1]:c.cx)||0,cy=Number(isArr?c[2]:c.cy)||0
      const ex=Number(isArr?c[3]:c.x)||0,ey=Number(isArr?c[4]:c.y)||0
      const s=quadToCubic(x,y,cx,cy,ex,ey)
      emitCubic(s.c1x,s.c1y,s.c2x,s.c2y,s.x,s.y)
    }else if(m==='C'){
      let c1x,c1y,c2x,c2y,ex,ey
      if(isArr){
        c1x=+c[1]||0;c1y=+c[2]||0;c2x=+c[3]||0;c2y=+c[4]||0;ex=+c[5]||0;ey=+c[6]||0
      }else{
        c1x=c.cx1??c.cx??0;c1y=c.cy1??c.cy??0
        c2x=c.cx2??c.cx??0;c2y=c.cy2??c.cy??0
        ex=c.x||0;ey=c.y||0
      }
      emitCubic(c1x,c1y,c2x,c2y,ex,ey)
    }else if(m==='Z'){
      if(pts.length>=2){
        const a=pts[0],b=pts[pts.length-1]
        if(Math.hypot(a[0]-b[0],a[1]-b[1])<EPS)pts.pop()
      }
    }
  }

  // 超限均匀抽稀
  if(pts.length>maxPts){
    const step=pts.length/maxPts
    const slim=[]
    for(let i=0;i<maxPts;i++)slim.push(pts[Math.min(pts.length-1,Math.floor(i*step))])
    return slim
  }
  return pts
}

/** 兼容旧名：固定步数展平（孔位识别仍可用） */
export function flattenPath(cmds){
  return flattenCubicPath(cmds,{tol:.35,maxPts:64})
}
