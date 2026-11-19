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
  const raw=sampledGeometry(anchor,size)
  const inner={length:Number(raw.size.L),width:Number(raw.size.W),height:Number(raw.size.H)}
  const outer={length:Number(raw.outSize.L),width:Number(raw.outSize.W),height:Number(raw.outSize.H)}
  const panel={length:Number(raw.knifeSize.L),width:Number(raw.knifeSize.W),height:Number(raw.knifeSize.H)}
  const knife=knifeFromPacdoraGeom(raw,{
    sourceNum:data.num,label:template.label,
    length:inner.length,width:inner.width,height:inner.height,thickness:data.thickness||input.thickness,
  })
  const cut=Number(raw.extra?.cutlineLength)||0,crease=Number(raw.extra?.foldlineLength)||0
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
      thickness:data.thickness||Number(input.thickness)||0.5,
      sizeMode:mode,fluteDirection:input.fluteDirection==='W'?'W':'L',
      inner,outer,panel,
    },
    material:{...(knife.material||{}),id:input.materialId||knife.material?.id||'white'},
    bleed:Math.max(0,Number(input.bleed)||0),
    params:{},
    paramState:{},
    issues,
    piece:null,
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
