/**
 * 3D 折叠配方（fold3d）：由结构规格带出的、来自金样折叠动画的铰接关系。
 *
 * 规格模板的 2D 面片树（parent/side）是为排版推导的，按它逐层 90° 折并不总能合成盒子；
 * 金样动画里记录了每块面绕哪条折线、转多少度、分几步。编译规格时把这些记成与尺寸无关的形式
 * （父面名、折线在子面 bbox 内的 UV、转角、轴向），运行时套到当前尺寸的面片上，
 * 再交给与「官方几何回放」相同的骨架（geomRig）去折。只影响 3D，不改 2D 刀版。
 *
 * knife.fold3d = { faces:{[name]:{parent,hingeLine?,angle,axisVec?}}, stages:[[{child,rotate}|{face,move}]] }
 */

/** 折线方向与金样轴向对齐：方向取当前尺寸下的折线，正负号沿用金样（决定往哪边折） */
function alignedAxis(hingeLine,axisVec){
  if(!axisVec)return null
  const ax=Number(axisVec.x)||0,ay=Number(axisVec.y)||0,az=Number(axisVec.z)||0
  if(Array.isArray(hingeLine)&&hingeLine.length===2&&Math.abs(az)<1e-6){
    const dx=hingeLine[1][0]-hingeLine[0][0],dy=hingeLine[1][1]-hingeLine[0][1]
    const len=Math.hypot(dx,dy)
    if(len>1e-6){
      const sign=dx*ax+dy*ay<0?-1:1
      return {x:sign*dx/len,y:sign*dy/len,z:0}
    }
  }
  return {x:ax,y:ay,z:az}
}

/**
 * 把 knife.fold3d 套到当前面片上，得到 geomRig 可直接使用的 {faces,hinges,foldStages}。
 * 没有配方时返回 null（调用方走普通铰链树）。
 */
export function fold3dKnife(knife){
  const recipe=knife?.fold3d
  const spec=recipe?.faces
  if(!spec||!Array.isArray(knife?.faces)||!knife.faces.length)return null
  const names=new Set(knife.faces.map(f=>f.name))
  const faces=knife.faces.map(f=>{
    const r=spec[f.name]
    if(!r)return {...f}
    const parent=r.parent&&names.has(r.parent)?r.parent:null
    const out={...f,parent}
    if(!parent){
      delete out.hingeLine
      out.side=null
      return out
    }
    if(Array.isArray(r.hingeLine)&&r.hingeLine.length===2){
      out.hingeLine=r.hingeLine
    }else if(parent!==f.parent){
      // 换了父面又没有折线：原 side 不再适用，交给 geomRig 按 bbox 相对位置取边
      delete out.hingeLine
      out.side=f.side||null
    }
    return out
  })
  const byName=Object.fromEntries(faces.map(f=>[f.name,f]))
  const hinges=[]
  for(const f of faces){
    if(!f.parent)continue
    const r=spec[f.name]||{}
    const h={parent:f.parent,child:f.name,side:f.side||null,angle:Number.isFinite(r.angle)?r.angle:90}
    if(f.hingeLine)h.hingeLine=f.hingeLine
    const axis=alignedAxis(f.hingeLine,r.axisVec)
    if(axis)h.axisVec=axis
    hinges.push(h)
  }
  const foldStages=(recipe.stages||[])
    .map(stage=>(stage||[]).filter(s=>(s.child&&byName[s.child])||(s.face&&byName[s.face])))
    .filter(stage=>stage.length)
  return {faces,hinges,foldStages}
}
