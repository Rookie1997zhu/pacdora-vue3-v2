/**
 * 离线编译「结构规格」：Pacdora 金样 → 面片树 + 尺寸表达式 + 轮廓图元。
 * 规格只含公式与图元（自由边内收量），不保存刀版坐标；运行时由 specTemplate 自研生成（B1）。
 *
 * 范围：--from 为 all（默认）或逗号分隔的 templateId；精确 REA 映射的代码与手绘通用代码不编。
 * 按预设条数排序，取前 --limit 个可编译代码；编译后调用 validate-structure-specs.mjs 收窄/剔除。
 * 用法：node scripts/build-structure-specs.mjs [--from all|tuck-end-straight,handle-box] [--limit 2000]
 */
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'
import {faceSignature} from '../src/templates/spec/specTemplate.js'
import {resolveStructureTemplate} from '../src/catalog/structureCodeTemplates.js'
import {REA_TEMPLATES} from '../src/templates/rea/index.js'
import {arcToCubics,quadToCubic} from '../src/geom/flattenPath.js'

const REA_BY_ID=Object.fromEntries(REA_TEMPLATES.map(t=>[t.id,t]))
import {pickCompileLayer} from './lib/pickCompileLayer.mjs'
import {toHolePrimitive,holeCenter} from './lib/holePrimitives.mjs'

/** 新结构族占用的精确映射：不编规格、不做 REA 接管 */
const FAMILY_TEMPLATE_IDS=new Set(['cylinder-box','sleeve-drawer','rea-flat-sheet'])

/**
 * 多件件名/角色推断（面积降序的 comps）。
 * @param {string} [structureCode]
 * @returns {{id,label,role}[]}
 */
function inferPieceLabels(comps,byName,areaOf,structureCode=''){
  const used=new Map()
  const take=(label)=>{
    const n=(used.get(label)||0)+1
    used.set(label,n)
    return n===1?label:`${label}${n}`
  }
  const majority=(names,re)=>{
    if(!names.length)return false
    return names.filter(n=>re.test(n)).length>=Math.ceil(names.length*.5)
  }
  const sc=String(structureCode||'')
  let lidUsed=false

  // 已知结构族：整表专用命名（避免与通用 T1/TF 规则冲突）
  if(sc==='LongHookShelf'||/^FourCompartment/i.test(sc)
    ||/^BoutiqueboxHalfCenterOpen/i.test(sc)||sc==='MultiPiecePlugLockBox'){
    return comps.map((names,i)=>{
      let label,role
      if(sc==='LongHookShelf'){
        if(i===0){label=take('主盒');role='main'}
        else{label=take('货架');role='insert'}
      }else if(/^FourCompartment/i.test(sc)){
        if(i===0){label=take('主盘');role='main'}
        else{label=take('隔板');role='flat'}
      }else if(/^BoutiqueboxHalfCenterOpen/i.test(sc)){
        if(i===0){label=take('底盒');role='main'}
        else if(names.some(n=>/^T1/.test(n))){label=take('左盖');role='lid'}
        else if(names.some(n=>/^T2/.test(n))){label=take('右盖');role='lid'}
        else{label=take(i===1?'左盖':'右盖');role='lid'}
      }else{
        // MultiPiecePlugLockBox：左右侧片 + 天盖（面名常重叠，按 L/R/T 特征）
        const hasTop=names.some(n=>n==='T'||n==='TT'||n==='TB')
        const hasL=names.some(n=>n==='L'||n==='LL'||/^L[A-Z]/.test(n))
        const hasR=names.some(n=>n==='R'||n==='RR'||/^R[A-Z]/.test(n))
        if(hasTop){label=take('天盖');role='lid'}
        else if(hasL&&!hasR){label=take('左片');role='main'}
        else if(hasR&&!hasL){label=take('右片');role='main'}
        else if(i===0){label=take('底盒');role='main'}
        else{label=take('中框');role='main'}
      }
      let id
      if(i===0)id='bottom'
      else if(role==='lid'&&!lidUsed){id='lid';lidUsed=true}
      else id=`p${i+1}`
      return {id,label,role}
    })
  }

  return comps.map((names,i)=>{
    let label,role
    if(names.some(n=>/^B_/.test(n))){label=take('底盒');role='main'}
    else if(names.some(n=>/^T_/.test(n))){label=take('盖');role='lid'}
    else if(names.some(n=>/^T\d/.test(n))){label=take('盖');role='lid'}
    else if(majority(names,/^TF/)){label=take('隔板');role='flat'}
    else if(majority(names,/^T([A-Z]|$)/)&&!majority(names,/^TF/)){label=take('货架');role='insert'}
    else if(majority(names,/^B\d/)||names.some(n=>n==='B')){label=take('底盒');role='main'}
    else{
      const blob=names.join(' ')
      if(/Lid|Cover|Top|盖/i.test(blob)){label=take('盖');role='lid'}
      else if(/Insert|Lining|Partition|Inner|衬|隔/i.test(blob)){label=take('内衬');role='insert'}
      else if(/Sleeve|Outer|套/i.test(blob)){label=take('外套');role='sleeve'}
      else if(/Drawer|Tray|托|抽/i.test(blob)){label=take('托盘');role='main'}
      else if(names.length===1){label=take('隔板');role='flat'}
      else if(names.length<=2&&areaOf(names[0])<areaOf(comps[0][0])*.15){label=take('隔板');role='flat'}
      else if(i===0){label=take('主盒');role='main'}
      else{label=take(`部件${i+1}`);role='main'}
    }
    let id
    if(i===0)id='bottom'
    else if(role==='lid'&&!lidUsed){id='lid';lidUsed=true}
    else id=`p${i+1}`
    return {id,label,role}
  })
}

const root=join(dirname(fileURLToPath(import.meta.url)),'..')
const presetsPath=join(root,'src','catalog','presets.js')
const geomDir=join(root,'geometry','pacdora_boxes')
const outPath=join(root,'src','catalog','structureSpecs.js')
const reportDir=join(root,'未映射名单')
mkdirSync(reportDir,{recursive:true})

const arg=(name,def)=>{
  const i=process.argv.indexOf(`--${name}`)
  return i>=0&&process.argv[i+1]?process.argv[i+1]:def
}
const FROM=arg('from','all')
const FROM_SET=FROM==='all'?null:new Set(FROM.split(',').map(s=>s.trim()).filter(Boolean))
const LIMIT=Math.max(1,Number(arg('limit',100000))||100000)

/** 手绘/原型通用代码：同代码下结构各异，面片名也可能巧合一致，不按代码编规格 */
const GENERIC_CODES=new Set(['KnifeDraw','KnifePrototype'])

/** 管式/插舌/挂钩：禁止误拆成天地盖双件 */
function isTubeLikeCode(code){
  return /^(Pair|SealReverse|AntilifeAircraft|BuckleWithWindowHook|BotselflockWithWindowHook)/i.test(String(code||''))
}

function looksLikeCoverPair(compA,compB,byName,bottomName){
  if(bottomName&&(compA.includes(bottomName)||compB.includes(bottomName)))return true
  const tag=names=>{
    const s=names.join(' ')
    const bot=names.some(n=>n==='B'||/^B_/.test(n)||/^B\d/.test(n)||/bottom/i.test(n))
    const top=names.some(n=>n==='T'||/^T_/.test(n)||/^T\d/.test(n)||/lid|Cover/i.test(n))
    return {bot,top,blob:s}
  }
  const a=tag(compA),b=tag(compB)
  if((a.bot&&b.top)||(a.top&&b.bot))return true
  const center=names=>{
    let sx=0,sy=0,n=0
    for(const nm of names){
      const f=byName.get(nm)
      if(!f)continue
      sx+=f.x+f.w/2;sy+=f.y+f.h/2;n++
    }
    return n?{x:sx/n,y:sy/n}:null
  }
  const halfDiag=names=>{
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity
    for(const nm of names){
      const f=byName.get(nm)
      if(!f)continue
      minX=Math.min(minX,f.x);minY=Math.min(minY,f.y)
      maxX=Math.max(maxX,f.x+f.w);maxY=Math.max(maxY,f.y+f.h)
    }
    if(!Number.isFinite(minX))return 0
    return Math.hypot(maxX-minX,maxY-minY)/2
  }
  const c0=center(compA),c1=center(compB)
  if(!c0||!c1)return false
  const dist=Math.hypot(c0.x-c1.x,c0.y-c1.y)
  return dist>(halfDiag(compA)+halfDiag(compB))*.6
}

/** 折线与面 bbox 边的重合容差（mm） */
const EDGE_TOL=1
const r2=n=>Math.round(n*100)/100

/** 去掉金样名称里的运营后缀（仅上架 Pacdora / 尺寸 / 模型优化 / P1） */
function cleanName(name,code){
  const s=String(name||'')
    .replace(/[_\-\s]*仅.*?Pacdora.*$/i,'')
    .replace(/[_\-\s]*\d+(\.\d+)?x\d+(\.\d+)?(x\d+(\.\d+)?)?.*$/i,'')
    .replace(/[_\-\s]*模型优化.*$/,'')
    .replace(/[_\-\s]+$/,'')
    .trim()
  return s||code
}

function loadPresets(){
  const raw=readFileSync(presetsPath,'utf8')
  return JSON.parse(raw.replace(/^\/\*\*[\s\S]*?\*\/\s*export\s+default\s+/,'').trim())
}

function lengthParams(j){
  const seen=new Set()
  const out=[]
  for(const o of (j.openParams||[]).flat(3)){
    if(!o||o.unit==='angle'||!o.name||seen.has(o.name))continue
    const v=Number(o.value)
    if(!(v>0))continue
    seen.add(o.name)
    out.push({code:o.name,label:o.name,value:v,min:Number(o.min)||0,max:Number(o.max)||Math.max(v*4,100)})
  }
  return out
}

/** 值 v ≈ k·base + c；base ∈ L/W/H/openParam；返回最简表达式 */
function fitExpr(v,dims,params){
  const cands=[]
  for(const [t,b] of Object.entries(dims)){
    if(!(b>0))continue
    cands.push({t,k:1,b},{t,k:.5,b})
  }
  for(const p of params)cands.push({t:`P:${p.code}`,k:1,b:p.value})
  let best=null
  for(const c of cands){
    const res=v-c.k*c.b
    const score=Math.abs(res)+(c.k===1?0:.3)+(c.t.startsWith('P:')?.2:0)
    if(!best||score<best.score)best={...c,res,score}
  }
  if(best&&Math.abs(best.res)<=Math.max(2,v*.1)){
    return {t:best.t,k:best.k,c:r2(best.res)}
  }
  if(v<=25)return {t:null,k:0,c:r2(v)}
  // 无法用单项解释：按最接近的主尺寸取比例，保证随尺寸缩放
  let ratio=null
  for(const [t,b] of Object.entries(dims)){
    if(!(b>0))continue
    const d=Math.abs(Math.log(v/b))
    if(!ratio||d<ratio.d)ratio={t,k:v/b,d}
  }
  return ratio?{t:ratio.t,k:Math.round(ratio.k*10000)/10000,c:0}:{t:null,k:0,c:r2(v)}
}

/** 内部折线位置：距父面较近一侧边的距离表达式（from=start 起边 / end 止边） */
function interiorFold(fromStart,fromEnd,dims,params){
  const useStart=fromStart<=fromEnd
  return {from:useStart?'start':'end',d:fitExpr(Math.max(0,useStart?fromStart:fromEnd),dims,params)}
}

const u4=n=>Math.round(n*10000)/10000

/** 绝对点 → 相对 bbox 的 UV；矩形轮廓返回 null */
function toUv(pts,face){
  const {x,y,w,h}=face
  if(!(w>1e-6&&h>1e-6)||pts.length<3)return null
  // 弧凸出可能略超 bbox：钳到 [0,1]，满足 knife absoluteOutline 契约
  const uv=pts.map(([px,py])=>[
    u4(Math.min(1,Math.max(0,(px-x)/w))),
    u4(Math.min(1,Math.max(0,(py-y)/h)))
  ])
  const near01=t=>Math.abs(t)<.02||Math.abs(t-1)<.02
  if(uv.every(([u,v])=>near01(u)&&near01(v)))return null
  return uv
}

/**
 * dlist → 归一化多边形（含 A 弧按 rx 细分）；矩形省略。
 * 只存形状比例，无刀版 mm。无曲线时的折线兜底。
 */
function normalizeOutline(face,arcSeg=4){
  const segs=face.dlist||[]
  if(segs.length<3)return null
  const pts=[]
  let prev=null
  for(const s of segs){
    if(!s||s.mtd==='Z'||!Number.isFinite(s.x)||!Number.isFinite(s.y))continue
    if(s.mtd==='A'&&prev){
      const rx=Math.max(Number(s.rx)||0,Number(s.ry)||0)
      if(rx>1e-3){
        const dx=s.x-prev[0],dy=s.y-prev[1]
        const len=Math.hypot(dx,dy)||1
        const nx=-dy/len,ny=dx/len
        const bulge=(s.dir===0?-1:1)*Math.min(rx,len/2)
        for(let i=1;i<arcSeg;i++){
          const t=i/arcSeg
          pts.push([prev[0]+dx*t+nx*bulge*Math.sin(Math.PI*t),prev[1]+dy*t+ny*bulge*Math.sin(Math.PI*t)])
        }
      }
    }
    pts.push([s.x,s.y])
    prev=[s.x,s.y]
  }
  const dedup=[]
  for(const p of pts){
    const last=dedup[dedup.length-1]
    if(!last||Math.hypot(p[0]-last[0],p[1]-last[1])>.05)dedup.push(p)
  }
  if(dedup.length>=2&&Math.hypot(dedup[0][0]-dedup[dedup.length-1][0],dedup[0][1]-dedup[dedup.length-1][1])<.05){
    dedup.pop()
  }
  return toUv(dedup,face)
}

const uvClamp=(t)=>u4(Math.min(1,Math.max(0,t)))

/**
 * dlist → UV 三次贝塞尔命令列 oc。
 * 仅当存在 A/Q/C 时返回；side 非空时校验铰链边为覆盖整边的 L 段，否则 null（回退 e）。
 * @returns {{oc:array[], fallback?:boolean}|null}
 */
function toUvCurve(face,side=null){
  const segs=face.dlist||[]
  const {x,y,w,h}=face
  if(!(w>1e-6&&h>1e-6)||segs.length<3)return null
  const hasCurve=segs.some(s=>s&&(s.mtd==='A'||s.mtd==='Q'||s.mtd==='C'))
  if(!hasCurve)return null
  const toU=(px,py)=>[uvClamp((px-x)/w),uvClamp((py-y)/h)]
  const oc=[]
  let px=0,py=0,started=false
  for(const s of segs){
    if(!s)continue
    if(s.mtd==='M'&&Number.isFinite(s.x)&&Number.isFinite(s.y)){
      const [u,v]=toU(s.x,s.y)
      oc.push(['M',u,v]);px=s.x;py=s.y;started=true
    }else if(s.mtd==='L'&&Number.isFinite(s.x)&&Number.isFinite(s.y)){
      const [u,v]=toU(s.x,s.y)
      oc.push(['L',u,v]);px=s.x;py=s.y
    }else if(s.mtd==='A'&&started){
      for(const seg of arcToCubics(px,py,s.x,s.y,s.rx||0,s.ry||0,s.ang||0,!!s.arc,!!(s.dir??1))){
        const [u1,v1]=toU(seg.c1x,seg.c1y)
        const [u2,v2]=toU(seg.c2x,seg.c2y)
        const [u,v]=toU(seg.x,seg.y)
        oc.push(['C',u1,v1,u2,v2,u,v])
        px=seg.x;py=seg.y
      }
    }else if(s.mtd==='Q'&&started){
      const cub=quadToCubic(px,py,s.cx,s.cy,s.x,s.y)
      const [u1,v1]=toU(cub.c1x,cub.c1y)
      const [u2,v2]=toU(cub.c2x,cub.c2y)
      const [u,v]=toU(cub.x,cub.y)
      oc.push(['C',u1,v1,u2,v2,u,v])
      px=s.x;py=s.y
    }else if(s.mtd==='C'&&started){
      const [u1,v1]=toU(s.cx1??s.cx,s.cy1??s.cy)
      const [u2,v2]=toU(s.cx2??s.cx,s.cy2??s.cy)
      const [u,v]=toU(s.x,s.y)
      oc.push(['C',u1,v1,u2,v2,u,v])
      px=s.x;py=s.y
    }else if(s.mtd==='Z'){
      oc.push(['Z'])
    }
  }
  if(oc.filter(c=>c[0]!=='Z').length<3)return null

  // 铰链边：side 对应子面贴父面的那条 bbox 边，必须被 L 段整段覆盖
  if(side){
    // top=子在父上 → 铰在子底边 v=1；bottom → v=0；left → u=1；right → u=0
    const hingeU=side==='left'?1:side==='right'?0:null
    const hingeV=side==='top'?1:side==='bottom'?0:null
    const near=(a,b)=>Math.abs(a-b)<.04
    const spans=[]
    let curU=null,curV=null
    for(const c of oc){
      if(c[0]==='M'){curU=c[1];curV=c[2];continue}
      if(c[0]==='L'&&curU!=null){
        const nu=c[1],nv=c[2]
        if(hingeU!=null&&near(curU,hingeU)&&near(nu,hingeU)){
          spans.push([Math.min(curV,nv),Math.max(curV,nv)])
        }
        if(hingeV!=null&&near(curV,hingeV)&&near(nv,hingeV)){
          spans.push([Math.min(curU,nu),Math.max(curU,nu)])
        }
        curU=nu;curV=nv
      }else if(c[0]==='C'){
        // 曲线段不得落在铰链边上（允许端点擦边）
        const midU=(c[1]+c[3]+c[5])/3,midV=(c[2]+c[4]+c[6])/3
        if(hingeU!=null&&near(midU,hingeU))return {oc:null,fallback:true}
        if(hingeV!=null&&near(midV,hingeV))return {oc:null,fallback:true}
        curU=c[5];curV=c[6]
      }else if(c[0]==='Z'&&oc[0]?.[0]==='M'){
        curU=oc[0][1];curV=oc[0][2]
      }
    }
    spans.sort((a,b)=>a[0]-b[0])
    let covered=0,cursor=0
    for(const [a,b] of spans){
      if(b<cursor)continue
      covered+=b-Math.max(a,cursor)
      cursor=Math.max(cursor,b)
    }
    if(covered<.85)return {oc:null,fallback:true}
  }
  return {oc,fallback:false}
}

/** 给 entry 挂 oc（优先）或 outline；侧铰面铰链失败则保留 e */
function attachOutline(entry,face,side=null){
  const curve=toUvCurve(face,side)
  if(curve?.oc){
    entry.oc=curve.oc
    delete entry.outline
    delete entry.e // oc 已含自由边形状，梯形内收多余
    return {curves:1,fallback:0}
  }
  if(curve?.fallback){
    // 铰链边上有曲线：不写 oc，保留/生成 e
    if(side&&!entry.e){
      const inset=freeEdgeInsets(face,side)
      if(inset)entry.e=inset
    }
    return {curves:0,fallback:1}
  }
  if(!entry.outline&&!entry.oc){
    const ol=normalizeOutline(face)
    if(ol)entry.outline=ol
  }
  return {curves:0,fallback:0}
}

/** 折线两端相对子面 bbox 的 UV（铰链 hingeLine） */
function normalizeHinge(fold,child){
  const {x,y,w,h}=child
  if(!(w>1e-6&&h>1e-6))return null
  const clamp=(t)=>u4(Math.min(1.05,Math.max(-.05,t)))
  const len=Math.hypot(fold.x2-fold.x1,fold.y2-fold.y1)
  if(len>=.5){
    return [
      [clamp((fold.x1-x)/w),clamp((fold.y1-y)/h)],
      [clamp((fold.x2-x)/w),clamp((fold.y2-y)/h)]
    ]
  }
  return null
}

/**
 * 零长接缝：在子面朝向父面一侧造一条短 hingeLine（避免零轴四元数），
 * 调用方通常配 a:0（装配缝不折）。
 */
function fabricateHingeUv(child,parent){
  const {x,y,w,h}=child
  if(!(w>1e-6&&h>1e-6))return null
  const cx=x+w/2,cy=y+h/2,px=parent.x+parent.w/2,py=parent.y+parent.h/2
  let dx=cx-px,dy=cy-py
  const L=Math.hypot(dx,dy)||1
  dx/=L;dy/=L
  const mx=cx-dx*Math.min(w,h)*.35,my=cy-dy*Math.min(w,h)*.35
  const half=Math.max(2,Math.min(w,h)*.25)
  const qx=-dy*half,qy=dx*half
  const clamp=(t)=>u4(Math.min(1,Math.max(0,t)))
  return [
    [clamp((mx-qx-x)/w),clamp((my-qy-y)/h)],
    [clamp((mx+qx-x)/w),clamp((my+qy-y)/h)]
  ]
}

/** 从折线名拆出两端面名（与现编译器一致的最长前缀匹配） */
function splitFoldFaces(name,byName){
  const parts=String(name||'').split('_')
  for(let k=1;k<parts.length;k++){
    const a=parts.slice(0,k).join('_'),b=parts.slice(k).join('_')
    if(byName.has(a)&&byName.has(b)&&a!==b)return [a,b]
  }
  return null
}

/** 无向邻接表上的连通分量（只含 nameSet） */
function connectedComponents(adj,nameSet){
  const left=new Set(nameSet),comps=[]
  while(left.size){
    const start=left.values().next().value
    const comp=[],q=[start]
    left.delete(start)
    while(q.length){
      const n=q.shift()
      comp.push(n)
      for(const {to} of adj.get(n)||[]){
        if(!left.has(to))continue
        left.delete(to)
        q.push(to)
      }
    }
    comps.push(comp)
  }
  return comps.sort((a,b)=>b.length-a.length)
}

/** 子 bbox 相对父 bbox 的二维偏移表达式 */
function place2d(child,parent,dims,params){
  return {
    ox:fitExpr(child.x-parent.x,dims,params),
    oy:fitExpr(child.y-parent.y,dims,params)
  }
}

function relPoints(face){
  return (face.dlist||[]).filter(s=>s&&s.mtd!=='Z'&&Number.isFinite(s.x)&&Number.isFinite(s.y))
    .map(s=>[s.x-face.x,s.y-face.y])
}

/** 自由边（铰链对边）两端内收量 → 梯形图元 */
function freeEdgeInsets(face,side){
  const pts=relPoints(face)
  if(pts.length<3)return null
  const {w,h}=face
  const near=(axisVal,target)=>Math.abs(axisVal-target)<=1
  let along=[]
  if(side==='top')along=pts.filter(p=>near(p[1],0)).map(p=>p[0])
  else if(side==='bottom')along=pts.filter(p=>near(p[1],h)).map(p=>p[0])
  else if(side==='left')along=pts.filter(p=>near(p[0],0)).map(p=>p[1])
  else along=pts.filter(p=>near(p[0],w)).map(p=>p[1])
  if(!along.length)return null
  const len=side==='top'||side==='bottom'?w:h
  const a=Math.max(0,Math.min(...along)),b=Math.max(0,len-Math.max(...along))
  if(a<.3&&b<.3)return null
  return {a:r2(a),b:r2(b)}
}

/**
 * 金样折叠动画 → 本地折向：子面中心绕折线旋转后的 z 位移符号（相对父面平面）。
 * 动画以折线名第二段为转动面；若与本树父子相反，角度取反。
 */
function localFoldSign(anim,fold,parentName,child){
  const len=Math.hypot(anim.vector?.x||0,anim.vector?.y||0)
  if(!(len>0))return 0
  const ux=anim.vector.x/len,uy=anim.vector.y/len
  const mx=(fold.x1+fold.x2)/2,my=(fold.y1+fold.y2)/2
  const rx=child.x+child.w/2-mx,ry=child.y+child.h/2-my
  const moverIsChild=String(fold.name).endsWith(`_${child.name}`)&&!String(fold.name).startsWith(`${child.name}_`)
  const theta=(Number(anim.rotate)||0)*Math.PI/180*(moverIsChild?1:-1)
  return Math.sign(Math.sin(theta)*(ux*ry-uy*rx))
}

function compile(code,num){
  const file=join(geomDir,`${num}.json`)
  if(!existsSync(file))return {error:'geometry missing'}
  const j=JSON.parse(readFileSync(file,'utf8'))
  const ly=pickCompileLayer(j)
  if(!ly)return {error:'multi-layer'}
  // 金样 x/y/w/h 有时把子面包进父面 bbox；以 dlist 实际点集外框为准。
  // dlist 退化成零宽/零高（如竖线舌片）时回退原始 bbox，避免弱边链被误丢。
  const faces=(ly?.faces||[]).map(f=>{
    const pts=(f.dlist||[]).filter(s=>s&&s.mtd!=='Z'&&Number.isFinite(s.x)&&Number.isFinite(s.y))
    if(pts.length<3)return f
    const xs=pts.map(s=>s.x),ys=pts.map(s=>s.y)
    const x=Math.min(...xs),y=Math.min(...ys)
    const w=Math.max(...xs)-x,h=Math.max(...ys)-y
    if(w*.5<.5||h*.5<.5)return f
    return {...f,x,y,w,h}
  })
  if(faces.length<2)return {error:'too few faces'}
  const byName=new Map(faces.map(f=>[f.name,f]))
  if(byName.size!==faces.length)return {error:'duplicate face names'}

  // 双通道邻接：强边 len≥1 先入；弱边（零长接缝）追加末尾，BFS 仍优先强边 → 已 OK 规格零回归
  const adjStrong=new Map(faces.map(f=>[f.name,[]]))
  const adjWeak=new Map(faces.map(f=>[f.name,[]]))
  for(const fo of ly.folds||[]){
    const pair=splitFoldFaces(fo.name,byName)
    if(!pair)continue
    const [a,b]=pair
    const len=Math.hypot(fo.x2-fo.x1,fo.y2-fo.y1)
    // 弱边阈值放宽到 <2mm，捞回近零长接缝
    const edge={to:null,fold:fo,deg:len<2}
    if(len>=2){
      adjStrong.get(a).push({...edge,to:b})
      adjStrong.get(b).push({...edge,to:a})
    }else{
      adjWeak.get(a).push({...edge,to:b})
      adjWeak.get(b).push({...edge,to:a})
    }
  }
  const mergeAdj=(strong,weak)=>{
    const out=new Map([...strong.keys()].map(k=>[k,[...(strong.get(k)||[])]]))
    for(const [k,list] of weak){
      const row=out.get(k)||[]
      for(const e of list)row.push(e)
      out.set(k,row)
    }
    return out
  }

  const bottomName=(j.modeCate?.otherFaces||[]).find(o=>o.direction==='bottom')?.faceName
  const areaOf=n=>{const f=byName.get(n);return (f?.w||0)*(f?.h||0)}
  // 忽略近零面积面，避免假分量
  const validNames=[...byName.keys()].filter(n=>areaOf(n)>.5)
  const strongComps=connectedComponents(adjStrong,new Set(validNames))
  const nValid=validNames.length||1
  const isLarge=comp=>comp.length>=3||(comp.length>=2&&comp.length/nValid>=.3)
  const largeComps=strongComps.filter(isLarge)
  const adjMerged=mergeAdj(adjStrong,adjWeak)
  const mergedComps=connectedComponents(adjMerged,new Set(validNames))

  /** @type {'single'|'multi'} */
  let mode='single'
  /** @type {Map<string, Array<{to:string,fold:object,deg?:boolean}>>} */
  let adj=adjStrong
  /** @type {string[][]} */
  let pieceComps=strongComps
  /** @type {{droppedPieces:number,from?:string}|null} */
  let keptLargestFlag=null

  if(strongComps.length===1){
    mode='single'
    adj=adjStrong
    pieceComps=strongComps
  }else if(largeComps.length>=2){
    // 两大件/多坯：各大分量经弱边吸收舌片孤岛，但不跨入其他大件（签名与灰板面全集对齐）
    mode='multi'
    const largeSet=new Set(largeComps.flat())
    pieceComps=largeComps.map(seed=>{
      const owned=new Set(seed)
      const q=[...seed]
      while(q.length){
        const n=q.shift()
        for(const {to} of adjMerged.get(n)||[]){
          if(owned.has(to))continue
          if(largeSet.has(to)&&!seed.includes(to))continue
          owned.add(to)
          q.push(to)
        }
      }
      return [...owned]
    })
  }else if(mergedComps.length===1){
    // 微面链靠弱边并入主分量（pieceComps 必须换成合并后的全量，不能仍用强边单面分量）
    mode='single'
    adj=adjMerged
    pieceComps=mergedComps
  }else if(mergedComps.length<strongComps.length&&mergedComps.every(c=>c.length>=1)){
    mode=mergedComps.length===1?'single':'multi'
    adj=adjMerged
    pieceComps=mergedComps
  }else{
    // 仍断：能成件的分量各自编译；孤岛小面并入最近件（bbox 中心距）
    const usable=strongComps.filter(c=>c.length>=2)
    if(usable.length>=1){
      mode=usable.length===1?'single':'multi'
      adj=adjMerged
      const owned=new Set(usable.flat())
      const islands=validNames.filter(n=>!owned.has(n))
      const center=n=>{
        const f=byName.get(n)
        return f?{x:f.x+f.w/2,y:f.y+f.h/2}:null
      }
      const comps=usable.map(c=>[...c])
      for(const iso of islands){
        const c0=center(iso)
        if(!c0)continue
        let best=-1,bestD=Infinity
        for(let i=0;i<comps.length;i++){
          for(const n of comps[i]){
            const c1=center(n)
            if(!c1)continue
            const d=Math.hypot(c0.x-c1.x,c0.y-c1.y)
            if(d<bestD){bestD=d;best=i}
          }
        }
        if(best>=0)comps[best].push(iso)
      }
      pieceComps=comps
    }else{
      // 仍全是碎面：取面积最大且面数≥2 的分量单树（keptLargest）
      const pool=(mergedComps.length?mergedComps:strongComps).slice()
      pool.sort((a,b)=>{
        const aa=a.reduce((s,n)=>s+areaOf(n),0),bb=b.reduce((s,n)=>s+areaOf(n),0)
        return bb-aa
      })
      const best=pool.find(c=>c.length>=2)
      if(!best)return {error:`disconnected ${strongComps[0]?.length||0}/${faces.length}`}
      mode='single'
      adj=adjMerged
      pieceComps=[best]
      keptLargestFlag={droppedPieces:Math.max(0,validNames.length-best.length),from:'disconnected'}
    }
  }

  // 动画分阶段累加：同一折线多段旋转按首段轴向对齐后求和；name$1 为重复折线的同步副本，不计入
  const animByFold=new Map()
  for(const a of (ly.animation?.animations||[]).flat(2)){
    if(!a?.name||a.action!=='rotate'||String(a.name).includes('$'))continue
    const prev=animByFold.get(a.name)
    if(!prev){
      animByFold.set(a.name,{name:a.name,vector:a.vector,rotate:Number(a.rotate)||0})
      continue
    }
    const dot=(prev.vector.x||0)*(a.vector?.x||0)+(prev.vector.y||0)*(a.vector?.y||0)
    prev.rotate+=(Number(a.rotate)||0)*(dot<0?-1:1)
  }
  const ks=j.knifeSize||j.size||{}
  const dims={L:Number(ks.L)||0,W:Number(ks.W)||0,H:Number(ks.H)||0}
  const params=lengthParams(j)

  const strongDeg=n=>(adjStrong.get(n)||[]).length
  const pickRoot=comp=>{
    // 优先 bottom；其次强边度数>0 的最大面（避免仅弱边相连的底被选根后强边成树失败）
    if(bottomName&&comp.includes(bottomName)&&strongDeg(bottomName)>0)return bottomName
    const ranked=[...comp].sort((a,b)=>{
      const da=strongDeg(a)>0?1:0,db=strongDeg(b)>0?1:0
      if(db!==da)return db-da
      return areaOf(b)-areaOf(a)
    })
    if(bottomName&&comp.includes(bottomName)&&strongDeg(ranked[0])===0)return bottomName
    return ranked[0]
  }

  /** 在给定 adj 与 root 上编一棵面片树；names 为允许收录的面集合 */
  const buildTree=(rootName,names,adjMap)=>{
    const nameSet=new Set(names)
    const order=[rootName]
    const parentOf=new Map([[rootName,null]])
    const out=[]
    let curveCount=0,curveFallback=0,partialDropped=0
    const rootFace=byName.get(rootName)
    const rootEntry={n:rootName,w:fitExpr(rootFace.w,dims,params),h:fitExpr(rootFace.h,dims,params)}
    const rs=attachOutline(rootEntry,rootFace,null)
    curveCount+=rs.curves;curveFallback+=rs.fallback
    out.push(rootEntry)

    const ensureOutline=name=>{
      const face=byName.get(name)
      const entry=out.find(e=>e.n===name)
      if(!face||!entry||entry.outline||entry.oc)return
      const rs2=attachOutline(entry,face,null)
      curveCount+=rs2.curves;curveFallback+=rs2.fallback
    }

    const pushHingeLineChild=(to,c,pn,fold,deg)=>{
      let hl=normalizeHinge(fold,c)
      if(!hl)hl=fabricateHingeUv(c,byName.get(pn))
      if(!hl)return {error:`hinge uv ${pn}_${to}`}
      const entry={
        n:to,p:pn,s:null,
        w:fitExpr(c.w,dims,params),h:fitExpr(c.h,dims,params),
        o2:place2d(c,byName.get(pn),dims,params),
        hl
      }
      const rs2=attachOutline(entry,c,null)
      curveCount+=rs2.curves;curveFallback+=rs2.fallback
      ensureOutline(pn)
      const anim=animByFold.get(fold.name)
      if(anim){
        entry.fs=localFoldSign(anim,fold,pn,c)
        entry.fa=Math.min(180,Math.abs(Number(anim.rotate)||90))
      }else if(deg){
        entry.fa=0
        entry.fs=1
      }
      out.push(entry)
      parentOf.set(to,pn)
      order.push(to)
      return null
    }

    for(let i=0;i<order.length;i++){
      const pn=order[i],p=byName.get(pn)
      for(const {to,fold,deg} of adjMap.get(pn)||[]){
        if(!nameSet.has(to)||parentOf.has(to))continue
        const c=byName.get(to)
        const horiz=Math.abs(fold.y1-fold.y2)<.01,vert=Math.abs(fold.x1-fold.x2)<.01
        if(deg||(!horiz&&!vert)||(horiz&&vert)){
          const err=pushHingeLineChild(to,c,pn,fold,!!deg)
          if(err)return err
          continue
        }
        let side=null,interior=null
        if(horiz){
          const y=fold.y1
          if(Math.abs(p.y-y)<=EDGE_TOL&&Math.abs(c.y+c.h-y)<=EDGE_TOL)side='top'
          else if(Math.abs(p.y+p.h-y)<=EDGE_TOL&&Math.abs(c.y-y)<=EDGE_TOL)side='bottom'
          else if(y>p.y-EDGE_TOL&&y<p.y+p.h+EDGE_TOL){
            if(Math.abs(c.y+c.h-y)<=EDGE_TOL)side='top'
            else if(Math.abs(c.y-y)<=EDGE_TOL)side='bottom'
            if(side)interior=interiorFold(y-p.y,p.y+p.h-y,dims,params)
          }
        }else{
          const x=fold.x1
          if(Math.abs(p.x-x)<=EDGE_TOL&&Math.abs(c.x+c.w-x)<=EDGE_TOL)side='left'
          else if(Math.abs(p.x+p.w-x)<=EDGE_TOL&&Math.abs(c.x-x)<=EDGE_TOL)side='right'
          else if(x>p.x-EDGE_TOL&&x<p.x+p.w+EDGE_TOL){
            if(Math.abs(c.x+c.w-x)<=EDGE_TOL)side='left'
            else if(Math.abs(c.x-x)<=EDGE_TOL)side='right'
            if(side)interior=interiorFold(x-p.x,p.x+p.w-x,dims,params)
          }
        }
        if(!side){
          const err=pushHingeLineChild(to,c,pn,fold,!!deg)
          if(err)return err
          continue
        }
        const alongH=side==='top'||side==='bottom'
        const dS=alongH?c.x-p.x:c.y-p.y
        const dE=alongH?(p.x+p.w)-(c.x+c.w):(p.y+p.h)-(c.y+c.h)
        let off
        if(Math.abs(dS-dE)<=1&&Math.abs(dS)>1)off={align:'center',c:0}
        else if(Math.abs(dS)<=Math.abs(dE))off={align:'start',c:r2(dS)}
        else off={align:'end',c:r2(dE)}
        const entry={n:to,p:pn,s:side,w:fitExpr(c.w,dims,params),h:fitExpr(c.h,dims,params),o:off}
        if(interior)entry.f=interior
        const anim=animByFold.get(fold.name)
        if(anim){
          entry.fs=localFoldSign(anim,fold,pn,c)
          entry.fa=Math.min(180,Math.abs(Number(anim.rotate)||90))
        }
        const inset=freeEdgeInsets(c,side)
        if(inset)entry.e=inset
        // 侧铰子面：优先曲线 oc（铰链边必须是整边 L）
        const rs2=attachOutline(entry,c,side)
        curveCount+=rs2.curves;curveFallback+=rs2.fallback
        out.push(entry)
        parentOf.set(to,pn)
        order.push(to)
      }
    }
    if(order.length!==nameSet.size){
      // 无法挂到根的面丢弃，保留已成树部分（≥2 面）
      if(order.length<2)return {error:`disconnected ${order.length}/${nameSet.size}`}
      const keep=new Set(order)
      for(let i=out.length-1;i>=0;i--)if(!keep.has(out[i].n))out.splice(i,1)
      partialDropped=nameSet.size-order.length
    }

    const foldBetween=(a,b)=>{
      for(const {to,fold} of adjMap.get(a)||[])if(to===b)return fold
      for(const {to,fold} of adjMap.get(b)||[])if(to===a)return fold
      return null
    }
    // 有外形（outline 或 oc）的侧铰面：改成 hingeLine + o2
    //（曲线自由边无法保证 bbox 整边铰链；运行时用 hingeLine 折）
    for(const entry of out){
      if(!entry.s||!(entry.oc||entry.outline)||!entry.p)continue
      const child=byName.get(entry.n),parent=byName.get(entry.p)
      const fold=foldBetween(entry.p,entry.n)
      let hl=fold?normalizeHinge(fold,child):null
      if(!hl&&child&&parent)hl=fabricateHingeUv(child,parent)
      if(!hl||!child||!parent){
        if(entry.oc){delete entry.oc;curveCount=Math.max(0,curveCount-1);curveFallback++}
        delete entry.outline
        continue
      }
      entry.hl=hl
      entry.o2=place2d(child,parent,dims,params)
      entry.s=null
      delete entry.o
      delete entry.e
      delete entry.f
    }

    const dominant=Math.sign(out.filter(f=>f.p===rootName&&f.fs).reduce((s,f)=>s+f.fs*areaOf(f.n),0))||1
    for(const f of out){
      if(!f.p)continue
      const sign=f.fs?f.fs*dominant:1
      const ang=f.fa??90
      delete f.fs
      delete f.fa
      if(sign!==1||Math.abs(ang-90)>.5)f.a=r2(sign*ang)
    }
    return {out,root:rootName,curves:curveCount,curveFallback,partialDropped}
  }

  let out=[],rootName,piecesMeta=null,supportsPiece=false
  let curvesTotal=0,curveFallbackTotal=0

  if(mode==='single'){
    const comp=pieceComps[0]||validNames
    rootName=pickRoot(comp)
    const tree=buildTree(rootName,comp,adj)
    if(tree.error)return tree
    out=tree.out
    rootName=tree.root
    curvesTotal+=tree.curves||0
    curveFallbackTotal+=tree.curveFallback||0
    if(tree.partialDropped){
      keptLargestFlag={droppedPieces:(keptLargestFlag?.droppedPieces||0)+tree.partialDropped,from:keptLargestFlag?.from||'treePartial'}
    }
  }else{
    // 多件：2 件 → bottom/lid；3–4 件 → p1..pN；5+ 只保留最大件
    const sorted=[...pieceComps].filter(c=>c.length>=1).sort((a,b)=>{
      const aa=a.reduce((s,n)=>s+areaOf(n),0),bb=b.reduce((s,n)=>s+areaOf(n),0)
      return bb-aa
    })
    if(sorted.length<1)return {error:`disconnected 0/${faces.length}`}
    if(sorted.length>=5){
      const comp=sorted[0]
      rootName=pickRoot(comp)
      const tree=buildTree(rootName,comp,adjMerged)
      if(tree.error)return tree
      out=tree.out
      rootName=tree.root
      curvesTotal+=tree.curves||0
      curveFallbackTotal+=tree.curveFallback||0
      supportsPiece=false
      piecesMeta=null
      keptLargestFlag={droppedPieces:pieceComps.length-1,from:'multi5plus'}
      if(tree.partialDropped)keptLargestFlag.droppedPieces+=(tree.partialDropped||0)
    }else     if(sorted.length>=3){
      supportsPiece=true
      piecesMeta=[]
      const inferred=inferPieceLabels(sorted,byName,areaOf,code)
      for(let i=0;i<sorted.length;i++){
        const meta=inferred[i]
        const r=pickRoot(sorted[i])
        const tree=buildTree(r,sorted[i],adjMerged)
        if(tree.error)return {error:`piece ${meta.id}: ${tree.error}`}
        for(const f of tree.out)f.piece=meta.id
        out.push(...tree.out)
        piecesMeta.push({id:meta.id,label:meta.label,role:meta.role,root:tree.root,faces:tree.out.map(f=>f.n)})
        curvesTotal+=tree.curves||0
        curveFallbackTotal+=tree.curveFallback||0
      }
      rootName=piecesMeta[0].root
    }else{
      // 双件：管式禁拆；其余需 lookCover，否则合并单树
      const a=sorted[0],b=sorted[1]
      const mergeSingle=isTubeLikeCode(code)||!looksLikeCoverPair(a,b,byName,bottomName)
      if(mergeSingle){
        const merged=[...new Set([...a,...b])]
        rootName=pickRoot(merged)
        const tree=buildTree(rootName,merged,adjMerged)
        if(tree.error)return tree
        out=tree.out
        rootName=tree.root
        curvesTotal+=tree.curves||0
        curveFallbackTotal+=tree.curveFallback||0
        supportsPiece=false
        piecesMeta=null
        if(tree.partialDropped){
          keptLargestFlag={droppedPieces:tree.partialDropped,from:'merge2piece'}
        }
      }else{
        const withBottom=sorted.find(c=>bottomName&&c.includes(bottomName))
        const bottomComp=withBottom||sorted[0]
        const lidComp=sorted.find(c=>c!==bottomComp)||sorted[1]
        supportsPiece=true
        piecesMeta=[]
        for(const {id,label,role,comp} of [
          {id:'bottom',label:'底盖',role:'main',comp:bottomComp},
          {id:'lid',label:'天盖',role:'lid',comp:lidComp}
        ]){
          const r=pickRoot(comp)
          const tree=buildTree(r,comp,adjMerged)
          if(tree.error)return {error:`piece ${id}: ${tree.error}`}
          for(const f of tree.out)f.piece=id
          out.push(...tree.out)
          piecesMeta.push({id,label,role,root:tree.root,faces:tree.out.map(f=>f.n)})
          curvesTotal+=tree.curves||0
          curveFallbackTotal+=tree.curveFallback||0
        }
        rootName=piecesMeta[0].root
      }
    }
  }

  // 孔位：优先 faces[].holes；未认领的 layer.holes 按中心落入最小面 bbox 归属
  const outByName=new Map(out.map(e=>[e.n,e]))
  const claimed=new Set()
  const holeKey=cmds=>{
    const c=holeCenter(cmds)
    return c?`${r2(c.x)},${r2(c.y)},${r2(c.w)},${r2(c.h)}`:JSON.stringify(cmds).slice(0,80)
  }
  const attachHole=(faceName,cmds)=>{
    const entry=outByName.get(faceName)
    const face=byName.get(faceName)
    if(!entry||!face)return false
    const prim=toHolePrimitive(cmds,{x:face.x,y:face.y,w:face.w,h:face.h})
    if(!prim)return false
    if(!entry.hs)entry.hs=[]
    entry.hs.push(prim)
    return true
  }
  for(const f of faces){
    if(!outByName.has(f.name)||!Array.isArray(f.holes))continue
    for(const h of f.holes){
      const cmds=Array.isArray(h)?h:(h?.dlist||[])
      if(!cmds.length)continue
      if(attachHole(f.name,cmds))claimed.add(holeKey(cmds))
    }
  }
  for(const h of ly.holes||[]){
    const cmds=Array.isArray(h)?h:(h?.dlist||[])
    if(!cmds.length)continue
    const key=holeKey(cmds)
    if(claimed.has(key))continue
    const c=holeCenter(cmds)
    if(!c)continue
    // 取包含中心且面积最小的已保留面
    let best=null,bestA=Infinity
    for(const e of out){
      const f=byName.get(e.n)
      if(!f)continue
      if(c.x<f.x||c.x>f.x+f.w||c.y<f.y||c.y>f.y+f.h)continue
      const a=f.w*f.h
      if(a<bestA){bestA=a;best=e.n}
    }
    if(best&&attachHole(best,cmds))claimed.add(key)
  }
  let holeCount=0
  for(const e of out)if(e.hs?.length)holeCount+=e.hs.length

  const size=j.size||{},outSize=j.outSize||{}
  const D=Number(size.D)||Number(ly?.thickness)||Number(j.layer?.traditional?.thickness)||.5
  const add=(a,b)=>Math.max(0,Math.round(((Number(a)||0)-(Number(b)||0))/Math.max(D,.1)*10)/10)
  const def={length:Number(size.L)||dims.L,width:Number(size.W)||dims.W,height:Number(size.H)||dims.H}
  const lim=v=>[Math.max(10,Math.round(v*.6)),Math.max(20,Math.round(v*2))]
  const spec={
    code,
    sampleNum:String(num),
    sig:faceSignature(out.map(f=>f.n)),
    name:cleanName(j.modeCate?.name,code),
    remarks:j.modeCate?.remarks||'',
    root:rootName,
    defaults:{...def,thickness:Math.max(.5,D)},
    limits:{length:lim(def.length),width:lim(def.width),height:lim(def.height)},
    sizeRule:{
      panelAdd:{length:add(ks.L,size.L),width:add(ks.W,size.W),height:add(ks.H,size.H)},
      outerAdd:{length:add(outSize.L,size.L),width:add(outSize.W,size.W),height:add(outSize.H,size.H)}
    },
    params:params.map(p=>({code:p.code,label:p.label,def:p.value,min:p.min,max:p.max})),
    faces:out
  }
  if(piecesMeta){
    spec.pieces=piecesMeta
    if(supportsPiece)spec.supportsPiece=true
  }
  const pieceCount=piecesMeta?.length||1
  const detailExtra=keptLargestFlag
    ?{keptLargest:true,droppedPieces:keptLargestFlag.droppedPieces||0,keptFrom:keptLargestFlag.from}
    :(mode==='multi'&&!piecesMeta&&pieceComps.length>=5
      ?{keptLargest:true,droppedPieces:pieceComps.length-1}
      :{})
  return {
    spec,
    stats:{
      faces:out.length,folds:(ly.folds||[]).length,pieces:pieceCount,holes:holeCount,
      curves:curvesTotal,curveFallback:curveFallbackTotal,...detailExtra
    }
  }
}

/** 样本主图层面数（用于 REA 失配判定） */
function sampleFaceCount(num){
  const file=join(geomDir,`${num}.json`)
  if(!existsSync(file))return 0
  try{
    const j=JSON.parse(readFileSync(file,'utf8'))
    const ly=pickCompileLayer(j)
    return (ly?.faces||[]).length
  }catch{return 0}
}

function sampleFaceSig(num){
  const file=join(geomDir,`${num}.json`)
  if(!existsSync(file))return null
  try{
    const j=JSON.parse(readFileSync(file,'utf8'))
    const ly=pickCompileLayer(j)
    if(!ly)return null
    return faceSignature((ly.faces||[]).map(f=>f.name))
  }catch{return null}
}

function reaFaceCount(templateId){
  const t=REA_BY_ID[templateId]
  if(!t)return 0
  if(Array.isArray(t.faceOrder))return t.faceOrder.length
  return 0
}

/** 面数偏差是否超过 40%（REA 失配接管候选） */
function faceCountMismatch(reaN,sampleN){
  if(!(reaN>0&&sampleN>0))return false
  return Math.abs(reaN-sampleN)/Math.max(reaN,sampleN)>.4
}

const data=loadPresets()
/** @type {Map<string, object[]>} code → presets */
const byCode=new Map()
/** 通用代码：每样本单独编 */
const genericSamples=[]
/** REA 失配候选：code + sample */
const reaTakeoverCandidates=[]

for(const p of data.presets||[]){
  const from=p.templateSource==='structure-spec'||p.templateSource==='structure-spec-takeover'?p.specFrom:p.templateId
  if(FROM_SET&&!FROM_SET.has(from))continue
  if(!p.structureCode)continue
  const code=p.structureCode
  const exact=resolveStructureTemplate(code)
  if(exact&&FAMILY_TEMPLATE_IDS.has(exact))continue
  if(GENERIC_CODES.has(code)){
    genericSamples.push(p)
    continue
  }
  if(exact){
    const sn=sampleFaceCount(p.sourceNum)
    const rn=reaFaceCount(exact)
    if(faceCountMismatch(rn,sn))reaTakeoverCandidates.push(p)
    continue
  }
  if(!byCode.has(code))byCode.set(code,[])
  byCode.get(code).push(p)
}

const ranked=[...byCode.entries()].sort((a,b)=>b[1].length-a[1].length||(b[1][0].foldCount||0)-(a[1][0].foldCount||0))

const specs=[]
const report=['structureCode,sampleNum,presets,status,detail']
const seenSpecIds=new Set()

function pushCompiled(specId,code,num,listLen,r,tag=''){
  if(specs.length>=LIMIT)return false
  if(seenSpecIds.has(specId))return false
  const spec={...r.spec,code:specId}
  // 原始 structureCode 保留便于挂载匹配
  if(specId!==code)spec.structureCode=code
  specs.push(spec)
  seenSpecIds.add(specId)
  const extra=r.stats.keptLargest?`;keptLargest;dropped=${r.stats.droppedPieces||0}`:''
  const pieceTag=r.stats.pieces>1?`;pieces=${r.stats.pieces}`:''
  const holeTag=r.stats.holes>0?`;holes=${r.stats.holes}`:''
  const curveTag=r.stats.curves>0?`;curves=${r.stats.curves}`:''
  const fbTag=r.stats.curveFallback>0?`;curveFallback=${r.stats.curveFallback}`:''
  report.push([specId,num,listLen,'ok',`faces=${r.stats.faces}${pieceTag}${holeTag}${curveTag}${fbTag}${extra}${tag}`].join(','))
  return true
}

// 1) 常规 code：按 faceSignature 分组；首组用 code，其余用 code__num
for(const [code,list] of ranked){
  if(specs.length>=LIMIT)break
  const groups=new Map()
  for(const p of list){
    const sig=sampleFaceSig(p.sourceNum)||`_${p.sourceNum}`
    if(!groups.has(sig))groups.set(sig,[])
    groups.get(sig).push(p)
  }
  let gi=0
  for(const [,glist] of groups){
    if(specs.length>=LIMIT)break
    const num=glist[0].sourceNum
    const specId=gi===0?code:`${code}__${num}`
    gi++
    const r=compile(code,num)
    if(r.error){
      report.push([specId,num,glist.length,'skip',r.error].join(','))
      continue
    }
    pushCompiled(specId,code,num,glist.length,r,groups.size>1?`;sigGroup=${gi}/${groups.size}`:'')
  }
}

// 2) 通用 code：每样本 code__num
for(const p of genericSamples){
  if(specs.length>=LIMIT)break
  const code=p.structureCode
  const num=p.sourceNum
  const specId=`${code}__${num}`
  const r=compile(code,num)
  if(r.error){
    report.push([specId,num,1,'skip',r.error].join(','))
    continue
  }
  pushCompiled(specId,code,num,1,r,';generic')
}

// 3) REA 失配接管候选：按签名编规格（供 apply 接管）
for(const p of reaTakeoverCandidates){
  if(specs.length>=LIMIT)break
  const code=p.structureCode
  const num=p.sourceNum
  const specId=`${code}__${num}`
  if(seenSpecIds.has(specId)||seenSpecIds.has(code))continue
  const r=compile(code,num)
  if(r.error){
    report.push([specId,num,1,'skip',`rea-takeover:${r.error}`].join(','))
    continue
  }
  pushCompiled(specId,code,num,1,r,';rea-takeover')
}

writeFileSync(
  outPath,
  `/** auto-generated by scripts/build-structure-specs.mjs — 结构规格（公式+图元，无刀版坐标） */\nexport default ${JSON.stringify({from:FROM,specs})}\n`
)
writeFileSync(join(reportDir,'17_结构规格编译.csv'),report.join('\n'),'utf8')
console.log(JSON.stringify({from:FROM,candidates:ranked.length,compiled:specs.length,skipped:report.length-1-specs.length},null,2))

const v=spawnSync(process.execPath,[join(root,'scripts','validate-structure-specs.mjs')],{stdio:'inherit',cwd:root})
if(v.status){
  console.error('build-structure-specs: validation step failed')
  process.exit(v.status)
}
