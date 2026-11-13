/**
 * 从运输箱 + 邮寄盒 CSV 生成「导入的尺寸目录」。
 * 只写入 L/W/H/厚度/名称/段数等元数据；不把 Pacdora cuts/folds 坐标写进产品刀版。
 */
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs'
import {dirname,join} from 'node:path'
import {fileURLToPath} from 'node:url'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')
const shippingCsv=join(root,'docs','pacdora_shipping_boxes','shipping_boxes.csv')
const mailerCsv=join(root,'docs','pacdora_mailer_boxes','mailer_boxes.csv')
const legacyCsv=join(root,'pacdora_boxes_geom.csv')
const shippingGeomDir=join(root,'docs','pacdora_shipping_boxes','geometry')
const mailerGeomDir=join(root,'docs','pacdora_mailer_boxes','geometry')
const legacyGeomDir=join(root,'geometry','pacdora_boxes')
const outDir=join(root,'src','catalog')
const outPath=join(outDir,'presets.js')
const overridesJsonPath=join(outDir,'mapOverrides.json')

/** sourceNum → templateId；由 build-map-overrides-from-unmapped.mjs 生成 */
const MAP_OVERRIDES=existsSync(overridesJsonPath)
  ?JSON.parse(readFileSync(overridesJsonPath,'utf8'))
  :{}

function parseCSV(t){
  const rows=[];let row=[],cur='',q=false
  for(let i=0;i<t.length;i++){
    const c=t[i],n=t[i+1]
    if(q){
      if(c==='"'&&n==='"'){cur+='"';i++}
      else if(c==='"')q=false
      else cur+=c
    }else if(c==='"')q=true
    else if(c===','){row.push(cur);cur=''}
    else if(c==='\n'||(c==='\r'&&n==='\n')){
      if(c==='\r')i++
      row.push(cur);rows.push(row);row=[];cur=''
    }else cur+=c
  }
  if(cur.length||row.length){row.push(cur);rows.push(row)}
  return rows
}

function mapTemplate(name,mockup,num){
  const s=`${name} ${mockup}`.toLowerCase()
  const n=String(num||'')
  // —— 覆盖表优先（未映射名单可映射 / 改判）——
  if(n&&MAP_OVERRIDES[n])return MAP_OVERRIDES[n]
  // —— 专用新模板（优先于泛化词）——
  // 多边形：默认勿一律开顶；明确 tray/open 才 polygon-tray
  if(/polygon|polygonal|六角|八角|三角|多边/.test(s)){
    if(/flip\s*top|翻盖|mailer|飞机|aircraft/.test(s))return /mailer|飞机|aircraft/.test(s)?'mailer-aircraft':'tuck-end-straight'
    if(/open\s*top|tray|托盘|pdq/.test(s)&&!/lid|cover|tuck|盖|插|flip|mailer|snap|lock|锁/.test(s))return 'polygon-tray'
    if(/tuck|插舌|插口|fold|lid|盖/.test(s))return 'tuck-end-straight'
    return 'tuck-end-straight'
  }
  if(/zipper|拉链|易撕/.test(s)&&!/window|drawer|sleeve/.test(s))return 'zipper-tuck'
  // 展示盒：明确 PDQ/开顶托盘才 display-pdq；带盖/提手/插舌走有盖族
  if(/\bpdq\b|counter\s*display|open\s*top\s*display|开顶展示/.test(s)
    &&!/mailer|tuck|drawer|pizza|window|polygon|handle|lid|盖|flip/.test(s))return 'display-pdq'
  if(/display\s*tray|展示托盘/.test(s)&&!/mailer|tuck|lid|盖|flip|handle|插/.test(s))return 'display-pdq'
  if(/display\s*(box|packaging)|展示盒/.test(s)
    &&!/mailer|tuck|drawer|pizza|window|polygon|pdq|tray|托盘|open\s*top/.test(s))return 'tuck-end-straight'
  if(/magnetic|磁吸|翻盖硬盒|boutique.*flip|rigid\s*box/.test(s)&&!/mailer|tuck\s*end/.test(s))return 'magnetic-rigid'
  if(/handle|提手|手提|carrier|6-pack|six\s*pack/.test(s)&&!/hang|挂|window|drawer/.test(s))return 'handle-box'
  if(/pizza|clamshell|食品翻盖|快餐盒|burger\s*box|hot\s*dog/.test(s))return 'pizza-clamshell'
  if(/hang|挂孔|euro\s*hole|挂盒|hanging/.test(s)&&!/handle|提手/.test(s))return 'hanging-tuck'
  if(/aircraft|飞机盒|飞机箱/.test(s))return 'mailer-aircraft'
  if(/window|开窗|带窗/.test(s)&&!/drawer|sleeve|display|pdq/.test(s))return 'tuck-window'
  if(/drawer|sleeve|滑盖|抽屉|knife.?draw/.test(s)&&!/lid-base|天地|对盖/.test(s)){
    return /sleeve|套筒|外袖|滑套/.test(s)?'sleeve':'drawer-tray'
  }
  // 浅托盘类 → 展示/抽屉托盘
  if(/\btray\b|托盘|food\s*tray|kraft\s*paper\s*tray|cardboard\s*tray|paper\s*tray/.test(s)
    &&!/mailer|tuck|drawer|sleeve|polygon|display\s*box|with\s*lid/.test(s)){
    return /display|展示/.test(s)?'display-pdq':'drawer-tray'
  }
  // 日化/药品/糕点等折叠盒 → 直插舌
  if(/medicine|cosmetic|soap|skincare|hand\s*cream|cigarette|sweet\s*box|cake\s*box|tissue\s*box|barbie|board\s*game/.test(s)
    &&!/window|hang|lid|tray|drawer|magnetic|rigid/.test(s))return 'tuck-end-straight'
  if(/folding\s*(paper\s*)?(packaging\s*)?box|folding\s*box|gift\s*box|square\s*(gift\s*|cake\s*|cardboard\s*)?box/.test(s)
    &&!/window|hang|lid|tray|drawer|magnetic|mailer|shipping|polygon|display|handle/.test(s))return 'tuck-end-straight'
  // —— 已有几何：编号与标准名 ——
  if(/^200010/.test(n)||/fefco\s*0201|regular slotted|\brsc\b/.test(s))return 'fefco-0201'
  if(/^150011/.test(n)||/fefco\s*0427/.test(s))return 'fefco-0427'
  if(/^150010/.test(n)||/rollover hinged|hinged lid mailer/.test(s))return 'mailer-parametric-demo'
  if(/^105010|^112310/.test(n)||/auto.?lock|crash.?lock|1-2-3 bottom|snap.?lock bottom/.test(s))return 'auto-lock-bottom'
  if(/reverse tuck/.test(s)||(/^100010/.test(n)&&/reverse/.test(s)))return 'tuck-end-reverse'
  if(/straight tuck/.test(s))return 'tuck-end-straight'
  if(/tuck end/.test(s)&&!/reverse|drawer|zipper|window|auto.?lock|hang|handle/.test(s))return 'tuck-end-straight'
  // A1 锁底/插口扩词
  if(/自锁|锁底|插口|snap.?lock|crash.?bottom|folding\s*carton/.test(s)
    &&!/window|hang|drawer|sleeve|zipper|handle|pizza|aircraft|display|magnetic|开窗|挂/.test(s)){
    if(/自锁|锁底|auto|crash|snap/.test(s))return 'auto-lock-bottom'
    return 'tuck-end-straight'
  }
  // A2 运输箱/纸箱扩词
  if(/shipping\s*box|运输箱|瓦楞纸箱|corrugated\s*(shipping\s*)?box|fefco\s*02\d{2}/.test(s)
    &&!/mailer|tuck|drawer|lid|盖|pizza|display/.test(s))return 'fefco-0201'
  // A4 天地盖漏网
  if(/天地盖|对盖|对开盖|telescope|shoe\s*box|boxes?\s+with\s+lid|cover\s*box|fefco\s*0?300\b|两件套.?盖|gift\s*box\s*with\s*lid|board\s*game\s*box\s*with\s*lid/.test(s)
    &&!/mailer|tuck|slotted|\brsc\b|auto.?lock|drawer|sleeve|magnetic|boutique/.test(s))return 'lid-base'
  // A3 邮寄/翻盖
  if(/邮寄盒|shipping\s*mailer|flip.?top\s*mailer/.test(s))return 'fefco-0427'
  if(/mailer/.test(s)&&/(flip|hinged|rollover|lid)/.test(s))return 'fefco-0427'
  return null
}

function thicknessFromMaterial(name){
  const m=String(name||'').match(/(\d+(?:\.\d+)?)\s*mm/i)
  if(m)return Math.max(.5,Number(m[1]))
  if(/e-flute|e flute/i.test(name))return 1.5
  if(/b-flute|b flute/i.test(name))return 3
  if(/white paperboard|白卡|铜版/i.test(name))return .5
  return 1.5
}

function materialId(name){
  const s=String(name||'').toLowerCase()
  if(/kraft|牛皮|flute/.test(s))return 'kraft'
  if(/blue/.test(s))return 'blue'
  return 'white'
}

/** CSV「分类」→ 稳定 id + 中文名 */
const CATEGORY_MAP={
  '运输箱':{id:'shipping',label:'运输箱'},
  'Shipping Box':{id:'shipping',label:'运输箱'},
  '邮寄盒':{id:'mailer',label:'邮寄盒'},
  'Mailer Box':{id:'mailer',label:'邮寄盒'},
  'Gift Box':{id:'gift',label:'礼品盒'},
  'Display Box':{id:'display',label:'展示盒'}
}
function mapCategory(raw,forceId){
  if(forceId==='shipping')return {id:'shipping',label:'运输箱'}
  if(forceId==='mailer')return {id:'mailer',label:'邮寄盒'}
  const hit=CATEGORY_MAP[String(raw||'').trim()]
  return hit||{id:'other',label:'其他'}
}

const sources=[]
if(existsSync(shippingCsv)){
  sources.push({
    csvPath:shippingCsv,
    forceCategory:'shipping',
    geomDirs:[shippingGeomDir,legacyGeomDir],
    coverRelPrefix:'shipping-covers',
    geomPublicPrefix:'shipping-geom',
  })
}
if(existsSync(mailerCsv)){
  sources.push({
    csvPath:mailerCsv,
    forceCategory:'mailer',
    geomDirs:[mailerGeomDir],
    coverRelPrefix:'mailer-covers',
    geomPublicPrefix:'mailer-geom',
  })
}
if(!sources.length&&existsSync(legacyCsv)){
  sources.push({
    csvPath:legacyCsv,
    forceCategory:'shipping',
    geomDirs:[legacyGeomDir],
    coverRelPrefix:'shipping-covers',
    geomPublicPrefix:'shipping-geom',
  })
}
if(!sources.length){
  console.error('missing shipping/mailer/legacy CSV')
  process.exit(1)
}

const presets=[]
const seen=new Set()
let skippedDim=0,missingGeom=0,mapped=0
const generatedFrom=[]

for(const src of sources){
  generatedFrom.push(src.csvPath.replace(root,'').replace(/^[/\\]/,''))
  const rows=parseCSV(readFileSync(src.csvPath,'utf8').replace(/^\uFEFF/,''))
  const h=rows[0]
  const idx=Object.fromEntries(h.map((k,i)=>[k.trim(),i]))
  const col=(r,name)=>r[idx[name]]

  for(const r of rows.slice(1)){
    if(!r||r.length<8)continue
    const num=String(col(r,'模型编号')||'').trim()
    // 同号可跨类目并存（运输箱 / 邮寄盒各自保留）
    const seenKey=`${src.forceCategory||'other'}:${num}`
    if(!num||seen.has(seenKey))continue
    seen.add(seenKey)

    const name=(col(r,'名称')||'').trim()
    const mockup=(col(r,'mockup名称')||'').trim()
    const innerL=Number(col(r,'内尺寸L'))
    const innerW=Number(col(r,'内尺寸W'))
    const innerH=Number(col(r,'内尺寸H'))
    const knifeL=Number(col(r,'刀版长mm'))
    const knifeW=Number(col(r,'刀版宽mm'))
    const knifeH=Number(col(r,'刀版高mm'))
    let L=innerL>0?innerL:knifeL
    let W=innerW>0?innerW:knifeW
    let H=innerH>0?innerH:knifeH
    // StarBox 金样 W=0 → 用 L；CanCylinder 允许 H=0
    if(L>0&&!(W>0)&&H>0)W=L
    if(!(L>0&&W>0&&H>=0)){skippedDim++;continue}

    const matName=col(r,'默认材质名')||''
    const geomPublicRel=`${src.geomPublicPrefix}/${num}.json`
    const geomPath=src.geomDirs.map(d=>join(d,`${num}.json`)).find(p=>existsSync(p))
    const hasGeometry=!!geomPath
    if(!hasGeometry)missingGeom++

    const templateId=mapTemplate(name,mockup,num)
    if(templateId)mapped++
    const category=mapCategory(col(r,'分类'),src.forceCategory)

    const label=((mockup||name).replace(/\s+mockup\s*$/i,'').replace(/\s+dieline\s*$/i,'').trim())||num
    presets.push({
      id:`import-${src.forceCategory||'box'}-${num}`,
      sourceNum:num,
      label,
      categoryId:category.id,
      categoryLabel:category.label,
      length:Math.round(L*1000)/1000,
      width:Math.round(W*1000)/1000,
      height:Math.round(H*1000)/1000,
      thickness:thicknessFromMaterial(matName),
      materialId:materialId(matName),
      templateId,
      hasGeometry,
      cutCount:Number(col(r,'切割段数'))||0,
      foldCount:Number(col(r,'折线段数'))||0,
      sheetW:Number(col(r,'展开宽'))||0,
      sheetH:Number(col(r,'展开高'))||0,
      geomRel:geomPublicRel,
      geomPublicRel,
      coverRel:`${src.coverRelPrefix}/${num}.png`
    })
  }
}

presets.sort((a,b)=>String(a.sourceNum).localeCompare(String(b.sourceNum),'en',{numeric:true}))
const byTemplate={},byCategory={}
for(const p of presets){
  const k=p.templateId||'unmapped'
  byTemplate[k]=(byTemplate[k]||0)+1
  byCategory[p.categoryId]=(byCategory[p.categoryId]||0)+1
}
const seenCat=new Set()
const categories=[]
for(const c of Object.values(CATEGORY_MAP)){
  if(seenCat.has(c.id))continue
  seenCat.add(c.id)
  const count=byCategory[c.id]||0
  if(count>0)categories.push({id:c.id,label:c.label,count})
}
if(byCategory.other)categories.push({id:'other',label:'其他',count:byCategory.other})

mkdirSync(outDir,{recursive:true})
const payload={
  schema:'boxcraft.presets.v1',
  note:'Imported SIZE directory (shipping + mailer). Geometry under public/*-geom is locked-sample playback reference, not production dielines. Engine regenerates via BOXCRAFT templates when no geom.',
  generatedFrom,
  count:presets.length,
  mapped,
  missingGeom,
  byTemplate,
  byCategory,
  categories,
  presets
}
writeFileSync(outPath,`/** auto-generated by scripts/build-presets-from-csv.mjs — do not edit */\nexport default ${JSON.stringify(payload,null,2)}\n`)
console.log(JSON.stringify({
  out:outPath,
  count:presets.length,
  mapped,
  unmapped:presets.length-mapped,
  skippedDim,
  missingGeom,
  byCategory,
  shippingGeomExists:existsSync(shippingGeomDir),
  mailerGeomExists:existsSync(mailerGeomDir),
  byTemplate
},null,2))
