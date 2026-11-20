/**
 * Exact sampling of an SVG elliptical arc (endpoint parameterisation, SVG 1.1 F.6.5).
 * Returns the points after the start point, the last one being exactly (x2, y2).
 *
 * @param {number} x1 start x
 * @param {number} y1 start y
 * @param {number} x2 end x
 * @param {number} y2 end y
 * @param {number} rx
 * @param {number} ry
 * @param {number} angDeg x-axis rotation in degrees
 * @param {boolean|number} large large-arc flag
 * @param {boolean|number} sweep sweep flag
 * @param {number} [minSegs] lower bound on the number of chords
 * @returns {number[][]}
 */
export function sampleSvgArc(x1,y1,x2,y2,rx,ry,angDeg,large,sweep,minSegs=6){
  rx=Math.abs(Number(rx)||0)
  ry=Math.abs(Number(ry)||0)||rx
  if(!(rx>1e-9)||!(ry>1e-9)||Math.hypot(x2-x1,y2-y1)<1e-9)return [[x2,y2]]
  const phi=(Number(angDeg)||0)*Math.PI/180
  const cos=Math.cos(phi),sin=Math.sin(phi)
  const dx=(x1-x2)/2,dy=(y1-y2)/2
  const x1p=cos*dx+sin*dy,y1p=-sin*dx+cos*dy
  // radii too small for the chord are scaled up (a semicircle at the limit)
  const lam=(x1p*x1p)/(rx*rx)+(y1p*y1p)/(ry*ry)
  if(lam>1){const k=Math.sqrt(lam);rx*=k;ry*=k}
  const num=rx*rx*ry*ry-rx*rx*y1p*y1p-ry*ry*x1p*x1p
  const den=rx*rx*y1p*y1p+ry*ry*x1p*x1p
  let co=den>0?Math.sqrt(Math.max(0,num/den)):0
  if(!!large===!!sweep)co=-co
  const cxp=co*rx*y1p/ry,cyp=-co*ry*x1p/rx
  const cx=cos*cxp-sin*cyp+(x1+x2)/2,cy=sin*cxp+cos*cyp+(y1+y2)/2
  const ang=(ux,uy,vx,vy)=>Math.atan2(ux*vy-uy*vx,ux*vx+uy*vy)
  const ux=(x1p-cxp)/rx,uy=(y1p-cyp)/ry
  const t0=ang(1,0,ux,uy)
  let dt=ang(ux,uy,(-x1p-cxp)/rx,(-y1p-cyp)/ry)
  if(!sweep&&dt>0)dt-=2*Math.PI
  else if(sweep&&dt<0)dt+=2*Math.PI
  const n=Math.max(minSegs,Math.ceil(Math.abs(dt)/(Math.PI/24)))
  const out=[]
  for(let i=1;i<n;i++){
    const t=t0+dt*i/n
    const ex=rx*Math.cos(t),ey=ry*Math.sin(t)
    out.push([cos*ex-sin*ey+cx,sin*ex+cos*ey+cy])
  }
  out.push([x2,y2])
  return out
}
