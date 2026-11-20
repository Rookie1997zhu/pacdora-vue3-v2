/**
 * 生成「按尺寸插值」模板的数据：public/sampled/<类目>-<编号>.json + src/catalog/sampledIndex.js。
 *
 * 输入：public/<类目>-geom/<编号>.json（原始尺寸）与 docs/pacdora-multisize/<编号>_*.json（官方多尺寸样本，
 *       见 sample-size-grid.mjs）。验证样本（_a.._d、_v<n>）不参与插值。
 * 分段：刀版拓扑在某些尺寸会变（多一道锁扣之类）。原始尺寸所在的一段是主锚点；主锚点轴线上拓扑不同的
 *       每一段各出一个次锚点，各自带一组逐维样本（scripts/lib/sampledRegimes.mjs）。
 * 之后必须运行 validate-sampled-templates.mjs：它决定哪些盒型真正启用。
 * 用法：node scripts/build-sampled-templates.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {loadPoints,anchorData,secondaryCenters,trim} from './lib/sampledRegimes.mjs'
import {TEMPLATES} from '../src/templates/index.js'

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const SAMPLES=path.join(ROOT,'docs','pacdora-multisize')
const OUT=path.join(ROOT,'public','sampled')
const CATS=['folding','tray','mailer','shipping','gift','square']

// 采样范围之外退回原来的参数化模板（近似）：记下该预设现用的 spec-* 模板
const presetText=fs.readFileSync(path.join(ROOT,'src','catalog','presets.js'),'utf8')
const presetList=JSON.parse(presetText.replace(/^\/\*\*[\s\S]*?\*\/\s*export\s+default\s+/,'').trim()).presets||[]
function fallbackOf(cat,num){
  const p=presetList.find(x=>x.categoryId===cat&&String(x.sourceNum)===String(num))
  if(p?.templateId&&!String(p.templateId).startsWith('sampled-'))return p.templateId
  const old=path.join(OUT,`${cat}-${num}.json`)
  if(fs.existsSync(old)){try{return JSON.parse(fs.readFileSync(old,'utf8')).fallback||null}catch{return null}}
  return null
}
const csvHas=(cat,num)=>{
  const f=path.join(ROOT,'docs',`pacdora_${cat}_boxes`,`${cat}_boxes.csv`)
  return fs.existsSync(f)&&fs.readFileSync(f,'utf8').includes(`,${num},`)
}

const index={}
const report=[]
fs.mkdirSync(OUT,{recursive:true})
const files=fs.existsSync(SAMPLES)?fs.readdirSync(SAMPLES):[]
const nums=[...new Set(files.filter(f=>/_([LWH]\d|p\d)/.test(f)).map(f=>f.split('_')[0]))]
const fmt=r=>`L${r.L.join('–')} W${r.W.join('–')} H${r.H.join('–')}`

for(const num of nums){
  const cat=CATS.find(c=>fs.existsSync(path.join(ROOT,'public',`${c}-geom`,`${num}.json`))&&csvHas(c,num))
  if(!cat){report.push(`${num}: no category`);continue}
  const {base,grid}=loadPoints(ROOT,cat,num)
  // 多件盒：各件的面片名单取自原结构规格模板（改用插值模板后预设里已不是它，从旧数据里找回）
  const fb=fallbackOf(cat,num)
  const specPieces=TEMPLATES[fb]?.pieces
  const pieces=Array.isArray(specPieces)&&specPieces.length>1
    ?specPieces.map(p=>({id:p.id,label:p.label,role:p.role,faces:p.faces})):null
  // 多图层的多件盒（面纸 + 灰板的精装盒）：每个图层是一件；原规格只有灰板的天 / 地盖，
  // 超出采样范围退回时，各层对应到含有它面片的那一件（面纸跟着同名的灰板走）
  let layerPieces=null
  const layerNames=Object.keys(base.geom.layer||{}).filter(n=>Array.isArray(base.geom.layer[n]?.faces)&&base.geom.layer[n].faces.length)
  if(pieces&&layerNames.length>1){
    const info=base.geom.modeCate?.layerList||[]
    const order=info.map(l=>l?.name).filter(n=>layerNames.includes(n))
    const ordered=[...order,...layerNames.filter(n=>!order.includes(n))]
    const ownerOf=name=>{
      const faces=new Set(base.geom.layer[name].faces.map(f=>f.name))
      return pieces.find(p=>(p.faces||[]).some(f=>faces.has(f)))?.id||null
    }
    const direct=Object.fromEntries(ordered.map(n=>[n,ownerOf(n)]))
    const twin=n=>ordered.find(m=>m!==n&&direct[m]&&m.replace(/Greyboard|Facepaper/gi,'')===n.replace(/Greyboard|Facepaper/gi,''))
    layerPieces=ordered.map((name,i)=>{
      const meta=info.find(l=>l?.name===name)||{}
      return {id:`layer${i+1}`,label:String(meta.friendlyName||name),labelEn:String(meta.friendlyName_en||name),layer:name,
        fallbackPiece:direct[name]||(twin(name)?direct[twin(name)]:null)||pieces[0].id}
    })
  }
  const primary=anchorData(base,grid)
  // 次锚点：至少在另外两个维度之一上有可用范围（补采过样本）才有意义
  const anchors=[]
  for(const {center} of secondaryCenters(base,grid)){
    const a=anchorData(center,grid)
    const usable=['L','W','H'].filter(d=>a.dims[d].v.length>1).length
    if(usable>=2)anchors.push({baseKnife:a.baseKnife,range:a.range,dims:a.dims,base:a.base})
  }
  const data={
    schema:'boxcraft.sampled.v2',cat,num,
    name:base.geom.modeCate?.name||num,
    baseKnife:primary.baseKnife,
    baseInner:{L:Number(base.geom.size.L),W:Number(base.geom.size.W),H:Number(base.geom.size.H)},
    baseOuter:{L:Number(base.geom.outSize.L),W:Number(base.geom.outSize.W),H:Number(base.geom.outSize.H)},
    thickness:Number(base.geom.size.D)||0,
    fallback:fb,
    ...(layerPieces?{pieces:layerPieces}:(pieces?{pieces}:{})),
    range:primary.range,dims:primary.dims,base:primary.base,
    anchors,
  }
  const body=JSON.stringify(data)
  const key=`${cat}-${num}`
  fs.writeFileSync(path.join(OUT,`${key}.json`),body)
  index[key]=crypto.createHash('sha1').update(body).digest('hex').slice(0,10)
  // 同一编号在别的类目里若是同一份刀版（常见于邮寄盒 / 折叠盒重复收录），共用这组采样
  for(const other of CATS){
    if(other===cat)continue
    const f2=path.join(ROOT,'public',`${other}-geom`,`${num}.json`)
    if(!fs.existsSync(f2))continue
    if(JSON.stringify(trim(JSON.parse(fs.readFileSync(f2,'utf8'))).layer)!==JSON.stringify(base.geom.layer))continue
    const b2=JSON.stringify({...data,cat:other,fallback:fallbackOf(other,num)})
    fs.writeFileSync(path.join(OUT,`${other}-${num}.json`),b2)
    index[`${other}-${num}`]=crypto.createHash('sha1').update(b2).digest('hex').slice(0,10)
    report.push(`${other}-${num}: 与 ${key} 同一份刀版，共用采样`)
  }
  report.push(`${key}: 主段 ${fmt(primary.range)}${anchors.length?`；另有 ${anchors.length} 段 ${anchors.map(a=>fmt(a.range)).join(' | ')}`:''}, ${(body.length/1024).toFixed(0)}KB`)
}

fs.writeFileSync(path.join(ROOT,'src','catalog','sampledIndex.js'),`// generated by scripts/build-sampled-templates.mjs — do not edit\nexport default ${JSON.stringify(index,null,1)}\n`)
console.log(report.join('\n'))
console.log(`written ${Object.keys(index).length} sampled templates`)
