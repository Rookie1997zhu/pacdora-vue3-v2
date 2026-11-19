/**
 * Export Pacdora box-mockups four categories from local presets.js → backend seed JSON.
 * Categories: square / gift / mailer / shipping (local docs + public/*-covers already present).
 *
 * Usage:
 *   node scripts/export-box-mockups-catalog-seed.mjs
 *   then: python manage.py seed_catalog
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import presetsData from '../src/catalog/presets.js'
import { CATALOG_KO } from '../src/i18n/catalogKo.js'
import { isExcludedPreset } from '../src/catalog/excludedPresets.js'

const CATEGORIES = ['square', 'gift', 'mailer', 'shipping']

const CATEGORY_META = {
  square: { labelZh: '方形盒', labelKoFallback: '사각 상자' },
  gift: { labelZh: '礼盒', labelKoFallback: '선물 상자' },
  mailer: { labelZh: '邮寄盒', labelKoFallback: '우편 상자' },
  shipping: { labelZh: '运输箱', labelKoFallback: '운송 상자' },
}

const COVER_PREFIX = {
  square: 'square-covers',
  gift: 'gift-covers',
  mailer: 'mailer-covers',
  shipping: 'shipping-covers',
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'backend', 'apps', 'catalog', 'data')
const outFile = join(outDir, 'box_mockups_presets.json')
const shippingCompatFile = join(outDir, 'shipping_presets.json')

function matchCategory(preset, categoryId) {
  // Pacdora box-mockups sidebar is primary category only — do not pull via subclassIds
  // (that double-counts the same preset into multiple product categories).
  return !!preset && preset.categoryId === categoryId && !isExcludedPreset(preset.id)
}

function toItem(p, categoryId) {
  const meta = CATEGORY_META[categoryId]
  const sourceNum = String(p.sourceNum || '')
  const nameKo =
    (sourceNum && CATALOG_KO.presets[sourceNum]) ||
    (p.id && CATALOG_KO.presets[p.id]) ||
    (sourceNum ? `${meta.labelKoFallback} · ${sourceNum}` : '')
  const coverFallback = sourceNum ? `${COVER_PREFIX[categoryId]}/${sourceNum}.png` : ''
  return {
    category: categoryId,
    preset_id: String(p.id),
    source_num: sourceNum,
    label: String(p.label || `${meta.labelZh} ${sourceNum}`),
    name_ko: nameKo,
    length: Number(p.length),
    width: Number(p.width),
    height: Number(p.height),
    thickness: Number(p.thickness ?? 1.5),
    material_id: ['kraft', 'white', 'blue'].includes(p.materialId) ? p.materialId : 'white',
    cover_rel: String(p.coverRel || coverFallback),
    template_id: p.templateId || null,
  }
}

const byCategory = {}
const items = []
for (const categoryId of CATEGORIES) {
  const presets = (presetsData.presets || []).filter((p) => matchCategory(p, categoryId))
  const mapped = presets.map((p) => toItem(p, categoryId))
  byCategory[categoryId] = mapped.length
  items.push(...mapped)
}

mkdirSync(outDir, { recursive: true })
const payload = {
  schema: 'boxcraft.box_mockups_seed.v1',
  generatedFrom: 'src/catalog/presets.js',
  sourceNote: 'Local Pacdora box-mockups four categories; no live scrape required',
  categories: CATEGORIES,
  byCategory,
  count: items.length,
  items,
}
writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

// Keep shipping_presets.json for older seed paths / docs.
const shippingItems = items.filter((i) => i.category === 'shipping')
writeFileSync(
  shippingCompatFile,
  `${JSON.stringify(
    {
      schema: 'boxcraft.shipping_seed.v1',
      generatedFrom: 'src/catalog/presets.js',
      count: shippingItems.length,
      items: shippingItems,
    },
    null,
    2,
  )}\n`,
  'utf8',
)

console.log(`wrote ${items.length} box-mockups presets → ${outFile}`)
console.log(JSON.stringify(byCategory))
console.log(`compat shipping=${shippingItems.length} → ${shippingCompatFile}`)
