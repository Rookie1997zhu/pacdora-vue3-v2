/**
 * 视觉对照闭环：金样 2D / 本仓 2D（出血+次环）/ 3D 缩略图；关单写 CSV。
 * 用法：node scripts/audit/visual-compare.mjs [--skip-shot] [--no-3d]
 * 3D 栏依赖 vite dev（localhost:5173）；未启动则写「未截 3D」。
 */
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'
import {tmpdir} from 'node:os'
import {createKnife} from '../../src/knife.js'
import presets from '../../src/catalog/presets.js'
import {getTemplate} from '../../src/templates/index.js'
import {pickCompileLayer} from '../lib/pickCompileLayer.mjs'

const root=join(dirname(fileURLToPath(import.meta.url)),'..','..')
const geomDir=join(root,'geometry','pacdora_boxes')
const outDir=join(root,'未映射名单')
const csvPath=join(outDir,'20_视觉对照问题清单.csv')
const compileCsv=join(outDir,'17_结构规格编译.csv')
const shotDir=join(tmpdir(),'boxaudit')
mkdirSync(shotDir,{recursive:true})
mkdirSync(outDir,{recursive:true})

const SKIP_SHOT=process.argv.includes('--skip-shot')
const NO_3D=process.argv.includes('--no-3d')
const EDGE=[
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].find(p=>existsSync(p))

const SAMPLES=[
  {num:'100011',cat:'curve',note:'曲线插舌 PairWithLock'},
  {num:'100014',cat:'curve',note:'开窗插口'},
  {num:'112290',cat:'curve',note:'带孔提手'},
  {num:'315303',cat:'cylinder',note:'圆筒生日礼盒'},
  {num:'513790',cat:'cylinder',note:'白圆筒'},
  {num:'500771',cat:'cylinder',note:'Tube'},
  {num:'362011',cat:'sleeveDrawer',note:'抽屉袖套香水盒'},
  {num:'36201101',cat:'sleeveDrawer',note:'抽屉袖套变体'},
  {num:'177010',cat:'multiPiece',note:'三件 LongHookShelf'},
  {num:'128023',cat:'multiPiece',note:'四件缓冲盘'},
  {num:'362080',cat:'multiPiece',note:'三件 Boutique 半开'},
  {num:'501202',cat:'modelOnly',note:'塑料食品盒'},
  {num:'550120',cat:'cylinder',note:'粉盒改挂圆筒'},
  {num:'128010',cat:'takeover',note:'Bufferwall REA接管'},
  {num:'161012',cat:'takeover',note:'CoverBasset REA接管'},
  {num:'170311',cat:'takeover',note:'展示盒 REA接管'},
  {num:'184110',cat:'takeover',note:'双开门 REA接管'},
  {num:'100210',cat:'multiPiece',note:'三件 MultiPiecePlugLock'},
  {num:'160010',cat:'telescoping',note:'天地盖成套'},
  {num:'112470',cat:'curve',note:'提手 REA'},
  {num:'18700001',cat:'curve',note:'CurveBox'},
  {num:'105210',cat:'curve',note:'撕拉自锁'},
  {num:'200010',cat:'rea',note:'Carton 0201'},
  {num:'150010',cat:'rea',note:'飞机盒'},
]

function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;')}
function csvEsc(s){const t=String(s??'');return /[",\n]/.test(t)?`"${t.replace(/"/g,'""')}"`:t}

function pathFromCmds(cmds){
  if(!Array.isArray(cmds))return ''
  const parts=[]
  for(const c of cmds){
    if(!c)continue
    if(c.mtd==='M')parts.push(`M ${c.x} ${c.y}`)
    else if(c.mtd==='L')parts.push(`L ${c.x} ${c.y}`)
    else if(c.mtd==='A')parts.push(`A ${c.rx||0} ${c.ry||0} ${c.ang||0} ${c.arc?1:0} ${c.dir??1} ${c.x} ${c.y}`)
    else if(c.mtd==='Q')parts.push(`Q ${c.cx} ${c.cy} ${c.x} ${c.y}`)
    else if(c.mtd==='C')parts.push(`C ${c.cx1??c.cx} ${c.cy1??c.cy} ${c.cx2??c.cx} ${c.cy2??c.cy} ${c.x} ${c.y}`)
    else if(c.mtd==='Z')parts.push('Z')
  }
  return parts.join(' ')
}

function loopPath(pts){
  if(!pts?.length)return ''
  return pts.map((p,i)=>`${i?'L':'M'} ${p[0]} ${p[1]}`).join(' ')+' Z'
}

function pacdoraSvg(j){
  const ly=pickCompileLayer(j)||j.layer?.traditional||Object.values(j.layer||{})[0]
  if(!ly)return '<svg xmlns="http://www.w3.org/2000/svg"><text x="20" y="40">no layer</text></svg>'
  const faces=ly.faces||[],folds=ly.folds||[],holes=ly.holes||[]
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity
  for(const f of faces){
    for(const s of f.dlist||[]){
      if(!Number.isFinite(s.x)||!Number.isFinite(s.y))continue
      minX=Math.min(minX,s.x);minY=Math.min(minY,s.y)
      maxX=Math.max(maxX,s.x);maxY=Math.max(maxY,s.y)
    }
  }
  if(!Number.isFinite(minX)){minX=0;minY=0;maxX=100;maxY=100}
  const pad=20,w=maxX-minX+2*pad,h=maxY-minY+2*pad
  const paths=[]
  for(const f of faces)paths.push(`<path d="${esc(pathFromCmds(f.dlist))}" fill="#f5e6d3" stroke="#2028b0" stroke-width="1.2"/>`)
  for(const fo of folds)paths.push(`<line x1="${fo.x1}" y1="${fo.y1}" x2="${fo.x2}" y2="${fo.y2}" stroke="#fa0000" stroke-width="1" stroke-dasharray="4 3"/>`)
  for(const hole of holes){
    const cmds=Array.isArray(hole)?hole:(hole.dlist||[])
    if(cmds.length)paths.push(`<path d="${esc(pathFromCmds(cmds))}" fill="none" stroke="#2028b0" stroke-width="1"/>`)
  }
  return {svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX-pad} ${minY-pad} ${w} ${h}" width="480" height="400">${paths.join('')}</svg>`,bbox:{w:maxX-minX,h:maxY-minY}}
}

function knifeSvg(knife){
  const b=knife.bounds,pad=20
  const vb=`${b.minX-pad} ${b.minY-pad} ${b.maxX-b.minX+2*pad} ${b.maxY-b.minY+2*pad}`
  const bleed=knife.bleedPath?`<path d="${esc(knife.bleedPath)}" fill="none" stroke="#46ba00" stroke-width="1.4" opacity=".75"/>`:''
  const extras=(knife.cutExtraLoops||[]).map((loop,i)=>
    `<path d="${esc(loopPath(loop))}" fill="none" stroke="#c45c00" stroke-width="1.4" stroke-dasharray="4 2" data-extra="${i}"/>`
  ).join('')
  const folds=(knife.folds||[]).map(f=>`<line x1="${f.x1}" y1="${f.y1}" x2="${f.x2}" y2="${f.y2}" stroke="#fa0000" stroke-width="1.2" stroke-dasharray="5 3"/>`).join('')
  const holes=(knife.holes||[]).map(h=>`<path d="${esc(h.path)}" fill="none" stroke="#2028b0" stroke-width="1"/>`).join('')
  const cut=`<path d="${esc(loopPath(knife.cutLoop))}" fill="#f5e6d3" stroke="#2028b0" stroke-width="1.6"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="480" height="400">${bleed}${cut}${extras}${folds}${holes}</svg>`
}

function shotFile(file,html,{w=1500,h=560}={}){
  if(SKIP_SHOT||!EDGE)return null
  const htmlPath=join(shotDir,`${file}.html`)
  writeFileSync(htmlPath,html,'utf8')
  const png=join(shotDir,`${file}.png`)
  spawnSync(EDGE,['--headless=new','--disable-gpu',`--window-size=${w},${h}`,`--screenshot=${png}`,`file:///${htmlPath.replace(/\\/g,'/')}`],{stdio:'ignore',timeout:30000})
  return existsSync(png)?png:null
}

function viteUp(){
  if(NO_3D)return false
  try{
    const r=spawnSync('curl',['-s','-o','NUL','-w','%{http_code}','http://127.0.0.1:5173/'],{encoding:'utf8',timeout:3000})
    return String(r.stdout||'').trim()==='200'
  }catch{return false}
}

function shot3d(tid){
  if(!EDGE||!tid||NO_3D||!viteUp())return null
  // 通过 vite 提供的 audit thumb 页面；若静态路径不可用，用 query 直开源文件需 vite
  const url=`http://127.0.0.1:5173/scripts/audit/thumb-page.html?templateId=${encodeURIComponent(tid)}&size=360`
  const png=join(shotDir,`thumb-${tid.replace(/[^\w.-]+/g,'_')}.png`)
  spawnSync(EDGE,['--headless=new','--disable-gpu','--window-size=420,440',`--screenshot=${png}`,url],{stdio:'ignore',timeout:45000})
  return existsSync(png)?png:null
}

/** 读取旧 CSV：保留 wontfix / 人工备注 */
function loadPrev(){
  if(!existsSync(csvPath))return new Map()
  const lines=readFileSync(csvPath,'utf8').trim().split(/\r?\n/).slice(1)
  const map=new Map()
  for(const line of lines){
    // sourceNum,类别,问题,严重度,归属项,status,备注
    const m=line.match(/^(?:([^,]*),([^,]*),(?:"((?:[^"]|"")*)"|([^,]*)),([^,]*),([^,]*),([^,]*),(.*))$/)
    if(!m)continue
    const sourceNum=m[1],cat=m[2],problem=(m[3]?m[3].replace(/""/g,'"'):m[4])||'',sev=m[5],own=m[6],status=m[7],note=(m[8]||'').replace(/^"|"$/g,'')
    const key=`${sourceNum}|${problem}`
    map.set(key,{sourceNum,cat,problem,sev,own,status,note})
  }
  return map
}

function loadCompileOk(){
  const set=new Set()
  if(!existsSync(compileCsv))return set
  for(const line of readFileSync(compileCsv,'utf8').trim().split(/\r?\n/).slice(1)){
    const [code,sample,presetsN,status]=line.split(',')
    if(status==='ok'&&sample)set.add(String(sample))
  }
  return set
}

const byNum=Object.fromEntries((presets.presets||[]).map(p=>[String(p.sourceNum),p]))
const prev=loadPrev()
const compileOk=loadCompileOk()
const hasVite=viteUp()
const issues=[] // rows
const summary=[]
const indexCards=[]

for(const s of SAMPLES){
  const p=byNum[s.num]
  const geomFile=join(geomDir,`${s.num}.json`)
  const found=[]
  if(!existsSync(geomFile)){
    found.push({problem:'geometry missing',sev:'high',own:'3'})
    continue
  }
  const j=JSON.parse(readFileSync(geomFile,'utf8'))
  const pac=pacdoraSvg(j)
  let ourSvg='<svg xmlns="http://www.w3.org/2000/svg"><text x="20" y="40">no template</text></svg>'
  let knife=null
  let thumbHtml='<div class="ph">未截 3D</div>'
  if(p?.templateId){
    try{
      knife=createKnife({
        templateId:p.templateId,
        length:p.length||100,width:p.width||80,height:Math.max(p.height||40,1),
        thickness:p.thickness||1.5,bleed:3,materialId:'kraft',
        piece:p.templateId==='sleeve-drawer'?'drawer':(p.templateId==='cylinder-box'||p.templateId==='lid-base'?'bottom':undefined)
      })
      ourSvg=knifeSvg(knife)
    }catch(e){
      found.push({problem:`createKnife fail: ${String(e.message||e).slice(0,80)}`,sev:'high',own:'2'})
    }
  }else{
    found.push({problem:'未挂模板',sev:'high',own:'3'})
  }

  // 3D
  let thumbPng=null
  if(p?.templateId&&!p.modelOnly){
    thumbPng=shot3d(p.templateId)
    if(thumbPng)thumbHtml=`<img src="file:///${thumbPng.replace(/\\/g,'/')}" width="360" height="360" alt="3d"/>`
    else thumbHtml=`<div class="ph">${hasVite?'3D 截图失败':'未截 3D（vite 未启动）'}</div>`
  }else if(p?.modelOnly){
    thumbHtml='<div class="ph">modelOnly 替身（列表）</div>'
  }

  const html=`<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;font:13px/1.4 system-ui;background:#eef1f5;color:#222}
    .row{display:flex;gap:10px;padding:10px}
    .card{background:#fff;border-radius:8px;padding:8px;flex:1;min-width:0;box-shadow:0 1px 4px #0002}
    h1{font-size:14px;margin:0 0 6px}
    .meta{color:#666;font-size:11px;margin-bottom:6px}
    .ph{height:360px;display:grid;place-items:center;background:#f3f5f8;color:#888;border-radius:6px}
  </style></head><body>
  <div class="row">
    <div class="card"><h1>Pacdora 金样 ${s.num}</h1><div class="meta">${esc(s.note)} · ${esc(j.modeCate?.code||'')}</div>${pac.svg}</div>
    <div class="card"><h1>BOXCRAFT 2D ${esc(p?.templateId||'—')}</h1>
      <div class="meta">cutApprox=${knife?.meta?.cutApprox?'Y':'N'} bleedApprox=${knife?.meta?.bleedApprox?'Y':'N'} extra=${knife?.meta?.extraCutLoops||0}</div>
      ${ourSvg}</div>
    <div class="card"><h1>3D 合盖</h1><div class="meta">${esc(p?.label||'')}</div>${thumbHtml}</div>
  </div></body></html>`
  writeFileSync(join(shotDir,`cmp-${s.num}.html`),html,'utf8')
  const png=shotFile(`cmp-${s.num}`,html,{w:1500,h:560})
  indexCards.push({num:s.num,note:s.note,png:png?`cmp-${s.num}.png`:null,html:`cmp-${s.num}.html`,tid:p?.templateId||''})

  // —— 自动判定 ——
  if(p?.modelOnly)found.push({problem:'仅 3D 样机：需替身展示',sev:'med',own:'4'})
  if(knife?.meta?.cutApprox)found.push({problem:`外裁 cutApprox=true reason=${knife.meta.cutApproxReason||'?'}`,sev:'med',own:'2'})
  if(knife?.meta?.bleedApprox)found.push({problem:`出血 bleedApprox=true（退回 AABB）`,sev:'med',own:'2'})
  if((knife?.meta?.extraCutLoops||0)>0)found.push({problem:`伪/真多坯 extraCutLoops=${knife.meta.extraCutLoops}`,sev:'low',own:'2'})
  if(knife&&pac.bbox.w>0&&pac.bbox.h>0){
    const cw=knife.bounds.maxX-knife.bounds.minX,ch=knife.bounds.maxY-knife.bounds.minY
    const arP=pac.bbox.w/pac.bbox.h,arC=cw/ch
    if(Math.abs(arP-arC)/Math.max(arP,arC)>0.15){
      found.push({problem:`外形长宽比偏差 ${arP.toFixed(2)} vs ${arC.toFixed(2)}`,sev:'med',own:'2'})
    }
  }
  if(s.cat==='cylinder'&&p?.templateId&&p.templateId!=='cylinder-box'){
    found.push({problem:`圆筒未挂 cylinder-box，实际 ${p.templateId}`,sev:'high',own:'5'})
  }
  if(s.cat==='sleeveDrawer'&&p?.templateId&&p.templateId!=='sleeve-drawer'){
    found.push({problem:`抽屉袖套未挂 sleeve-drawer，实际 ${p.templateId}`,sev:'high',own:'3'})
  }
  if(p?.templateId&&!String(p.templateId).startsWith('spec-')&&compileOk.has(String(s.num))&&!p.modelOnly){
    // 该样本有编译成功规格但未挂
    const code=p.structureCode||j.modeCate?.code
    if(code)found.push({problem:`可挂未挂规格（compile ok）实际 ${p.templateId}`,sev:'med',own:'6'})
  }
  if(String(p?.templateId||'').startsWith('spec-')){
    try{
      const t=getTemplate(p.templateId)
      const pieces=t?.pieces||[]
      if(pieces.length>=2){
        // 仅报警仍为「部件N」的占位件名（有 role 的底盖/天盖不算残缺）
        const bad=pieces.some(x=>/^部件\d+$/.test(x.label||''))
        if(bad)found.push({problem:`多件件名/role 不完整：${pieces.map(x=>x.label||x.id).join('|')}`,sev:'low',own:'6'})
      }
    }catch{/* */}
  }

  for(const f of found){
    const key=`${s.num}|${f.problem}`
    const old=prev.get(key)
    let status='open'
    let note=''
    if(old?.status==='wontfix'||(old?.note&&old.note.trim())){
      status=old.status==='wontfix'?'wontfix':'open'
      note=old.note||''
      if(old.status==='wontfix')status='wontfix'
    }
    issues.push({sourceNum:s.num,cat:s.cat,problem:f.problem,sev:f.sev,own:f.own,status,note,key})
  }
  summary.push({num:s.num,cat:s.cat,tid:p?.templateId||null,cutApprox:!!knife?.meta?.cutApprox,bleedApprox:!!knife?.meta?.bleedApprox,extra:knife?.meta?.extraCutLoops||0,found:found.length})
}

// 关单：本次未再出现的问题（含曾 wontfix）→ closed
const currentKeys=new Set(issues.map(i=>i.key))
for(const [key,old] of prev){
  if(currentKeys.has(key))continue
  if(old.status==='closed'){
    issues.push({...old,key,status:'closed'})
  }else{
    issues.push({...old,key,status:'closed',note:old.note?`${old.note} · auto-closed`:'auto-closed'})
  }
}

const header=['sourceNum','类别','问题','严重度','归属项','status','备注']
const lines=[header.join(',')]
for(const r of issues){
  lines.push([r.sourceNum,r.cat,csvEsc(r.problem),r.sev,r.own,r.status,csvEsc(r.note||'')].join(','))
}
writeFileSync(csvPath,lines.join('\n'),'utf8')

const openN=issues.filter(i=>i.status==='open').length
const closedN=issues.filter(i=>i.status==='closed').length
const wontN=issues.filter(i=>i.status==='wontfix').length

const indexHtml=`<!doctype html><html><head><meta charset="utf-8"><title>boxaudit index</title>
<style>
body{font:14px/1.4 system-ui;background:#eef1f5;margin:0;padding:16px}
h1{font-size:18px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px}
.card{background:#fff;border-radius:8px;padding:10px;box-shadow:0 1px 4px #0002}
img{width:100%;height:auto;border-radius:4px;background:#f3f5f8}
a{color:#2458d4}
.meta{color:#666;font-size:12px}
</style></head><body>
<h1>视觉对照索引 · open=${openN} closed=${closedN}</h1>
<div class="grid">
${indexCards.map(c=>`<div class="card"><b>${c.num}</b> ${esc(c.note)}<div class="meta">${esc(c.tid)}</div>
${c.png?`<a href="${c.png}"><img src="${c.png}" alt="${c.num}"/></a>`:`<div class="meta">无截图 · <a href="${c.html}">html</a></div>`}
</div>`).join('')}
</div></body></html>`
writeFileSync(join(shotDir,'index.html'),indexHtml,'utf8')
writeFileSync(join(shotDir,'summary.json'),JSON.stringify({shotDir,open:openN,closed:closedN,wontfix:wontN,vite:hasVite,samples:summary},null,2),'utf8')
console.log(JSON.stringify({shotDir,samples:SAMPLES.length,open:openN,closed:closedN,wontfix:wontN,edge:!!EDGE,skipShot:SKIP_SHOT,vite:hasVite},null,2))
