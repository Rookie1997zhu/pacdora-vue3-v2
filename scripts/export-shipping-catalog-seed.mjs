/**
 * Export LAB shipping presets → backend seed JSON.
 * Re-run after presets.js / catalogKo.js changes, then: manage.py seed_catalog
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import presetsData from '../src/catalog/presets.js'
import { CATALOG_KO } from '../src/i18n/catalogKo.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'backend', 'apps', 'catalog', 'data')
const outFile = join(outDir, 'shipping_presets.json')

const presets = (presetsData.presets || []).filter(
  (p) => p && (p.categoryId === 'shipping' || (p.subclassIds || []).includes('shipping')),
)

const items = presets.map((p) => {
  const sourceNum = String(p.sourceNum || '')
  const nameKo =
    (sourceNum && CATALOG_KO.presets[sourceNum]) ||
    (p.id && CATALOG_KO.presets[p.id]) ||
    (sourceNum ? `운송 상자 · ${sourceNum}` : '')
  return {
    preset_id: String(p.id),
    source_num: sourceNum,
    label: String(p.label || `运输箱 ${sourceNum}`),
    name_ko: nameKo,
    length: Number(p.length),
    width: Number(p.width),
    height: Number(p.height),
    thickness: Number(p.thickness ?? 1.5),
    material_id: ['kraft', 'white', 'blue'].includes(p.materialId) ? p.materialId : 'white',
    cover_rel: String(p.coverRel || (sourceNum ? `shipping-covers/${sourceNum}.png` : '')),
    template_id: p.templateId || null,
  }
})

mkdirSync(outDir, { recursive: true })
const payload = {
  schema: 'boxcraft.shipping_seed.v1',
  generatedFrom: 'src/catalog/presets.js',
  count: items.length,
  items,
}
writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
console.log(`wrote ${items.length} shipping presets → ${outFile}`)
