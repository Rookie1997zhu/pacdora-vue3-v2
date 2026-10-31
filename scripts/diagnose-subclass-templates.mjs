/**
 * 诊断：官方子类 × templateId 分布，标出挤挂 / 未映射 / 疑似错挂。
 */
import {writeFileSync,mkdirSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import data from '../src/catalog/presets.js'
import {OFFICIAL_SUBCLASS_DEFS} from '../src/catalog/officialSubclasses.js'
import {EXPECTED,templateFitsAnySubclass} from '../src/catalog/subclassTemplateRules.js'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')
const outDir=join(root,'未映射名单')
mkdirSync(outDir,{recursive:true})

const presets=data.presets||[]
const subclassMeta=Object.fromEntries(
  (data.officialSubclasses||OFFICIAL_SUBCLASS_DEFS).map(s=>[s.id,s])
)

function topEntries(obj,n=8){
  return Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,n)
}

const rows=[]
const globalTpl={}
let mapped=0,unmapped=0

for(const p of presets){
  if(p.templateId){mapped++;globalTpl[p.templateId]=(globalTpl[p.templateId]||0)+1}
  else unmapped++
}

for(const def of OFFICIAL_SUBCLASS_DEFS){
  const list=presets.filter(p=>(p.subclassIds||[]).includes(def.id))
  const byTpl={unmapped:0}
  for(const p of list){
    const k=p.templateId||'unmapped'
    byTpl[k]=(byTpl[k]||0)+1
  }
  const total=list.length
  const mappedN=total-(byTpl.unmapped||0)
  const tops=topEntries(byTpl,6)
  const top1=tops[0]
  const top1Share=total?top1[1]/total:0
  const expected=EXPECTED[def.id]
  let suspect=0
  let whitelistMiss=0
  // 真错挂：已映射但不落在该条目任一所属子类合理列表（与纠错口径一致）
  // whitelistMiss：仅相对本子类白名单（多标签时可偏高，仅作参考）
  if(Array.isArray(expected)&&expected.length){
    for(const p of list){
      if(!p.templateId)continue
      if(p.templateSource==='structure-code'||p.templateSource==='structure-spec')continue
      if(!expected.includes(p.templateId))whitelistMiss++
      const ids=(p.subclassIds||[]).filter(id=>{
        const e=EXPECTED[id]
        return Array.isArray(e)&&e.length>0
      })
      if(ids.length&&!templateFitsAnySubclass(p.templateId,ids))suspect++
    }
  }
  const crowding=top1&&top1[0]!=='unmapped'&&top1Share>=0.55?'挤挂':''
  const mismatch=expected?.length&&suspect/Math.max(mappedN,1)>=0.25?'疑似错挂多':''
  const plasticEmpty=def.id==='plastic'&&(byTpl.unmapped||0)/Math.max(total,1)>=0.5?'仅尺寸为主':''

  rows.push({
    id:def.id,
    label:def.label,
    total,
    mapped:mappedN,
    unmapped:byTpl.unmapped||0,
    mapRate:total?mappedN/total:0,
    top1:top1?.[0]||'',
    top1Count:top1?.[1]||0,
    top1Share,
    top3:tops.slice(0,3).map(([k,n])=>`${k}:${n}`).join(' · '),
    suspect,
    whitelistMiss,
    flags:[crowding,mismatch,plasticEmpty].filter(Boolean).join(',')
  })
}

rows.sort((a,b)=>b.total-a.total)

const md=[
  '# 官方子类 × 模板映射诊断',
  '',
  `> 生成时间：${new Date().toISOString()}`,
  `> 尺寸目录 ${presets.length} 条；已映射 ${mapped}；未映射 ${unmapped}。`,
  '',
  '## 读法',
  '',
  '- **挤挂**：该子类里超过 55% 条目落在同一个 `templateId`（改尺寸也几乎同一种轮廓）。',
  '- **疑似错挂多**：已映射里 ≥25% 对「该条目全部所属子类」都不合理（与纠错口径一致；多标签下挂在另一合理子类不算错挂）。',
  '- **仅尺寸为主**：塑料等预期大量无模板。',
  '- 子类可重叠，各行 `total` 之和会大于目录总数。',
  '',
  '## 全局模板占用（全部目录）',
  '',
  '| templateId | 条数 | 占比 |',
  '|---|---:|---:|',
  ...topEntries(globalTpl,20).map(([k,n])=>`| \`${k}\` | ${n} | ${(100*n/presets.length).toFixed(1)}% |`),
  `| _unmapped_ | ${unmapped} | ${(100*unmapped/presets.length).toFixed(1)}% |`,
  '',
  '## 分官方子类',
  '',
  '| 子类 | 条数 | 已映射 | 未映射 | 映射率 | Top1 模板 | Top1 占比 | Top3 | 疑似错挂条数 | 标记 |',
  '|---|---:|---:|---:|---:|---|---:|---|---:|---|',
  ...rows.map(r=>`| ${r.label} | ${r.total} | ${r.mapped} | ${r.unmapped} | ${(100*r.mapRate).toFixed(0)}% | \`${r.top1}\` | ${(100*r.top1Share).toFixed(0)}% | ${r.top3} | ${r.suspect} | ${r.flags||'—'} |`),
  '',
  '## 优先处理建议',
  '',
]

const crowded=rows.filter(r=>r.flags.includes('挤挂'))
const mismatched=rows.filter(r=>r.flags.includes('疑似错挂'))
md.push('### 挤挂（看起来最千篇一律）')
if(!crowded.length)md.push('- （无）')
else for(const r of crowded){
  md.push(`- **${r.label}**：${(100*r.top1Share).toFixed(0)}% → \`${r.top1}\`（${r.top1Count}/${r.total}）。建议：拆映射到更多结构模板，或接受「同族示意」。`)
}
md.push('')
md.push('### 疑似错挂偏多')
if(!mismatched.length)md.push('- （无）')
else for(const r of mismatched){
  md.push(`- **${r.label}**：疑似错挂 ${r.suspect} 条；当前 Top3：${r.top3}`)
}
md.push('')
md.push('### 映射率偏低但仍有量')
for(const r of rows.filter(r=>r.total>=40&&r.mapRate<0.5&&r.id!=='plastic')){
  md.push(`- **${r.label}**：映射率 ${(100*r.mapRate).toFixed(0)}%，未映射 ${r.unmapped}。`)
}
md.push('')
md.push('明细 JSON：`11_子类模板诊断.json`')
md.push('')

writeFileSync(join(outDir,'11_子类模板诊断.md'),md.join('\n'),'utf8')
writeFileSync(join(outDir,'11_子类模板诊断.json'),JSON.stringify({
  generatedAt:new Date().toISOString(),
  catalog:{count:presets.length,mapped,unmapped},
  globalTpl,
  expected:EXPECTED,
  bySubclass:rows
},null,2),'utf8')

console.log(md.join('\n'))
