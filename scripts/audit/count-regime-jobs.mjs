/**
 * Dry run of sample-regimes.mjs: for every box that is not enabled, how many secondary anchors
 * it has and how many samples are still missing. No network access.
 *   node scripts/audit/count-regime-jobs.mjs [maxSegments]
 * Prints a histogram and the cat:num list of boxes with at most maxSegments (default 5) anchors.
 */
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {loadPoints,secondaryCenters,neededPoints,pointName} from '../lib/sampledRegimes.mjs'
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..')
const DIR=path.join(ROOT,'docs','pacdora-multisize')
const MAX=Number(process.argv[2]||5)
const verdict=JSON.parse(fs.readFileSync(path.join(ROOT,'docs','按尺寸插值_盒型结论.json'),'utf8'))
const rows=[],seen=new Set()
for(const [key,v] of Object.entries(verdict)){
  if(v.ok)continue
  const i=key.indexOf('-'),cat=key.slice(0,i),num=key.slice(i+1)
  if(seen.has(num))continue
  seen.add(num)
  let pts
  try{pts=loadPoints(ROOT,cat,num)}catch{continue}
  const centers=secondaryCenters(pts.base,pts.grid)
  const missing=neededPoints(pts.base,centers,pts.limits).filter(p=>!fs.existsSync(path.join(DIR,`${num}_${pointName(p)}.json`))).length
    +centers.filter((_,n)=>!fs.existsSync(path.join(DIR,`${num}_v${n+1}.json`))).length
  rows.push({cat,num,segs:centers.length,missing})
}
const hist={}
for(const r of rows){const b=r.segs===0?'0':r.segs<=2?'1-2':r.segs<=5?'3-5':r.segs<=10?'6-10':'11+';(hist[b]=hist[b]||{boxes:0,missing:0});hist[b].boxes++;hist[b].missing+=r.missing}
console.log(JSON.stringify(hist))
const pick=rows.filter(r=>r.segs>0&&r.segs<=MAX&&r.missing>0)
console.log(`<=${MAX} segments with missing samples: ${pick.length} boxes, ${pick.reduce((s,r)=>s+r.missing,0)} samples`)
console.log(pick.map(r=>`${r.cat}:${r.num}`).join(','))
