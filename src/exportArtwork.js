/**
 * Artwork (the image / text / shape layers placed in the design editor) for exported files.
 * Placement follows src/components/studio/StudioCanvas2D.vue exactly, so the export matches the
 * canvas: a layer's transform is its top-left corner in mm — relative to its panel's top-left for
 * `panel_mm`, to the net origin for `net_mm` — rotated clockwise about that corner; `clip: 'panel'`
 * clips to the panel outline.
 *
 * Input: artwork = {backgroundColor, layers}, images = {assetId: {mime, base64, width, height}}.
 * Only the outside print side is exported (the dieline is drawn from the outside).
 */
import {
  pushGraphicsState,popGraphicsState,concatTransformationMatrix,moveTo,lineTo,closePath,clip,endPath,
  appendBezierCurve,rectangle,fill,stroke,fillAndStroke,setFillingColor,setStrokingColor,setLineWidth,
  setGraphicsState,drawObject,beginText,endText,setFontAndSize,setTextMatrix,showText,rgb,
} from 'pdf-lib'

const num=(v,d=0)=>(Number.isFinite(Number(v))?Number(v):d)
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')

/** '#rgb' | '#rrggbb' → {r,g,b} in 0..1; anything else (empty, 'transparent', 'none') → null. */
export function parseHexColor(value){
  const m=/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(value||'').trim())
  if(!m)return null
  const h=m[1].length===3?m[1].split('').map(c=>c+c).join(''):m[1]
  return {r:parseInt(h.slice(0,2),16)/255,g:parseInt(h.slice(2,4),16)/255,b:parseInt(h.slice(4,6),16)/255}
}

function faceOutline(face){
  const loop=Array.isArray(face.outline)&&face.outline.length>=3
    ?face.outline
    :[[face.x,face.y],[face.x+face.w,face.y],[face.x+face.w,face.y+face.h],[face.x,face.y+face.h]]
  return loop.map(p=>[num(p[0]),num(p[1])])
}

/**
 * Resolve the layers to draw, bottom to top, in net mm.
 * @returns {{items:Array,background:{color:string,loops:number[][][]}|null,skipped:string[]}}
 */
export function planArtwork(knife,artwork,{side='outside'}={}){
  const faces=new Map((knife?.faces||[]).map(f=>[String(f.name),f]))
  const layers=Array.isArray(artwork?.layers)?artwork.layers:[]
  const items=[],skipped=[]
  for(const layer of [...layers].sort((a,b)=>num(a?.zIndex)-num(b?.zIndex))){
    if(!layer||layer.visible===false)continue
    // The other print side is drawn on its own sheet (see mirrorKnifeForInside)
    if((layer.side||'outside')!==side)continue
    const t=layer.transform||{}
    let x=num(t.xMm),y=num(t.yMm),clipLoop=null
    const w0=Math.max(0,num(layer.widthMm)),h0=Math.max(0,num(layer.heightMm))
    if(side==='inside'&&layer.coordinateSpace==='net_mm'){
      // A layer placed on the whole net: on the inside every panel shows its own part the way it was
      // drawn (same rule as the 3D preview), so the layer is repeated per panel, clipped to it.
      if(!(w0>0&&h0>0)){skipped.push(`${layer.name||layer.id}: empty size`);continue}
      for(const face of knife?.faces||[]){
        if(!Number.isFinite(face.srcX))continue
        if(x+w0<face.srcX||x>face.srcX+num(face.w)||y+h0<num(face.y)||y>num(face.y)+num(face.h))continue
        items.push({layer,x:num(face.x)+(x-face.srcX),y,w:w0,h:h0,rotation:num(t.rotationDeg),
          opacity:Math.max(0,Math.min(1,num(layer.opacity,1))),clipLoop:faceOutline(face)})
      }
      continue
    }
    if(layer.coordinateSpace!=='net_mm'){
      const face=faces.get(String(layer.panelId||''))
      if(!face){skipped.push(`${layer.name||layer.id}: panel ${layer.panelId||'?'} not found`);continue}
      x+=num(face.x);y+=num(face.y)
      if(layer.clip==='panel')clipLoop=faceOutline(face)
    }
    const w=Math.max(0,num(layer.widthMm)),h=Math.max(0,num(layer.heightMm))
    if(!(w>0&&h>0)){skipped.push(`${layer.name||layer.id}: empty size`);continue}
    items.push({layer,x,y,w,h,rotation:num(t.rotationDeg),opacity:Math.max(0,Math.min(1,num(layer.opacity,1))),clipLoop})
  }
  // The background colour is the outside print; the inside sheet stays unprinted unless layers are placed
  const bg=side==='outside'?parseHexColor(artwork?.backgroundColor):null
  const background=bg?{color:String(artwork.backgroundColor).trim(),rgb:bg,loops:(knife?.faces||[]).map(faceOutline)}:null
  return {items,background,skipped}
}

/** Does the artwork have anything on the inside print side? */
export function hasInsideArtwork(artwork){
  return (Array.isArray(artwork?.layers)?artwork.layers:[]).some(l=>l&&l.visible!==false&&l.side==='inside')
}

/**
 * The sheet seen from its inside (back): the dieline mirrored left ↔ right.
 *
 * Inside layers are placed in the editor on the usual (outside) view of a panel and are meant to read
 * the way they were drawn when one looks at the inside of that panel. On the back of the flat sheet
 * each panel sits at its mirrored position, so a layer keeps its offset from the panel's left edge and
 * is NOT mirrored itself. planArtwork(mirrored, artwork, {side:'inside'}) gives exactly that, because
 * panel layers are positioned from face.x of the mirrored face. Faces keep `srcX` (their x on the
 * outside view) for layers placed on the whole net.
 */
export function mirrorKnifeForInside(knife){
  const b=knife?.bounds
  if(!b)return knife
  const mx=x=>b.minX+b.maxX-num(x)
  const cmd=c=>{
    if(!c||typeof c!=='object')return c
    const o={...c}
    for(const k of ['x','cx','cx1','cx2','x1','x2'])if(typeof o[k]==='number')o[k]=mx(o[k])
    // Mirroring reverses the turning direction of an arc
    if(o.mtd==='A')o.dir=o.dir?0:1
    return o
  }
  const seg=s=>({...s,x1:mx(s.x1),x2:mx(s.x2)})
  const paths={},layers={}
  for(const role of ['trim','crease','bleed']){
    const direct=knife.paths?.[role]||knife.layers?.[role]?.paths
    if(Array.isArray(direct)&&direct.length)paths[role]=direct.map(p=>p.map(cmd))
    const lay=knife.layers?.[role]
    if(lay)layers[role]={...lay,paths:paths[role],segments:Array.isArray(lay.segments)?lay.segments.map(seg):lay.segments}
  }
  return {
    ...knife,
    faces:(knife.faces||[]).map(f=>({
      ...f,srcX:num(f.x),x:mx(num(f.x)+num(f.w)),
      outline:Array.isArray(f.outline)?f.outline.map(p=>[mx(p[0]),num(p[1])]):f.outline,
    })),
    paths:{...(knife.paths||{}),...paths},
    layers:{...(knife.layers||{}),...layers},
    cuts:Array.isArray(knife.cuts)?knife.cuts.map(seg):knife.cuts,
    folds:Array.isArray(knife.folds)?knife.folds.map(seg):knife.folds,
    bleeds:Array.isArray(knife.bleeds)?knife.bleeds.map(seg):knife.bleeds,
    insideView:true,
  }
}

const textLines=layer=>String(layer.text?.content??'').split(/\r?\n/)

/** SVG `<g id="ARTWORK">`: live text, embedded images. Returns '' when there is nothing to draw. */
export function artworkToSvg(knife,artwork,images={},warnings=[],{side='outside'}={}){
  const {items,background,skipped}=planArtwork(knife,artwork,{side})
  const tag=side==='inside'?'ARTWORK_INSIDE':'ARTWORK',clipId=side==='inside'?'artwork-in-clip':'artwork-clip'
  warnings.push(...skipped)
  if(!items.length&&!background)return ''
  const defs=[],body=[]
  if(background){
    const d=background.loops.map(loop=>'M'+loop.map(p=>`${p[0]} ${p[1]}`).join('L')+'Z').join('')
    body.push(`<path id="ARTWORK_BACKGROUND" d="${d}" fill="${background.color}"/>`)
  }
  items.forEach((it,i)=>{
    const {layer,w,h}=it
    let inner=''
    if(layer.kind==='image'){
      const img=images[String(layer.assetId||'')]
      if(!img?.base64){warnings.push(`${layer.name||layer.id}: image file missing`);return}
      const href=`data:${img.mime||'image/png'};base64,${img.base64}`
      const c=layer.crop,nw=num(img.width),nh=num(img.height)
      inner=c&&nw>0&&nh>0
        ?`<svg width="${w}" height="${h}" viewBox="${c.x*nw} ${c.y*nh} ${Math.max(1,c.w*nw)} ${Math.max(1,c.h*nh)}" preserveAspectRatio="none"><image width="${nw}" height="${nh}" href="${href}"/></svg>`
        :`<image width="${w}" height="${h}" preserveAspectRatio="none" href="${href}"/>`
    }else if(layer.kind==='text'&&layer.text){
      const size=num(layer.text.fontSizeMm,10),align=layer.text.align||'left'
      const ax=align==='center'?w/2:align==='right'?w:0
      const anchor=align==='center'?'middle':align==='right'?'end':'start'
      // Canvas text starts at the top of the box with a line height of 1; 0.86 ≈ ascent of common sans fonts
      const spans=textLines(layer).map((line,k)=>`<tspan x="${ax}" y="${(size*(0.86+k)).toFixed(3)}">${esc(line)}</tspan>`).join('')
      inner=`<text font-family="${esc(layer.text.fontFamily||'sans-serif')}" font-size="${size}" fill="${esc(layer.text.fill||'#000000')}" text-anchor="${anchor}" xml:space="preserve">${spans}</text>`
    }else if(layer.kind==='shape'&&layer.shape){
      const s=layer.shape,sw=num(s.strokeWidthMm)
      const paint=`fill="${parseHexColor(s.fill)?s.fill:'none'}" stroke="${parseHexColor(s.stroke)&&sw>0?s.stroke:'none'}" stroke-width="${sw}"`
      inner=s.shapeType==='ellipse'
        ?`<ellipse cx="${w/2}" cy="${h/2}" rx="${w/2}" ry="${h/2}" ${paint}/>`
        :`<rect width="${w}" height="${h}" ${paint}/>`
    }else return
    let clipAttr=''
    if(it.clipLoop){
      defs.push(`<clipPath id="${clipId}-${i}"><path d="M${it.clipLoop.map(p=>`${p[0]} ${p[1]}`).join('L')}Z"/></clipPath>`)
      clipAttr=` clip-path="url(#${clipId}-${i})"`
    }
    const tf=`translate(${it.x} ${it.y})${it.rotation?` rotate(${it.rotation})`:''}`
    body.push(`<g${clipAttr}><g transform="${tf}"${it.opacity<1?` opacity="${it.opacity}"`:''} data-layer="${esc(layer.name||layer.id)}">${inner}</g></g>`)
  })
  if(!body.length)return ''
  return `${defs.length?`<defs>${defs.join('')}</defs>`:''}<g id="${tag}">${body.join('')}</g>`
}

const K=0.5522847498 // circle → 4 cubic Béziers

/**
 * Draw the artwork on a pdf-lib page. `map(x,y)` converts net mm to page points (y up), `scale` is
 * points per mm. Text uses `font` (a standard PDF font). A layer with characters that font cannot
 * encode (CJK, Hangul…) is converted to curves with `outlineText(line,size)` when the caller provides
 * one (services/geometry/textOutline.mjs); without it, or when a character has no glyph in any font
 * found there, the layer is drawn as a placeholder box and reported, never dropped silently.
 */
export async function drawArtworkPdf(doc,page,knife,artwork,images,{map,scale,font,warnings=[],outlineText=null,side='outside'}){
  const {items,background,skipped}=planArtwork(knife,artwork,{side})
  warnings.push(...skipped)
  const ops=(...list)=>page.pushOperators(...list)
  const loopPath=loop=>{
    const out=[]
    loop.forEach((p,i)=>{const q=map(p[0],p[1]);out.push(i?lineTo(q.x,q.y):moveTo(q.x,q.y))})
    out.push(closePath())
    return out
  }
  if(background){
    ops(pushGraphicsState(),setFillingColor(rgb(background.rgb.r,background.rgb.g,background.rgb.b)))
    for(const loop of background.loops)ops(...loopPath(loop),fill())
    ops(popGraphicsState())
  }
  const embedded=new Map()
  const fontName=page.node.newFontDictionary('ArtF',font.ref)
  let drawn=background?1:0
  for(const it of items){
    const {layer,w,h}=it
    let image=null
    if(layer.kind==='image'){
      const key=String(layer.assetId||''),src=images?.[key]
      if(!src?.base64){warnings.push(`${layer.name||layer.id}: image file missing`);continue}
      if(!embedded.has(key)){
        try{
          const bytes=Buffer.from(src.base64,'base64')
          embedded.set(key,/jpe?g/i.test(src.mime||'')?await doc.embedJpg(bytes):await doc.embedPng(bytes))
        }catch(e){embedded.set(key,null);warnings.push(`${layer.name||layer.id}: image could not be embedded (${String(e?.message||e).slice(0,60)})`)}
      }
      image=embedded.get(key)
      if(!image)continue
    }
    ops(pushGraphicsState())
    if(it.clipLoop)ops(...loopPath(it.clipLoop),clip(),endPath())
    // Layer frame: origin at the layer's top-left, units mm, y down, rotated clockwise as on screen
    const o=map(it.x,it.y),th=it.rotation*Math.PI/180,cs=Math.cos(th)*scale,sn=Math.sin(th)*scale
    ops(concatTransformationMatrix(cs,-sn,-sn,-cs,o.x,o.y))
    if(it.opacity<1){
      const gs=page.node.newExtGState('ArtGS',doc.context.obj({Type:'ExtGState',ca:it.opacity,CA:it.opacity}))
      ops(setGraphicsState(gs))
    }
    if(layer.kind==='image'){
      const c=layer.crop
      const fw=c&&c.w>0?w/c.w:w,fh=c&&c.h>0?h/c.h:h,dx=c?-c.x*fw:0,dy=c?-c.y*fh:0
      if(c)ops(rectangle(0,0,w,h),clip(),endPath())
      // An image fills the unit square with y up: flip it into the y-down layer frame
      ops(concatTransformationMatrix(fw,0,0,-fh,dx,dy+fh),drawObject(page.node.newXObject('ArtIm',image.ref)))
      drawn++
    }else if(layer.kind==='shape'&&layer.shape){
      const s=layer.shape,f=parseHexColor(s.fill),sw=num(s.strokeWidthMm),st=sw>0?parseHexColor(s.stroke):null
      if(f)ops(setFillingColor(rgb(f.r,f.g,f.b)))
      if(st)ops(setStrokingColor(rgb(st.r,st.g,st.b)),setLineWidth(sw))
      if(s.shapeType==='ellipse'){
        const rx=w/2,ry=h/2,cx=rx,cy=ry
        ops(moveTo(cx+rx,cy),
          appendBezierCurve(cx+rx,cy+K*ry,cx+K*rx,cy+ry,cx,cy+ry),
          appendBezierCurve(cx-K*rx,cy+ry,cx-rx,cy+K*ry,cx-rx,cy),
          appendBezierCurve(cx-rx,cy-K*ry,cx-K*rx,cy-ry,cx,cy-ry),
          appendBezierCurve(cx+K*rx,cy-ry,cx+rx,cy-K*ry,cx+rx,cy),closePath())
      }else ops(rectangle(0,0,w,h))
      ops(f&&st?fillAndStroke():f?fill():st?stroke():endPath())
      if(f||st)drawn++
    }else if(layer.kind==='text'&&layer.text){
      const size=num(layer.text.fontSizeMm,10),align=layer.text.align||'left'
      const col=parseHexColor(layer.text.fill)||{r:0,g:0,b:0}
      let unsupported=false
      const lines=textLines(layer).map(line=>{
        try{return {hex:font.encodeText(line),width:font.widthOfTextAtSize(line,size)}}catch{unsupported=true;return null}
      })
      // Outline the whole layer (not just the offending lines) so that one layer keeps one typeface
      const outlined=unsupported&&typeof outlineText==='function'
        ?textLines(layer).map(line=>{try{return outlineText(line,size)}catch{return null}})
        :null
      if(outlined&&outlined.every(Boolean)){
        ops(setFillingColor(rgb(col.r,col.g,col.b)))
        outlined.forEach((ln,k)=>{
          const x=align==='center'?(w-ln.width)/2:align==='right'?w-ln.width:0
          // Glyph outlines are y-up from the baseline; the layer frame is y-down
          const base=size*(0.86+k)
          for(const glyph of ln.paths){
            for(const c of glyph){
              if(c[0]==='M')ops(moveTo(x+c[1],base-c[2]))
              else if(c[0]==='L')ops(lineTo(x+c[1],base-c[2]))
              else if(c[0]==='C')ops(appendBezierCurve(x+c[1],base-c[2],x+c[3],base-c[4],x+c[5],base-c[6]))
              else ops(closePath())
            }
          }
        })
        // One fill for the whole layer: counters (the inside of 口, ㅇ…) are cut out by the winding rule
        ops(fill())
        warnings.push(`${layer.name||layer.id}: text converted to curves (not editable as text; glyphs may differ from the editor font)`)
        drawn++
      }else if(unsupported){
        warnings.push(`${layer.name||layer.id}: text has characters the PDF font cannot draw (use SVG, or convert the text to an image)`)
        ops(setStrokingColor(rgb(.8,.2,.2)),setLineWidth(0.3),rectangle(0,0,w,h),stroke())
      }else{
        ops(setFillingColor(rgb(col.r,col.g,col.b)),beginText(),setFontAndSize(fontName,size))
        lines.forEach((ln,k)=>{
          const x=align==='center'?(w-ln.width)/2:align==='right'?w-ln.width:0
          // Text matrix flips y back up inside the y-down layer frame
          ops(setTextMatrix(1,0,0,-1,x,size*(0.86+k)),showText(ln.hex))
        })
        ops(endText())
        drawn++
      }
    }
    ops(popGraphicsState())
  }
  return drawn
}

export const ARTWORK_PDF_LAYER='ARTWORK'
