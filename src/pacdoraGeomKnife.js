/**
 * 运输箱例外：Pacdora geometry JSON → createKnife 同构 knife。
 * 试播阶段尺寸锁定；修复：动画角累加带符号、多段裁切/出血子路径、多根件森林。
 */
import {foldStagesFromAnimation} from './foldStages.js'
import {sizeArrowDataFromBounds} from './dimAnnotations.js'
import {BLEED_EXTRA_MM,expandBleedLoops} from './knife.js'
import {publicAssetUrl} from './assetUrl.js'
import {commandsToPathData,pathCommandsFromLoop} from './geom/flattenPath.js'
import {sampleSvgArc} from './geom/arcSample.js'
import LAYER_ASSEMBLY_REF from './catalog/layerAssemblyRef.js'

const cache=new Map()
const inflight=new Map()

export function pathFromCmds(cmds){
  if(!Array.isArray(cmds))return ''
  const parts=[]
  for(const c of cmds){
    if(!c)continue
    if(c.mtd==='M')parts.push(`M ${c.x} ${c.y}`)
    else if(c.mtd==='L')parts.push(`L ${c.x} ${c.y}`)
    // Pacdora arc/dir → SVG large-arc / sweep
    else if(c.mtd==='A')parts.push(`A ${c.rx||0} ${c.ry||0} ${c.ang||0} ${c.arc?1:0} ${c.dir?1:0} ${c.x} ${c.y}`)
    else if(c.mtd==='Q')parts.push(`Q ${c.cx} ${c.cy} ${c.x} ${c.y}`)
    else if(c.mtd==='C')parts.push(`C ${c.cx1??c.cx} ${c.cy1??c.cy} ${c.cx2??c.cx} ${c.cy2??c.cy} ${c.x} ${c.y}`)
    else if(c.mtd==='Z')parts.push('Z')
  }
  return parts.join(' ')
}

/** 按 M 拆成独立子路径，避免多坯件/多环被连成交叉线段 */
export function splitCmdsIntoSubpaths(cmds){
  const out=[]
  let cur=[]
  for(const c of cmds||[]){
    if(!c)continue
    if(c.mtd==='M'){
      if(cur.length)out.push(cur)
      cur=[c]
    }else{
      if(!cur.length)cur.push({mtd:'M',x:c.x,y:c.y})
      cur.push(c)
    }
  }
  if(cur.length)out.push(cur)
  return out
}

export function cmdsToPolyline(cmds,{arcSegs=10}={}){
  const pts=[]
  let cx=0,cy=0,started=false
  const push=(x,y)=>{
    if(!Number.isFinite(x)||!Number.isFinite(y))return
    const last=pts[pts.length-1]
    if(last&&Math.hypot(last[0]-x,last[1]-y)<1e-6)return
    pts.push([x,y])
  }
  for(const c of cmds||[]){
    if(!c)continue
    if(c.mtd==='M'){
      cx=c.x;cy=c.y;started=true;push(cx,cy)
    }else if(c.mtd==='L'){
      cx=c.x;cy=c.y;if(started)push(cx,cy)
    }else if(c.mtd==='A'){
      const x2=c.x,y2=c.y
      // 按真实圆弧取点（large-arc = arc，sweep = dir），不再用二次曲线近似
      for(const q of sampleSvgArc(cx,cy,x2,y2,c.rx,c.ry,c.ang,c.arc,c.dir,Math.max(4,arcSegs>>1)))push(q[0],q[1])
      cx=x2;cy=y2
    }else if(c.mtd==='Q'){
      const x1=cx,y1=cy,qx=c.cx,qy=c.cy,x2=c.x,y2=c.y
      for(let i=1;i<=arcSegs;i++){
        const t=i/arcSegs
        push((1-t)*(1-t)*x1+2*(1-t)*t*qx+t*t*x2,(1-t)*(1-t)*y1+2*(1-t)*t*qy+t*t*y2)
      }
      cx=x2;cy=y2
    }else if(c.mtd==='C'){
      const x1=cx,y1=cy
      const cx1=c.cx1??c.cx,cy1=c.cy1??c.cy,cx2=c.cx2??c.cx,cy2=c.cy2??c.cy
      const x2=c.x,y2=c.y
      for(let i=1;i<=arcSegs;i++){
        const t=i/arcSegs,u=1-t
        push(u*u*u*x1+3*u*u*t*cx1+3*u*t*t*cx2+t*t*t*x2,u*u*u*y1+3*u*u*t*cy1+3*u*t*t*cy2+t*t*t*y2)
      }
      cx=x2;cy=y2
    }else if(c.mtd==='Z'){
      if(pts.length)push(pts[0][0],pts[0][1])
    }
  }
  if(pts.length>=2){
    const a=pts[0],b=pts[pts.length-1]
    if(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-4)pts.pop()
  }
  return pts
}

function cmdsToSegments(cmds){
  const segs=[]
  for(const sub of splitCmdsIntoSubpaths(cmds)){
    const poly=cmdsToPolyline(sub,{arcSegs:8})
    for(let i=0;i<poly.length-1;i++){
      const a=poly[i],b=poly[i+1]
      if(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-6)continue
      segs.push({x1:a[0],y1:a[1],x2:b[0],y2:b[1]})
    }
    if(poly.length>=3){
      const a=poly[poly.length-1],b=poly[0]
      if(Math.hypot(a[0]-b[0],a[1]-b[1])>1e-4)segs.push({x1:a[0],y1:a[1],x2:b[0],y2:b[1]})
    }
  }
  return segs
}

function pickLayer(j){
  if(!j?.layer)return null
  if(j.layer.traditional)return j.layer.traditional
  const keys=Object.keys(j.layer)
  return keys.length?j.layer[keys[0]]:null
}

const SHEET_GAP_MM=24
const X_KEYS=['x','cx','cx1','cx2','x1','x2']
const Y_KEYS=['y','cy','cy1','cy2','y1','y2']

function shiftPoint(o,dx,dy){
  if(!o||typeof o!=='object')return o
  const out={...o}
  for(const k of X_KEYS)if(typeof out[k]==='number')out[k]+=dx
  for(const k of Y_KEYS)if(typeof out[k]==='number')out[k]+=dy
  return out
}

function shiftHole(h,dx,dy){
  if(Array.isArray(h))return h.map(c=>shiftPoint(c,dx,dy))
  if(h&&Array.isArray(h.dlist))return {...h,dlist:h.dlist.map(c=>shiftPoint(c,dx,dy))}
  return h
}

/** `Parent_Child` 折线名按改名表重写（与 parseFoldName 同一拆法） */
function renameFoldName(name,rename){
  const s=String(name||'')
  const i=s.indexOf('_')
  if(i<=0||i>=s.length-1)return name
  const a=s.slice(0,i),b=s.slice(i+1)
  return `${rename.get(a)||a}_${rename.get(b)||b}`
}

/**
 * 多层盒（精品盒：面纸 + 灰板，天盖 / 地盖 / 围框……）：每层是一张独立的刀版，坐标各自从 0 起。
 * 把所有图层排到同一张版面上（按官方图层顺序，从左到右换行），合成一层交给后面的回放流程。
 * 跨层重名的面片加 `~层序号` 后缀，折线名与折叠动画同步改名。
 */
function mergeSheetLayers(raw){
  const order=(raw?.modeCate?.layerList||[]).map(l=>l?.name).filter(Boolean)
  const info=new Map((raw?.modeCate?.layerList||[]).map(l=>[l?.name,l]))
  const names=Object.keys(raw.layer).filter(n=>Array.isArray(raw.layer[n]?.faces)&&raw.layer[n].faces.length)
  names.sort((a,b)=>{
    const ia=order.indexOf(a),ib=order.indexOf(b)
    return (ia<0?1e6:ia)-(ib<0?1e6:ib)
  })
  if(!names.length)return null
  if(names.length===1)return raw.layer[names[0]]

  const sizes=names.map(n=>{
    const ly=raw.layer[n]
    let w=Number(ly.totalX)||0,h=Number(ly.totalY)||0
    for(const f of ly.faces){w=Math.max(w,(Number(f.x)||0)+(Number(f.w)||0));h=Math.max(h,(Number(f.y)||0)+(Number(f.h)||0))}
    return {w,h}
  })
  const area=sizes.reduce((t,z)=>t+(z.w+SHEET_GAP_MM)*(z.h+SHEET_GAP_MM),0)
  const rowLimit=Math.max(...sizes.map(z=>z.w),Math.sqrt(area)*1.35)

  const out={faces:[],folds:[],cuts:[],bleeds:[],holes:[],pieces:[],animation:{groups:[],animations:[]}}
  const used=new Set()
  let cx=0,cy=0,rowH=0,totalX=0,totalY=0
  names.forEach((name,idx)=>{
    const ly=raw.layer[name]
    const {w,h}=sizes[idx]
    if(cx>0&&cx+w>rowLimit){cx=0;cy+=rowH+SHEET_GAP_MM;rowH=0}
    const dx=cx,dy=cy
    const rename=new Map()
    for(const f of ly.faces)if(used.has(f.name))rename.set(f.name,`${f.name}~${idx+1}`)
    for(const f of ly.faces)used.add(rename.get(f.name)||f.name)
    const fold=n=>rename.size?renameFoldName(n,rename):n
    for(const f of ly.faces){
      out.faces.push({
        ...f,
        name:rename.get(f.name)||f.name,
        x:(Number(f.x)||0)+dx,
        y:(Number(f.y)||0)+dy,
        dlist:(f.dlist||[]).map(c=>{
          const o=shiftPoint(c,dx,dy)
          if(o.foldline)o.foldline=fold(o.foldline)
          return o
        }),
        holes:Array.isArray(f.holes)?f.holes.map(hh=>shiftHole(hh,dx,dy)):f.holes
      })
    }
    for(const fo of ly.folds||[])out.folds.push({...shiftPoint(fo,dx,dy),name:fold(fo.name)})
    for(const c of ly.cuts||[])out.cuts.push(shiftPoint(c,dx,dy))
    for(const c of ly.bleeds||[])out.bleeds.push(shiftPoint(c,dx,dy))
    for(const hh of ly.holes||[])out.holes.push(shiftHole(hh,dx,dy))
    ;(ly.animation?.animations||[]).forEach((stage,i)=>{
      const dst=out.animation.animations[i]||(out.animation.animations[i]=[])
      for(const st of stage||[]){
        if(!st)continue
        // 整件动作（平移 / 翻转）的 name 是面名，折叠的 name 是 父_子
        const whole=st.action==='translate'||st.action==='rotateMesh'
        const nm=rename.size&&st.name?(whole?(rename.get(st.name)||st.name):fold(st.name)):st.name
        dst.push(nm===st.name?st:{...st,name:nm})
      }
    })
    const meta=info.get(name)||{}
    out.pieces.push({
      id:name,
      label:String(meta.friendlyName||name),
      labelEn:String(meta.friendlyName_en||name),
      grey:!!meta.isGrey,
      thickness:Number(ly.thickness)||0,
      x:dx,y:dy,w,h,
      // 灰板：官方的 3D 成品里只有面纸层，灰板不单独展示（被面纸包住），装配后隐藏
      inert:!!meta.isGrey,
      // 官方装配位姿：把这一层（各自的刀版坐标）摆到成品盒里的位置与朝向
      transform:ly.transform&&ly.transform.position&&ly.transform.rotate
        ?{position:{...ly.transform.position},rotate:{...ly.transform.rotate}}
        :null
    })
    cx+=w+SHEET_GAP_MM
    rowH=Math.max(rowH,h)
    totalX=Math.max(totalX,dx+w)
    totalY=Math.max(totalY,dy+h)
  })
  const grey=out.pieces.find(pc=>pc.grey)
  out.thickness=grey?.thickness||Number(raw.layer[names[0]].thickness)||0
  out.bleedline=Number(raw.layer[names[0]].bleedline)||0
  out.totalX=totalX
  out.totalY=totalY
  return out
}

/** 回放用的图层：单层取其本身；多层合成一张版面 */
function replayLayer(raw){
  if(!raw?.layer)return null
  if(raw.layer.traditional)return raw.layer.traditional
  const keys=Object.keys(raw.layer)
  if(keys.length<=1)return pickLayer(raw)
  return mergeSheetLayers(raw)||pickLayer(raw)
}

function parseFoldName(name){
  const s=String(name||'').trim()
  if(!s||s==='x'||s==='X')return null
  const i=s.indexOf('_')
  if(i<=0||i>=s.length-1)return null
  const parent=s.slice(0,i),child=s.slice(i+1)
  if(!parent||!child||parent==='x'||child==='x')return null
  return {parent,child}
}

function inferSide(parent,child){
  if(!parent||!child)return 'top'
  const pcx=parent.x+parent.w/2,pcy=parent.y+parent.h/2
  const ccx=child.x+child.w/2,ccy=child.y+child.h/2
  const dx=ccx-pcx,dy=ccy-pcy
  if(Math.abs(dx)>=Math.abs(dy))return dx>=0?'right':'left'
  return dy>=0?'bottom':'top'
}

function defaultFoldDeg(faceName){
  const n=String(faceName||'')
  if(/^(HT|HL|HB|FT|FRT|FLT|FLB|FRB)/i.test(n)||/Hook|Lock|Tuck/i.test(n))return -155
  return -90
}

/** 累加各阶段带符号转角（自锁底常先 -120 再 +30 → 净 -90） */
function angleMapFromAnimation(ly){
  const map={}
  for(const stage of foldStagesFromAnimation(ly?.animation?.animations)){
    for(const step of stage){
      if(!step.child)continue
      map[step.child]=(map[step.child]||0)+step.rotate
    }
  }
  return map
}

function buildHoles(ly){
  const holes=[]
  for(const f of ly.faces||[]){
    for(const h of f.holes||[]){
      const cmds=Array.isArray(h)?h:(h.dlist||[])
      if(!cmds.length)continue
      const loop=cmdsToPolyline(cmds)
      if(loop.length<3)continue
      holes.push({face:f.name,loop,pathCommands:cmds,path:pathFromCmds(cmds)})
    }
  }
  // 同一个孔常在 faces[].holes 与 layer.holes 里各登记一次：按包围盒去重
  const seen=new Set()
  const boxKey=loop=>{
    let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity
    for(const p of loop){x0=Math.min(x0,p[0]);y0=Math.min(y0,p[1]);x1=Math.max(x1,p[0]);y1=Math.max(y1,p[1])}
    return [x0,y0,x1,y1].map(v=>Math.round(v*2)/2).join(',')
  }
  for(const h of holes)seen.add(boxKey(h.loop))
  for(const h of ly.holes||[]){
    const cmds=Array.isArray(h)?h:(h.dlist||[])
    if(!cmds.length)continue
    const loop=cmdsToPolyline(cmds)
    if(loop.length<3)continue
    const k=boxKey(loop)
    if(seen.has(k))continue
    seen.add(k)
    holes.push({face:h.face||null,loop,pathCommands:cmds,path:pathFromCmds(cmds)})
  }
  return holes
}

/** 无向连通分量；不把不同坯件硬并到同一根 */
function connectedComponents(faceNames,folds){
  const adj=new Map([...faceNames].map(n=>[n,new Set()]))
  for(const fo of folds||[]){
    const p=parseFoldName(fo.name)
    if(!p)continue
    if(!adj.has(p.parent)||!adj.has(p.child))continue
    adj.get(p.parent).add(p.child)
    adj.get(p.child).add(p.parent)
  }
  const seen=new Set(),comps=[]
  for(const n of faceNames){
    if(seen.has(n))continue
    const q=[n],comp=[]
    seen.add(n)
    while(q.length){
      const u=q.pop();comp.push(u)
      for(const v of adj.get(u)||[]){
        if(seen.has(v))continue
        seen.add(v);q.push(v)
      }
    }
    comps.push(comp)
  }
  return comps
}

/**
 * @param {object} raw Pacdora geom JSON
 * @param {{sourceNum?:string,label?:string,length?:number,width?:number,height?:number,thickness?:number}} meta
 */
export function knifeFromPacdoraGeom(raw,meta={}){
  const ly=replayLayer(raw)
  if(!ly?.faces?.length)throw new Error('pacdora geom: no faces')

  const angleMap=angleMapFromAnimation(ly)
  const faceList=ly.faces||[]
  const faceNames=new Set(faceList.map(f=>f.name))
  const byRaw=Object.fromEntries(faceList.map(f=>[f.name,f]))

  const parentOf=new Map()
  const foldByChild=new Map()
  for(const fo of ly.folds||[]){
    const parsed=parseFoldName(fo.name)
    if(!parsed)continue
    if(!faceNames.has(parsed.parent)||!faceNames.has(parsed.child))continue
    if(parsed.parent===parsed.child)continue
    // 同名折线以首次为准；动画里的 Parent_Child 与 folds 一致
    if(!parentOf.has(parsed.child)){
      parentOf.set(parsed.child,parsed.parent)
      foldByChild.set(parsed.child,fo)
    }
  }

  // 破环：若 child 链回到自身，取消最后一条
  for(const child of [...parentOf.keys()]){
    const seen=new Set()
    let n=child
    while(parentOf.has(n)){
      if(seen.has(n)){parentOf.delete(child);foldByChild.delete(child);break}
      seen.add(n)
      n=parentOf.get(n)
    }
  }

  const comps=connectedComponents(faceNames,ly.folds)
  const rootSet=new Set()
  for(const comp of comps){
    const candidates=comp.filter(n=>!parentOf.has(n))
    const root=candidates.sort((a,b)=>(byRaw[b].w*byRaw[b].h)-(byRaw[a].w*byRaw[a].h))[0]||comp[0]
    rootSet.add(root)
    for(const n of comp){
      if(n===root)continue
      if(!parentOf.has(n)){
        // 分量内仍无父的面：挂到同分量 root（仅同坯），避免跨件硬连
        parentOf.set(n,root)
      }
    }
  }

  const faces=faceList.map(f=>{
    const outline=cmdsToPolyline(f.dlist||[])
    const isRoot=rootSet.has(f.name)
    const parent=isRoot?null:(parentOf.get(f.name)||null)
    const parentFace=parent?byRaw[parent]:null
    const side=parent?inferSide(
      {x:parentFace?.x??0,y:parentFace?.y??0,w:parentFace?.w??0,h:parentFace?.h??0},
      {x:f.x,y:f.y,w:f.w,h:f.h}
    ):null
    const face={
      name:f.name,
      x:Number(f.x)||0,
      y:Number(f.y)||0,
      w:Number(f.w)||0,
      h:Number(f.h)||0,
      parent,
      side,
      dlist:f.dlist||[]
    }
    if(outline.length>=3)face.outline=outline
    const fo=foldByChild.get(f.name)
    if(fo&&Number.isFinite(fo.x1)){
      face.hingeLine=[[fo.x1,fo.y1],[fo.x2,fo.y2]]
    }
    return face
  })

  const folds=(ly.folds||[]).map(fo=>({
    name:fo.name,
    x1:fo.x1,y1:fo.y1,x2:fo.x2,y2:fo.y2
  })).filter(fo=>parseFoldName(fo.name)||fo.name) // 保留几何折线供 2D；无效名仍画线
    // 多片式盒型用零长度（实测 0.000001 或 0.01 mm；真实的最短折线是纸厚级的 0.15 mm）的"折线"标记两片的拼接位置（名称如 H_R），只供上面的面片父子关系/3D 拼装使用；
    // 它不是压痕，坐标还可能落在轮廓之外，不进入 2D 画布、压痕图层和导出文件
    .filter(fo=>!(Number.isFinite(fo.x1)&&Number.isFinite(fo.x2)&&Math.hypot(fo.x2-fo.x1,fo.y2-fo.y1)<0.05))

  const cutSubs=splitCmdsIntoSubpaths(ly.cuts||[])
  const bleedSubs=splitCmdsIntoSubpaths(ly.bleeds||[])
  const cutPaths=cutSubs.map(pathFromCmds).filter(Boolean)
  // 官方 bleed 再等距外扩默认 +10mm（紧贴的多件先合并）
  // 没有官方出血线（按尺寸插值的刀版不带）：用面片轮廓的并集外扩「官方出血 + 预览加宽」
  const bleedLoops=bleedSubs.length
    ?expandBleedLoops(bleedSubs.map(sub=>cmdsToPolyline(sub,{arcSegs:8})),BLEED_EXTRA_MM)
    :expandBleedLoops(
      faces.map(f=>Array.isArray(f.outline)&&f.outline.length>=3?f.outline:[[f.x,f.y],[f.x+f.w,f.y],[f.x+f.w,f.y+f.h],[f.x,f.y+f.h]]),
      (Number(ly.bleedline)||5)+BLEED_EXTRA_MM
    )
  const bleedPaths=bleedLoops.map(loop=>{
    if(!loop.length)return ''
    return loop.map((p,i)=>`${i?'L':'M'} ${p[0]} ${p[1]}`).join(' ')+' Z'
  }).filter(Boolean)
  const trimPathCommands=cutSubs.map(path=>path.map(c=>({...c})))
  const creasePathCommands=folds
    .filter(f=>Number.isFinite(f.x1)&&Number.isFinite(f.y1)&&Number.isFinite(f.x2)&&Number.isFinite(f.y2))
    .map(f=>[{mtd:'M',x:f.x1,y:f.y1},{mtd:'L',x:f.x2,y:f.y2}])
  const bleedPathCommands=bleedLoops.map(loop=>pathCommandsFromLoop(loop))
  const paths={trim:trimPathCommands,crease:creasePathCommands,bleed:bleedPathCommands}
  const cutPath=cutPaths.join(' ')
  const bleedPath=bleedPathCommands.map(commandsToPathData).join(' ')
  const cuts=cmdsToSegments(ly.cuts||[])
  const bleeds=bleedLoops.flatMap(loop=>{
    const segs=[]
    for(let i=0;i<loop.length;i++){
      const a=loop[i],b=loop[(i+1)%loop.length]
      if(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-6)continue
      segs.push({x1:a[0],y1:a[1],x2:b[0],y2:b[1]})
    }
    return segs
  })

  // 多层盒：与官方 3D 结果对照得到的装配数据（步数、各层每一步的位置修正），没有则为 null
  const assemblyRef=ly.pieces?(LAYER_ASSEMBLY_REF[String(meta.sourceNum||raw.cate_no||'')]||null):null
  // 各层动画已按步号合并；所有层都为空的步，官方同样会跳过
  let foldStages=foldStagesFromAnimation(ly?.animation?.animations)
  if(assemblyRef?.stages&&foldStages.length>assemblyRef.stages)foldStages=foldStages.slice(0,assemblyRef.stages)
  const axisByChild={}
  // 每一步所绕折线的位置：骨架据此区分「绕自己的主折线转」和「绕另一条折线转」
  const foldLineByName=new Map()
  for(const fo of ly.folds||[]){
    if(!fo?.name||foldLineByName.has(fo.name))continue
    if(![fo.x1,fo.y1,fo.x2,fo.y2].every(Number.isFinite))continue
    if(Math.hypot(fo.x2-fo.x1,fo.y2-fo.y1)<0.05)continue
    foldLineByName.set(fo.name,[[fo.x1,fo.y1],[fo.x2,fo.y2]])
  }
  for(const stage of foldStages)for(const s of stage){
    if(s.child&&s.vector&&!axisByChild[s.child])axisByChild[s.child]=s.vector
    if(s.child&&s.fold&&foldLineByName.has(s.fold))s.line=foldLineByName.get(s.fold)
  }
  // 一个面在同一步里出现多条转动指令时，只有绕「它与父面之间那条折线」的才决定它的姿态：
  //  · 这条折线被开槽断成两段时，官方给两段各起一个名字（如 FR1_FR3、FR2_FR3），各写一次同样的角度——
  //    是同一个转动，累加会转成两倍（侧板的内折片被甩到盒外）；
  //  · 同一步里绕别的折线的指令（它同时连着的其他面）是闭合连杆的另一边，角度是结果而不是驱动。
  // 所以另备一份「同一步里有主折线指令时，同角度的只留一个，别的折线的丢掉」的步骤（foldStagesAlt）。
  // 两种读法各有盒型成立（150430 必须去重，112662 必须累加），数据里分不出来：
  // 由 3D 骨架分别折一遍，取合盖外形更接近标称外尺寸的那一种（见 geomRig.pickFoldStages）。
  // 没有主折线指令的步（如先随锁舌折、后面某一步再单独绕另一条线转）原样保留，由骨架逐步复合。
  const sameLine=(a,b)=>{
    const [[ax,ay],[bx,by]]=a,len=Math.hypot(bx-ax,by-ay)
    if(len<1e-6)return false
    return b.every(([x,y])=>Math.abs((x-ax)*(by-ay)-(y-ay)*(bx-ax))/len<=0.5)
  }
  const mainLineOf=Object.fromEntries(faces.filter(f=>f.parent&&Array.isArray(f.hingeLine)).map(f=>[f.name,f.hingeLine]))
  let foldStagesAlt=foldStages.map(stage=>{
    const isMain=st=>!!(st.child&&st.line&&mainLineOf[st.child]&&sameLine(mainLineOf[st.child],st.line))
    const withMain=new Set(stage.filter(isMain).map(st=>st.child))
    const kept=[]
    for(const st of stage){
      if(st.child&&st.line&&withMain.has(st.child)){
        if(!isMain(st))continue
        if(kept.some(k=>k.child===st.child&&k.fold!==st.fold&&Math.abs(Number(k.rotate)-Number(st.rotate))<1))continue
      }
      kept.push(st)
    }
    return kept
  })
  if(foldStagesAlt.every((st,i)=>st.length===foldStages[i].length))foldStagesAlt=null
  const refOuter=raw?.outSize&&[raw.outSize.L,raw.outSize.W,raw.outSize.H].every(v=>Number(v)>0)
    ?{L:Number(raw.outSize.L),W:Number(raw.outSize.W),H:Number(raw.outSize.H)}:null
  const hinges=faces.filter(f=>f.parent).map(f=>{
    const signed=Number.isFinite(angleMap[f.name])?angleMap[f.name]:defaultFoldDeg(f.name)
    const h={parent:f.parent,child:f.name,side:f.side,angle:signed}
    if(f.hingeLine)h.hingeLine=f.hingeLine
    if(axisByChild[f.name])h.axisVec=axisByChild[f.name]
    return h
  })

  const holes=buildHoles(ly)
  const xs=[],ys=[]
  for(const f of faces){
    xs.push(f.x,f.x+f.w);ys.push(f.y,f.y+f.h)
    for(const p of f.outline||[]){xs.push(p[0]);ys.push(p[1])}
  }
  const minX=Math.min(...xs),minY=Math.min(...ys),maxX=Math.max(...xs),maxY=Math.max(...ys)

  const size=raw.size||{}
  const L=Number(meta.length??size.L)||0
  const W=Number(meta.width??size.W)||0
  const H=Number(meta.height??size.H)||0
  const T=Number(meta.thickness??ly.thickness??size.D)||1.5
  const sourceNum=String(meta.sourceNum||raw.cate_no||'')
  const bleedSrc=Number(ly.bleedline)||5
  const bleedEff=bleedSrc+BLEED_EXTRA_MM

  const layers={
    trim:{role:'trim',color:'#2028b0',segments:cuts,paths:trimPathCommands},
    crease:{role:'crease',color:'#fa0000',dash:true,segments:folds.filter(f=>Number.isFinite(f.x1)).map(f=>({x1:f.x1,y1:f.y1,x2:f.x2,y2:f.y2})),paths:creasePathCommands},
    bleed:{role:'bleed',color:'#46ba00',segments:bleeds,paths:bleedPathCommands}
  }

  return {
    schema:'boxcraft.knife.v3',
    unit:'mm',
    template:`pacdora-geom:${sourceNum}`,
    templateInfo:{
      id:`pacdora-geom:${sourceNum}`,
      label:meta.label||sourceNum,
      labelEn:'Pacdora shipping sample',
      standard:'官方样本刀版（运输箱例外）',
      sizeRule:'locked-sample'
    },
    sourceNum,
    geomMode:true,
    dimensions:{
      length:L,width:W,height:H,thickness:T,
      sizeMode:'inner',fluteDirection:'L',
      inner:{length:L,width:W,height:H},
      outer:{length:L,width:W,height:H},
      panel:{length:L,width:W,height:H}
    },
    material:{id:'kraft',science:'pacdora-sample',fluteDirection:'L'},
    bleed:bleedSrc,
    bleedEffective:bleedEff,
    params:{},
    faces,cuts,bleeds,folds,hinges,foldStages,layers,paths,holes,
    ...(foldStagesAlt&&refOuter?{foldStagesAlt,refOuter}:{}),
    cutPath,bleedPath,cutPaths,bleedPaths,
    meta:{anyPoly:true,fromPacdoraGeom:true,components:comps.length,foldStageCount:foldStages.length,bleedExtra:BLEED_EXTRA_MM,bleedEffective:bleedEff},
    topology:{
      root:[...rootSet][0]||faces[0]?.name,
      roots:[...rootSet],
      faceCount:faces.length,
      hingeCount:hinges.length,
      faceOrder:faces.map(f=>f.name),
      supportsClosedCheck:false,
      supportsPiece:false,
      holeCount:holes.length,
      anyPoly:true,
      components:comps.length
    },
    animation:ly.animation||{groups:[],animations:foldStages},
    // 多层盒：版面上各件的位置与名称（地盖面纸、天盖灰板……），单层为 null
    sheetPieces:ly.pieces||null,
    assemblyRef:meta.noAssemblyRef?null:assemblyRef,
    // 官方标称的成品外尺寸：3D 装配后用它自检（对不上就退回散件视图）
    assemblyOuter:ly.pieces&&raw.outSize?{L:Number(raw.outSize.L)||0,W:Number(raw.outSize.W)||0,H:Number(raw.outSize.H)||0}:null,
    sizeArrowData:sizeArrowDataFromBounds(
      {minX,minY,maxX,maxY},
      {length:L,width:W,height:H,sizeMode:'inner'}
    ),
    totalX:Math.round((maxX-minX)*1000)/1000,
    totalY:Math.round((maxY-minY)*1000)/1000,
    bounds:{minX,minY,maxX,maxY},
    manufacturingReady:false,
    productionReady:false,
    provenance:{
      source:'pacdora-geom',
      lockedSample:true,
      unitConfidence:'trusted',
      engineeringExportAllowed:false,
      note:'fixed_snapshot playback — not parametric generation',
    },
    validation:{ok:true,checks:[{id:'pacdora-geom',ok:true,detail:'locked-sample geometry playback (not parametric)'}]}
  }
}

async function fetchGeomJson(num,meta={}){
  const preferred=String(meta.geomPublicRel||'').replace(/^\/+/,'')
  const candidates=[
    preferred,
    `square-geom/${num}.json`,
    `gift-geom/${num}.json`,
    `mailer-geom/${num}.json`,
    `shipping-geom/${num}.json`,
  ].filter(Boolean)
  let lastErr=null
  for(const rel of candidates){
    try{
      const r=await fetch(publicAssetUrl(rel))
      if(!r.ok){
        lastErr=new Error(`geom fetch ${rel}: ${r.status}`)
        continue
      }
      return await r.json()
    }catch(err){
      lastErr=err
    }
  }
  throw lastErr||new Error(`geom fetch ${num}: not found`)
}

export async function loadPacdoraGeomKnife(sourceNum,meta={}){
  const num=String(sourceNum||'')
  if(!num)throw new Error('missing sourceNum')
  // 同一编号在不同类目里可能是不同刀版：指定了文件就按文件缓存
  const key=meta.geomPublicRel?`${num}@${String(meta.geomPublicRel).replace(/^\/+/,'')}`:num
  if(cache.has(key))return cache.get(key)
  if(inflight.has(key))return inflight.get(key)
  const p=fetchGeomJson(num,meta)
    .then(raw=>{
      const knife=knifeFromPacdoraGeom(raw,{...meta,sourceNum:num})
      cache.set(key,knife)
      inflight.delete(key)
      return knife
    })
    .catch(err=>{
      inflight.delete(key)
      throw err
    })
  inflight.set(key,p)
  return p
}

export function clearPacdoraGeomCache(){
  cache.clear()
}
