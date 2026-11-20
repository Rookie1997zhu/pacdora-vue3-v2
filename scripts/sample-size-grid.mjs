/**
 * 逐维采样：对指定盒型，每次只改长 / 宽 / 高中的一个维度，取官方在该尺寸下的刀版。
 * 这些样本是「按尺寸插值」模板（src/templates/sampled）的数据来源，见 build-sampled-templates.mjs。
 *
 * 样本存为 docs/pacdora-multisize/<编号>_<L|W|H><倍数>.json，已存在的不重复请求。
 * 用法：node scripts/sample-size-grid.mjs --nums folding:103213,tray:120080 [--delay 1500]
 *       不带 --nums 时取 docs/pacdora-multisize 里已有混合样本（_a/_b/_c/_d）的那些盒型。
 */
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const arg=(k,d)=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:d}
const DELAY=Number(arg('--delay',1500))
const OUT_DIR=path.join(ROOT,'docs','pacdora-multisize')
const BASE='https://www.pacdora.com'
const CATS=['folding','tray','mailer','shipping','gift','square']
export const FACTORS=[0.7,0.85,1.15,1.3,1.6]

function listIdOf(cat,num){
  const f=path.join(ROOT,'docs',`pacdora_${cat}_boxes`,`${cat}_boxes.csv`)
  if(!fs.existsSync(f))return null
  const lines=fs.readFileSync(f,'utf8').replace(/^﻿/,'').split(/\r?\n/)
  const head=lines[0].split(',')
  const iNum=head.indexOf('模型编号'),iId=head.indexOf('列表id')
  for(const line of lines.slice(1)){
    const c=line.split(',')
    if(c[iNum]===String(num))return c[iId]
  }
  return null
}
const catOf=num=>CATS.find(c=>fs.existsSync(path.join(ROOT,'public',`${c}-geom`,`${num}.json`))&&listIdOf(c,num))

let targets=[]
const numsArg=arg('--nums','')
if(numsArg)targets=numsArg.split(',').map(s=>{const [a,b]=s.split(':');return b?{cat:a,num:b}:{cat:catOf(a),num:a}})
else{
  const nums=[...new Set(fs.readdirSync(OUT_DIR).filter(f=>/_[a-d]\.json$/.test(f)).map(f=>f.split('_')[0]))]
  targets=nums.map(num=>({cat:catOf(num),num}))
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
const limitOf=s=>{const m=/^\s*([\d.]+)\s*,\s*([\d.]+)/.exec(String(s||''));return m?[Number(m[1]),Number(m[2])]:[0,Infinity]}

fs.mkdirSync(OUT_DIR,{recursive:true})
let fetched=0,failed=0
for(const {cat,num} of targets){
  if(!cat){console.log(num,'no category / list id');continue}
  const listId=listIdOf(cat,num)
  const base=JSON.parse(fs.readFileSync(path.join(ROOT,'public',`${cat}-geom`,`${num}.json`),'utf8'))
  const ks=base.knifeSize
  const lim={L:limitOf(base.modeCate?.lengthLimit),W:limitOf(base.modeCate?.widthLimit),H:limitOf(base.modeCate?.heightLimit)}
  const seen=new Set()
  for(const dim of ['L','W','H']){
    for(const f of FACTORS){
      const v=Math.max(lim[dim][0],Math.min(lim[dim][1],Math.round(Number(ks[dim])*f)))
      if(Math.abs(v-Number(ks[dim]))<0.5||seen.has(dim+v))continue
      seen.add(dim+v)
      const file=path.join(OUT_DIR,`${num}_${dim}${v}.json`)
      if(fs.existsSync(file))continue
      const size={L:Number(ks.L),W:Number(ks.W),H:Number(ks.H),[dim]:v}
      try{
        const data=await api(`${BASE}/api/v2/project/knife?id=${listId}&bleed=5&export_type=model&length=${size.L}&width=${size.W}&height=${size.H}`)
        fs.writeFileSync(file,JSON.stringify(data))
        fetched++
      }catch(e){
        failed++
        console.log(num,dim,v,'FAILED',String(e?.message||e).slice(0,60))
      }
      await sleep(DELAY)
    }
  }
  console.log(cat,num,'done')
}
console.log(`fetched ${fetched}, failed ${failed}`)
