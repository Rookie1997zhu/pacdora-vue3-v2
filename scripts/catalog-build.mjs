import {existsSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')
const run=(file,...args)=>{
  const r=spawnSync(process.execPath,[join(root,'scripts',file),...args],{stdio:'inherit',cwd:root})
  if(r.status)process.exit(r.status||1)
}

const shippingCsv=join(root,'docs','pacdora_shipping_boxes','shipping_boxes.csv')
const mailerCsv=join(root,'docs','pacdora_mailer_boxes','mailer_boxes.csv')
const legacyCsv=join(root,'pacdora_boxes_geom.csv')
const detailCsv=join(root,'structure_inventory','03_模型结构归类明细.csv')
const hasInventory=existsSync(detailCsv)

// 运输箱/邮寄盒定点目录：不再从全库「未映射名单」生成覆盖表
console.warn('skip build-map-overrides-from-unmapped — shipping+mailer catalog')

if(existsSync(shippingCsv)||existsSync(mailerCsv)||existsSync(legacyCsv))run('build-presets-from-csv.mjs')
else{
  console.warn('shipping/mailer/legacy CSV missing — applying overrides onto existing presets.js')
  run('apply-map-overrides-to-presets.mjs')
}
// 先撤销上一轮结构规格接管，后续纠错步骤只面对原始模板
run('apply-structure-specs.mjs','--restore')
run('enrich-presets-subclasses.mjs')
if(hasInventory)run('inject-zero-dim-presets.mjs')
else console.warn('skip inject-zero-dim-presets — no structure_inventory')
run('backfill-structure-codes.mjs')
if(hasInventory){
  run('apply-structure-code-templates.mjs','--prefixes')
  run('apply-prototype-routing.mjs')
}else{
  console.warn('skip structure-code-templates / prototype-routing — no structure_inventory')
}
run('correct-subclass-templates.mjs')
run('refine-crowded-templates.mjs')
// 开顶模板 + 高折线的错挂必须最后重挂，避免被前面步骤改回开顶
run('remap-open-top-highfold.mjs')
// 结构规格（spec-*）按 structureCode + 面片签名接管粗挂条目；规格本身由 build-structure-specs.mjs 离线编译
run('apply-structure-specs.mjs')
// 手工示意挂载压过 structure-code / subclass 误伤（不覆盖已挂 spec-*）
run('apply-manual-map-overrides.mjs')
// 1 面 0 折且非圆筒 → 仅 3D 样机
run('mark-model-only.mjs')
// 定点目录：不再写出全库审计到「未映射名单」
console.warn('skip diagnose/audit dumps — shipping+mailer catalog')
run('sync-shipping-assets.mjs')
if(existsSync(mailerCsv))run('sync-mailer-assets.mjs')
