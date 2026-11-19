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
  const page=(await PDFDocument.load(bytes)).getPage(0)
  const xs=[],ys=[]
  for(const role of ['trim','crease'])for(const path of knife.layers?.[role]?.paths||knife.paths?.[role]||[])for(const c of path)if(Number.isFinite(c.x)){xs.push(c.x);ys.push(c.y)}
  const k=72/25.4,w=(Math.max(...xs)-Math.min(...xs))*k,h=(Math.max(...ys)-Math.min(...ys))*k
  assert.ok(page.getWidth()>=w&&page.getHeight()>=h,`${label}: pdf page ${page.getWidth().toFixed(0)}x${page.getHeight().toFixed(0)}pt fits 1:1 dieline ${w.toFixed(0)}x${h.toFixed(0)}pt`)
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

console.log('check-export: all passed')
