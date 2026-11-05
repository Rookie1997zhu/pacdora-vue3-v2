/**
 * OUTBOX 联动校验：内空 ≥ 内盒外廓 + 2×间隙；外箱契约与合盖检测通过
 */
import {createKnife} from '../src/knife.js'
import {estimateClosedCollisions} from '../src/foldSim.js'
import {
  OUTBOX_TEMPLATE_ID,
  DEFAULT_OUTBOX_GAP,
  DEFAULT_OUTBOX_THICKNESS,
  inboxOuterDims,
  computeOutboxSize,
  buildOutboxKnife,
  canBuildOutbox
} from '../src/outbox.js'

const samples=[
  {templateId:'mailer-parametric-demo',length:315,width:202,height:62,thickness:1.5},
  {templateId:'tuck-end-straight',length:80,width:50,height:150,thickness:1.5},
  {templateId:'fefco-0427',length:250,width:180,height:60,thickness:1.5},
  {templateId:'lid-base',length:300,width:200,height:60,thickness:1.5,piece:'bottom'},
  {templateId:'rea-flat-sheet',length:100,width:95,height:0,thickness:1.5,expectSkip:true}
]

let failed=0
function ok(msg){console.log('ok',msg)}
function fail(msg){console.error('FAIL',msg);failed++}

for(const s of samples){
  const inbox=createKnife({
    templateId:s.templateId,
    length:s.length,
    width:s.width,
    height:s.height,
    thickness:s.thickness,
    bleed:5,
    sizeMode:'inner',
    piece:s.piece
  })
  const flat=s.height===0
  const eligible=canBuildOutbox({knife:inbox,flatHeight:flat,enabled:true})
  if(s.expectSkip){
    if(eligible)fail(`${s.templateId}: expected skip but eligible`)
    else ok(`${s.templateId}: skipped as expected`)
    continue
  }
  if(!eligible){fail(`${s.templateId}: not eligible`);continue}
  const outer=inboxOuterDims(inbox)
  if(!outer){fail(`${s.templateId}: no outer dims`);continue}
  const gap=DEFAULT_OUTBOX_GAP
  const plan=computeOutboxSize(outer,gap)
  const needL=Math.ceil(outer.length+2*gap.length)
  const needW=Math.ceil(outer.width+2*gap.width)
  const needH=Math.ceil(outer.height+2*gap.height)
  if(!plan.clamped){
    if(plan.inner.length<needL||plan.inner.width<needW||plan.inner.height<needH){
      fail(`${s.templateId}: inner too small ${JSON.stringify(plan.inner)} vs need ${needL}x${needW}x${needH}`)
      continue
    }
  }else if(plan.inner.length<=0||plan.inner.width<=0||plan.inner.height<=0){
    fail(`${s.templateId}: clamped to invalid size`);continue
  }
  const built=buildOutboxKnife({
    inboxKnife:inbox,
    gap,
    thickness:DEFAULT_OUTBOX_THICKNESS,
    bleed:5,
    flatHeight:flat
  })
  if(!built?.knife){fail(`${s.templateId}: no outbox knife`);continue}
  if(built.knife.template!==OUTBOX_TEMPLATE_ID&&built.knife.templateId!==OUTBOX_TEMPLATE_ID){
    // createKnife puts template id on knife.template
  }
  if(built.knife.template!==OUTBOX_TEMPLATE_ID){
    fail(`${s.templateId}: wrong template ${built.knife.template}`)
    continue
  }
  if(!built.knife.validation?.ok){
    fail(`${s.templateId}: outbox contract failed`)
    continue
  }
  const closed=estimateClosedCollisions(built.knife,DEFAULT_OUTBOX_THICKNESS)
  if(!closed.ok&&!closed.skipped){
    fail(`${s.templateId}: outbox closed check ${closed.issues?.length||0}`)
    continue
  }
  ok(`${s.templateId}: outer ${outer.length}x${outer.width}x${outer.height} → inner ${plan.inner.length}x${plan.inner.width}x${plan.inner.height} faces=${built.knife.faces.length}`)
}

if(failed){
  console.error(`check-outbox: ${failed} failed`)
  process.exit(1)
}
console.log('check-outbox: all passed')
