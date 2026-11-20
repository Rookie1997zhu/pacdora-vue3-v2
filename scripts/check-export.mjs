import assert from 'node:assert/strict'
import {createKnife} from '../src/knife.js'
import {toDxf,toSvgDieline,toPdf,toAi} from '../src/exportDieline.js'
import {buildDimAnnotations} from '../src/dimAnnotations.js'

function assertDxf(label,knife){
  const dxf=toDxf(knife)
  assert.ok(dxf.includes('TRIM'),`${label}: TRIM layer`)
  assert.ok(dxf.includes('CREASE'),`${label}: CREASE layer`)
  assert.ok(dxf.includes('BLEED'),`${label}: BLEED layer`)
  assert.ok(dxf.includes('\nDIM\n'),`${label}: DIM layer`)
  assert.ok(dxf.includes('\nTEXT\n'),`${label}: TEXT layer`)
  const entities=dxf.split('\n').filter((v,i,a)=>['LINE','POLYLINE','ARC'].includes(v)&&a[i-1]==='0').length
  assert.ok(entities>0,`${label}: vector entities`)
  assert.ok(dxf.includes('\nPOLYLINE\n'),`${label}: POLYLINE entities`)
  assert.ok(dxf.includes('$INSUNITS'),`${label}: INSUNITS`)
  assert.equal(knife.manufacturingReady,false,`${label}: manufacturingReady`)
  console.log(`ok dxf ${label} entities=${entities}`)
}

function assertDims(label,knife){
  const anns=buildDimAnnotations(knife)
  const overall=anns.filter(a=>a.kind==='overall')
  const faces=anns.filter(a=>a.kind==='face')
  assert.ok(overall.length>=3,`${label}: overall dims >=3 got ${overall.length}`)
  assert.ok(faces.length>=1,`${label}: face dims >=1 got ${faces.length}`)
  assert.ok(overall.every(a=>a.lines?.length>=3),`${label}: overall has dim lines`)
  assert.ok(faces.every(a=>/^\d+×\d+$/.test(a.label)),`${label}: face label w×h`)
  console.log(`ok dims ${label} overall=${overall.length} faces=${faces.length}`)
}

function assertSvg(label,knife){
  const svg=toSvgDieline(knife,{includeDims:true})
  assert.ok(svg.includes('#2028b0'),`${label}: trim color`)
  assert.ok(svg.includes('#fa0000'),`${label}: crease color`)
  assert.ok(svg.includes('#46ba00'),`${label}: bleed color`)
  assert.ok(svg.includes('NOT FOR DIE CUTTING'),`${label}: disclaimer`)
  assert.ok(svg.includes('不可开模'),`${label}: zh note`)
  assert.ok(svg.includes('id="DIMENSIONS"'),`${label}: DIMENSIONS group`)
  assert.ok(svg.includes('<line '),`${label}: dim/crease lines`)
  assert.ok(/×|\dx\d/.test(svg)||svg.includes('×'),`${label}: face size text`)
  console.log(`ok svg ${label} len=${svg.length}`)
}

async function assertPdf(label,knife){
  const bytes=await toPdf(knife)
  assert.ok(bytes instanceof Uint8Array,`${label}: Uint8Array`)
  assert.ok(bytes.length>500,`${label}: pdf size`)
  const head=String.fromCharCode(...bytes.slice(0,5))
  assert.equal(head,'%PDF-',`${label}: %PDF header`)
  // 1:1：页面（pt）必须装得下以 mm 计的展开尺寸（1 mm = 72/25.4 pt），否则标着 1:1 实际是缩小的
  const {PDFDocument}=await import('pdf-lib')
  const pdfDoc=await PDFDocument.load(bytes)
  const page=pdfDoc.getPage(0)
  const xs=[],ys=[]
  for(const role of ['trim','crease'])for(const path of knife.layers?.[role]?.paths||knife.paths?.[role]||[])for(const c of path)if(Number.isFinite(c.x)){xs.push(c.x);ys.push(c.y)}
  const k=72/25.4,w=(Math.max(...xs)-Math.min(...xs))*k,h=(Math.max(...ys)-Math.min(...ys))*k
  assert.ok(page.getWidth()>=w&&page.getHeight()>=h,`${label}: pdf page ${page.getWidth().toFixed(0)}x${page.getHeight().toFixed(0)}pt fits 1:1 dieline ${w.toFixed(0)}x${h.toFixed(0)}pt`)
  // 线必须画在页面里面：逐条路径把坐标按当前变换算到页面上，检查落在页面范围内，且整体范围等于刀版范围。
  // （以前 y 轴翻转后没给原点，切线 / 压痕 / 出血线全在页面下方，文件结构却完全正常。）
  const {PDFRawStream,decodePDFRawStream}=await import('pdf-lib')
  let stream=''
  const contents=page.node.Contents()
  for(const st of (contents.asArray?contents.asArray().map(r=>pdfDoc.context.lookup(r)):[contents]))stream+=Buffer.from(st instanceof PDFRawStream?decodePDFRawStream(st).decode():st.getContents()).toString('latin1')+'\n'
  const toks=stream.split(/\s+/).filter(Boolean)
  const stack=[];let m=[1,0,0,1,0,0],px=[],py=[],inLine=false
  const mul=(a,b)=>[a[0]*b[0]+a[1]*b[2],a[0]*b[1]+a[1]*b[3],a[2]*b[0]+a[3]*b[2],a[2]*b[1]+a[3]*b[3],a[4]*b[0]+a[5]*b[2]+b[4],a[4]*b[1]+a[5]*b[3]+b[5]]
  for(let i=0;i<toks.length;i++){
    const t=toks[i]
    if(t==='q')stack.push(m)
    else if(t==='Q')m=stack.pop()||[1,0,0,1,0,0]
    else if(t==='cm')m=mul(toks.slice(i-6,i).map(Number),m)
    else if(t==='BDC')inLine=['/OC1','/OC2','/OC3'].includes(toks[i-1])
    else if(t==='EMC')inLine=false
    else if(inLine&&(t==='m'||t==='l')){const x=+toks[i-2],y=+toks[i-1];px.push(m[0]*x+m[2]*y+m[4]);py.push(m[1]*x+m[3]*y+m[5])}
  }
  assert.ok(px.length>10,`${label}: pdf line points found`)
  const inside=px.every(v=>v>=-1&&v<=page.getWidth()+1)&&py.every(v=>v>=-1&&v<=page.getHeight()+1)
  assert.ok(inside,`${label}: pdf cut / crease / bleed lines are inside the page (x ${Math.min(...px).toFixed(0)}..${Math.max(...px).toFixed(0)} of ${page.getWidth().toFixed(0)}, y ${Math.min(...py).toFixed(0)}..${Math.max(...py).toFixed(0)} of ${page.getHeight().toFixed(0)})`)
  console.log(`ok pdf ${label} bytes=${bytes.length}`)
}

async function assertAi(label,knife){
  const bytes=await toAi(knife)
  assert.ok(bytes instanceof Uint8Array,`${label}: Uint8Array`)
  assert.ok(bytes.length>500,`${label}: ai size`)
  const head=String.fromCharCode(...bytes.slice(0,5))
  assert.equal(head,'%PDF-',`${label}: PDF-compatible .ai`)
  const pdf=await toPdf(knife,{includeDims:true})
  assert.ok(Math.abs(bytes.length-pdf.length)<pdf.length*0.25,`${label}: ai size near pdf`)
  // 分图层：五个图层都登记在目录里，页面内容用 BDC /OC … EMC 分组，且成对
  const {PDFDocument,PDFName,decodePDFRawStream,PDFRawStream}=await import('pdf-lib')
  const doc=await PDFDocument.load(bytes)
  const ocp=doc.catalog.lookup(PDFName.of('OCProperties'))
  assert.ok(ocp,`${label}: OCProperties`)
  const names=ocp.lookup(PDFName.of('OCGs')).asArray().map(r=>doc.context.lookup(r).lookup(PDFName.of('Name')).decodeText())
  assert.deepEqual(names,['BLEED','TRIM','CREASE','DIM','TEXT'],`${label}: layer names`)
  let content=''
  const contents=doc.getPage(0).node.Contents()
  const streams=contents.asArray?contents.asArray().map(r=>doc.context.lookup(r)):[contents]
  for(const st of streams)content+=Buffer.from(st instanceof PDFRawStream?decodePDFRawStream(st).decode():st.getContents()).toString('latin1')+' '
  content=' '+content.replace(/\s+/g,' ')+' '
  const open=(content.match(/\/OC \/OC\d BDC/g)||[]).length,close=(content.match(/ EMC /g)||[]).length
  assert.ok(open>=4&&open===close,`${label}: layer groups ${open}/${close}`)
  for(let i=1;i<=4;i++)assert.ok(content.includes(`/OC /OC${i} BDC`),`${label}: layer OC${i} used`)
  console.log(`ok ai ${label} bytes=${bytes.length}`)
}

const sizes=[
  {label:'default',dims:{length:315,width:202,height:62,thickness:1.5,bleed:5,materialId:'kraft'}},
  {label:'alt',dims:{length:200,width:150,height:40,thickness:2,bleed:3,materialId:'white'}}
]

for(const {label,dims} of sizes){
  const k=createKnife(dims)
  assertDims(label,k)
  assertDxf(label,k)
  assertSvg(label,k)
  await assertPdf(label,k)
  await assertAi(label,k)
}

// 图案（设计器里放的图片 / 文字 / 形状）要进 SVG、PDF、AI；DXF 不带
{
  const k=createKnife(sizes[0].dims)
  const face=k.faces[0]
  // 1×1 红色 PNG
  const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='
  const base={coordinateSpace:'panel_mm',panelId:face.name,side:'outside',visible:true,locked:false,opacity:1,clip:'panel',resizePolicy:'keep_mm'}
  const tf=(x,y,r=0)=>({xMm:x,yMm:y,rotationDeg:r,scaleX:1,scaleY:1})
  const artwork={backgroundColor:null,layers:[
    {...base,id:'a',kind:'image',name:'logo',assetId:'img1',transform:tf(5,5),widthMm:40,heightMm:20,zIndex:1,crop:{x:0,y:0,w:1,h:1}},
    {...base,id:'b',kind:'shape',name:'box',shape:{shapeType:'rect',fill:'#ffcc00',stroke:'#000000',strokeWidthMm:0.5},transform:tf(10,30,15),widthMm:30,heightMm:10,zIndex:2},
    {...base,id:'c',kind:'shape',name:'dot',shape:{shapeType:'ellipse',fill:'#0f6e68',stroke:'',strokeWidthMm:0},transform:tf(50,30),widthMm:12,heightMm:12,zIndex:3,opacity:0.5},
    {...base,id:'d',kind:'text',name:'latin',text:{content:'Hello\nBox',fontFamily:'Arial',fontSizeMm:6,fill:'#112233',align:'center'},transform:tf(5,45),widthMm:60,heightMm:14,zIndex:4},
    {...base,id:'e',kind:'text',name:'cjk',text:{content:'盒子',fontFamily:'Arial',fontSizeMm:6,fill:'#000000',align:'left'},transform:tf(5,60),widthMm:60,heightMm:8,zIndex:5},
    {...base,id:'f',kind:'shape',name:'inside',side:'inside',shape:{shapeType:'rect',fill:'#ff0000',stroke:'',strokeWidthMm:0},transform:tf(0,0),widthMm:5,heightMm:5,zIndex:6},
    {...base,id:'g',kind:'shape',name:'lost',panelId:'NO_SUCH_PANEL',shape:{shapeType:'rect',fill:'#ff0000',stroke:'',strokeWidthMm:0},transform:tf(0,0),widthMm:5,heightMm:5,zIndex:7},
  ]}
  const images={img1:{mime:'image/png',base64:png,width:1,height:1}}
  const w1=[]
  const svg=toSvgDieline(k,{artwork,artworkImages:images,artworkWarnings:w1})
  assert.ok(svg.includes('<g id="ARTWORK">'),'artwork: svg group')
  assert.ok(svg.indexOf('<g id="ARTWORK">')<svg.indexOf(`stroke="#2028b0"`),'artwork: drawn under the cut line')
  assert.ok(svg.includes('data:image/png;base64,'),'artwork: svg image embedded')
  assert.ok(svg.includes('>Hello</tspan>')&&svg.includes('>盒子</tspan>'),'artwork: svg live text incl. CJK')
  assert.ok(svg.includes('<ellipse')&&svg.includes('rotate(15)')&&svg.includes('clip-path="url(#artwork-clip-'),'artwork: svg shapes / rotation / panel clip')
  assert.ok(svg.includes(`translate(${face.x+5} ${face.y+5})`),'artwork: svg position = panel origin + layer offset')
  assert.ok(w1.some(t=>t.includes('NO_SUCH_PANEL')),'artwork: skipped layers are reported')
  // 内面的图案：右边并排一张从内面看的刀版（左右镜像），图层保持离面板左边的距离、本身不镜像
  {
    const {PDFDocument,PDFRawStream,decodePDFRawStream}=await import('pdf-lib')
    const insideX=k.bounds.minX+k.bounds.maxX-(face.x+face.w)
    assert.ok(svg.includes('<g id="INSIDE"')&&svg.includes('<g id="ARTWORK_INSIDE">'),'artwork: svg inside sheet')
    assert.ok(svg.includes(`translate(${insideX} ${face.y})`),'artwork: inside layer sits at the mirrored panel')
    assert.ok(!w1.some(t=>t.includes('is not exported')),'artwork: inside layers are no longer reported as skipped')
    assert.ok(w1.some(t=>t.includes('inside artwork is on its own sheet')),'artwork: the export says where the inside print went')
    const vbOf=t=>t.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number)
    const noInside={...artwork,layers:artwork.layers.filter(l=>l.side!=='inside')}
    const one=toSvgDieline(k,{artwork:noInside,artworkImages:images})
    assert.ok(!one.includes('id="INSIDE"'),'artwork: no inside sheet without inside layers')
    assert.equal(vbOf(svg)[2],vbOf(one)[2]*2,'artwork: svg twice as wide with the inside sheet')
    const two=await PDFDocument.load(await toPdf(k,{artwork,artworkImages:images,artworkWarnings:[]}))
    assert.equal(two.getPageCount(),2,'artwork: pdf has an inside page')
    assert.equal((await PDFDocument.load(await toPdf(k,{artwork:noInside,artworkImages:images}))).getPageCount(),1,'artwork: one page without inside layers')
    const c2=two.getPage(1).node.Contents()
    let text=''
    for(const st of (c2.asArray?c2.asArray().map(r=>two.context.lookup(r)):[c2]))text+=Buffer.from(st instanceof PDFRawStream?decodePDFRawStream(st).decode():st.getContents()).toString('latin1')
    text=' '+text.replace(/\s+/g,' ')+' '
    assert.ok(text.includes(' 1 0 0 rg ')&&/\/OC \/OC1 BDC/.test(text),'artwork: inside page draws the inside layer in the ARTWORK layer')
    assert.ok(!/ BT [^B]*INSIDE/.test(' ')&&(text.match(/ q /g)||[]).length===(text.match(/ Q /g)||[]).length,'artwork: inside page graphics state balanced')
  }
  assert.ok(!toSvgDieline(k,{}).includes('ARTWORK'),'artwork: absent without layers')
  const {PDFDocument,PDFName,PDFRawStream,decodePDFRawStream}=await import('pdf-lib')
  for(const [label,fn] of [['pdf',toPdf],['ai',toAi]]){
    const w2=[]
    const doc=await PDFDocument.load(await fn(k,{artwork,artworkImages:images,artworkWarnings:w2}))
    const names=doc.catalog.lookup(PDFName.of('OCProperties')).lookup(PDFName.of('OCGs')).asArray().map(r=>doc.context.lookup(r).lookup(PDFName.of('Name')).decodeText())
    assert.deepEqual(names,['ARTWORK','BLEED','TRIM','CREASE','DIM','TEXT'],`artwork ${label}: layer names`)
    const page=doc.getPage(0)
    const xo=page.node.Resources().lookup(PDFName.of('XObject'))
    assert.ok(xo&&xo.keys().length===1,`artwork ${label}: one embedded image`)
    let content=''
    const contents=page.node.Contents()
    for(const st of (contents.asArray?contents.asArray().map(r=>doc.context.lookup(r)):[contents]))content+=Buffer.from(st instanceof PDFRawStream?decodePDFRawStream(st).decode():st.getContents()).toString('latin1')+' '
    content=' '+content.replace(/\s+/g,' ')+' '
    assert.ok(/\/ArtIm[-\w]* Do /.test(content),`artwork ${label}: image drawn`)
    assert.ok((content.match(/ BT /g)||[]).length>(label==='pdf'?0:0)&&/\/ArtF[-\w]* 6 Tf/.test(content),`artwork ${label}: text drawn at 6 mm`)
    assert.equal((content.match(/ q /g)||[]).length,(content.match(/ Q /g)||[]).length,`artwork ${label}: graphics state balanced`)
    assert.equal((content.match(/\/OC \/OC\d BDC/g)||[]).length,(content.match(/ EMC /g)||[]).length,`artwork ${label}: layer groups balanced`)
    assert.ok(w2.some(t=>t.includes('cjk')&&t.includes('cannot draw')),`artwork ${label}: unsupported text is reported, not dropped`)
  }
  // 中日韩文字：导出服务提供 outlineText 时转成曲线画进去（services/geometry/textOutline.mjs），不再是占位框
  {
    const {outlineText,loadOutlineFonts}=await import('../services/geometry/textOutline.mjs')
    const read=async bytes=>{
      const doc=await PDFDocument.load(bytes)
      let content=''
      const contents=doc.getPage(0).node.Contents()
      for(const st of (contents.asArray?contents.asArray().map(r=>doc.context.lookup(r)):[contents]))content+=Buffer.from(st instanceof PDFRawStream?decodePDFRawStream(st).decode():st.getContents()).toString('latin1')
      return ' '+content.replace(/\s+/g,' ')+' '
    }
    // 不依赖本机装了什么字体：用一个假的转曲函数确认接线
    const fake=(line,size)=>({width:size*[...line].length,paths:[...line].map((_,i)=>[['M',i*size,0],['L',i*size+size*.8,0],['L',i*size+size*.8,size*.8],['C',i*size+size*.6,size,i*size+size*.2,size,i*size,size*.8],['Z']])})
    for(const [label,fn] of [['pdf',toPdf],['ai',toAi]]){
      // 页眉另算（见下），这里只看图案
      const plain=await read(await fn(k,{artwork,artworkImages:images,artworkWarnings:[],showTitleBlock:false}))
      const w3=[]
      const curved=await read(await fn(k,{artwork,artworkImages:images,artworkWarnings:w3,outlineText:fake,showTitleBlock:false}))
      assert.ok(!w3.some(t=>t.includes('cannot draw')),`artwork ${label}: CJK text no longer reported as undrawable`)
      assert.ok(w3.some(t=>t.includes('cjk')&&t.includes('converted to curves')),`artwork ${label}: curve conversion is reported`)
      assert.ok(plain.includes(' 0.8 0.2 0.2 RG ')&&!curved.includes(' 0.8 0.2 0.2 RG '),`artwork ${label}: placeholder box gone`)
      assert.equal((curved.match(/ c /g)||[]).length-(plain.match(/ c /g)||[]).length,2,`artwork ${label}: one curve per outlined glyph`)
      assert.ok(/\/ArtF[-\w]* 6 Tf/.test(curved),`artwork ${label}: latin text still uses the PDF font`)
      assert.equal((curved.match(/ q /g)||[]).length,(curved.match(/ Q /g)||[]).length,`artwork ${label}: graphics state balanced with curves`)
      // 转不出来（某个字哪种字体里都没有）时退回占位框并报告
      const w4=[]
      const fallback=await read(await fn(k,{artwork,artworkImages:images,artworkWarnings:w4,outlineText:()=>null,showTitleBlock:false}))
      assert.ok(fallback.includes(' 0.8 0.2 0.2 RG ')&&w4.some(t=>t.includes('cannot draw')),`artwork ${label}: falls back to the placeholder`)
    }
    // 页眉：盒型名是中文 / 韩文时转成曲线画出来；没有转曲函数时照旧只留拉丁字符
    {
      const named={...k,templateInfo:{...(k.templateInfo||{}),label:'天地盖礼盒'}}
      const latin={...k,templateInfo:{...(k.templateInfo||{}),label:'Gift box'}}
      const curves=t=>(t.match(/ c /g)||[]).length
      const a=await read(await toPdf(named,{})),b=await read(await toPdf(named,{outlineText:fake})),c=await read(await toPdf(latin,{outlineText:fake}))
      assert.ok(curves(b)>curves(a),'title: CJK box name drawn as curves')
      assert.equal(curves(c),curves(await read(await toPdf(latin,{}))),'title: latin box name stays text')
      assert.equal(curves(await read(await toPdf(named,{outlineText:()=>null}))),curves(a),'title: falls back when a glyph is missing')
    }
    // 本机有中日韩字体时再用真字体过一遍（没有就跳过；镜像里装了 font-noto-cjk）
    if(loadOutlineFonts().length){
      const o=outlineText('盒子 한글 Box',6)
      assert.ok(o&&o.paths.length>=7&&o.width>20&&o.width<60,'outlineText: real glyphs with a plausible width')
      const ys=o.paths.flat().filter(c=>c[0]!=='Z').map(c=>c[c.length-1])
      assert.ok(Math.max(...ys)>3&&Math.max(...ys)<7&&Math.min(...ys)>-2.5,'outlineText: glyphs sit on the baseline, y up')
      console.log(`ok outlineText with ${loadOutlineFonts().length} font face(s)`)
    }else console.log('skip outlineText real-font check (no CJK font on this machine)')
  }
  assert.ok(!toDxf(k,{artwork,artworkImages:images}).includes('ARTWORK'),'artwork: dxf stays line-only')
  console.log('ok artwork svg/pdf/ai')
}

console.log('check-export: all passed')
