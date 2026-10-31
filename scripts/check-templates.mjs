import assert from 'node:assert/strict'
import {createKnife,deriveSizes} from '../src/knife.js'
import {assertStableTopology} from '../src/knifeContract.js'
import {estimateClosedCollisions} from '../src/foldSim.js'
import {TEMPLATE_LIST} from '../src/templates/index.js'
import {assertKnife,sizeCases} from './lib/assertKnife.mjs'

for(const t of TEMPLATE_LIST){
  const d=t.defaults
  const cases=sizeCases(t)
  const knives={}
  for(const [label,dims] of Object.entries(cases)){
    knives[label]=createKnife({templateId:t.id,...dims})
    assertKnife(t,label,knives[label])
  }
  assertStableTopology(knives.default,knives.min)
  assertStableTopology(knives.default,knives.max)

  const inner=deriveSizes(t,{...d,sizeMode:'inner'})
  const outer=deriveSizes(t,{...inner.outer,thickness:d.thickness,sizeMode:'outer'})
  assert.deepEqual(outer.inner,inner.inner,`${t.id}: inner/outer parity`)
  assert.deepEqual(outer.panel,inner.panel,`${t.id}: panel parity`)
  const thick=deriveSizes(t,{...d,thickness:d.thickness*3})
  const growsL=thick.outer.length>inner.outer.length||t.sizeRule.outerAdd.length===0
  const growsH=thick.panel.height>inner.panel.height||t.sizeRule.panelAdd.height===0
  assert.ok(growsL&&growsH,`${t.id}: thickness compensation grows (or flat rule)`)

  const k=knives.default
  console.log(`ok ${t.id} (${t.standard}) faces=${k.faces.length} folds=${k.folds.length} cuts=${k.cuts.length} sheet=${k.totalX}x${k.totalY}`)
}

assert.equal(createKnife({templateId:'unknown-template'}).template,'mailer-parametric-demo','unknown id falls back to default')

// lid-base：同尺寸下天盖底板长宽大于底盖（lidClearance）
{
  const d=TEMPLATE_LIST.find(t=>t.id==='lid-base')?.defaults||{length:300,width:200,height:60,thickness:1.5}
  const bottom=createKnife({templateId:'lid-base',...d,piece:'bottom',bleed:0})
  const lid=createKnife({templateId:'lid-base',...d,piece:'lid',bleed:0})
  const baseB=bottom.faces.find(f=>f.name==='base')
  const baseL=lid.faces.find(f=>f.name==='base')
  assert.ok(baseB&&baseL,'lid-base: base faces')
  assert.ok(baseL.w>baseB.w&&baseL.h>baseB.h,`lid-base: lid panel ${baseL.w}x${baseL.h} > bottom ${baseB.w}x${baseB.h}`)
  assert.equal(lid.piece,'lid')
  assert.equal(bottom.piece,'bottom')
  const closedLid=estimateClosedCollisions(lid,d.thickness)
  assert.notEqual(closedLid.skipped,true,'lid-base lid: closed not skipped')
  assert.equal(closedLid.ok,true,`lid-base lid: closed ok ${JSON.stringify(closedLid.issues)}`)
  console.log(`ok lid-base piece clearance bottom=${baseB.w}x${baseB.h} lid=${baseL.w}x${baseL.h}`)
}

// cylinder-box：三档边数拓扑稳定
{
  const d=TEMPLATE_LIST.find(t=>t.id==='cylinder-box')?.defaults||{length:80,width:80,height:120,thickness:1.5}
  for(const sides of [24,36,48]){
    const k=createKnife({templateId:'cylinder-box',...d,piece:'bottom',params:{sides}})
    assertKnife(TEMPLATE_LIST.find(t=>t.id==='cylinder-box'),`sides=${sides}`,k)
    assert.ok(k.faces.some(f=>f.name==='disk'),`cylinder sides=${sides}: disk`)
    assert.equal(k.faces.filter(f=>/^wall\d+$/.test(f.name)).length,sides,`cylinder sides=${sides}: wall count`)
    // 24 档必须真外环；36/48 在锯齿舌+盘片下允许 cutApprox，但拓扑与 tabs 稳定
    if(sides===24)assert.equal(k.meta?.cutApprox,false,`cylinder sides=24: cutApprox false`)
    assert.equal(k.faces.filter(f=>/^tab\d+$/.test(f.name)).length,sides,`cylinder sides=${sides}: tabs`)
    const kMin=createKnife({templateId:'cylinder-box',length:40,width:40,height:30,thickness:1.5,piece:'bottom',params:{sides}})
    assertStableTopology(k,kMin)
  }
  const lid=createKnife({templateId:'cylinder-box',...d,piece:'lid',params:{sides:36}})
  assert.equal(lid.piece,'lid')
  console.log('ok cylinder-box sides 24/36/48')
}

console.log('check-templates: all passed')
