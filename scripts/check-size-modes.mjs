/**
 * Same physical box via inner / manufacturing / outer inputs → identical geometry.
 */
import assert from 'node:assert/strict'
import {createKnife,deriveSizes,getTemplate,assertStableTopology} from '../packages/geometry-engine/index.js'

const TID='mailer-parametric-demo'
const template=getTemplate(TID)
const base={length:300,width:200,height:60,thickness:1.5,bleed:3,previewBleedExtra:0}

const viaInner=createKnife({...base,templateId:TID,sizeMode:'inner'})
const panel=viaInner.dimensions.panel
const outer=viaInner.dimensions.outer

const viaMfg=createKnife({
  ...base,templateId:TID,sizeMode:'manufacturing',
  length:panel.length,width:panel.width,height:panel.height,
})
const viaOuter=createKnife({
  ...base,templateId:TID,sizeMode:'outer',
  length:outer.length,width:outer.width,height:outer.height,
})

function geomKey(k){
  return JSON.stringify({
    faces:k.faces.map(f=>({n:f.name,x:f.x,y:f.y,w:f.w,h:f.h})),
    folds:k.folds.map(f=>({n:f.name,x1:f.x1,y1:f.y1,x2:f.x2,y2:f.y2})),
    cuts:k.cuts,
  })
}

assert.equal(geomKey(viaInner),geomKey(viaMfg),'inner vs manufacturing geometry')
assert.equal(geomKey(viaInner),geomKey(viaOuter),'inner vs outer geometry')
assertStableTopology(viaInner,viaMfg)
assertStableTopology(viaInner,viaOuter)

const eps=0.001
for(const k of ['length','width','height']){
  assert.ok(Math.abs(viaInner.dimensions.inner[k]-viaMfg.dimensions.inner[k])<=eps)
  assert.ok(Math.abs(viaInner.dimensions.panel[k]-viaOuter.dimensions.panel[k])<=eps)
}

const derived=deriveSizes(template,{...base,sizeMode:'manufacturing',length:panel.length,width:panel.width,height:panel.height})
assert.equal(derived.sizeMode,'manufacturing')
assert.ok(Math.abs(derived.panel.length-panel.length)<=eps)

console.log('check-size-modes: ok')
