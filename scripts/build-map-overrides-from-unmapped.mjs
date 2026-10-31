/**
 * 从未映射名单标注生成 sourceNum → templateId 覆盖表。
 * - suggestAction=可映射：启发式填 suggestedTemplateId
 * - suggestAction=需新模板：仅对「明显可改判」写入覆盖表
 * 不确定则跳过（宁可未映射也不错挂）。
 */
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')
const unmappedDir=join(root,'未映射名单')
const annotPath=join(unmappedDir,'08_未映射_suggestAction全量标注.csv')
const needPath=join(unmappedDir,'08_需新模板_公开展开可矩形化.csv')
const outJs=join(root,'src','catalog','mapOverrides.js')
const outJson=join(root,'src','catalog','mapOverrides.json')
const outReview=join(unmappedDir,'09_可映射_suggestedTemplateId.csv')
const outBacklog=join(unmappedDir,'10_structureCode_backlog.md')

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

function loadCsv(path){
  if(!existsSync(path))throw new Error('missing '+path)
  const t=readFileSync(path,'utf8').replace(/^\ufeff/,'')
  const lines=t.split(/\r?\n/).filter(Boolean)
  const headers=splitCsv(lines[0])
  return lines.slice(1).map(line=>{
    const cols=splitCsv(line)
    const o={}
    headers.forEach((h,i)=>o[h]=cols[i]??'')
    return o
  })
}

function csvEscape(v){
  const s=String(v??'')
  return /[",\n\r]/.test(s)?`"${s.replace(/"/g,'""')}"`:s
}

/** 启发式：可映射 / 改判 → templateId；不确定返回 null */
function suggestTemplate(row){
  const label=String(row.label||'')
  const code=String(row.structureCode||'')
  const s=`${label} ${code} ${row.remarks||''}`.toLowerCase()
  const cluster=String(row.cluster||'')

  // —— 按 structureCode 硬映射（高置信）——
  const codeMap={
    SimpleGluedCoverBox:'lid-base',
    KnifeDraw:'drawer-tray',
    CoverBox:'lid-base',
    Pair:'lid-base',
    PairWithHook:'tuck-end-straight',
    PairHorizontal:'tuck-end-straight',
    PairStickWithLock:'auto-lock-bottom',
    PairWithLining:'tuck-end-reverse',
    FourFoldCoverBox:'lid-base',
    CartonCoverBoxWithHandle:'handle-box'
  }
  if(codeMap[code])return codeMap[code]

  // 抽屉 / 袖套
  if(/knifedraw|drawer|sleeve|滑盖|抽屉|套筒/i.test(s)){
    return /sleeve|套筒|外袖|滑套/i.test(s)?'sleeve':'drawer-tray'
  }
  // 天地盖 / FEFCO 03xx / with lid（非精品多层备注）
  if(/fefco\s*030[0-9]|天地|对盖|telescope|lid\s*and\s*base|box\s*with\s*lid|cover\s*box|sweet\s*box\s*with\s*lid|perfume\s*box\s*with\s*lid|maternity.*with\s*lid/i.test(s)
    &&!/double\s*wall|four\s*fold|boutique|magnetic|卡边|explosive/i.test(s)){
    return 'lid-base'
  }
  // 展示
  if(/display|展示|pdq/i.test(s)||cluster==='展示残留')return 'display-pdq'
  // 日化 / 药品折叠盒 → 直插舌
  if(/lotion|perfume|lipstick|cleanser|face\s*wash|omega|medicine|cosmetic|soap|skincare|candle|holiday\s*candle/i.test(s)
    &&!/window|hang|tray|drawer|magnetic/i.test(s))return 'tuck-end-straight'
  // 开窗
  if(/window|开窗|带窗/i.test(s))return 'tuck-window'
  // 挂孔
  if(/hang|挂孔|euro/i.test(s))return 'hanging-tuck'
  // 飞机 / 邮寄
  if(/aircraft|飞机|mailer/i.test(s))return /aircraft|飞机/.test(s)?'mailer-aircraft':'fefco-0427'
  // 提手
  if(/handle|提手|carrier|6-pack/i.test(s))return 'handle-box'
  // 食品翻盖
  if(/pizza|burger|clamshell|hot\s*dog|dessert/i.test(s))return 'pizza-clamshell'
  // 托盘
  if(/\btray\b|托盘/i.test(s))return /display|展示/.test(s)?'display-pdq':'drawer-tray'
  // 鞋盒
  if(/shoe/i.test(s))return 'lid-base'
  // 多边形
  if(/polygon|polygonal|六角|八角/i.test(s))return 'polygon-tray'
  // 折叠礼盒 / 产品盒泛化
  if(/gift\s*box|folding\s*box|square\s*box|trading\s*card|packaging\s*box|ampoule|pill\s*box|syringe|palette|charger|battery|kit\s*box|toy\s*box|scale\s*model/i.test(s)
    &&!/lid|tray|window|rigid|magnetic|drawer|sleeve/i.test(s)){
    return 'tuck-end-straight'
  }
  if(/reverse\s*mortise|lock\s*insert|tuck\s*end.*reverse/i.test(s))return 'tuck-end-reverse'
  if(/mortise\s*lock|lock-top|lock\s*insert/i.test(s))return 'auto-lock-bottom'
  // 运输
  if(/shipping|rsc|fefco\s*02/i.test(s))return 'fefco-0201'
  // 锁底
  if(/auto.?lock|crash.?lock|锁底|snap.?lock/i.test(s))return 'auto-lock-bottom'

  return null
}

/** 需新模板中「明显可改判」 */
function reclassifyNeed(row){
  const code=String(row.structureCode||'')
  const s=`${row.label||''} ${code} ${row.remarks||''}`.toLowerCase()
  // KnifeDraw → 抽屉托盘
  if(code==='KnifeDraw'||/knife.?draw/i.test(s))return 'drawer-tray'
  // 简单胶合对盖 / 名称明确 lid and base（无双壁精品）
  if(code==='SimpleGluedCoverBox')return 'lid-base'
  if(/^(lid and base box|rectangle box with lid|box with lid mockup)/i.test(String(row.label||''))
    &&!/double|four\s*fold|card\s*edge|explosive|boutique/i.test(s)){
    return 'lid-base'
  }
  // 纯展示 tray 名称
  if(/^display tray box$/i.test(String(row.label||'').trim()))return 'display-pdq'
  if(code==='CartonCoverBoxWithHandle')return 'handle-box'
  if(code==='TissueSimpleP1')return 'tuck-end-straight'
  return null
}

const all=loadCsv(annotPath)
const mappable=all.filter(r=>r.suggestAction==='可映射')
const needRows=existsSync(needPath)?loadCsv(needPath):all.filter(r=>r.suggestAction==='需新模板')

const overrides={}
const reviewRows=[]
let mappedOk=0,mappedSkip=0

for(const r of mappable){
  const tid=suggestTemplate(r)
  const num=String(r.sourceNum||'')
  if(tid&&num){
    overrides[num]=tid
    mappedOk++
    reviewRows.push({...r,suggestedTemplateId:tid,overrideSource:'可映射启发式'})
  }else{
    mappedSkip++
    reviewRows.push({...r,suggestedTemplateId:'',overrideSource:'跳过-不确定'})
  }
}

let reclassOk=0
for(const r of needRows){
  const tid=reclassifyNeed(r)
  const num=String(r.sourceNum||'')
  if(tid&&num&&!overrides[num]){
    overrides[num]=tid
    reclassOk++
    reviewRows.push({
      cluster:r.cluster,suggestAction:'改判可映射',sourceNum:num,id:r.id,label:r.label,
      categoryLabel:r.categoryLabel,length:r.length,width:r.width,height:r.height,
      thickness:r.thickness,materialId:r.materialId,structureCode:r.structureCode,
      suggestedTemplateId:tid,overrideSource:'需新模板改判'
    })
  }
}

// 统计需新模板 code
const byCode={}
for(const r of needRows){
  const c=r.structureCode||'(空)'
  if(!byCode[c])byCode[c]={count:0,samples:[],reclass:null}
  byCode[c].count++
  if(byCode[c].samples.length<3)byCode[c].samples.push(`${r.sourceNum} ${r.label}`)
  const rc=reclassifyNeed(r)
  if(rc)byCode[c].reclass=rc
}

function actionForCode(code,info){
  if(info.reclass)return `改判可映射 → \`${info.reclass}\``
  if(/Boutique|Magnetic|灰板|面纸/i.test(code))return '仅尺寸或示意（精品多层，不新开生产模板）'
  if(/Cylinder|Plastic|Can|Pouch|Carton.*Milk|Juice/i.test(code))return '仅尺寸'
  if(/KnifeDraw/i.test(code))return '改判可映射 → `drawer-tray` / `sleeve`'
  if(/Buckle|Lock|Insert|Aircraft|Window|Handle|Cover|Pair|Tray|Adhesive|Tissue|Flip/i.test(code)){
    return '新模板（族级示意，需公开结构）'
  }
  return '待定：抽样后改判或仅尺寸'
}

const codeEntries=Object.entries(byCode).sort((a,b)=>b[1].count-a[1].count)
const backlogMd=`# structureCode 族 backlog（需新模板）

> 由 \`scripts/build-map-overrides-from-unmapped.mjs\` 生成。  
> 本波**不**为每条开模板；按族选择：改判可映射 / 新模板 / 仅尺寸。

- 需新模板条目：${needRows.length}
- 本波改判写入覆盖表：${reclassOk}
- 可映射启发式写入：${mappedOk}（跳过 ${mappedSkip}）

## Top 结构 code

| 优先级 | structureCode | 数量 | 建议动作 | 样例 |
|---:|---|---:|---|---|
${codeEntries.slice(0,25).map(([code,info],i)=>`| ${i+1} | \`${code}\` | ${info.count} | ${actionForCode(code,info)} | ${info.samples[0]||''} |`).join('\n')}

## 下一波建议先做的 3～5 族

1. **KnifeDraw**（若仍有残留）— 统一挂 \`drawer-tray\`/\`sleeve\`  
2. **Cover / Lid 卡边族**（CartonCoverBoxWithCardEdge 等）— 评估是否新模板或继续仅尺寸  
3. **Buckle* / 自锁箱族** — 公开锁扣结构后再写示意模板  
4. **Boutique* 翻盖** — 维持 \`magnetic-rigid\` 示意或仅尺寸，不做多层生产  
5. **Pair* / Window 展示** — 能挂 \`tuck-window\`/\`display-pdq\` 则改判  

## 明确不做

- 460 条各做一个模板  
- 运行时加载 Pacdora cuts/folds  
- 精品多灰板生产级  
`

mkdirSync(join(root,'src','catalog'),{recursive:true})
mkdirSync(unmappedDir,{recursive:true})

// 手工示意挂载（Boutique / KnifeDraw / KnifePrototype 等）叠在启发式之上，catalog:build 不丢
const manualPath=join(root,'src','catalog','mapOverrides.manual.json')
let manualCount=0
if(existsSync(manualPath)){
  const manual=JSON.parse(readFileSync(manualPath,'utf8'))
  for(const [num,tid] of Object.entries(manual)){
    if(!tid)continue
    overrides[String(num)]=tid
    manualCount++
  }
}

const js=`/** auto-generated by scripts/build-map-overrides-from-unmapped.mjs — do not edit */
export default ${JSON.stringify(overrides,null,2)}
`

writeFileSync(outJs,js,'utf8')
writeFileSync(outJson,JSON.stringify(overrides,null,2)+'\n','utf8')

const reviewHeaders=[
  'overrideSource','suggestedTemplateId','cluster','suggestAction','sourceNum','id','label',
  'categoryLabel','length','width','height','thickness','structureCode'
]
const reviewCsv=[reviewHeaders.join(',')].concat(
  reviewRows.map(r=>reviewHeaders.map(h=>csvEscape(r[h])).join(','))
).join('\n')
writeFileSync(outReview,'\ufeff'+reviewCsv,'utf8')
writeFileSync(outBacklog,backlogMd,'utf8')

console.log(JSON.stringify({
  mappableTotal:mappable.length,
  mappedOk,
  mappedSkip,
  reclassOk,
  manualCount,
  overrideCount:Object.keys(overrides).length,
  outJs,
  outJson,
  outReview,
  outBacklog,
  topCodes:codeEntries.slice(0,10).map(([c,i])=>({code:c,count:i.count,reclass:i.reclass}))
},null,2))
