/**
 * 「按尺寸插值」模板（sampled-<类目>-<编号>）。
 *
 * 与结构规格模板（spec-*）的区别：不靠推算公式，而是在官方的多尺寸采样之间插值，
 * 所以在采样范围内改尺寸仍与官方刀版一致。代价：结构参数跟随官方在该尺寸下的默认值，不能单独调；
 * 纸厚固定为采样时的材质；尺寸只能在采样范围内变化。
 */
import {sampledGeometry,clampToRange,pickAnchor} from './sampledGeometry.js'
import {knifeFromPacdoraGeom} from '../../pacdoraGeomKnife.js'

export const SAMPLED_PREFIX='sampled-'
export function isSampledTemplateId(id){
  return typeof id==='string'&&id.startsWith(SAMPLED_PREFIX)
}

const r1=v=>Math.round(v*10)/10

const X_KEYS=['x','cx','cx1','cx2','x1','x2']
const Y_KEYS=['y','cy','cy1','cy2','y1','y2']
const shift=(o,dx,dy)=>{
  if(!o||typeof o!=='object')return o
  const out={...o}
  for(const k of X_KEYS)if(typeof out[k]==='number')out[k]+=dx
  for(const k of Y_KEYS)if(typeof out[k]==='number')out[k]+=dy
  return out
}

/**
 * 多件盒（天地盖、抽屉盒……）：官方把各件画在同一张版面上，彼此留有空隙。
 * 取出其中一件（pieces 为全部各件的名单，pieceId 指定取哪一件）：面片按名单取；折线、切线、开孔按「离哪一件的面片更近」归属；整件的平移 / 翻转动作去掉。
 * 结果平移到以该件左上角为原点。
 * 多图层的盒（面纸 + 灰板）不用拆：名单里的每一件直接对应一个图层（piece.layer）。
 * @returns {object|null} 与官方接口同结构的几何对象；名单里的面片一个都找不到时返回 null
 */
export function pieceGeometry(raw,pieces,pieceId){
  if(!Array.isArray(pieces))return null
  const at=pieces.findIndex(p=>p.id===pieceId)
  if(at<0)return null
  // 多图层的盒（精装盒：面纸 + 灰板）：每个图层本来就是一张独立的刀版，一件 = 一个图层
  if(pieces[at].layer){
    const ly=raw?.layer?.[pieces[at].layer]
    if(!ly||!Array.isArray(ly.faces)||!ly.faces.length)return null
    const layer={...ly,animation:{groups:ly.animation?.groups||[],animations:(ly.animation?.animations||[])
      .map(stage=>(stage||[]).filter(st=>st&&st.action!=='translate'&&st.action!=='rotateMesh')).filter(stage=>stage.length)}}
    delete layer.transform
    const list=(raw.modeCate?.layerList||[]).filter(l=>l?.name===pieces[at].layer)
    return {...raw,modeCate:{...(raw.modeCate||{}),layerList:list},layer:{[pieces[at].layer]:layer}}
  }
  const keys=Object.keys(raw?.layer||{})
  if(keys.length!==1||!Array.isArray(pieces[at].faces))return null
  const ly=raw.layer[keys[0]]
  const groups=pieces.map(p=>{const names=new Set(p.faces||[]);return (ly.faces||[]).filter(f=>names.has(f.name))})
  const mine=groups[at]
  if(!mine.length)return null
  const gap=(f,x,y)=>Math.hypot(Math.max(f.x-x,0,x-(f.x+f.w)),Math.max(f.y-y,0,y-(f.y+f.h)))
  // 归属：离哪一件的面片最近；一样近时归排在前面的那一件（保证每条线只属于一件）
  const isMine=(x,y)=>{
    let best=-1,bestD=Infinity
    groups.forEach((list,i)=>{
      const d=list.reduce((m,f)=>Math.min(m,gap(f,x,y)),Infinity)
      if(d<bestD-1e-9){bestD=d;best=i}
    })
    return best===at
  }
  const ownsPath=cmds=>{
    let yes=0,no=0
    for(const c of cmds||[]){
      if(typeof c?.x!=='number'||typeof c?.y!=='number')continue
      if(isMine(c.x,c.y))yes++;else no++
    }
    return yes>no
  }
  const cuts=[]
  let sub=[]
  const flush=()=>{if(sub.length&&ownsPath(sub))cuts.push(...sub);sub=[]}
  for(const c of ly.cuts||[]){
    if(String(c?.mtd||'').toUpperCase()==='M')flush()
    sub.push(c)
  }
  flush()
  const folds=(ly.folds||[]).filter(f=>isMine((f.x1+f.x2)/2,(f.y1+f.y2)/2))
  const holes=(ly.holes||[]).filter(h=>ownsPath(Array.isArray(h)?h:h?.dlist))
  const foldOk=name=>folds.some(f=>f.name===name)
  const animations=(ly.animation?.animations||[]).map(stage=>(stage||[]).filter(st=>{
    if(!st)return false
    if(st.action==='translate'||st.action==='rotateMesh')return false
    return foldOk(st.name)
  })).filter(stage=>stage.length)
  const dx=-Math.min(...mine.map(f=>f.x)),dy=-Math.min(...mine.map(f=>f.y))
  const moveHole=h=>Array.isArray(h)?h.map(c=>shift(c,dx,dy)):(h&&Array.isArray(h.dlist)?{...h,dlist:h.dlist.map(c=>shift(c,dx,dy))}:h)
  const layer={
    ...ly,
    faces:mine.map(f=>({
      ...f,x:f.x+dx,y:f.y+dy,
      dlist:(f.dlist||[]).map(c=>shift(c,dx,dy)),
      holes:Array.isArray(f.holes)?f.holes.map(moveHole):f.holes,
    })),
    cuts:cuts.map(c=>shift(c,dx,dy)),
    folds:folds.map(f=>shift(f,dx,dy)),
    holes:holes.map(moveHole),
    animation:{groups:ly.animation?.groups||[],animations},
    totalX:Math.max(...mine.map(f=>f.x+f.w))+dx,
    totalY:Math.max(...mine.map(f=>f.y+f.h))+dy,
  }
  delete layer.transform
  return {...raw,layer:{[keys[0]]:layer}}
}

const segLength=segs=>(segs||[]).reduce((s,g)=>s+Math.hypot((g.x2??0)-(g.x1??0),(g.y2??0)-(g.y1??0)),0)
const DIMS=[['L','length'],['W','width'],['H','height']]

export function createSampledTemplate(data){
  const off={inner:{},outer:{}}
  for(const [d] of DIMS){
    off.inner[d]=data.baseKnife[d]-data.baseInner[d]
    off.outer[d]=data.baseKnife[d]-data.baseOuter[d]
  }
  const limits={}
  // 各段范围的外包（并非这个长方体里每一种组合都覆盖；没覆盖到的组合会退回近似并提示）
  const segs=[data,...(data.anchors||[])]
  for(const [d,name] of DIMS){
    limits[name]=[r1(Math.min(...segs.map(a=>a.range[d][0]))-off.inner[d]),r1(Math.max(...segs.map(a=>a.range[d][1]))-off.inner[d])]
  }
  return {
    id:`${SAMPLED_PREFIX}${data.cat}-${data.num}`,
    label:data.name,
    labelEn:data.base?.modeCate?.code||data.num,
    standard:`官方多尺寸采样插值 · 样本 ${data.num}`,
    sampled:data,
    sampledOffsets:off,
    /** 采样范围之外改用的参数化模板（近似），没有则钳在范围边界 */
    sampledFallback:data.fallback||null,
    defaults:{length:data.baseInner.L,width:data.baseInner.W,height:data.baseInner.H,thickness:data.thickness||0.5},
    /** 与官方刀版核对过的内尺寸范围（由采样范围换算） */
    verifiedRange:limits,
    /** verified：范围内的验证样本全部达标；improved：个别尺寸组合仍有偏差，但好于参数化推算 */
    sampledQuality:data.quality||null,
    // 有参数化模板可退时不限制尺寸（范围外按近似推算并提示）；否则只能在采样范围内
    limits:data.fallback?undefined:limits,
    paramDefs:[],
    /** 多件盒：各件的面片名单（来自原结构规格）；工作台据此一次显示一件 */
    pieces:Array.isArray(data.pieces)&&data.pieces.length>1?data.pieces:undefined,
    supportsPiece:Array.isArray(data.pieces)&&data.pieces.length>1,
    specRef:{code:data.base?.modeCate?.code||'',sampleNum:data.num,structureCode:data.base?.modeCate?.code||''},
    faceOrder:()=>[],
    layout(){throw new Error('sampled template has no parametric layout')},
  }
}

/**
 * @param {object} template createSampledTemplate 的结果
 * @param {{length:number,width:number,height:number,thickness?:number,sizeMode?:string,bleed?:number,materialId?:string,fluteDirection?:string}} input
 * @returns {object|null} null：尺寸超出采样范围，应改用 template.sampledFallback
 */
export function createSampledKnife(template,input){
  const data=template.sampled
  const mode=input.sizeMode==='outer'?'outer':input.sizeMode==='manufacturing'?'manufacturing':'inner'
  const given={L:Number(input.length),W:Number(input.width),H:Number(input.height)}
  const asked={}
  for(const [d] of DIMS){
    const v=Number.isFinite(given[d])?given[d]:(mode==='outer'?data.baseOuter[d]:mode==='manufacturing'?data.baseKnife[d]:data.baseInner[d])
    asked[d]=mode==='manufacturing'?v:v+template.sampledOffsets[mode][d]
  }
  // 先找覆盖该尺寸的那一段；没有任何一段覆盖时，有参数化模板可退就交回调用方（createKnife），否则钳到主段边界
  let anchor=pickAnchor(data,asked)
  let size=asked,clamped=false
  if(!anchor){
    if(input.allowFallback&&template.sampledFallback)return null
    anchor=data
    ;({size,clamped}=clampToRange(data,asked))
  }
  const whole=sampledGeometry(anchor,size)
  // 多件盒：只出当前这一件（默认第一件）
  const pieces=template.pieces||null
  const pieceMeta=pieces?(pieces.find(p=>p.id===input.piece)||pieces[0]):null
  const raw=pieceMeta?(pieceGeometry(whole,pieces,pieceMeta.id)||whole):whole
  const isPiece=raw!==whole
  // 多图层盒各层的纸厚不同（灰板 2mm、面纸 0.15mm）
  const layerT=isPiece&&pieceMeta.layer?Number(raw.layer?.[pieceMeta.layer]?.thickness)||0:0
  const inner={length:Number(raw.size.L),width:Number(raw.size.W),height:Number(raw.size.H)}
  const outer={length:Number(raw.outSize.L),width:Number(raw.outSize.W),height:Number(raw.outSize.H)}
  const panel={length:Number(raw.knifeSize.L),width:Number(raw.knifeSize.W),height:Number(raw.knifeSize.H)}
  const knife=knifeFromPacdoraGeom(raw,{
    sourceNum:data.num,label:template.label,
    length:inner.length,width:inner.width,height:inner.height,thickness:layerT||data.thickness||input.thickness,
  })
  // 官方给的切线 / 折线总长是整张版面的；单件时按该件的线段重新量
  const cut=isPiece?segLength(knife.cuts):Number(raw.extra?.cutlineLength)||0
  const crease=isPiece?segLength(knife.folds):Number(raw.extra?.foldlineLength)||0
  // 回放刀版把开孔（挂孔、开窗）与外轮廓分开存放；导出文件按切线层出图，所以把开孔并进切线层
  const holeCuts=(knife.holes||[]).map(h=>h.pathCommands).filter(c=>Array.isArray(c)&&c.length)
  const trim=holeCuts.length?[...(knife.paths?.trim||[]),...holeCuts]:knife.paths?.trim
  const issues=clamped?[{
    code:'SIZE_OUT_OF_SAMPLED_RANGE',severity:'warning',
    message:'尺寸超出该盒型的采样范围，已按范围边界生成',
  }]:[]
  return {
    ...knife,
    template:template.id,
    paths:{...knife.paths,trim},
    layers:knife.layers?.trim?{...knife.layers,trim:{...knife.layers.trim,paths:trim}}:knife.layers,
    templateInfo:{id:template.id,label:template.label,labelEn:template.labelEn,standard:template.standard,sizeRule:'sampled'},
    sampled:true,
    dimensions:{
      length:inner.length,width:inner.width,height:inner.height,
      thickness:layerT||data.thickness||Number(input.thickness)||0.5,
      sizeMode:mode,fluteDirection:input.fluteDirection==='W'?'W':'L',
      inner,outer,panel,
    },
    material:{...(knife.material||{}),id:input.materialId||knife.material?.id||'white'},
    bleed:Math.max(0,Number(input.bleed)||0),
    params:{},
    paramState:{},
    issues,
    piece:isPiece?pieceMeta.id:null,
    stats:{
      cutLengthMm:r1(cut),creaseLengthMm:r1(crease),
      sheetWidthMm:r1(knife.totalX),sheetHeightMm:r1(knife.totalY),
      sheetAreaM2:Math.round(knife.totalX*knife.totalY/1e4)/100,
      netAreaM2:Math.round((knife.faces||[]).reduce((s,f)=>s+(Number(f.w)||0)*(Number(f.h)||0),0)/1e4)/100,
      holeCount:(knife.holes||[]).length,faceCount:(knife.faces||[]).length,
    },
    meta:{...(knife.meta||{}),cutApprox:false,bleedApprox:false,sizeClamped:clamped},
    validation:{ok:true,checks:[{id:'sampled',ok:true,detail:'interpolated between captured reference samples'}]},
    provenance:{...(knife.provenance||{}),source:'pacdora-sampled',lockedSample:false,note:'interpolated between multi-size reference samples'},
  }
}
