import assert from 'node:assert/strict'
import {createKnife} from '../src/knife.js'
import {toDxf,toSvgDieline,toPdf,toAi} from '../src/exportDieline.js'
import {buildDimAnnotations} from '../src/dimAnnotations.js'

function assertDxf(label,knife){
  const dxf=toDxf(knife)
  assert.ok(dxf.includes('TRIM'),`${label}: TRIM layer`)
  assert.ok(dxf.includes('CREASE'),`${label}: CREASE layer`)
  assert.ok(dxf.includes('BLEED'),`${label}: BLEED layer`)
  const entities=dxf.split('\n').filter((v,i,a)=>v==='LINE'&&a[i-1]==='0').length
  const expected=knife.layers.trim.segments.length
    +knife.layers.crease.segments.length
    +knife.layers.bleed.segments.length
  assert.ok(entities>=expected,`${label}: LINE count ${entities} >= ${expected}`)
  assert.ok(dxf.includes('$INSUNITS'),`${label}: INSUNITS`)
  assert.equal(knife.manufacturingReady,false,`${label}: manufacturingReady`)
  console.log(`ok dxf ${label} lines=${entities}`)
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
