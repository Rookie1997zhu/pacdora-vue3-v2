/**
 * 从金样 JSON 选取可编结构规格的层。
 * 单层：traditional 或唯一层；多层（Boutique 面纸+灰板）：只取灰板/壳，忽略面纸。
 * 返回合并后的 layer 对象，或 null（调用方报 multi-layer）。
 */

// Greyboard / Shell / SUPBOARD / 缩写 GB（如 BottomBoxGB360091）；勿匹配 Owp/Iwp 面纸
const GREY_RE=/greyboard|Greyboard|Shell|shell|SUPBOARD|GB\d/i
const BOTTOM_RE=/bottom|inner|base/i
const BOTTOM_EXCLUDE=/outer/i
const LID_RE=/top|lid|cover|outer|shell|flip/i

function faceCount(ly){
  return (ly?.faces||[]).length
}

/** 折线名按两端面重映射（最长前缀匹配） */
function remapFoldName(name,map){
  const parts=String(name||'').split('_')
  for(let k=1;k<parts.length;k++){
    const a=parts.slice(0,k).join('_'),b=parts.slice(k).join('_')
    if(map.has(a)&&map.has(b))return `${map.get(a)}_${map.get(b)}`
  }
  return name
}

function prefixLayer(ly,prefix){
  const map=new Map((ly.faces||[]).map(f=>[f.name,`${prefix}${f.name}`]))
  return {
    ...ly,
    faces:(ly.faces||[]).map(f=>({...f,name:map.get(f.name)})),
    folds:(ly.folds||[]).map(fo=>({...fo,name:remapFoldName(fo.name,map)}))
  }
}

function mergeLayers(a,b){
  const botNames=new Set((a.faces||[]).map(f=>f.name))
  const clash=(b.faces||[]).some(f=>botNames.has(f.name))
  let left=a,right=b
  if(clash){
    // 跨层重名（如双坯都用 V/VT）：加前缀保证 byName 唯一且折线可拆
    left=prefixLayer(a,'B_')
    right=prefixLayer(b,'T_')
  }
  return {
    faces:[...(left.faces||[]),...(right.faces||[])],
    folds:[...(left.folds||[]),...(right.folds||[])],
    holes:[...(left.holes||[]),...(right.holes||[])],
    cuts:[...(left.cuts||[]),...(right.cuts||[])],
    bleeds:[...(left.bleeds||[]),...(right.bleeds||[])],
    animation:left.animation||right.animation,
    thickness:left.thickness??right.thickness,
    _fromLayers:[a._layerKey,b._layerKey].filter(Boolean),
    _prefixed:clash
  }
}

function tag(key,ly){
  return {...ly,_layerKey:key}
}

/**
 * @param {object} j 金样根对象（含 layer）
 * @returns {object|null} 可编译层，或 null
 */
export function pickCompileLayer(j){
  const layer=j?.layer||{}
  const keys=Object.keys(layer)
  if(!keys.length)return null
  if(keys.length===1)return layer.traditional||layer[keys[0]]

  // 多层：只抽灰板/壳（忽略面纸）；无可用灰板则 null → multi-layer
  const candidates=keys
    .filter(k=>GREY_RE.test(k))
    .map(k=>({k,ly:tag(k,layer[k]),n:faceCount(layer[k])}))
    .filter(x=>x.n>=2)
    .sort((a,b)=>b.n-a.n)

  if(!candidates.length){
    // 无灰板：退到面数最多的单层（通常是面纸），仅用于外形规格编译
    const paper=keys
      .map(k=>({k,ly:tag(k,layer[k]),n:faceCount(layer[k])}))
      .filter(x=>x.n>=2)
      .sort((a,b)=>b.n-a.n)
    return paper[0]?.ly||null
  }
  if(candidates.length===1)return candidates[0].ly

  const bot=candidates.find(x=>BOTTOM_RE.test(x.k)&&!BOTTOM_EXCLUDE.test(x.k))
    ||candidates.find(x=>BOTTOM_RE.test(x.k))
    ||candidates[0]
  const lid=candidates.find(x=>x.k!==bot.k&&LID_RE.test(x.k))
    ||candidates.find(x=>x.k!==bot.k)
  if(!lid)return bot.ly
  return mergeLayers(bot.ly,lid.ly)
}
