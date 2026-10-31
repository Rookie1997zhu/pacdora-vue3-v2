import assert from 'node:assert/strict'
import {estimateClosedCollisions} from '../../src/foldSim.js'
import {toDxf} from '../../src/exportDieline.js'

// 翻盖邮寄盒的 lidInnerLeft/Right 父面为 lid 但并不相邻（历史拓扑，保持稳定），故不做铰链压线覆盖断言
const HINGE_FOLD_EXEMPT=new Set(['mailer-parametric-demo'])

const onSegment=(seg,fold)=>{
  const [[ax,ay],[bx,by]]=seg
  const h=Math.abs(ay-by)<1e-6
  if(h)return Math.abs(fold.y1-ay)<1e-6&&Math.abs(fold.y2-ay)<1e-6
  return Math.abs(fold.x1-ax)<1e-6&&Math.abs(fold.x2-ax)<1e-6
}

function hingeEdge(child){
  if(child.side==='right')return [[child.x,child.y],[child.x,child.y+child.h]]
  if(child.side==='left')return [[child.x+child.w,child.y],[child.x+child.w,child.y+child.h]]
  if(child.side==='top')return [[child.x,child.y+child.h],[child.x+child.w,child.y+child.h]]
  return [[child.x,child.y],[child.x+child.w,child.y]]
}

/** 模板刀版契约断言（check-templates 与结构规格校验共用） */
export function assertKnife(t,label,k){
  const tag=`${t.id}/${label}`
  assert.equal(k.template,t.id,`${tag}: template id`)
  if(t.supportsClosedCheck!==false){
    assert.ok(t.closedCheck?.buildBoxes&&t.closedCheck?.pairs,`${tag}: closedCheck`)
    assert.equal(k.topology.supportsClosedCheck,true,`${tag}: supportsClosedCheck`)
  }
  assert.equal(k.validation.ok,true,`${tag}: validation ${JSON.stringify(k.validation.checks.filter(c=>!c.ok))}`)
  assert.equal(k.manufacturingReady,false,`${tag}: manufacturingReady`)
  if(label==='default'&&t.supportsClosedCheck!==false){
    const closed=estimateClosedCollisions(k,t.defaults.thickness)
    assert.notEqual(closed.skipped,true,`${tag}: closed not skipped`)
    assert.equal(closed.ok,true,`${tag}: closed ok ${JSON.stringify(closed.issues)}`)
  }
  const faceOrder=k.topology.faceOrder||(typeof t.faceOrder==='function'?t.faceOrder(k.params||{}):t.faceOrder)
  assert.equal(k.faces.length,faceOrder.length,`${tag}: faceCount`)
  assert.equal(k.hinges.length,faceOrder.length-1,`${tag}: hingeCount`)
  assert.equal(k.faces.find(f=>!f.parent)?.name,k.topology?.root||t.root,`${tag}: root`)
  for(const f of k.faces)assert.ok(f.w>0&&f.h>0,`${tag}: ${f.name} positive size`)

  const loopKeys=k.cutLoop.map(p=>p.join(','))
  assert.ok(k.cutLoop.length>=4,`${tag}: cut loop`)
  assert.equal(new Set(loopKeys).size,loopKeys.length,`${tag}: cut loop is simple`)
  const holeSegs=(k.holes||[]).reduce((n,h)=>n+(h.cuts?.length||0),0)
  // 多坯次外环也写入 cuts（meta.extraCutLoops）
  const extraSegs=Math.max(0,(k.cuts.length)-(k.cutLoop.length+holeSegs))
  assert.ok(k.cuts.length>=k.cutLoop.length+holeSegs,`${tag}: cut loop + holes`)
  if(k.meta?.extraCutLoops)assert.ok(extraSegs>=0,`${tag}: extra cut loops`)

  const b=k.bounds
  const bx=k.bleedLoop.map(p=>p[0]),by=k.bleedLoop.map(p=>p[1])
  const eps=1e-6
  const anyPoly=!!k.meta?.anyPoly||k.faces.some(f=>Array.isArray(f.outline)&&f.outline.length>=3)
  if(!anyPoly||k.meta?.bleedApprox){
    // AABB 出血须覆盖 bounds∪cutLoop 外扩
    const cutXs=k.cutLoop.map(p=>p[0]),cutYs=k.cutLoop.map(p=>p[1])
    const needMinX=Math.min(b.minX,...cutXs)-k.bleed,needMaxX=Math.max(b.maxX,...cutXs)+k.bleed
    const needMinY=Math.min(b.minY,...cutYs)-k.bleed,needMaxY=Math.max(b.maxY,...cutYs)+k.bleed
    assert.ok(Math.min(...bx)<=needMinX+1&&Math.max(...bx)>=needMaxX-1,`${tag}: bleed X`)
    assert.ok(Math.min(...by)<=needMinY+1&&Math.max(...by)>=needMaxY-1,`${tag}: bleed Y`)
  }else{
    // 多边形外扩：包围盒应覆盖裁切，允许 1mm 数值误差
    assert.ok(k.bleedLoop.length>=4,`${tag}: poly bleed loop`)
    assert.ok(Math.min(...bx)<=Math.min(...k.cutLoop.map(p=>p[0]))+1,`${tag}: bleed covers cut Xmin`)
    assert.ok(Math.max(...bx)>=Math.max(...k.cutLoop.map(p=>p[0]))-1,`${tag}: bleed covers cut Xmax`)
    assert.ok(Math.min(...by)<=Math.min(...k.cutLoop.map(p=>p[1]))+1,`${tag}: bleed covers cut Ymin`)
    assert.ok(Math.max(...by)>=Math.max(...k.cutLoop.map(p=>p[1]))-1,`${tag}: bleed covers cut Ymax`)
  }

  // 轮廓：点在 bbox 内；带 outline 时外环简单且面积约等于各面面积和
  for(const f of k.faces){
    if(!Array.isArray(f.outline))continue
    for(const [px,py] of f.outline){
      assert.ok(px>=f.x-1e-3&&px<=f.x+f.w+1e-3&&py>=f.y-1e-3&&py<=f.y+f.h+1e-3,`${tag}: ${f.name} outline in bbox`)
    }
  }
  if(anyPoly&&!k.meta?.cutApprox&&k.cutLoop.length>=3){
    const area=pts=>{let s=0;for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];s+=a[0]*b[1]-b[0]*a[1]}return Math.abs(s)/2}
    const faceArea=k.faces.reduce((s,f)=>{
      if(Array.isArray(f.outline)&&f.outline.length>=3)return s+area(f.outline)
      return s+f.w*f.h
    },0)
    // 多坯：主环 + 次环面积合计
    let cutA=area(k.cutLoop)
    if(k.meta?.extraCutLoops>0&&Array.isArray(k.cutExtraLoops)){
      cutA+=k.cutExtraLoops.reduce((s,l)=>s+area(l),0)
    }
    assert.ok(cutA>faceArea*0.15&&cutA<faceArea*1.65,`${tag}: cut area ${cutA.toFixed(1)} ~ faces ${faceArea.toFixed(1)}`)
  }

  // 出血包含 cut：仅在非 AABB 回退时做点检；AABB 回退只验包围盒
  if(k.bleed>0&&k.bleedLoop?.length>=3&&k.cutLoop?.length>=3){
    const bxs=k.bleedLoop.map(p=>p[0]),bys=k.bleedLoop.map(p=>p[1])
    const minBx=Math.min(...bxs),maxBx=Math.max(...bxs),minBy=Math.min(...bys),maxBy=Math.max(...bys)
    const sample=k.cutLoop.filter((_,i)=>i%Math.max(1,Math.floor(k.cutLoop.length/12))===0)
    for(const [x,y] of sample){
      assert.ok(x>=minBx-1&&x<=maxBx+1&&y>=minBy-1&&y<=maxBy+1,`${tag}: bleed bbox covers cut pt ${x},${y}`)
    }
  }

  // 真多坯：次环不宜贴主环（<1mm 视为未并净的伪多坯）
  if(Array.isArray(k.cutExtraLoops)&&k.cutExtraLoops.length&&k.cutLoop?.length){
    const minDist=(a,b)=>{
      let best=Infinity
      for(const p of a)for(const q of b){const d=Math.hypot(p[0]-q[0],p[1]-q[1]);if(d<best)best=d}
      return best
    }
    for(let i=0;i<k.cutExtraLoops.length;i++){
      const d=minDist(k.cutLoop,k.cutExtraLoops[i])
      assert.ok(d>=1-1e-3,`${tag}: extra[${i}] dist ${d.toFixed(2)} >= 1`)
    }
  }

  for(const f of k.folds){
    assert.ok(Math.min(f.x1,f.x2)>=b.minX-eps&&Math.max(f.x1,f.x2)<=b.maxX+eps,`${tag}: fold ${f.name} in bounds`)
    assert.ok(Math.min(f.y1,f.y2)>=b.minY-eps&&Math.max(f.y1,f.y2)<=b.maxY+eps,`${tag}: fold ${f.name} in bounds`)
  }
  if(!HINGE_FOLD_EXEMPT.has(t.id)){
    const byName=Object.fromEntries(k.faces.map(f=>[f.name,f]))
    for(const h of k.hinges){
      // 弧面虚折：不出压线
      if(h.smooth||byName[h.child]?.smooth)continue
      if(h.hingeLine||byName[h.child]?.hingeLine){
        const hl=h.hingeLine||byName[h.child].hingeLine
        assert.ok(k.folds.some(f=>onSegment(hl,f)||(
          Math.abs(f.x1-hl[0][0])<1e-3&&Math.abs(f.y1-hl[0][1])<1e-3&&Math.abs(f.x2-hl[1][0])<1e-3&&Math.abs(f.y2-hl[1][1])<1e-3
        )||(
          Math.abs(f.x1-hl[1][0])<1e-3&&Math.abs(f.y1-hl[1][1])<1e-3&&Math.abs(f.x2-hl[0][0])<1e-3&&Math.abs(f.y2-hl[0][1])<1e-3
        )),`${tag}: hingeLine ${h.parent}->${h.child} has crease`)
        continue
      }
      const seg=hingeEdge(byName[h.child])
      assert.ok(k.folds.some(f=>onSegment(seg,f)),`${tag}: hinge ${h.parent}->${h.child} has crease`)
    }
  }
  const dxf=toDxf(k)
  assert.ok(dxf.includes('TRIM')&&dxf.includes('CREASE')&&dxf.includes('BLEED'),`${tag}: DXF layers`)
  const holeN=k.holes?.length||0
  assert.equal(k.topology.holeCount??0,holeN,`${tag}: holeCount`)
  if(holeN){
    assert.ok(k.cuts.length>k.cutLoop.length,`${tag}: cuts include hole loops`)
    assert.ok(k.cutPath.includes('Z'),`${tag}: cutPath has closed loops`)
  }
  const byFace=Object.fromEntries(k.faces.map(f=>[f.name,f]))
  for(const h of k.holes||[]){
    const loop=h.loop||[]
    assert.ok(loop.length>=3,`${tag}: hole loop`)
    assert.equal(new Set(loop.map(p=>p.join(','))).size,loop.length,`${tag}: hole loop is simple`)
    if(!h.face||!byFace[h.face])continue
    const f=byFace[h.face]
    assert.ok(h.x>=f.x-1e-3&&h.y>=f.y-1e-3&&h.x+h.w<=f.x+f.w+1e-3&&h.y+h.h<=f.y+f.h+1e-3,
      `${tag}: hole bbox in face ${h.face}`)
  }
}

/** 默认 / 最小 / 最大三档尺寸用例（与 check-templates 一致） */
export function sizeCases(t){
  const d=t.defaults,lim=t.limits
  return {
    default:{...d,bleed:3},
    min:{length:lim.length[0],width:lim.width[0],height:lim.height[0],thickness:d.thickness,bleed:0},
    max:{length:lim.length[1],width:lim.width[1],height:lim.height[1],thickness:d.thickness*2,bleed:5}
  }
}
