/**
 * 分段补采：刀版拓扑随尺寸变化的盒型，在「变了之后」的每一段里取一个锚点，补采它另外两条轴线上的样本
 * （主锚点那条轴线上的样本 sample-size-grid.mjs 已经取过）。每个锚点另取一个验证样本（_v<n>）。
 * 需要先跑过 sample-size-grid.mjs。样本存 docs/pacdora-multisize/<编号>_p<长>x<宽>x<高>.json。
 * 用法：node scripts/sample-regimes.mjs [--nums folding:103213,...] [--delay 1500]
 *       不带 --nums 时处理 docs/按尺寸插值_盒型结论.json 里的全部盒型。
 */
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {loadPoints,secondaryCenters,neededPoints,pointName,DIMS} from './lib/sampledRegimes.mjs'

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const arg=(k,d)=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:d}
const DELAY=Number(arg('--delay',1500))
const OUT_DIR=path.join(ROOT,'docs','pacdora-multisize')
const BASE='https://www.pacdora.com'

function listIdOf(cat,num){
  const f=path.join(ROOT,'docs',`pacdora_${cat}_boxes`,`${cat}_boxes.csv`)
  if(!fs.existsSync(f))return null
  const lines=fs.readFileSync(f,'utf8').replace(/^﻿/,'').split(/\r?\n/)
  const head=lines[0].split(',')
  const iNum=head.indexOf('模型编号'),iId=head.indexOf('列表id')
  for(const line of lines.slice(1)){const c=line.split(',');if(c[iNum]===String(num))return c[iId]}
  return null
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

let targets
const numsArg=arg('--nums','')
if(numsArg)targets=numsArg.split(',').map(s=>s.split(':'))
else targets=Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT,'docs','按尺寸插值_盒型结论.json'),'utf8'))).map(k=>{const i=k.indexOf('-');return [k.slice(0,i),k.slice(i+1)]})

let fetched=0,failed=0
const done=new Set()
for(const [cat,num] of targets){
  if(done.has(num))continue
  done.add(num)
  const listId=listIdOf(cat,num)
  if(!listId)continue
  const {base,grid,limits}=loadPoints(ROOT,cat,num)
  const centers=secondaryCenters(base,grid)
  if(!centers.length)continue
  const jobs=neededPoints(base,centers,limits).map(p=>({p,file:`${num}_${pointName(p)}.json`}))
  // 每个锚点一个验证样本：另外两个维度一个 +15%、一个 −10%
  centers.forEach(({center,dim},i)=>{
    const [d1,d2]=DIMS.filter(d=>d!==dim)
    const clamp=(d,v)=>Math.max(limits[d][0],Math.min(limits[d][1],Math.round(v)))
    jobs.push({p:{...center.k,[d1]:clamp(d1,center.k[d1]*1.15),[d2]:clamp(d2,center.k[d2]*0.9)},file:`${num}_v${i+1}.json`})
  })
  for(const {p,file} of jobs){
    const out=path.join(OUT_DIR,file)
    if(fs.existsSync(out))continue
    try{
      const data=await api(`${BASE}/api/v2/project/knife?id=${listId}&bleed=5&export_type=model&length=${p.L}&width=${p.W}&height=${p.H}`)
      fs.writeFileSync(out,JSON.stringify(data))
      fetched++
    }catch(e){
      failed++
      console.log(num,file,'FAILED',String(e?.message||e).slice(0,60))
    }
    await sleep(DELAY)
  }
  console.log(cat,num,`${centers.length} 段`,centers.map(c=>c.dim+c.center.k[c.dim]).join('/'),'done')
}

// ---- 二分收窄：主锚点轴线上相邻两个采样点拓扑不同，变化点就在它们之间。反复取中点，直到间隔 ≤ 2mm。
// 这样两段之间「哪一段都不覆盖」的空隙从十几毫米缩到约 2mm。
if(process.argv.includes('--bisect')){
  const seen=new Set()
  for(const [cat,num] of targets){
    if(seen.has(num))continue
    seen.add(num)
    const listId=listIdOf(cat,num)
    if(!listId)continue
    if(!secondaryCenters(loadPoints(ROOT,cat,num).base,loadPoints(ROOT,cat,num).grid).length)continue
    for(let round=0;round<5;round++){
      const {base,grid}=loadPoints(ROOT,cat,num)
      const jobs=[]
      for(const dim of DIMS){
        const others=DIMS.filter(d=>d!==dim)
        const line=[base,...grid].filter(p=>others.every(d=>Math.abs(p.k[d]-base.k[d])<0.05)).sort((a,b)=>a.k[dim]-b.k[dim])
        for(let i=0;i<line.length-1;i++){
          const a=line[i],b=line[i+1]
          if(a.sig===b.sig||b.k[dim]-a.k[dim]<=2)continue
          const mid=Math.round((a.k[dim]+b.k[dim])/2)
          if(mid<=a.k[dim]||mid>=b.k[dim])continue
          jobs.push({...base.k,[dim]:mid})
        }
      }
      if(!jobs.length)break
      for(const p of jobs){
        const out=path.join(OUT_DIR,`${num}_${pointName(p)}.json`)
        if(fs.existsSync(out))continue
        try{
          const data=await api(`${BASE}/api/v2/project/knife?id=${listId}&bleed=5&export_type=model&length=${p.L}&width=${p.W}&height=${p.H}`)
          fs.writeFileSync(out,JSON.stringify(data))
          fetched++
        }catch(e){failed++;console.log(num,pointName(p),'FAILED',String(e?.message||e).slice(0,60))}
        await sleep(DELAY)
      }
    }
    console.log(cat,num,'bisect done')
  }
}
console.log(`fetched ${fetched}, failed ${failed}`)
