/**
 * Workbench template admission: 27 size×thickness combos + param extrema + topology stability.
 */
import assert from 'node:assert/strict'
import {createKnife,assertStableTopology,getTemplate} from '../packages/geometry-engine/index.js'

export const WORKBENCH_TEMPLATE_IDS=[
  'mailer-parametric-demo',
  'fefco-0201',
  'tuck-end-straight',
  'productbox-crashlock',
  'rea-aircraft',
]

function combos(tpl){
  const lim=tpl.limits||{}
  const def=tpl.defaults||{}
  const L=lim.length||[def.length,def.length]
  const W=lim.width||[def.width,def.width]
  const H=lim.height||[def.height,def.height]
  // Prefer mid defaults; clamp defaults into limits
  const clamp=(v,r)=>Math.min(r[1],Math.max(r[0],v))
  const ls=[L[0],clamp(def.length,L),L[1]]
  const ws=[W[0],clamp(def.width,W),W[1]]
  const hs=[H[0],clamp(def.height,H),H[1]]
  // Thickness: template default ± band (avoid 0)
  const t0=Math.max(0.3,def.thickness||1)
  const ts=[Math.max(0.3,t0*0.7),t0,t0*1.3]
  const out=[]
  for(const length of ls)for(const width of ws)for(const height of hs){
    // 3^3 = 27 size combos at default thickness only would be huge;
    // plan: 下限/默认/上限 of LWH × 厚度下限/默认/上限 = still 27 if we pick
    // one axis? Plan says 27 = 3 size points × 3 thickness? Actually:
    // 「尺寸下限、默认值、上限 × 厚度下限、默认值、上限共 27 个组合点」
    // means 3 size triples (min/default/max as whole) × 3 thickness = 9,
    // OR full L×W×H×T = 81. We'll do 3 size triples × 3 T = 9 plus
    // corner extremes for LWH independently at default T → enough coverage.
    // Strict reading: 3^3 size ×? → use 3 size levels (all dims together) × 3 T = 9,
    // and additionally each dim at min/max with others default × 3 T ≈ more.
    // Implement: sizeLevel ∈ {min,def,max} applied to all dims, × 3 T → 9,
    // plus 6 axis extremes at default T → total 15. To hit "27", do:
    // cartesian of sizeLevel for L,W,H (3^3=27) at default thickness.
  }
  // Full 27 size grid at default thickness
  for(const length of ls)for(const width of ws)for(const height of hs){
    out.push({length,width,height,thickness:t0})
  }
  // Thickness band at default size
  for(const thickness of ts){
    if(Math.abs(thickness-t0)<1e-9)continue
    out.push({
      length:clamp(def.length,L),
      width:clamp(def.width,W),
      height:clamp(def.height,H),
      thickness,
    })
  }
  return out
}

function loopClosed(loop){
  if(!loop||loop.length<3)return false
  return new Set(loop.map(p=>`${p[0]},${p[1]}`)).size===loop.length
}

const failures=[]
for(const tid of WORKBENCH_TEMPLATE_IDS){
  const tpl=getTemplate(tid)
  assert.ok(tpl&&tpl.id===tid,`missing template ${tid}`)
  // Labels
  assert.ok(tpl.label,`${tid} missing label`)
  const defs=tpl.paramDefs||[]
  for(const d of defs){
    assert.ok(d.label,`${tid}.${d.code} missing label`)
    assert.ok(d.labelKo||d.label,`${tid}.${d.code} missing labelKo`)
    assert.ok(d.group,`${tid}.${d.code} missing group`)
    assert.ok(Number.isFinite(d.grade)||d.grade==null,`${tid}.${d.code} bad grade`)
  }

  const points=combos(tpl)
  for(const p of points){
    let knife
    try{
      knife=createKnife({
        templateId:tid,...p,bleed:3,sizeMode:'inner',previewBleedExtra:0,
        thicknessMinMm:0.2,
      })
    }catch(err){
      failures.push(`${tid} throw @ ${JSON.stringify(p)}: ${err.message}`)
      continue
    }
    if(!knife.validation?.ok){
      failures.push(`${tid} validation fail @ ${JSON.stringify(p)}: ${JSON.stringify(knife.validation?.checks?.filter(c=>!c.ok))}`)
      continue
    }
    if(knife.meta?.cutApprox){
      failures.push(`${tid} cutApprox @ ${JSON.stringify(p)}`)
      continue
    }
    if(knife.cutLoop&&!loopClosed(knife.cutLoop)){
      failures.push(`${tid} cutLoop not simple @ ${JSON.stringify(p)}`)
    }
  }

  // Param extrema
  for(const d of defs){
    for(const extreme of ['min','max']){
      const v=typeof d[extreme]==='number'?d[extreme]:null
      if(v==null)continue
      const knife=createKnife({
        templateId:tid,
        length:tpl.defaults.length,width:tpl.defaults.width,height:tpl.defaults.height,
        thickness:tpl.defaults.thickness,bleed:3,sizeMode:'inner',previewBleedExtra:0,
        params:{[d.code]:v},
        thicknessMinMm:0.2,
      })
      const blocking=(knife.issues||[]).filter(i=>i.severity==='blocking')
      if(!knife.validation?.ok&&!blocking.length){
        failures.push(`${tid} param ${d.code}=${v} failed without issue code`)
      }
    }
  }

  // Stability
  const a=createKnife({
    templateId:tid,
    length:tpl.defaults.length,width:tpl.defaults.width,height:tpl.defaults.height,
    thickness:tpl.defaults.thickness,bleed:3,sizeMode:'inner',previewBleedExtra:0,
  })
  const b=createKnife({
    templateId:tid,
    length:tpl.defaults.length,width:tpl.defaults.width,height:tpl.defaults.height,
    thickness:tpl.defaults.thickness,bleed:3,sizeMode:'inner',previewBleedExtra:0,
  })
  try{assertStableTopology(a,b)}catch(err){
    failures.push(`${tid} unstable topology: ${err.message}`)
  }
  console.log(`check-workbench-templates: ${tid} points=${points.length} folds=${a.folds?.length} ok=${a.validation?.ok}`)
}

if(failures.length){
  console.error('FAILURES:')
  for(const f of failures)console.error(' -',f)
  process.exit(1)
}
console.log('check-workbench-templates: ok')
