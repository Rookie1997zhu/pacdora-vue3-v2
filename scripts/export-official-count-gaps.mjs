/**
 * 官方子类宣称 count vs 本地命中差（次要采集缺口），写 CSV + 说明。
 * 不自动全量补爬；列出差集规模供人工/后续爬虫任务。
 */
import {readFileSync,writeFileSync,existsSync,mkdirSync,readdirSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')
const outDir=join(root,'未映射名单')
mkdirSync(outDir,{recursive:true})

const invCandidates=[
  join(root,'structure_inventory','01_官方子类命中统计.csv'),
  'C:\\Users\\ROG STRIX\\Desktop\\信息搜集\\webspider\\data search\\data_search\\exports\\structure_inventory\\01_官方子类命中统计.csv'
]
const invPath=invCandidates.find(p=>existsSync(p))
const geomDir=join(root,'geometry','pacdora_boxes')

function splitCsv(line){
  const out=[];let cur='',q=false
  for(let i=0;i<line.length;i++){
    const c=line[i]
    if(q){
      if(c==='"'&&line[i+1]==='"'){cur+='"';i++}
      else if(c==='"')q=false
      else cur+=c
    }else if(c==='"')q=true
    else if(c===','){out.push(cur);cur=''}
    else cur+=c
  }
  out.push(cur)
  return out
}

const rows=[]
if(invPath){
  const lines=readFileSync(invPath,'utf8').replace(/^\ufeff/,'').split(/\r?\n/).filter(Boolean)
  const headers=splitCsv(lines[0])
  for(const line of lines.slice(1)){
    const cols=splitCsv(line)
    const o=Object.fromEntries(headers.map((h,i)=>[h,cols[i]??'']))
    if(String(o['子类名']||'').startsWith('【'))continue
    const claimed=Number(o['站点宣称count']||0)
    const local=Number(o['本地命中数']||0)
    rows.push({
      subclass:o['子类名'],
      nameKey:o['nameKey'],
      claimed,
      local,
      gap:Math.max(0,claimed-local),
      note:o['说明']||''
    })
  }
}

const geomCount=existsSync(geomDir)?readdirSync(geomDir).filter(f=>f.endsWith('.json')).length:0
const crawlCsv=existsSync(join(root,'未映射名单','15_目录条数差.md'))
  ?readFileSync(join(root,'未映射名单','15_目录条数差.md'),'utf8')
  :''

const csv=['subclass,nameKey,claimed,local,gap,note']
for(const r of rows){
  csv.push([r.subclass,r.nameKey,r.claimed,r.local,r.gap,`"${(r.note||'').replace(/"/g,'""')}"`].join(','))
}
writeFileSync(join(outDir,'16_官方子类count差集.csv'),csv.join('\n'),'utf8')

const totalGap=rows.reduce((s,r)=>s+r.gap,0)
const md=[
  '# 官方子类 count 差集（采集次要缺口）',
  '',
  `> 生成时间：${new Date().toISOString()}`,
  `> 来源：\`${invPath||'(missing)'}\``,
  `> 本地 geometry JSON：${geomCount}`,
  '',
  '## 结论',
  '',
  `- 各子类宣称−命中 **合计缺口约 ${totalGap} 条次**（同一模型可属多子类，不宜直接当「缺模型数」）。`,
  '- 单类缺口多为 **0～3**；**不能解释** Demo「没有盖子 / 结构不完整」（该问题主因是模板错挂）。',
  '- 爬虫全集 ~2033 vs Demo presets ~1802 的差，见 `15_目录条数差.md`（筛选未进导入目录，几何文件往往仍在）。',
  '',
  '## 差表',
  '',
  '| 子类 | 宣称 | 本地 | 缺口 |',
  '|---|---:|---:|---:|'
]
for(const r of rows){
  md.push(`| ${r.subclass} | ${r.claimed} | ${r.local} | ${r.gap} |`)
}
md.push('')
md.push('## 补漏建议')
md.push('')
md.push('1. 仅对 gap>0 的 nameKey 再拉 `/api/v2/models` 分页，与本地 `模型编号` 做差集。')
md.push('2. 差集 `num` 补 `knife` JSON；**不要**为盖子问题全量重爬。')
md.push('3. Demo 导入目录若需对齐 2033，用 `build-presets-from-csv.mjs` 重生成后再跑 structureCode / 开顶重挂流水线。')
if(crawlCsv){
  md.push('')
  md.push('---')
  md.push('')
  md.push('（附）已存在目录条数差文档片段已生成，见同目录 `15_目录条数差.md`。')
}
writeFileSync(join(outDir,'16_官方子类count差集说明.md'),md.join('\n'),'utf8')
console.log(JSON.stringify({invPath,geomCount,totalGap,rows:rows.length},null,2))
