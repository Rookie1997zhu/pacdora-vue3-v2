/**
 * OUTBOX 联动 + 装箱数量校验
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
  canBuildOutbox,
  choosePacking,
  packingCandidates,
  packingContentCells,
  packingStats,
  fitInFixedOutbox,
  maxQuantityWithinLimits,
  packingFitsCavity,
  withinLimits
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
  const built=buildOutboxKnife({
    inboxKnife:inbox,
    gap:DEFAULT_OUTBOX_GAP,
    thickness:DEFAULT_OUTBOX_THICKNESS,
    bleed:5,
    flatHeight:flat,
    quantity:1
  })
  if(!built?.knife){fail(`${s.templateId}: no outbox knife`);continue}
  if(built.knife.template!==OUTBOX_TEMPLATE_ID){
    fail(`${s.templateId}: wrong template ${built.knife.template}`)
    continue
  }
  if(!built.knife.validation?.ok){
    fail(`${s.templateId}: outbox contract failed`)
    continue
  }
  if(built.packing.nx*built.packing.ny*built.packing.nz!==1){
    fail(`${s.templateId}: N=1 packing product !=1`)
    continue
  }
  const needL=Math.ceil(outer.length+2*DEFAULT_OUTBOX_GAP.length)
  const needW=Math.ceil(outer.width+2*DEFAULT_OUTBOX_GAP.width)
  const needH=Math.ceil(outer.height+2*DEFAULT_OUTBOX_GAP.height)
  if(!built.plan.clamped){
    if(built.plan.inner.length<needL||built.plan.inner.width<needW||built.plan.inner.height<needH){
      fail(`${s.templateId}: N=1 inner too small`)
      continue
    }
  }
  const closed=estimateClosedCollisions(built.knife,DEFAULT_OUTBOX_THICKNESS)
  if(!closed.ok&&!closed.skipped){
    fail(`${s.templateId}: outbox closed check`)
    continue
  }
  ok(`${s.templateId}: N=1 outer ${outer.length}x${outer.width}x${outer.height} → ${built.plan.inner.length}x${built.plan.inner.width}x${built.plan.inner.height}`)
}

// 多件装箱
{
  const inbox=createKnife({
    templateId:'mailer-parametric-demo',
    length:315,width:202,height:62,thickness:1.5,bleed:5,sizeMode:'inner'
  })
  const outer=inboxOuterDims(inbox)
  for(const N of [7,12,24]){
    const cands=packingCandidates(outer,N)
    if(!cands.length){fail(`N=${N}: no candidates`);continue}
    if(cands.some(c=>c.nx*c.ny*c.nz!==N)){fail(`N=${N}: candidate product mismatch`);continue}
    const pack=choosePacking(outer,N,DEFAULT_OUTBOX_GAP)
    if(!pack){fail(`N=${N}: no packing`);continue}
    if(pack.nx*pack.ny*pack.nz!==N){fail(`N=${N}: product ${pack.nx}x${pack.ny}x${pack.nz}`);continue}
    // 验证选中方案体积不大于任意合法方案
    let minVol=Infinity
    for(const c of cands){
      const plan=computeOutboxSize(outer,DEFAULT_OUTBOX_GAP,c)
      if(plan.clamped&&!withinLoose(plan.raw||plan.inner))continue
      const vol=plan.inner.length*plan.inner.width*plan.inner.height
      // compare using raw before clamp for fairness when both unclamped
      const raw=c.rawInner||{
        length:Math.ceil(c.nx*c.cell.length+2*DEFAULT_OUTBOX_GAP.length),
        width:Math.ceil(c.ny*c.cell.width+2*DEFAULT_OUTBOX_GAP.width),
        height:Math.ceil(c.nz*c.cell.height+2*DEFAULT_OUTBOX_GAP.height)
      }
      if(!withinLoose(raw))continue
      minVol=Math.min(minVol,raw.length*raw.width*raw.height)
    }
    const built=buildOutboxKnife({inboxKnife:inbox,quantity:N,gap:DEFAULT_OUTBOX_GAP,thickness:DEFAULT_OUTBOX_THICKNESS})
    if(!built){fail(`N=${N}: build failed`);continue}
    const cells=packingContentCells(built.packing)
    if(cells.length!==N){fail(`N=${N}: cells ${cells.length}`);continue}
    const stats=packingStats(outer,N,built.plan)
    if(!stats||stats.quantity!==N){fail(`N=${N}: bad stats`);continue}
    if(stats.fillRate<=0||stats.fillRate>100){fail(`N=${N}: fillRate ${stats.fillRate}`);continue}
    // 内空应至少容纳排布占用（夹紧前）
    const occL=built.packing.nx*built.packing.cell.length
    const occW=built.packing.ny*built.packing.cell.width
    const occH=built.packing.nz*built.packing.cell.height
    if(!built.plan.clamped){
      if(built.plan.inner.length<occL||built.plan.inner.width<occW||built.plan.inner.height<occH){
        fail(`N=${N}: cavity smaller than occupancy`)
        continue
      }
    }
    if(minVol<Infinity&&built.packing.score>minVol+1){
      // score is raw volume; allow tiny float
      fail(`N=${N}: not minimal volume got ${built.packing.score} min ${minVol}`)
      continue
    }
    ok(`N=${N}: layout ${built.packing.nx}x${built.packing.ny}x${built.packing.nz}${built.packing.rotated?' rot':''} cavity ${built.plan.inner.length}x${built.plan.inner.width}x${built.plan.inner.height} fill=${stats.fillRate}%`)
  }

  // 手动排布乘积不符
  const bad=choosePacking(outer,12,DEFAULT_OUTBOX_GAP,{manual:{nx:2,ny:2,nz:2,rotated:false}})
  if(!bad.warnings.includes('layoutMismatch'))fail('manual mismatch warning missing')
  else ok('manual 2x2x2 vs N=12 warns layoutMismatch')

  // grow 超限：不再静默夹紧，返回 overLimit
  {
    const huge=buildOutboxKnife({
      inboxKnife:inbox,
      quantity:2000,
      gap:DEFAULT_OUTBOX_GAP,
      thickness:DEFAULT_OUTBOX_THICKNESS,
      sizingMode:'grow'
    })
    if(!huge||huge.error!=='overLimit')fail(`grow N=2000: expected overLimit got ${huge?.error}`)
    else if(huge.knife)fail('grow N=2000: knife should be null')
    else if(!(huge.hint?.maxFit>0))fail(`grow N=2000: maxFit missing got ${huge.hint?.maxFit}`)
    else{
      const maxFit=maxQuantityWithinLimits(outer,DEFAULT_OUTBOX_GAP)
      if(maxFit!==huge.hint.maxFit)fail(`grow N=2000: hint.maxFit ${huge.hint.maxFit} != ${maxFit}`)
      else ok(`grow N=2000: overLimit, maxFit=${maxFit}`)
    }
  }

  // fixed：按实际外廓手算期望装量
  {
    const small=createKnife({
      templateId:'tuck-end-straight',
      length:80,width:50,height:150,thickness:1.5,bleed:5,sizeMode:'inner'
    })
    const smallOuter=inboxOuterDims(small)
    const fixed={length:430,width:210,height:270}
    const g=DEFAULT_OUTBOX_GAP
    const usable={
      length:fixed.length-2*g.length,
      width:fixed.width-2*g.width,
      height:fixed.height-2*g.height
    }
    const orients=[
      {nx:Math.floor(usable.length/smallOuter.length),ny:Math.floor(usable.width/smallOuter.width),nz:Math.floor(usable.height/smallOuter.height)},
      {nx:Math.floor(usable.length/smallOuter.width),ny:Math.floor(usable.width/smallOuter.length),nz:Math.floor(usable.height/smallOuter.height)}
    ]
    const expected=Math.max(
      orients[0].nx>=1&&orients[0].ny>=1&&orients[0].nz>=1?orients[0].nx*orients[0].ny*orients[0].nz:0,
      orients[1].nx>=1&&orients[1].ny>=1&&orients[1].nz>=1?orients[1].nx*orients[1].ny*orients[1].nz:0
    )
    const fit=fitInFixedOutbox(smallOuter,fixed,DEFAULT_OUTBOX_GAP)
    if(!fit||fit.error)fail(`fixed fit: unexpected error ${fit?.error}`)
    else if(fit.quantity!==expected){
      fail(`fixed fit: expected ${expected} got ${fit.nx}x${fit.ny}x${fit.nz}=${fit.quantity}`)
    }else ok(`fixed fit: ${smallOuter.length}×${smallOuter.width}×${smallOuter.height} in 430×210×270 → ${fit.nx}x${fit.ny}x${fit.nz}=${fit.quantity}`)

    const builtFixed=buildOutboxKnife({
      inboxKnife:small,
      gap:DEFAULT_OUTBOX_GAP,
      thickness:DEFAULT_OUTBOX_THICKNESS,
      sizingMode:'fixed',
      fixedInner:fixed
    })
    if(!builtFixed?.knife)fail('fixed build: no knife')
    else if(builtFixed.packing.quantity!==expected)fail(`fixed build qty ${builtFixed.packing.quantity}`)
    else if(builtFixed.plan.inner.length!==430||builtFixed.plan.inner.width!==210||builtFixed.plan.inner.height!==270){
      fail(`fixed build size ${builtFixed.plan.inner.length}x${builtFixed.plan.inner.width}x${builtFixed.plan.inner.height}`)
    }else ok(`fixed build: knife at 430×210×270 with ${expected} units`)

    // 尺寸在模板范围内，但放不下一盒
    const none=buildOutboxKnife({
      inboxKnife:small,
      gap:DEFAULT_OUTBOX_GAP,
      thickness:DEFAULT_OUTBOX_THICKNESS,
      sizingMode:'fixed',
      fixedInner:{length:100,width:80,height:50}
    })
    if(!none||none.error!=='noneFit'||none.knife)fail(`fixed tiny: expected noneFit got ${none?.error}`)
    else ok('fixed tiny: noneFit')

    const oor=buildOutboxKnife({
      inboxKnife:small,
      gap:DEFAULT_OUTBOX_GAP,
      thickness:DEFAULT_OUTBOX_THICKNESS,
      sizingMode:'fixed',
      fixedInner:{length:2000,width:210,height:270}
    })
    if(!oor||oor.error!=='fixedOutOfRange'||oor.knife)fail(`fixed OOR: expected fixedOutOfRange got ${oor?.error}`)
    else ok('fixed OOR: fixedOutOfRange')

    // 占用超内空 → packingFitsCavity 失败
    const badFit=packingFitsCavity(
      {nx:2,ny:1,nz:1,cell:{length:300,width:50,height:50}},
      {length:400,width:100,height:100}
    )
    if(badFit.ok)fail('packingFitsCavity: expected fail for 2x300 into 400')
    else ok(`packingFitsCavity: overflow L=${badFit.overflow.length}`)
  }
}

function withinLoose(inner){
  return withinLimits(inner)
}

if(failed){
  console.error(`check-outbox: ${failed} failed`)
  process.exit(1)
}
console.log('check-outbox: all passed')
