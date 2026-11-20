/**
 * 导出「导入预设用到的全部模板」给后端种子：backend/apps/catalog/data/workbench_templates.json。
 * 后端保存/导出设计时按 templateId 查 TemplateDefinition，结构规格模板（spec-*）有数百个，
 * 不能手写在 seed_catalog.py 里。只含 key / 标题 / 尺寸范围，不含几何。
 * 用法：node scripts/export-workbench-templates-seed.mjs  → 然后 python manage.py seed_catalog
 */
import {writeFileSync,mkdirSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {PRESETS} from '../src/catalog/index.js'
import {TEMPLATES} from '../src/templates/index.js'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')
const outPath=join(root,'backend','apps','catalog','data','workbench_templates.json')

const used=new Map()
for(const p of PRESETS){
  if(!p.templateId||used.has(p.templateId))continue
  const t=TEMPLATES[p.templateId]
  if(!t)continue
  const lim=t.limits||{}
  const range=v=>(Array.isArray(v)&&v.length===2?[Number(v[0]),Number(v[1])]:null)
  const limits={}
  for(const k of ['length','width','height']){
    const r=range(lim[k])
    if(r)limits[k]=r
  }
  used.set(p.templateId,{
    template_key:t.id,
    title:String(t.label||t.labelEn||t.id).slice(0,120),
    limits,
  })
}
// 固定规格盒型（没有可用的参数化模板，原样回放采集刀版）：登记成 fixed_snapshot 模板，尺寸锁死。
// key 规则与 seed_catalog.py 的样机目录一致：运输盒 fixed-<num>，其余 fixed-<品类>-<num>。
const fixed=new Map()
for(const p of PRESETS){
  const customizable=p.templateId&&(p.fidelity==='exact'||p.fidelity==='close')
  const rel=String(p.geomPublicRel||p.geomRel||'')
  if(customizable||!p.hasGeometry||!p.sourceNum||!rel)continue
  const category=String(p.categoryId||'shipping')
  const key=category==='shipping'?`fixed-${p.sourceNum}`:`fixed-${category}-${p.sourceNum}`
  if(fixed.has(key))continue
  fixed.set(key,{
    template_key:key,
    title:String(p.label||p.sourceNum).slice(0,120),
    category,
    source_num:String(p.sourceNum),
    preset_id:String(p.id),
    // 与 manifest.ts 的 lockedManifest 默认值保持一致，保存时后端按这组尺寸校验
    locked_dims:{lengthMm:Number(p.length)||100,widthMm:Number(p.width)||80,heightMm:Number(p.height)||0},
  })
}
const fixedItems=[...fixed.values()].sort((a,b)=>a.template_key.localeCompare(b.template_key))
const items=[...used.values()].sort((a,b)=>a.template_key.localeCompare(b.template_key))
mkdirSync(dirname(outPath),{recursive:true})
writeFileSync(outPath,JSON.stringify({schema:'boxcraft.workbench_templates.v1',count:items.length,items,fixed:fixedItems},null,1)+'\n')
console.log(JSON.stringify({outPath,count:items.length,spec:items.filter(i=>i.template_key.startsWith('spec-')).length,fixed:fixedItems.length}))
