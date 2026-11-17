/**
 * 结构规格模板（spec-*）按需加载。
 *
 * 规格有数百份、合计数 MB，浏览器端不随引擎打包：构建时把每份规格写成
 * public/spec/<code>.json（scripts/build-spec-chunks.mjs），用到哪个盒型再取哪一份并注册。
 * Node 端（几何服务、脚本）仍一次性全量注册，本模块在那里直接命中已注册的模板。
 *
 * createKnife 保持同步：调用前先 `await ensureTemplate(templateId)`。
 */
import {TEMPLATES,registerTemplate} from './index.js'
import {createSpecTemplate} from './spec/specTemplate.js'
import SPEC_INDEX from '../catalog/structureSpecIndex.js'

const SPEC_PREFIX='spec-'
/** @type {Map<string, Promise<object|null>>} */
const inflight=new Map()

export function isSpecTemplateId(id){
  return typeof id==='string'&&id.startsWith(SPEC_PREFIX)
}

export function isTemplateLoaded(id){
  return !!TEMPLATES[id]
}

function specUrl(code,hash){
  let base='/'
  try{base=(import.meta.env&&import.meta.env.BASE_URL)||'/'}catch{base='/'}
  return `${base.replace(/\/?$/,'/')}spec/${encodeURIComponent(code)}.json?v=${hash}`
}

/**
 * 确保模板已注册。内置与 REA 模板始终在；spec-* 未注册时按索引取规格文件。
 * @returns {Promise<object|null>} 模板；不存在或加载失败返回 null（createKnife 随后会报 TEMPLATE_NOT_LOADED）
 */
export async function ensureTemplate(id){
  if(!id)return null
  if(TEMPLATES[id])return TEMPLATES[id]
  if(!isSpecTemplateId(id))return null
  const code=id.slice(SPEC_PREFIX.length)
  const hash=SPEC_INDEX[code]
  if(!hash)return null
  if(inflight.has(id))return inflight.get(id)
  const job=(async()=>{
    try{
      const res=await fetch(specUrl(code,hash),{credentials:'omit'})
      if(!res.ok)return null
      const spec=await res.json()
      if(!spec||spec.code!==code||!Array.isArray(spec.faces))return null
      return registerTemplate(createSpecTemplate(spec))
    }catch{
      return null
    }finally{
      inflight.delete(id)
    }
  })()
  inflight.set(id,job)
  return job
}

/** 一次确保多个模板（去重、并行） */
export function ensureTemplates(ids){
  return Promise.all([...new Set((ids||[]).filter(Boolean))].map(ensureTemplate))
}
