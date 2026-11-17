/**
 * Random advanced params: either valid knife or blocking issue with code — never uncaught throw / out-of-face holes.
 */
import assert from 'node:assert/strict'
import {createKnife,getTemplate} from '../packages/geometry-engine/index.js'

const TEMPLATES_WITH_PARAMS=['rea-aircraft']
const N=500
const EDGE=1e-3

function mulberry32(a){
  return function(){
    let t=a+=0x6D2B79F5
    t=Math.imul(t^t>>>15,t|1)
    t^=t+Math.imul(t^t>>>7,t|61)
    return ((t^t>>>14)>>>0)/4294967296
  }
}

function pointInFace(face,x,y){
  return x>=face.x-EDGE&&y>=face.y-EDGE&&x<=face.x+face.w+EDGE&&y<=face.y+face.h+EDGE
}

for(const tid of TEMPLATES_WITH_PARAMS){
  const tpl=getTemplate(tid)
  const defs=tpl.paramDefs||[]
  assert.ok(defs.length,'expected paramDefs')
  const rnd=mulberry32(tid.split('').reduce((s,c)=>s+c.charCodeAt(0),1))
  let okCount=0,blockCount=0
  for(let i=0;i<N;i++){
    const overrides={}
    for(const d of defs){
      const lo=typeof d.min==='number'?d.min:0
      const hi=typeof d.max==='number'?d.max:200
      // Mix in-range and out-of-range
      const span=hi-lo||1
      const v=lo-span*0.2+rnd()*span*1.4
      overrides[d.code]=d.unit==='count'?Math.round(v):Math.round(v*1000)/1000
    }
    let knife
    try{
      knife=createKnife({
        templateId:tid,
        length:tpl.defaults.length,
        width:tpl.defaults.width,
        height:tpl.defaults.height,
        thickness:tpl.defaults.thickness,
        bleed:3,
        sizeMode:'inner',
        previewBleedExtra:0,
        params:overrides,
      })
    }catch(err){
      console.error(`uncaught for ${tid} #${i}`,overrides,err)
      throw err
    }
    const blocking=(knife.issues||[]).filter(x=>x.severity==='blocking')
    if(blocking.length){
      blockCount++
      for(const b of blocking)assert.ok(b.code,`blocking issue missing code: ${JSON.stringify(b)}`)
    }else{
      okCount++
      assert.ok(knife.validation?.ok!==false||!(knife.validation),'unexpected soft state')
    }
    // Holes must lie inside some face when generated
    for(const h of knife.holes||[]){
      if(!h.face)continue
      const face=knife.faces.find(f=>f.name===h.face)
      if(!face)continue
      assert.ok(
        pointInFace(face,h.x,h.y)&&pointInFace(face,h.x+h.w,h.y+h.h),
        `hole out of face ${h.face} for ${tid}`,
      )
    }
  }
  console.log(`check-param-constraints: ${tid} ok=${okCount} blocked=${blockCount}`)
  assert.ok(okCount+blockCount===N)
}

console.log('check-param-constraints: ok')
