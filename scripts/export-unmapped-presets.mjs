/**
 * 导出尺寸目录中未挂 templateId 的条目，供人工标注：可映射 / 需新模板 / 仅尺寸。
 */
import {writeFileSync,mkdirSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import data from '../src/catalog/presets.js'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')
const outDir=join(root,'structure_inventory','未映射名单')
mkdirSync(outDir,{recursive:true})

const unmapped=(data.presets||[]).filter(p=>!p.templateId)

function clusterKey(label){
  const s=String(label||'').toLowerCase()
  if(/cylinder|罐|plastic|塑料|bottle|tube\b/.test(s))return '塑料/圆柱'
  if(/rotat|旋转|interlock|luxury|rigid/.test(s))return '旋转/硬盒杂类'
  if(/milk|饮料|carton/.test(s))return '利乐/饮料'
  if(/coffee|capsule/.test(s))return '咖啡胶囊'
  if(/shoe|鞋/.test(s))return '鞋盒残留'
  if(/display|展示/.test(s))return '展示残留'
  if(/tray|托盘/.test(s))return '托盘残留'
  if(/gift|礼/.test(s))return '礼盒残留'
  if(/food|餐|burger|pizza/.test(s))return '食品残留'
  if(/mailer|邮寄|shipping/.test(s))return '邮寄/运输残留'
  if(/tuck|插|folding/.test(s))return '折叠/插舌残留'
  if(/window|窗/.test(s))return '开窗残留'
  if(/lid|盖/.test(s))return '带盖残留'
  return '未识别/其他'
}

function csvEscape(v){
  const s=String(v??'')
  return /[",\n\r]/.test(s)?`"${s.replace(/"/g,'""')}"`:s
}

const rows=unmapped.map(p=>({
  id:p.id,
  sourceNum:p.sourceNum,
  label:p.label,
  categoryId:p.categoryId,
  categoryLabel:p.categoryLabel,
  length:p.length,
  width:p.width,
  height:p.height,
  thickness:p.thickness,
  materialId:p.materialId,
  cluster:clusterKey(p.label),
  hasGeometry:!!p.hasGeometry,
  cutCount:p.cutCount||0,
  foldCount:p.foldCount||0,
  geomRel:p.geomRel||'',
  suggestAction:'' // 人工：可映射 / 需新模板 / 仅尺寸
})).sort((a,b)=>a.cluster.localeCompare(b.cluster,'zh')||String(a.sourceNum).localeCompare(String(b.sourceNum),'en',{numeric:true}))

const byCluster={}
for(const r of rows)byCluster[r.cluster]=(byCluster[r.cluster]||0)+1

const headers=[
  'cluster','suggestAction','sourceNum','id','label','categoryLabel',
  'length','width','height','thickness','materialId',
  'hasGeometry','cutCount','foldCount','geomRel'
]
const csv=[headers.join(',')].concat(
  rows.map(r=>headers.map(h=>csvEscape(r[h])).join(','))
).join('\n')

const csvPath=join(outDir,'07_未映射尺寸目录名单.csv')
const jsonPath=join(outDir,'07_未映射尺寸目录名单.json')
const mdPath=join(outDir,'07_未映射尺寸目录摘要.md')

writeFileSync(csvPath,'\ufeff'+csv,'utf8') // BOM 方便 Excel
writeFileSync(jsonPath,JSON.stringify({
  schema:'boxcraft.unmapped-export.v1',
  note:'Unmapped imported sizes (no templateId). Fill suggestAction: 可映射|需新模板|仅尺寸',
  generatedAt:new Date().toISOString(),
  catalogTotal:data.count,
  catalogMapped:data.mapped,
  unmappedCount:rows.length,
  byCluster,
  items:rows
},null,2),'utf8')

const clusterLines=Object.entries(byCluster)
  .sort((a,b)=>b[1]-a[1])
  .map(([k,n])=>`| ${k} | ${n} |`)
  .join('\n')

const md=`# 未映射尺寸目录名单

> 从 \`src/catalog/presets.js\` 导出：无 \`templateId\` 的导入尺寸。

- 目录总数：${data.count}
- 已映射：${data.mapped}
- 未映射：${rows.length}

## 粗聚类统计

| 聚类 | 数量 |
|---|---:|
${clusterLines}

## 文件

- 明细 CSV（含空列 \`suggestAction\`）：[\`07_未映射尺寸目录名单.csv\`](./07_未映射尺寸目录名单.csv)
- 机器可读 JSON：[\`07_未映射尺寸目录名单.json\`](./07_未映射尺寸目录名单.json)
- 本目录：\`structure_inventory/未映射名单/\`

## 标注说明

在 CSV 的 \`suggestAction\` 列填写其一：

| 值 | 含义 |
|---|---|
| 可映射 | 可挂到现有模板，只需扩 \`mapTemplate\` 关键词 |
| 需新模板 | 需公开结构 + 可矩形化后再写模板 |
| 仅尺寸 | 塑料/圆柱/超引擎能力，只保留尺寸 |
`

writeFileSync(mdPath,md,'utf8')

console.log(JSON.stringify({
  csvPath,jsonPath,mdPath,
  unmapped:rows.length,
  byCluster
},null,2))
