/** Export dieline from knife.layers (trim / crease / bleed). Demo only — not for die cutting. */
import {PDFDocument,PDFHexString,PDFName,PDFOperator,rgb,StandardFonts} from 'pdf-lib'
import {artworkToSvg,drawArtworkPdf,planArtwork,ARTWORK_PDF_LAYER} from './exportArtwork.js'
import {buildDimAnnotations,dimAnnotationsToSvg,DIM_COLOR} from './dimAnnotations.js'
import {
  arcCenter,
  commandsToPathData,
  flattenCubicPath,
} from './geom/flattenPath.js'

const LAYER_META={
  trim:{dxf:'TRIM',color:'#2028b0',aci:5},
  crease:{dxf:'CREASE',color:'#fa0000',aci:1,dash:true},
  bleed:{dxf:'BLEED',color:'#46ba00',aci:3}
}

/** PDF Helvetica (WinAnsi) cannot encode CJK; keep Chinese in SVG comments only */
const DISCLAIMER_EN='DEMO · NOT FOR DIE CUTTING'
const DISCLAIMER_NOTE='不可开模'

export function segmentsOf(knife,role){
  const segs=knife?.layers?.[role]?.segments
  if(!Array.isArray(segs))throw new Error(`missing layers.${role}.segments`)
  return segs
}

function boundsOf(knife){
  const b=knife?.bounds
  if(!b||![b.minX,b.minY,b.maxX,b.maxY].every(Number.isFinite))throw new Error('missing knife.bounds')
  return b
}

/** Knife Y-down → CAD Y-up; origin at bounds bottom-left */
function toCad(x,y,b){
  return {x:x-b.minX,y:b.maxY-y}
}

function hexToRgb01(hex){
  const h=String(hex||'#000000').replace('#','')
  const n=parseInt(h.length===3?h.split('').map(c=>c+c).join(''):h,16)
  return {r:((n>>16)&255)/255,g:((n>>8)&255)/255,b:(n&255)/255}
}

function validationNote(knife){
  return knife?.validation?.ok===false?'validation.ok=false':`validation.ok=${knife?.validation?.ok!==false}`
}

function normalizedOptions(options={}){
  return {
    showDimensions:options.showDimensions??options.includeDims??true,
    showFaceNames:options.showFaceNames??false,
    showBleed:options.showBleed??true,
    showTitleBlock:options.showTitleBlock??true,
    displayUnit:options.displayUnit==='in'?'in':'mm',
  }
}

function pathsOf(knife,role){
  const direct=knife?.paths?.[role]||knife?.layers?.[role]?.paths
  if(Array.isArray(direct)&&direct.length)return direct
  const segs=segmentsOf(knife,role)
  return segs.map(s=>[
    {mtd:'M',x:s.x1,y:s.y1},
    {mtd:'L',x:s.x2,y:s.y2}
  ])
}

function displayNumber(mm,unit){
  return unit==='in'?(Number(mm)/25.4).toFixed(2):String(Math.round(Number(mm)*100)/100)
}

function annotationLabel(annotation,unit){
  const suffix=unit==='in'?' in':' mm'
  const raw=String(annotation?.text?.value||annotation?.label||'')
  if(annotation?.kind==='face'&&raw.includes('×')){
    return raw.split('×').map(v=>displayNumber(Number(v),unit)).join('x')+suffix
  }
  return raw.replace(/(-?\d+(?:\.\d+)?)\s*$/,(_,value)=>`${displayNumber(Number(value),unit)}${suffix}`)
}

function faceNameLabel(face){
  return pdfSafeLabel(face?.name||'')
}

/** ASCII DXF R12：真圆弧用 ARC，连续直线用 POLYLINE；坐标单位始终为 mm。 */
export function toDxf(knife,options={}){
  const b=boundsOf(knife)
  const opts=normalizedOptions(options)
  const lines=[]
  const push=(code,value)=>{lines.push(String(code),String(value))}
  const layerNames=['TRIM','CREASE','BLEED','DIM','TEXT']
  const layerAci={TRIM:5,CREASE:1,BLEED:3,DIM:8,TEXT:7}

  push(0,'SECTION');push(2,'HEADER')
  push(9,'$INSUNITS');push(70,4)
  push(9,'$MEASUREMENT');push(70,1)
  push(0,'ENDSEC')

  push(0,'SECTION');push(2,'TABLES')
  push(0,'TABLE');push(2,'LAYER');push(70,layerNames.length)
  for(const name of layerNames){
    push(0,'LAYER');push(2,name);push(70,0);push(62,layerAci[name]);push(6,'CONTINUOUS')
  }
  push(0,'ENDTAB')
  push(0,'ENDSEC')

  const emitPolyline=(layer,points,{closed=false}={})=>{
    const clean=[]
    for(const p of points||[]){
      if(!Number.isFinite(p?.x)||!Number.isFinite(p?.y))continue
      const last=clean[clean.length-1]
      if(!last||Math.hypot(last.x-p.x,last.y-p.y)>1e-8)clean.push(p)
    }
    if(clean.length<2)return
    push(0,'POLYLINE');push(8,layer);push(66,1);push(70,closed?1:0)
    for(const p of clean){
      push(0,'VERTEX');push(8,layer);push(10,p.x);push(20,p.y);push(30,0)
    }
    push(0,'SEQEND');push(8,layer)
  }
  const emitArc=(layer,start,cmd)=>{
    const center=arcCenter(start.x,start.y,cmd.x,cmd.y,cmd.rx,cmd.ry,cmd.ang||0,!!cmd.arc,!!cmd.dir)
    const circular=center&&Math.abs(center.rx-center.ry)<1e-4
    if(!circular)return false
    const cadCenter=toCad(center.cx,center.cy,b)
    const cadStart=toCad(start.x,start.y,b)
    const cadEnd=toCad(cmd.x,cmd.y,b)
    const angle=p=>{
      let deg=Math.atan2(p.y-cadCenter.y,p.x-cadCenter.x)*180/Math.PI
      if(deg<0)deg+=360
      return deg
    }
    const forward=-center.dt>=0
    push(0,'ARC');push(8,layer)
    push(10,cadCenter.x);push(20,cadCenter.y);push(30,0);push(40,center.rx)
    push(50,angle(forward?cadStart:cadEnd));push(51,angle(forward?cadEnd:cadStart))
    return true
  }
  const emitPath=(layer,cmds)=>{
    let current=null,start=null,linePoints=[]
    const flush=(closed=false)=>{
      emitPolyline(layer,linePoints,{closed})
      linePoints=current?[toCad(current.x,current.y,b)]:[]
    }
    for(const cmd of cmds||[]){
      if(cmd?.mtd==='M'){
        if(linePoints.length>1)flush()
        current={x:Number(cmd.x),y:Number(cmd.y)}
        start={...current}
        linePoints=[toCad(current.x,current.y,b)]
      }else if(cmd?.mtd==='L'&&current){
        current={x:Number(cmd.x),y:Number(cmd.y)}
        linePoints.push(toCad(current.x,current.y,b))
      }else if(cmd?.mtd==='A'&&current){
        if(linePoints.length>1)flush()
        const arcStart={...current}
        if(!emitArc(layer,arcStart,cmd)){
          const sampled=flattenCubicPath([
            {mtd:'M',x:arcStart.x,y:arcStart.y},cmd
          ],{tol:.03,maxPts:128})
          emitPolyline(layer,sampled.map(([x,y])=>toCad(x,y,b)))
        }
        current={x:Number(cmd.x),y:Number(cmd.y)}
        linePoints=[toCad(current.x,current.y,b)]
      }else if((cmd?.mtd==='C'||cmd?.mtd==='Q')&&current){
        const sampled=flattenCubicPath([{mtd:'M',x:current.x,y:current.y},cmd],{tol:.03,maxPts:128})
        linePoints.push(...sampled.slice(1).map(([x,y])=>toCad(x,y,b)))
        current={x:Number(cmd.x),y:Number(cmd.y)}
      }else if(cmd?.mtd==='Z'&&current&&start){
        if(Math.hypot(current.x-start.x,current.y-start.y)>1e-8){
          linePoints.push(toCad(start.x,start.y,b))
        }
        flush(linePoints.length>2)
        current={...start}
      }
    }
    if(linePoints.length>1)flush()
  }
  const emitLine=(layer,line)=>{
    emitPolyline(layer,[toCad(line.x1,line.y1,b),toCad(line.x2,line.y2,b)])
  }
  const emitText=(layer,x,y,text,height=3)=>{
    const p=toCad(x,y,b)
    push(0,'TEXT');push(8,layer);push(10,p.x);push(20,p.y);push(30,0)
    push(40,height);push(1,pdfSafeLabel(text));push(7,'STANDARD')
  }

  push(0,'SECTION');push(2,'ENTITIES')
  for(const role of ['trim','crease','bleed']){
    if(role==='bleed'&&!opts.showBleed)continue
    const m=LAYER_META[role]
    for(const path of pathsOf(knife,role))emitPath(m.dxf,path)
  }
  if(opts.showDimensions){
    for(const annotation of buildDimAnnotations(knife)){
      for(const line of annotation.lines||[])emitLine('DIM',line)
      for(const poly of annotation.polys||[]){
        const points=poly.map(([x,y])=>toCad(x,y,b))
        if(points.length)points.push(points[0])
        emitPolyline('DIM',points,{closed:true})
      }
      if(annotation.text)emitText('TEXT',annotation.text.x,annotation.text.y,annotationLabel(annotation,opts.displayUnit),2.5)
    }
  }
  if(opts.showFaceNames){
    for(const face of knife.faces||[])emitText('TEXT',face.x+face.w/2,face.y+face.h/2,faceNameLabel(face),2.5)
  }
  if(opts.showTitleBlock){
    const d=knife.dimensions||{}
    const size=`${displayNumber(d.length,opts.displayUnit)}x${displayNumber(d.width,opts.displayUnit)}x${displayNumber(d.height,opts.displayUnit)} ${opts.displayUnit}`
    emitText('TEXT',b.minX,b.maxY+8,`${knife.template||'dieline'} ${size}`,3)
  }
  push(0,'ENDSEC')
  push(0,'EOF')
  return lines.join('\n')+'\n'
}

/** Offline SVG from layers (not DOM clone).
 * qualityTier=vector_proof：可缩放校样（仅 viewBox）。
 * qualityTier=engineering|manufacturing：声明物理 width/height mm，与 viewBox 1:1 映射。
 */
export function toSvgDieline(knife,options={}){
  const {
    pad,
    qualityTier='vector_proof',
  }=options
  const opts=normalizedOptions(options)
  const b=boundsOf(knife)
  const bleedPad=Number.isFinite(pad)?pad:26+Number(knife.bleedEffective??((Number(knife.bleed)||0)+10))
  const vbX=b.minX-bleedPad,vbY=b.minY-bleedPad
  const vbW=b.maxX-b.minX+2*bleedPad,vbH=b.maxY-b.minY+2*bleedPad
  const vb=`${vbX} ${vbY} ${vbW} ${vbH}`
  const note=validationNote(knife)
  const tier=String(qualityTier||'vector_proof')
  const phys=tier==='manufacturing'||tier==='engineering'
  const disclaimer=tier==='engineering'
    ?`ENGINEERING CANDIDATE · COMPENSATION UNVERIFIED · NOT FOR PRODUCTION DIE · physical mm · ${note} · manufacturingReady=false`
    :tier==='manufacturing'
    ?`ENGINEERING SVG · physical mm · ${note} · manufacturingReady=false`
    :`${DISCLAIMER_EN} / ${DISCLAIMER_NOTE}; PROOF ONLY; ${note}; manufacturingReady=false`
  const anns=opts.showDimensions?buildDimAnnotations(knife):[]
  const dims=anns.length?`<g id="DIMENSIONS">${dimAnnotationsToSvg(anns,{fontSize:13})}</g>`:''
  const faceNames=opts.showFaceNames
    ?`<g id="FACE_NAMES" fill="#667085">${(knife.faces||[]).map(f=>`<text x="${f.x+f.w/2}" y="${f.y+f.h/2}" text-anchor="middle">${faceNameLabel(f)}</text>`).join('')}</g>`
    :''
  const trimPath=pathsOf(knife,'trim').map(commandsToPathData).join(' ')
  const bleedPath=pathsOf(knife,'bleed').map(commandsToPathData).join(' ')
  const creasePath=pathsOf(knife,'crease').map(commandsToPathData).join(' ')
  const rootAttrs=phys
    ?`xmlns="http://www.w3.org/2000/svg" width="${vbW}mm" height="${vbH}mm" viewBox="${vb}" fill="none"`
    :`xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" fill="none"`
  const parts=[
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg ${rootAttrs}>`,
    `<!-- ${disclaimer} -->`,
    // 图案垫在刀线下面：切线、压痕始终可见
    options.artwork?artworkToSvg(knife,options.artwork,options.artworkImages||{},options.artworkWarnings||[]):'',
    opts.showBleed?`<path d="${bleedPath}" stroke="${LAYER_META.bleed.color}" stroke-width="1.2" opacity="0.65"/>`:'',
    `<path d="${trimPath}" stroke="${LAYER_META.trim.color}" stroke-width="1.8"/>`,
    `<path d="${creasePath}" stroke="${LAYER_META.crease.color}" stroke-width="1.6" stroke-dasharray="6 4"/>`,
    dims,
    faceNames,
    `</svg>`
  ]
  return parts.filter(Boolean).join('\n')
}

function pdfSafeLabel(s){
  // Helvetica / WinAnsi: drop non-latin; keep digits, letters, × as x
  return String(s||'')
    .replace(/×/g,'x')
    .replace(/[^\x20-\x7E]/g,'')
}

/**
 * SVG path data for page.drawSvgPath. pdf-lib draws SVG paths y-down from the anchor it is given,
 * so `map` must return y-down coordinates (see svgMap in toPdf) and arcs keep their original sweep.
 */
function pdfPathData(cmds,map,scale){
  const parts=[]
  for(const cmd of cmds||[]){
    if(cmd?.mtd==='M'||cmd?.mtd==='L'){
      const p=map(cmd.x,cmd.y)
      parts.push(`${cmd.mtd} ${p.x} ${p.y}`)
    }else if(cmd?.mtd==='A'){
      const p=map(cmd.x,cmd.y)
      parts.push(`A ${Math.abs(cmd.rx*scale)} ${Math.abs(cmd.ry*scale)} ${cmd.ang||0} ${cmd.arc?1:0} ${cmd.dir?1:0} ${p.x} ${p.y}`)
    }else if(cmd?.mtd==='Q'){
      const c=map(cmd.cx,cmd.cy),p=map(cmd.x,cmd.y)
      parts.push(`Q ${c.x} ${c.y} ${p.x} ${p.y}`)
    }else if(cmd?.mtd==='C'){
      const c1=map(cmd.cx1??cmd.cx,cmd.cy1??cmd.cy)
      const c2=map(cmd.cx2??cmd.cx,cmd.cy2??cmd.cy)
      const p=map(cmd.x,cmd.y)
      parts.push(`C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p.x} ${p.y}`)
    }else if(cmd?.mtd==='Z')parts.push('Z')
  }
  return parts.join(' ')
}

/**
 * PDF 图层（Optional Content Group）：与 DXF 同名的 TRIM / CREASE / BLEED / DIM / TEXT。
 * 返回 layer(name,draw)：draw 里画的内容归入该图层。Acrobat、Illustrator 等按图层显示 / 选取。
 */
function pdfLayers(doc,page,names){
  const ctx=doc.context
  const refs={},tags={}
  names.forEach((name,i)=>{
    refs[name]=ctx.register(ctx.obj({Type:'OCG',Name:PDFHexStringOf(name),Intent:['View','Design']}))
    tags[name]=`OC${i+1}`
  })
  const list=names.map(n=>refs[n])
  doc.catalog.set(PDFName.of('OCProperties'),ctx.obj({
    OCGs:list,
    D:{Name:PDFHexStringOf('Layers'),BaseState:'ON',Order:list,ListMode:'AllPages'},
  }))
  const props={}
  for(const n of names)props[tags[n]]=refs[n]
  page.node.normalizedEntries().Resources.set(PDFName.of('Properties'),ctx.obj(props))
  return (name,draw)=>{
    page.pushOperators(PDFOperator.of('BDC',[PDFName.of('OC'),PDFName.of(tags[name])]))
    draw()
    page.pushOperators(PDFOperator.of('EMC'))
  }
}
const PDFHexStringOf=text=>PDFHexString.fromText(text)

/** PDF export. vector_proof：页面缩放校样。engineering|manufacturing：标注实际 scale，不静默冒充 1:1。 */
export async function toPdf(knife,options={}){
  const {
    forAi=false,
    qualityTier='vector_proof',
  }=options
  const opts=normalizedOptions(options)
  const b=boundsOf(knife)
  const wMm=b.maxX-b.minX,hMm=b.maxY-b.minY
  // PDF 的单位是 pt（1/72 英寸），刀版坐标是 mm：1 mm = 72/25.4 pt。页面按实际尺寸撑开，保证 1:1。
  const PT_PER_MM=72/25.4
  // 出血线在切线外侧：页边要留出它的宽度，否则出血线会被页面边缘裁掉
  const bleedOutMm=opts.showBleed?Math.max(0,Number(knife.bleedEffective??((Number(knife.bleed)||0)+10))||0):0
  const margin=36+bleedOutMm*PT_PER_MM
  const headerH=opts.showTitleBlock?54:0,footerH=opts.showTitleBlock?36:12
  const pageW=Math.max(420,wMm*PT_PER_MM+margin*2)
  const pageH=Math.max(594,hMm*PT_PER_MM+margin*2+headerH+footerH)
  const doc=await PDFDocument.create()
  const page=doc.addPage([pageW,pageH])
  const font=await doc.embedFont(StandardFonts.Helvetica)
  const fontBold=await doc.embedFont(StandardFonts.HelveticaBold)
  const tier=String(qualityTier||'vector_proof')
  const eng=tier==='manufacturing'||tier==='engineering'

  const d=knife.dimensions||{}
  const mat=knife.material?.id||'-'
  const title=`${knife.template||'mailer'} · ${displayNumber(d.length,opts.displayUnit)}x${displayNumber(d.width,opts.displayUnit)}x${displayNumber(d.height,opts.displayUnit)} ${opts.displayUnit} · ${mat}`
  // 有图案时多一个 ARTWORK 图层，排在最下面；没有图案的文件保持原来的五个图层
  const artworkPlan=options.artwork?planArtwork(knife,options.artwork):null
  const hasArtwork=!!artworkPlan&&(artworkPlan.items.length>0||!!artworkPlan.background)
  const layer=pdfLayers(doc,page,[...(hasArtwork?[ARTWORK_PDF_LAYER]:[]),'BLEED','TRIM','CREASE','DIM','TEXT'])
  if(opts.showTitleBlock){
    layer('TEXT',()=>page.drawText(pdfSafeLabel(title),{x:margin,y:pageH-28,size:11,font:fontBold,color:rgb(.15,.18,.22)}))
  }

  const drawW=pageW-margin*2,drawH=pageH-margin*2-headerH-footerH
  // scale：每 mm 多少 pt。不放大，放得下就是 1:1
  const scale=Math.min(PT_PER_MM,drawW/Math.max(wMm,1),drawH/Math.max(hMm,1))
  const ratio=scale/PT_PER_MM
  const scaleNote=Math.abs(ratio-1)<1e-6?'scale=1:1':`PROOF scale=${ratio.toFixed(4)} (not 1:1 print)`
  const sub=forAi
    ?`TRIM / CREASE / BLEED · DEMO · ${validationNote(knife)} · manufacturingReady=false`
    :tier==='engineering'
      ?`ENGINEERING CANDIDATE · COMPENSATION UNVERIFIED · ${scaleNote} · ${validationNote(knife)} · manufacturingReady=false`
    :eng
      ?`ENGINEERING PDF · ${scaleNote} · ${validationNote(knife)} · manufacturingReady=false`
      :`PROOF ONLY · ${scaleNote} · ${validationNote(knife)} · manufacturingReady=false`
  if(opts.showTitleBlock){
    layer('TEXT',()=>page.drawText(pdfSafeLabel(sub),{
      x:margin,y:pageH-44,size:8,font,color:rgb(.4,.45,.5)
    }))
  }

  const ox=margin+(drawW-wMm*scale)/2
  const oy=margin+footerH+(drawH-hMm*scale)/2

  const map=(x,y)=>({
    x:ox+(x-b.minX)*scale,
    y:oy+(b.maxY-y)*scale
  })

  // drawSvgPath 以 (x,y) 为原点、y 向下画：原点放在页面左上角，路径坐标用「距页面顶边的距离」。
  // 以前直接把 y 向上的页面坐标交给它，又没给原点，切线 / 压痕 / 出血线全部被画到了页面下方（不可见）。
  const svgMap=(x,y)=>{const p=map(x,y);return {x:p.x,y:pageH-p.y}}

  if(hasArtwork){
    page.pushOperators(PDFOperator.of('BDC',[PDFName.of('OC'),PDFName.of('OC1')]))
    await drawArtworkPdf(doc,page,knife,options.artwork,options.artworkImages||{},{map,scale,font,warnings:options.artworkWarnings||[],outlineText:options.outlineText||null})
    page.pushOperators(PDFOperator.of('EMC'))
  }else if(artworkPlan&&options.artworkWarnings)options.artworkWarnings.push(...artworkPlan.skipped)

  for(const role of ['bleed','trim','crease']){
    if(role==='bleed'&&!opts.showBleed)continue
    const meta=LAYER_META[role]
    const c=hexToRgb01(meta.color)
    const color=rgb(c.r,c.g,c.b)
    layer(meta.dxf,()=>{
      for(const path of pathsOf(knife,role)){
        const pathData=pdfPathData(path,svgMap,scale)
        if(!pathData)continue
        page.drawSvgPath(pathData,{
          x:0,y:pageH,
          borderWidth:role==='trim'?1.2:role==='bleed'?0.8:0.9,
          borderColor:color,
          borderOpacity:role==='bleed'?0.65:1,
          borderDashArray:role==='crease'?[6,4]:undefined,
        })
      }
    })
  }

  if(opts.showDimensions){
    const anns=buildDimAnnotations(knife)
    const dimRgb=hexToRgb01(DIM_COLOR)
    const dimColor=rgb(dimRgb.r,dimRgb.g,dimRgb.b)
    layer('DIM',()=>{
    for(const a of anns){
      for(const L of a.lines||[]){
        const p1=map(L.x1,L.y1),p2=map(L.x2,L.y2)
        page.drawLine({start:p1,end:p2,thickness:0.7,color:dimColor})
      }
      for(const poly of a.polys||[]){
        if(poly.length<3)continue
        const [t0,t1,t2]=poly.map(([x,y])=>map(x,y))
        page.drawLine({start:t0,end:t1,thickness:0.6,color:dimColor})
        page.drawLine({start:t1,end:t2,thickness:0.6,color:dimColor})
        page.drawLine({start:t2,end:t0,thickness:0.6,color:dimColor})
      }
      if(a.text){
        const p=map(a.text.x,a.text.y)
        const size=a.kind==='face'?7:9
        const label=pdfSafeLabel(annotationLabel(a,opts.displayUnit))
        const tw=font.widthOfTextAtSize(label,size)
        page.drawText(label,{x:p.x-tw/2,y:p.y-size/3,size,font,color:dimColor})
      }
    }
    })
  }
  if(opts.showFaceNames)layer('TEXT',()=>{
    for(const face of knife.faces||[]){
      const p=map(face.x+face.w/2,face.y+face.h/2)
      const label=faceNameLabel(face)
      const size=7
      const tw=font.widthOfTextAtSize(label,size)
      page.drawText(label,{x:p.x-tw/2,y:p.y-size/3,size,font,color:rgb(.35,.38,.42)})
    }
  })

  const foot=tier==='engineering'
    ?`ENGINEERING CANDIDATE · NOT FOR PRODUCTION DIE · manufacturingReady=false`
    :eng
    ?`ENGINEERING · ${scaleNote} · manufacturingReady=false`
    :`${DISCLAIMER_EN} / PROOF ONLY / manufacturingReady=false`
  if(opts.showTitleBlock){
    layer('TEXT',()=>page.drawText(pdfSafeLabel(foot),{
      x:margin,y:18,size:9,font:fontBold,color:rgb(.75,.15,.1)
    }))
  }

  return doc.save()
}

/** PDF-compatible .ai (Illustrator opens as PDF); same payload as toPdf. */
export async function toAi(knife,options={}){
  return toPdf(knife,{...options,showDimensions:options.showDimensions??options.includeDims??true,forAi:true})
}
