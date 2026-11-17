/**
 * Knife stats vs independent segment-length accumulator.
 */
import assert from 'node:assert/strict'
import {createKnife,computeKnifeStats} from '../packages/geometry-engine/index.js'

function segLen(segs){
  return (segs||[]).reduce((s,e)=>s+Math.hypot((e.x2||0)-(e.x1||0),(e.y2||0)-(e.y1||0)),0)
}

const knife=createKnife({
  templateId:'fefco-0201',
  length:400,width:300,height:200,thickness:3,bleed:3,
  sizeMode:'inner',previewBleedExtra:0,
})
const stats=knife.stats||computeKnifeStats(knife)
const cut=segLen(knife.cuts)
const crease=segLen(knife.folds)
assert.ok(Math.abs(stats.cutLengthMm-cut)/Math.max(1,cut)<=0.001)
assert.ok(Math.abs(stats.creaseLengthMm-crease)/Math.max(1,crease)<=0.001)
assert.equal(stats.faceCount,knife.faces.length)
assert.equal(stats.holeCount,(knife.holes||[]).length)
assert.ok(stats.sheetWidthMm>0&&stats.sheetHeightMm>0)

// Rectangle baseline: single-face style via tuck-end defaults
const tuck=createKnife({
  templateId:'tuck-end-straight',
  length:80,width:50,height:150,thickness:0.5,bleed:0,
  sizeMode:'inner',previewBleedExtra:0,
})
const ts=tuck.stats||computeKnifeStats(tuck)
assert.ok(ts.cutLengthMm>0)
assert.ok(ts.creaseLengthMm>0)

console.log(`check-stats: ok cut=${stats.cutLengthMm} crease=${stats.creaseLengthMm}`)
