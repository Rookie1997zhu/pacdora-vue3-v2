/**
 * 只读：解析 StarBox* 金样 dlist，输出角数/面数/半径线索。
 */
import {readFileSync,existsSync,writeFileSync,mkdirSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')
const samples=[
  ['StarBoxOne','18203001'],
  ['StarBoxTwo','18203002'],
  ['StarBoxThree','18203003'],
  ['StarBoxFour','18203004'],
  ['StarBoxFive','18203005'],
  ['StarBoxSix','18203006'],
  ['StarBox','182030'],
  ['StarBoxSeven','18203007'],
  ['StarBoxEight','18203008']
]

function verts(dlist){
  return (dlist||[]).filter(p=>p&&p.mtd&&p.mtd!=='Z').map(p=>({x:Number(p.x),y:Number(p.y)}))
}

function bbox(vs){
  if(!vs.length)return null
  const xs=vs.map(v=>v.x),ys=vs.map(v=>v.y)
  return {minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys),
    w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)}
}

const lines=[]
for(const [code,num] of samples){
  const p=join(root,'geometry','pacdora_boxes',`${num}.json`)
  if(!existsSync(p)){lines.push(`${code} ${num} MISSING`);continue}
  const g=JSON.parse(readFileSync(p,'utf8'))
  const faces=g.layer?.traditional?.faces||[]
  const ks=g.knifeSize||{}
  const names=faces.map(f=>f.name)
  const groups={}
  for(const n of names){
    const m=n.match(/^([A-Za-z]+)/)
    const k=m?m[1]:n
    groups[k]=(groups[k]||0)+1
  }
  // L/M/R 通常是星形底/墙相关；数 HS/FS/HL 推角数
  const hs=(names.filter(n=>/^HS\d/.test(n)).length)
  const fs=(names.filter(n=>/^FS\d/.test(n)).length)
  const hl=(names.filter(n=>/^HL\d/.test(n)).length)
  const pGuess=Math.max(hs,fs,Math.round((faces.length-7)/6))
  const main=faces.find(f=>f.name==='M')||faces[0]
  const mb=bbox(verts(main?.dlist))
  const all=faces.flatMap(f=>verts(f.dlist))
  const sheet=bbox(all)
  const row={
    code,num,L:ks.L,W:ks.W,H:ks.H,
    faceCount:faces.length,formula:`6p+7=${6*pGuess+7}`,
    pGuess,hs,fs,hl,groups,
    mainBBox:mb,sheetW:sheet?.w,sheetH:sheet?.h,
    openParams:(g.openParams||[]).map(x=>`${x.name}=${x.value}`)
  }
  lines.push(JSON.stringify(row))
  console.log(`${code} faces=${faces.length} p~${pGuess} 6p+7=${6*pGuess+7} L=${ks.L} H=${ks.H} sheet=${sheet?.w?.toFixed?.(1)}x${sheet?.h?.toFixed?.(1)} groups=${JSON.stringify(groups)}`)
}

const outDir=join(root,'structure_inventory')
mkdirSync(outDir,{recursive:true})
writeFileSync(join(outDir,'14_StarBox分析.jsonl'),lines.join('\n')+'\n')
console.log('wrote structure_inventory/14_StarBox分析.jsonl')
