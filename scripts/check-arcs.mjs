import assert from 'node:assert/strict'
import {inflateSync} from 'node:zlib'
import {createKnife} from '../src/knife.js'
import {flattenCubicPath,pathCommandsFromLoop} from '../src/geom/flattenPath.js'
import {toDxf,toPdf} from '../src/exportDieline.js'

const MAX_DEVIATION_MM=.05

function pointSegmentDistance(p,a,b){
  const dx=b[0]-a[0],dy=b[1]-a[1]
  const len2=dx*dx+dy*dy
  if(len2<1e-12)return Math.hypot(p[0]-a[0],p[1]-a[1])
  const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/len2))
  return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)
}

function distanceToLoop(point,loop){
  let best=Infinity
  for(let i=0;i<loop.length;i++){
    best=Math.min(best,pointSegmentDistance(point,loop[i],loop[(i+1)%loop.length]))
  }
  return best
}

function pathPolylineDeviation(path,loop){
  const rebuilt=flattenCubicPath(path,{tol:.001,maxPts:4096})
  assert.ok(rebuilt.length>=3,'rebuilt path must contain at least three points')
  let max=0
  for(const point of rebuilt)max=Math.max(max,distanceToLoop(point,loop))
  for(const point of loop)max=Math.max(max,distanceToLoop(point,rebuilt))
  return max
}

function parseDxfEntities(text){
  const rows=String(text).trim().split(/\r?\n/)
  assert.equal(rows.length%2,0,'DXF group-code rows must be paired')
  const entities=[]
  let current=null
  for(let i=0;i<rows.length;i+=2){
    const code=Number(rows[i]),value=rows[i+1]
    if(code===0){
      if(current)entities.push(current)
      current={type:value,groups:[]}
    }else if(current){
      current.groups.push([code,value])
    }
  }
  if(current)entities.push(current)
  return entities
}

function groupNumber(entity,code){
  const pair=entity.groups.find(([groupCode])=>groupCode===code)
  return pair?Number(pair[1]):NaN
}

function groupText(entity,code){
  return entity.groups.find(([groupCode])=>groupCode===code)?.[1]
}

// 反例：共圆但不是圆弧的折线环不得被重建为 A（矩形出血曾被画成整圆）
const regularPolygon=(n,r)=>Array.from({length:n},(_,i)=>[100+r*Math.cos(i*2*Math.PI/n),100+r*Math.sin(i*2*Math.PI/n)])
for(const [label,loop] of [
  ['rectangle',[[12,12],[230,12],[230,252],[12,252]]],
  ['square',[[0,0],[50,0],[50,50],[0,50]]],
  ['hexagon',regularPolygon(6,40)],
  ['octagon',regularPolygon(8,40)],
  ['trapezoid',[[0,0],[100,0],[80,30],[20,30]]],
]){
  const cmds=pathCommandsFromLoop(loop)
  assert.ok(!cmds.some(cmd=>cmd.mtd==='A'),`${label} loop must stay polyline, got ${JSON.stringify(cmds)}`)
  assert.equal(cmds.filter(cmd=>cmd.mtd==='L').length,loop.length-1,`${label} loop must keep every vertex`)
}
const rectTemplate=createKnife({
  templateId:'tuck-end-straight',
  length:49.4,width:49.4,height:98.9,thickness:.5,
  bleed:3,previewBleedExtra:0,
})
assert.ok(
  !rectTemplate.paths.bleed.flat().some(cmd=>cmd.mtd==='A'),
  'rectangular bleed outline must not contain A commands'
)
assert.ok(!/A/.test(rectTemplate.bleedPath),'bleedPath of rectangular template must not contain arcs')

const rounded=createKnife({
  templateId:'rea-pair-window',
  length:315,width:202,height:62,thickness:1.5,
  bleed:3,previewBleedExtra:0,
})
assert.ok(rounded.holes.length>0,'rounded-hole template must produce a hole')
const roundedHole=rounded.holes.find(h=>h.r>0)
assert.ok(roundedHole,'rounded-hole template must expose radius metadata')
assert.ok(roundedHole.pathCommands.some(cmd=>cmd.mtd==='A'),'rounded hole path must contain A commands')
const roundedDeviation=pathPolylineDeviation(roundedHole.pathCommands,roundedHole.loop)
assert.ok(
  roundedDeviation<=MAX_DEVIATION_MM,
  `rounded-hole deviation ${roundedDeviation.toFixed(4)}mm > ${MAX_DEVIATION_MM}mm`
)

const chamfered=createKnife({
  templateId:'rea-cover-basset',
  length:315,width:202,height:62,thickness:1.5,
  bleed:3,previewBleedExtra:0,
})
assert.ok(chamfered.paths?.trim?.[0]?.length,'chamfer template must expose trim paths')
const chamferDeviation=pathPolylineDeviation(chamfered.paths.trim[0],chamfered.cutLoop)
assert.ok(
  chamferDeviation<=MAX_DEVIATION_MM,
  `chamfer deviation ${chamferDeviation.toFixed(4)}mm > ${MAX_DEVIATION_MM}mm`
)

const dxf=toDxf(rounded)
const entities=parseDxfEntities(dxf)
const arcs=entities.filter(entity=>entity.type==='ARC')
assert.ok(arcs.length>=4,`DXF must contain parseable ARC entities, got ${arcs.length}`)
for(const arc of arcs){
  assert.equal(groupText(arc,8),'TRIM','ARC must be on TRIM layer')
  for(const code of [10,20,40,50,51]){
    assert.ok(Number.isFinite(groupNumber(arc,code)),`ARC group ${code} must be numeric`)
  }
  assert.ok(groupNumber(arc,40)>0,'ARC radius must be positive')
}
assert.ok(entities.some(entity=>entity.type==='POLYLINE'),'DXF must contain POLYLINE entities')
assert.ok(entities.some(entity=>entity.type==='TEXT'&&groupText(entity,8)==='TEXT'),'DXF must contain TEXT-layer labels')
assert.ok(entities.some(entity=>entity.type==='POLYLINE'&&groupText(entity,8)==='DIM'),'DXF must contain DIM-layer geometry')

const withoutAnnotations=parseDxfEntities(toDxf(rounded,{
  showDimensions:false,
  showFaceNames:false,
  showBleed:false,
  showTitleBlock:false,
}))
assert.ok(!withoutAnnotations.some(entity=>groupText(entity,8)==='DIM'),'disabled dimensions must omit DIM entities')
assert.ok(!withoutAnnotations.some(entity=>groupText(entity,8)==='TEXT'),'disabled labels must omit TEXT entities')
assert.ok(!withoutAnnotations.some(entity=>groupText(entity,8)==='BLEED'),'disabled bleed must omit BLEED entities')

const inchEntities=parseDxfEntities(toDxf(rounded,{displayUnit:'in',showFaceNames:true}))
assert.ok(
  inchEntities.some(entity=>entity.type==='TEXT'&&/\bin\b/.test(groupText(entity,1)||'')),
  'displayUnit=in must produce inch labels'
)
assert.ok(
  inchEntities.some(entity=>entity.type==='TEXT'&&groupText(entity,1)===rounded.faces[0].name),
  'showFaceNames must produce face-name TEXT'
)

const pdfBytes=await toPdf(rounded,{
  showDimensions:true,
  showFaceNames:true,
  showBleed:false,
  showTitleBlock:false,
  displayUnit:'in',
})
const pdfLatin1=Buffer.from(pdfBytes).toString('latin1')
const decodedStreams=[]
for(const match of pdfLatin1.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)){
  try{decodedStreams.push(inflateSync(Buffer.from(match[1],'latin1')).toString('latin1'))}catch{/* non-Flate stream */}
}
assert.ok(
  decodedStreams.some(stream=>/(?:^|\s)c(?:\s|$)/m.test(stream)),
  'PDF content stream must contain cubic Bezier operators for true curves'
)

console.log(
  `check-arcs: passed rounded=${roundedDeviation.toFixed(4)}mm `+
  `chamfer=${chamferDeviation.toFixed(4)}mm arcs=${arcs.length} pdfCurves=true`
)
