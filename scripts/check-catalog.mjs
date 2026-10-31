import assert from 'node:assert/strict'
import {existsSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createKnife} from '../src/knife.js'
import {TEMPLATES} from '../src/templates/index.js'
import {PRESETS,PRESET_CATALOG,OFFICIAL_SUBCLASSES,searchImportedPresets} from '../src/catalog/index.js'
import {EXPECTED,templateFitsAnySubclass} from '../src/catalog/subclassTemplateRules.js'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')

assert.ok(PRESET_CATALOG.count>0,'catalog count')
assert.equal(PRESETS.length,PRESET_CATALOG.count)
assert.equal(PRESETS.length,47,'shipping-only catalog size')
const blob=JSON.stringify(PRESET_CATALOG)
assert.ok(!blob.includes('cdn.pacdora.com'),'no pacdora CDN')
assert.ok(!blob.includes('mockup-detail'),'no pacdora detail links')
assert.ok(!blob.includes('"cuts":'),'no knife cut geometry embedded')

const ids=new Set()
let withGeom=0,mapped=0
for(const p of PRESETS){
  const flat=p.templateId==='rea-flat-sheet'||p.height===0
  assert.ok(p.length>0&&p.width>0&&p.thickness>0,`${p.id} dims`)
  assert.ok(flat?p.height>=0:p.height>0,`${p.id} height`)
  assert.ok(!ids.has(p.id),`dup ${p.id}`)
  ids.add(p.id)
  assert.equal(p.categoryId,'shipping',`${p.id} must be shipping`)
  if(p.templateId){
    assert.ok(TEMPLATES[p.templateId],`bad template ${p.templateId}`)
    mapped++
  }
  if(p.hasGeometry){
    withGeom++
    assert.ok(existsSync(join(root,'geometry','pacdora_boxes',`${p.sourceNum}.json`)),`geom missing ${p.sourceNum}`)
  }
}

assert.ok(mapped>0,'some mapped')
assert.equal(withGeom,47,'all shipping presets have geometry')

// modelOnly 必须挂平板示意（无真实刀版）
let modelOnlyN=0
for(const p of PRESETS){
  if(!p.modelOnly)continue
  modelOnlyN++
  assert.equal(p.templateId,'rea-flat-sheet',`modelOnly ${p.sourceNum} must be rea-flat-sheet`)
}
assert.ok(searchImportedPresets('200010',{limit:5}).length>=1,'search works')
assert.ok(PRESETS.every(p=>p.categoryId&&p.categoryLabel),'each preset has category')
const shipping=searchImportedPresets('',{categoryId:'shipping',limit:120})
assert.ok(shipping.length===47&&shipping.every(p=>p.categoryId==='shipping'),'shipping filter')
assert.equal(searchImportedPresets('',{categoryId:'gift',limit:5}).length,0,'no gift presets')

assert.ok(OFFICIAL_SUBCLASSES.some(c=>c.id==='shipping'),'shipping subclass present')
assert.ok(OFFICIAL_SUBCLASSES.length>=3,'shipping-related subclasses')
const tuck=searchImportedPresets('',{subclassId:'tuck',limit:5})
assert.ok(tuck.length>=1&&tuck.every(p=>(p.subclassIds||[]).includes('tuck')),'tuck subclass filter')
const none=searchImportedPresets('',{subclassId:'__none__',limit:5})
assert.ok(none.every(p=>!(p.subclassIds||[]).length),'unclassified filter')

// 带 subclassIds 且已映射：模板须落在某一所属子类合理列表（plastic/other 除外）
let subclassMismatch=0
for(const p of PRESETS){
  if(!p.templateId)continue
  // structure-code / structure-spec / 手工示意挂载：允许偏离子类启发式白名单
  if(p.templateSource==='structure-code'||p.templateSource==='structure-spec'||p.templateSource==='structure-spec-takeover'||p.templateSource==='map-override-manual')continue
  const ids=(p.subclassIds||[]).filter(id=>{
    const exp=EXPECTED[id]
    return Array.isArray(exp)&&exp.length>0
  })
  if(!ids.length)continue
  if(!templateFitsAnySubclass(p.templateId,ids)){
    subclassMismatch++
    if(subclassMismatch<=5){
      console.warn(`subclass mismatch sample: ${p.sourceNum} ${p.templateId} ids=${ids.join(',')}`)
    }
  }
}
assert.equal(subclassMismatch,0,`subclass template consistency (${subclassMismatch} mismatches)`)

// 映射条目可生成自有 knife
const sample=PRESETS.find(p=>p.templateId==='mailer-parametric-demo')||PRESETS.find(p=>p.templateId)
const k=createKnife({
  templateId:sample.templateId,
  length:sample.length,width:sample.width,height:sample.height,
  thickness:sample.thickness,bleed:3,materialId:sample.materialId
})
assert.equal(k.validation.ok,true)
assert.equal(k.template,sample.templateId)

console.log(`check-catalog: ${PRESETS.length} imported sizes, mapped=${mapped}, hasGeometry=${withGeom}, modelOnly=${modelOnlyN}`)
