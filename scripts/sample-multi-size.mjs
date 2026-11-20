/**
 * 多尺寸采样：对若干主力盒型，在原始尺寸之外再取几组尺寸的官方刀版，与我们按同一尺寸推算出来的
 * 刀版比较，检验「改尺寸后是否仍然准确」。
 *
 * 样本保存在 docs/pacdora-multisize/<编号>_<组>.json，已存在的不重复请求。
 * 用法：node scripts/sample-multi-size.mjs [--count 10 | --all | --nums folding:110360,…] [--delay 1500] [--offline] [--out 文件.csv]
 * 输出：docs/多尺寸采样比对结果.csv
 */
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {TEMPLATES} from '../src/templates/index.js'
import {PRESETS} from '../src/catalog/index.js'
import {measure,gradeOf,sampleInput,presetParams} from './check-pacdora-fidelity.mjs'

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const arg=(k,d)=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:d}
const COUNT=Number(arg('--count',10))
const DELAY=Number(arg('--delay',1500))
const OFFLINE=process.argv.includes('--offline')
const OUT_DIR=path.join(ROOT,'docs','pacdora-multisize')
const BASE='https://www.pacdora.com'
const CATS={折叠盒:'folding',托盘盒:'tray',邮寄盒:'mailer',运输箱:'shipping',礼盒:'gift',方形盒:'square'}
/** 每组：对制造尺寸 (L, W, H) 的缩放 */
const VARIANTS=[
  {key:'d',label:'整体放大 1.1 倍',k:[1.1,1.1,1.1]},
  {key:'a',label:'整体放大 1.3 倍',k:[1.3,1.3,1.3]},
  {key:'b',label:'加长收窄 (L×1.5, W×0.8)',k:[1.5,0.8,1]},
  {key:'c',label:'缩短加高 (L×0.8, W×1.2, H×1.5)',k:[0.8,1.2,1.5]},
]

function csvRows(file){
  const text=fs.readFileSync(file,'utf8').replace(/^﻿/,'')
  const rows=[]
  for(const line of text.split(/\r?\n/)){
    if(!line)continue
    const cells=[];let cur='',q=false
    for(let i=0;i<line.length;i++){
      const ch=line[i]
      if(ch==='"'){if(q&&line[i+1]==='"'){cur+='"';i++}else q=!q}
      else if(ch===','&&!q){cells.push(cur);cur=''}
      else cur+=ch
    }
    cells.push(cur)
    rows.push(cells)
  }
  const head=rows.shift()
  return rows.map(r=>Object.fromEntries(head.map((h,i)=>[h,r[i]])))
}

// ---- 选盒：主力清单里按类目配额、可调参数多的优先
const main=csvRows(path.join(ROOT,'docs','主力盒型清单.csv'))
const quota={折叠盒:4,托盘盒:2,礼盒:1,方形盒:1,邮寄盒:1,运输箱:1}
const picks=[]
for(const [cat,n] of Object.entries(quota)){
  const list=main.filter(r=>r['类目']===cat).sort((a,b)=>Number(b['可调参数个数'])-Number(a['可调参数个数']))
  picks.push(...list.slice(0,n))
}
picks.splice(COUNT)
// --all：主力清单里的全部盒型（验证样本）
if(process.argv.includes('--all')){picks.length=0;picks.push(...main)}
// --nums folding:110360,tray:120035：指定盒型（不必在主力清单里）
if(arg('--nums','')){
  const zh=Object.fromEntries(Object.entries(CATS).map(([k,v])=>[v,k]))
  picks.length=0
  for(const s of arg('--nums','').split(',')){
    const [cat,num]=s.split(':')
    const p=PRESETS.find(x=>x.categoryId===cat&&String(x.sourceNum)===num)
    picks.push({类目:zh[cat],编号:num,名称:p?.labelEn||p?.label||'',结构代码:p?.structureCode||''})
  }
}

const listIdOf=(cat,num)=>{
  const f=path.join(ROOT,'docs',`pacdora_${cat}_boxes`,`${cat}_boxes.csv`)
  if(!fs.existsSync(f))return null
  const row=csvRows(f).find(r=>r['模型编号']===String(num))
  return row?row['列表id']:null
}

let cookie=''
async function api(url){
  if(!cookie){
    const r=await fetch(`${BASE}/api/v2/users/experience_user`,{headers:{'User-Agent':'Mozilla/5.0'}})
    cookie=(r.headers.getSetCookie?.()||[]).map(c=>c.split(';')[0]).join('; ')
    await r.text()
  }
  const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0',Cookie:cookie}})
  if(!r.ok)throw new Error(`HTTP ${r.status}`)
  const j=await r.json()
  if(j.code!==200||!j.data?.layer)throw new Error(`api code ${j.code} ${j.msg||''}`)
  return j.data
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const clampTo=(v,limit)=>{
  const m=/^\s*([\d.]+)\s*,\s*([\d.]+)/.exec(String(limit||''))
  return m?Math.max(Number(m[1]),Math.min(Number(m[2]),v)):v
}

fs.mkdirSync(OUT_DIR,{recursive:true})
const results=[]
for(const pick of picks){
  const cat=CATS[pick['类目']]
  const num=pick['编号']
  const preset=PRESETS.find(p=>p.categoryId===cat&&String(p.sourceNum)===num)
  const base=JSON.parse(fs.readFileSync(path.join(ROOT,'public',`${cat}-geom`,`${num}.json`),'utf8'))
  const listId=listIdOf(cat,num)
  if(!preset||!listId||!TEMPLATES[preset.templateId]){results.push({num,cat,error:'missing preset / list id / template'});continue}
  const ks=base.knifeSize||{}
  for(const v of VARIANTS){
    const want=[
      clampTo(Math.round(Number(ks.L)*v.k[0]),base.modeCate?.lengthLimit),
      clampTo(Math.round(Number(ks.W)*v.k[1]),base.modeCate?.widthLimit),
      clampTo(Math.round(Number(ks.H)*v.k[2]),base.modeCate?.heightLimit),
    ]
    const file=path.join(OUT_DIR,`${num}_${v.key}.json`)
    const row={类目:pick['类目'],编号:num,名称:pick['名称'],结构代码:pick['结构代码'],尺寸组:v.label,制造尺寸:want.join('×')}
    try{
      if(!fs.existsSync(file)){
        if(OFFLINE)throw new Error('sample not downloaded')
        const data=await api(`${BASE}/api/v2/project/knife?id=${listId}&bleed=5&export_type=model&length=${want[0]}&width=${want[1]}&height=${want[2]}`)
        fs.writeFileSync(file,JSON.stringify(data))
        await sleep(DELAY)
      }
      const geom=JSON.parse(fs.readFileSync(file,'utf8'))
      const got=geom.knifeSize||{}
      row.官方实际尺寸=[got.L,got.W,got.H].join('×')
      const input=sampleInput(geom)
      // ① 用户改尺寸后实际看到的：结构参数沿用我们的默认值
      const ours=measure(preset.templateId,geom,{...input,params:presetParams(preset)})
      // ② 把官方在该尺寸下给出的结构参数值代进去：只看推算公式本身
      const sampleParams={}
      for(const group of geom.openParams||[])for(const it of group||[])if(it?.name)sampleParams[it.name]=[it.value]
      const fair=measure(preset.templateId,geom,{...input,params:presetParams({templateId:preset.templateId,openParams:sampleParams})})
      const pct=x=>x==null?'':(x*100).toFixed(1)+'%'
      const sheet=m=>m.error?'':pct(Math.max(m.sheetWErr,m.sheetHErr))
      // 官方的结构参数默认值是否随尺寸变了
      const baseParams={}
      for(const group of base.openParams||[])for(const it of group||[])if(it?.name)baseParams[it.name]=it.value
      const moved=Object.entries(sampleParams).filter(([k,val])=>baseParams[k]!=null&&Math.abs(Number(val[0])-Number(baseParams[k]))>0.01).map(([k,val])=>`${k}:${baseParams[k]}→${val[0]}`)
      Object.assign(row,{
        默认参数_等级:ours.error?`错误 ${ours.error}`:gradeOf(ours),
        默认参数_展开尺寸偏差:sheet(ours),
        默认参数_切线长度偏差:ours.error?'':pct(ours.cutErr),
        默认参数_面片数:ours.error?'':`${ours.faces}/${ours.refFaces}`,
        官方参数_等级:fair.error?`错误 ${fair.error}`:gradeOf(fair),
        官方参数_展开尺寸偏差:sheet(fair),
        官方参数_切线长度偏差:fair.error?'':pct(fair.cutErr),
        官方参数随尺寸变化:moved.join(' ')||'无',
      })
    }catch(e){
      row.默认参数_等级=`失败 ${String(e?.message||e).slice(0,60)}`
    }
    results.push(row)
    console.log(row.编号,v.key,row.制造尺寸,'| 默认',row.默认参数_等级,row.默认参数_展开尺寸偏差||'','| 官方参数',row.官方参数_等级||'',row.官方参数_展开尺寸偏差||'','|',(row.官方参数随尺寸变化||'').slice(0,70))
  }
}

const cols=['类目','编号','名称','结构代码','尺寸组','制造尺寸','官方实际尺寸','默认参数_等级','默认参数_展开尺寸偏差','默认参数_切线长度偏差','默认参数_面片数','官方参数_等级','官方参数_展开尺寸偏差','官方参数_切线长度偏差','官方参数随尺寸变化']
const cell=v=>{const s=String(v??'');return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s}
fs.writeFileSync(arg('--out','')?path.resolve(arg('--out','')):path.join(ROOT,'docs','多尺寸采样比对结果.csv'),'﻿'+[cols.join(',')].concat(results.map(r=>cols.map(c=>cell(r[c])).join(','))).join('\n'))
const tally=k=>results.reduce((a,r)=>{const g=String(r[k]||'').slice(0,1);a[g]=(a[g]||0)+1;return a},{})
console.log('\n默认参数',tally('默认参数_等级'),'官方参数',tally('官方参数_等级'))
