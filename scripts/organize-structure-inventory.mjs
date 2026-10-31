/**
 * 整理 structure_inventory → 摘要 Markdown + 模板优先级 JSON
 */
import {readFileSync,writeFileSync} from 'node:fs'
import {dirname,join} from 'node:path'
import {fileURLToPath} from 'node:url'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')
const dir=join(root,'structure_inventory')

function parseCSV(t){
  const rows=[];let row=[],cur='',q=false
  for(let i=0;i<t.length;i++){
    const c=t[i],n=t[i+1]
    if(q){if(c==='"'&&n==='"'){cur+='"';i++}else if(c==='"')q=false;else cur+=c}
    else if(c==='"')q=true
    else if(c===','){row.push(cur);cur=''}
    else if(c==='\n'||(c==='\r'&&n==='\n')){if(c==='\r')i++;row.push(cur);rows.push(row);row=[];cur=''}
    else cur+=c
  }
  if(cur.length||row.length){row.push(cur);rows.push(row)}
  return rows
}
function load(name){
  const rows=parseCSV(readFileSync(join(dir,name),'utf8').replace(/^\uFEFF/,''))
  const h=rows[0].map(x=>x.trim())
  return rows.slice(1).filter(r=>r.some(c=>String(c||'').trim())).map(r=>{
    const o={};h.forEach((k,i)=>o[k]=(r[i]??'').trim());return o
  })
}

const official=load('01_官方子类命中统计.csv').filter(r=>!String(r['子类名']||'').startsWith('【'))
const unmapped=load('02_未映射名称归类统计.csv')
const officialTpl=load('04_官方子类结构模板.csv')
const unmappedTpl=load('05_未映射归类结构模板.csv')
const engSample=load('06_结构工程定义明细_代表样.csv')
const detail=load('03_模型结构归类明细.csv')

const OWNED={
  'mailer-parametric-demo':{covers:['飞机盒/邮寄盒','邮寄盒'],note:'自研翻盖邮寄'},
  'fefco-0427':{covers:['飞机盒/邮寄盒','邮寄盒','带盖盒'],note:'FEFCO 0427 铰盖'},
  'mailer-aircraft':{covers:['飞机盒/邮寄盒'],note:'飞机盒示意'},
  'fefco-0201':{covers:['运输箱/纸箱','运输箱'],note:'FEFCO 0201 RSC'},
  'tuck-end-straight':{covers:['插口盒','锁底/插口/自锁'],note:'直插舌'},
  'tuck-end-reverse':{covers:['插口盒','锁底/插口/自锁'],note:'反向插舌'},
  'tuck-window':{covers:['开窗盒'],note:'开窗插舌'},
  'hanging-tuck':{covers:['挂盒'],note:'挂孔插舌'},
  'zipper-tuck':{covers:['拉链盒'],note:'拉链示意'},
  'auto-lock-bottom':{covers:['锁底/插口/自锁','插口盒'],note:'锁底示意'},
  'handle-box':{covers:['提手盒'],note:'提手片锁底'},
  'lid-base':{covers:['天地盖/对盖'],note:'天地盖托盘'},
  'sleeve':{covers:['抽屉盒/袖套托盘'],note:'袖套'},
  'drawer-tray':{covers:['抽屉盒/袖套托盘'],note:'抽屉托盘'},
  'pizza-clamshell':{covers:['披萨/食品翻盖'],note:'食品翻盖'},
  'magnetic-rigid':{covers:['磁吸翻盖硬盒'],note:'磁吸示意单层'},
  'display-pdq':{covers:['展示盒'],note:'PDQ 展示'}
}

// 优先级：未映射量大 + 工程可参数化（单层 traditional、轴对齐面为主）优先
const NEXT=[
  {id:'lid-base',label:'天地盖/对盖',fromUnmapped:'天地盖/对盖',priority:1,effort:'中',reason:'60 条未映射；图层多为顶底灰板+面纸，可先做单层示意再扩展精品多图层',suggestPublic:'FEFCO 03xx / 天地盖工艺'},
  {id:'drawer-sleeve',label:'抽屉盒/袖套托盘',fromUnmapped:'抽屉盒/袖套托盘',priority:2,effort:'中',reason:'50 条；内盒+外袖两件套，可分两模板',suggestPublic:'Sleeve & Tray'},
  {id:'tuck-window',label:'开窗插舌盒',fromUnmapped:'开窗盒',priority:3,effort:'低-中',reason:'44 条；在插舌盒上加窗口洞口即可',suggestPublic:'STE/RTE + window'},
  {id:'mailer-aircraft',label:'飞机盒变体',fromUnmapped:'飞机盒/邮寄盒',priority:4,effort:'低-中',reason:'27 条；接近现有 mailer/0427，补锁底/侧翼变体',suggestPublic:'FEFCO 042x / mailer'},
  {id:'hanging-tuck',label:'挂孔插舌盒',fromUnmapped:'挂盒',priority:5,effort:'低',reason:'19 条；插舌盒 + 挂孔',suggestPublic:'tuck + euro hole'},
  {id:'pizza-clamshell',label:'披萨/食品翻盖',fromUnmapped:'披萨/食品翻盖',priority:6,effort:'中',reason:'19 条；盘式/翻盖食品盒',suggestPublic:'FEFCO 04xx food'},
  {id:'handle-box',label:'提手盒',fromUnmapped:'提手盒',priority:7,effort:'中',reason:'13 条；锁底或插舌 + 提手',suggestPublic:'FEFCO 02xx with handle'},
  {id:'magnetic-rigid',label:'磁吸翻盖硬盒',fromUnmapped:'磁吸翻盖硬盒',priority:8,effort:'高',reason:'12 条；多图层灰板面纸，先不做生产级',suggestPublic:'精品礼盒工艺（多件）'},
  {id:'display',label:'展示盒',fromUnmapped:'展示盒',priority:9,effort:'高',reason:'官方子类样本多但结构散，后做',suggestPublic:'PDQ / display'},
  {id:'zipper',label:'拉链盒',fromUnmapped:'拉链盒',priority:10,effort:'中-高',reason:'仅 5 条，可暂缓',suggestPublic:'zipper tuck'},
]

const unmappedTotal=unmapped.reduce((s,r)=>s+Number(r['数量']||0),0)
const coveredNow=unmapped.filter(r=>['锁底/插口/自锁','运输箱/纸箱','飞机盒/邮寄盒','插口盒'].includes(r['未映射名称归类']))
  .reduce((s,r)=>s+Number(r['数量']||0),0)

const byCode={}
for(const r of detail){
  const code=r['结构code']||'?'
  byCode[code]=(byCode[code]||0)+1
}
const topCodes=Object.entries(byCode).sort((a,b)=>b[1]-a[1]).slice(0,15)

const plan={
  schema:'boxcraft.structure-plan.v1',
  source:'structure_inventory',
  totals:{
    modelsInDetail:detail.length,
    officialSubclassHits:official.reduce((s,r)=>s+Number(r['本地命中数']||0),0),
    unmappedNameTotal:unmappedTotal,
    ownedTemplateCount:Object.keys(OWNED).length
  },
  ownedTemplates:OWNED,
  unmappedBreakdown:unmapped.map(r=>({
    group:r['未映射名称归类'],
    count:Number(r['数量']||0)
  })),
  officialSubclasses:official.map(r=>({
    name:r['子类名'],
    hit:Number(r['本地命中数']||0),
    siteCount:Number(r['站点宣称count']||0)
  })),
  nextTemplates:NEXT,
  topStructureCodes:topCodes.map(([code,count])=>({code,count})),
  engineeringSampleModels:[...new Set(engSample.map(r=>r['代表模型编号']).filter(Boolean))].slice(0,20)
}

writeFileSync(join(dir,'priority_templates.json'),JSON.stringify(plan,null,2))

const md=`# 结构清单整理摘要

> 由 \`scripts/organize-structure-inventory.mjs\` 根据 \`01\`~\`06\` CSV 自动生成。  
> 用途：指导 **自有模板** 补齐与映射；**不**把第三方刀版坐标当事生产几何导入引擎。

## 1. 数据资产一览

| 文件 | 内容 |
|---|---|
| 01_官方子类命中统计 | 站点盒子子类 vs 本地命中 |
| 02_未映射名称归类统计 | 未挂官方子类时按名称粗分 |
| 03_模型结构归类明细 | 每模型 code / 图层 / 尺寸 / openParams |
| 04_官方子类结构模板 | 各官方子类主结构与面序摘要 |
| 05_未映射归类结构模板 | 未映射各类主结构与面序摘要 |
| 06_结构工程定义明细_代表样 | 代表样的 openParam / 图层明细 |

- 明细模型数：**${detail.length}**
- 官方子类本地命中合计（可重叠）：**${plan.totals.officialSubclassHits}**
- 未映射名称归类合计：**${unmappedTotal}**
- 工程代表样涉及模型：**${plan.engineeringSampleModels.length}+**（见 JSON）

## 2. 官方子类（流量向）

| 子类 | 本地命中 |
|---|---:|
${official.map(r=>`| ${r['子类名']} | ${r['本地命中数']} |`).join('\n')}

说明：同一模型可属多个子类，命中数之和可大于模型总数。

## 3. 未映射名称归类（补模板优先级）

| 归类 | 数量 | 与现有模板关系 |
|---|---:|---|
${unmapped.map(r=>{
  const g=r['未映射名称归类']
  const n=r['数量']
  const hit=Object.entries(OWNED).filter(([,v])=>v.covers.includes(g)).map(([id])=>id)
  return `| ${g} | ${n} | ${hit.length?('部分覆盖：'+hit.join(', ')):'尚无对应模板'} |`
}).join('\n')}

## 4. 项目已有模板 vs 清单

| 模板 id | 说明 | 主要可覆盖清单类 |
|---|---|---|
${Object.entries(OWNED).map(([id,v])=>`| \`${id}\` | ${v.note} | ${v.covers.join('、')} |`).join('\n')}

> 约 396 条尺寸目录已自动映射到上表；其余条目仍可作尺寸库，结构借用当前选中模板。

## 5. 建议下一批自研模板（按投入产出）

| 优先级 | 建议模板 | 未映射量级 | 难度 | 理由 |
|---:|---|---:|---|---|
${NEXT.map(t=>`| ${t.priority} | **${t.label}** (\`${t.id}\`) | 见「${t.fromUnmapped}」 | ${t.effort} | ${t.reason} |`).join('\n')}

**建议先做 P1–P3**：天地盖、抽屉/袖套、开窗插舌——未映射量合计可观，且可用公开结构描述参数化，不必依赖第三方坐标。

## 6. 高频结构 code（全量明细 Top）

| code | 出现次数 |
|---|---:|
${topCodes.map(([c,n])=>`| ${c} | ${n} |`).join('\n')}

\`Pair\` / \`KnifePrototype\` / \`Aircraft\` / \`CanCylinder\` 等是后续映射关键词来源；写新模板时把 code 族写进 \`mapTemplate\`。

## 7. 做新模板时你还需要什么

已从本清单拿到：名称归类、主 code、典型面序、尺寸范围、openParam 名、代表编号。

仍建议补：
1. **公开结构定义**（FEFCO/ECMA 或工厂工艺）——面、铰链、上胶边  
2. **厚度补偿规则**（内尺寸→刀版）——示意系数 + 打样校准  
3. **每类 1～2 个实物/正规样张**——比对照第三方 JSON 更安全可靠  

**不要**把 \`geometry/pacdora_boxes/*.json\` 的 cuts/folds 整批拷进产品当事可开模刀版。

## 8. 机器可读计划

见同目录 [\`priority_templates.json\`](./priority_templates.json)。
`
writeFileSync(join(dir,'00_整理摘要.md'),md)
console.log(JSON.stringify({
  summary:join(dir,'00_整理摘要.md'),
  plan:join(dir,'priority_templates.json'),
  unmappedTotal,
  next:NEXT.slice(0,3).map(t=>t.id)
},null,2))
