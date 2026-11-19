/**
 * 懒加载规格的一致性：浏览器端从 public/spec/<code>.json 取规格，Node 端读 structureSpecs.js。
 * 两边必须是同一份内容，否则预览与服务端导出的几何会不一致。
 *  1. 每个预设用到的 spec-* 模板都有规格文件，且在索引里
 *  2. 文件内容与 structureSpecs.js 里的规格逐字一致，哈希与索引一致
 *  3. 由文件内容构建的模板与全量注册的模板生成相同的刀版
 *  4. 未注册的 spec-* 不会被 createKnife 悄悄回退成默认模板
 */
import assert from 'node:assert/strict'
import {readFileSync,existsSync,readdirSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {createKnife} from '../src/knife.js'
import {TEMPLATES} from '../src/templates/index.js'
import {createSpecTemplate} from '../src/templates/spec/specTemplate.js'
import {PRESETS} from '../src/catalog/index.js'
import specData from '../src/catalog/structureSpecs.js'
import SPEC_INDEX from '../src/catalog/structureSpecIndex.js'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')
const dir=join(root,'public','spec')
const byCode=new Map((specData.specs||[]).map(s=>[s.code,s]))
// 预设直接用到的 spec-*，以及「按尺寸插值」模板在采样范围之外退回的 spec-*
const used=[...new Set([
  ...PRESETS.map(p=>p.templateId),
  ...Object.values(TEMPLATES).map(t=>t.sampledFallback),
].filter(t=>typeof t==='string'&&t.startsWith('spec-')))]

assert.ok(used.length>0,'presets reference spec templates')
for(const id of used){
  const code=id.slice(5)
  const file=join(dir,`${code}.json`)
  assert.ok(SPEC_INDEX[code],`${id}: missing from structureSpecIndex`)
  assert.ok(existsSync(file),`${id}: missing public/spec/${code}.json — run npm run catalog:build`)
  const body=readFileSync(file,'utf8')
  const full=byCode.get(code)
  assert.ok(full,`${id}: not in structureSpecs.js`)
  assert.equal(body,JSON.stringify(full),`${id}: spec file differs from structureSpecs.js — run npm run catalog:build`)
  assert.equal(createHash('sha256').update(body).digest('hex').slice(0,10),SPEC_INDEX[code],`${id}: index hash stale`)
}
const files=readdirSync(dir).filter(f=>f.endsWith('.json'))
assert.equal(files.length,used.length,`public/spec has ${files.length} files, presets use ${used.length}`)
assert.equal(Object.keys(SPEC_INDEX).length,used.length,'index size matches used specs')

// 由懒加载文件构建的模板 == 全量注册的模板（抽样比对刀版）
const sample=used.filter((_,i)=>i%25===0)
for(const id of sample){
  const code=id.slice(5)
  const lazy=createSpecTemplate(JSON.parse(readFileSync(join(dir,`${code}.json`),'utf8')))
  const eager=TEMPLATES[id]
  assert.ok(eager,`${id}: registered on Node`)
  const d=eager.defaults
  const args={length:d.length,width:d.width,height:d.height,thickness:d.thickness,bleed:3,previewBleedExtra:0}
  const a=createKnife({templateId:id,...args})
  // 用懒加载模板的 layout 直接比对面片，避免改动注册表
  const params=a.params||{}
  const la=eager.layout({panel:a.dimensions.panel,inner:a.dimensions.inner,T:a.dimensions.thickness,params})
  const lb=lazy.layout({panel:a.dimensions.panel,inner:a.dimensions.inner,T:a.dimensions.thickness,params})
  assert.deepEqual(lb.faces,la.faces,`${id}: lazy layout faces differ`)
  assert.deepEqual(lb.slits||[],la.slits||[],`${id}: lazy layout slits differ`)
  assert.deepEqual(lazy.limits,eager.limits,`${id}: limits differ`)
}

// 未注册的规格模板必须报错，不得回退
assert.throws(
  ()=>createKnife({templateId:'spec-__NotLoaded__',length:100,width:80,height:60,thickness:.5}),
  e=>e?.code==='TEMPLATE_NOT_LOADED',
  'unloaded spec template must throw TEMPLATE_NOT_LOADED',
)

console.log(`check-spec-chunks: ok files=${files.length} sampled=${sample.length}`)
