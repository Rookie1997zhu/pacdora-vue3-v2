/**
 * 「按尺寸插值」模板的几何重建。
 *
 * 数据（scripts/build-sampled-templates.mjs 生成）= 原始尺寸下的官方刀版 + 每个维度（长 / 宽 / 高）
 * 单独变化时各采样点相对原始刀版的坐标增量。任意尺寸下的刀版：
 *   坐标 = 原始坐标 + ΔL(长) + ΔW(宽) + ΔH(高)
 * 每个 Δ 在相邻采样点之间线性插值；超出采样范围时停在边界（调用方负责把尺寸钳在范围内）。
 * 刀版的拓扑（面片、命令序列）在所有采样点上一致，由构建脚本校验。
 */

/** 可插值的数值叶子：按固定顺序遍历对象，返回 setter 列表（与构建脚本的遍历顺序一致） */
export function numericSlots(root){
  const slots=[]
  const walk=(node)=>{
    if(Array.isArray(node)){
      for(let i=0;i<node.length;i++){
        const v=node[i]
        if(typeof v==='number')slots.push([node,i])
        else if(v&&typeof v==='object')walk(v)
      }
      return
    }
    for(const k of Object.keys(node)){
      const v=node[k]
      if(STRUCTURAL_KEYS.has(k))continue
      if(typeof v==='number')slots.push([node,k])
      else if(v&&typeof v==='object')walk(v)
    }
  }
  walk(root)
  return slots
}

/** 这些键的数值是结构标志（圆弧的大弧 / 方向等），不参与插值 */
export const STRUCTURAL_KEYS=new Set(['arc','dir','id','ed','like','grade','blank'])

function interpWeights(values,x){
  const n=values.length
  if(x<=values[0])return [0,0,0]
  if(x>=values[n-1])return [n-1,n-1,0]
  for(let i=0;i<n-1;i++){
    if(x<=values[i+1])return [i,i+1,(x-values[i])/(values[i+1]-values[i])]
  }
  return [n-1,n-1,0]
}

/**
 * @param {object} data 采样数据
 * @param {{L:number,W:number,H:number}} size 制造尺寸（刀版尺寸，mm）
 * @returns {object} 与官方接口同结构的几何对象，可直接交给 knifeFromPacdoraGeom
 */
export function sampledGeometry(data,size){
  const geom=JSON.parse(JSON.stringify(data.base))
  const slots=numericSlots(geom)
  for(const dim of ['L','W','H']){
    const t=data.dims?.[dim]
    if(!t||!t.v?.length)continue
    const [i,j,f]=interpWeights(t.v,Number(size[dim]))
    const a=t.d[i],b=t.d[j]
    for(let k=0;k<t.idx.length;k++){
      const delta=a[k]+(b[k]-a[k])*f
      if(delta===0)continue
      const [obj,key]=slots[t.idx[k]]
      obj[key]+=delta
    }
  }
  return geom
}

const inside=(a,size)=>['L','W','H'].every(d=>Number(size[d])>=a.range[d][0]-1e-6&&Number(size[d])<=a.range[d][1]+1e-6)

/**
 * 选出覆盖该尺寸的那一段（锚点）：主段（原始尺寸所在）或某个次段（刀版拓扑不同的区段）。
 * 多段都覆盖时取锚点离得最近的；都不覆盖返回 null。
 */
export function pickAnchor(data,size){
  let best=null,bestD=Infinity
  for(const a of [data,...(data.anchors||[])]){
    if(!inside(a,size))continue
    let d=0
    for(const k of ['L','W','H'])d+=((Number(size[k])-a.baseKnife[k])/Math.max(1,a.baseKnife[k]))**2
    if(d<bestD){bestD=d;best=a}
  }
  return best
}

/** 把任意输入尺寸钳到采样范围内 */
export function clampToRange(data,size){
  const out={}
  let clamped=false
  for(const dim of ['L','W','H']){
    const [lo,hi]=data.range[dim]
    const v=Number(size[dim])
    out[dim]=Math.min(hi,Math.max(lo,Number.isFinite(v)?v:data.baseKnife[dim]))
    if(Math.abs(out[dim]-v)>1e-6)clamped=true
  }
  return {size:out,clamped}
}
