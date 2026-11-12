/**
 * Packative 官方 SVG → Lab 2D 一致性校验（失败非零退出）。
 *
 * - validated|holdout：必须有 geom_rel 且 public 文件存在
 * - unvalidated：不得有 geom_rel
 * - public/packative-geom 无孤儿文件
 * - 每份 SVG 可解析；faces=[]；manufacturingReady=false
 * - crashlock 试点 100×80×80：Cutting/Creasing 计数与官方报告一致
 * - 其它盒型（如 mailerbox）：只记 cut/crease 计数，不套用 crashlock 数字
 *
 * Usage: node scripts/verify-packative-geom.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const CATALOG_JSON = path.join(ROOT, 'docs/packative_lab_catalog/packative_catalog.json')
const PUBLIC_DIR = path.join(ROOT, 'public/packative-geom')
const CRASHLOCK_PILOT = {
  template_id: 'productbox-crashlock',
  L: 100,
  W: 80,
  H: 80,
  cuts: 133,
  creases: 14,
}

const errors = []
const warnings = []
const parseRows = []

function fail(msg) {
  errors.push(msg)
}

function stripBom(text) {
  return String(text || '').replace(/^\uFEFF/, '')
}

function sizeKey(row) {
  return `${row.template_id}-${row.L_mm}_${row.W_mm}_${row.H_mm}`
}

const catalog = JSON.parse(stripBom(fs.readFileSync(CATALOG_JSON, 'utf8')))
const assets = Array.isArray(catalog.assets) ? catalog.assets : []
if (!assets.length) fail('catalog.assets empty')

const referenced = new Set()
for (const row of assets) {
  const status = String(row.validation_status || '')
  const key = sizeKey(row)
  const geomRel = row.geom_rel ? String(row.geom_rel).replace(/^\//, '') : ''

  if (status === 'validated' || status === 'holdout') {
    if (!geomRel) {
      fail(`${key}: ${status} missing geom_rel`)
      continue
    }
    referenced.add(path.basename(geomRel))
    const abs = path.join(ROOT, 'public', geomRel)
    if (!fs.existsSync(abs)) {
      fail(`${key}: missing file public/${geomRel}`)
      continue
    }
  } else if (status === 'unvalidated') {
    if (geomRel) fail(`${key}: unvalidated must not have geom_rel (got ${geomRel})`)
  } else {
    warnings.push(`${key}: unknown validation_status=${status}`)
  }
}

if (!fs.existsSync(PUBLIC_DIR)) {
  fail(`missing directory ${PUBLIC_DIR}`)
} else {
  const onDisk = fs.readdirSync(PUBLIC_DIR).filter((n) => n.endsWith('.svg'))
  for (const name of onDisk) {
    if (!referenced.has(name)) fail(`orphan public/packative-geom/${name} (not in catalog geom_rel)`)
  }
  for (const name of referenced) {
    if (!onDisk.includes(name)) fail(`catalog references ${name} but file missing in public/packative-geom`)
  }
}

function canEnterPackativeRow(row) {
  if (!row) return false
  return row.validation_status === 'validated' || row.validation_status === 'holdout'
}

for (const row of assets) {
  const enter = canEnterPackativeRow(row)
  const status = row.validation_status
  if ((status === 'validated' || status === 'holdout') && !enter) {
    fail(`${sizeKey(row)}: canEnterPackativeRow should be true`)
  }
  if (status === 'unvalidated' && enter) {
    fail(`${sizeKey(row)}: canEnterPackativeRow should be false`)
  }
}

const knifeMod = await import(pathToFileURL(path.join(ROOT, 'src/packative/packativeGeomKnife.js')).href)
const { knifeFromPackativeSvgText } = knifeMod

for (const row of assets) {
  if (row.validation_status !== 'validated' && row.validation_status !== 'holdout') continue
  const geomRel = String(row.geom_rel || '').replace(/^\//, '')
  const abs = path.join(ROOT, 'public', geomRel)
  if (!fs.existsSync(abs)) continue
  const svgText = fs.readFileSync(abs, 'utf8')
  let knife
  try {
    knife = knifeFromPackativeSvgText(svgText, {
      L: Number(row.L_mm),
      W: Number(row.W_mm),
      H: Number(row.H_mm),
      templateId: row.template_id,
      geomRel,
      label: row.title_zh,
    })
  } catch (e) {
    fail(`${sizeKey(row)}: parse/knife failed: ${e?.message || e}`)
    continue
  }

  const cutCount = knife?.meta?.cutCount ?? knife?.cuts?.length ?? 0
  const creaseCount = knife?.meta?.creaseCount ?? knife?.folds?.length ?? 0
  parseRows.push({
    key: sizeKey(row),
    status: row.validation_status,
    geomRel,
    cutCount,
    creaseCount,
    faces: Array.isArray(knife.faces) ? knife.faces.length : -1,
    hinges: Array.isArray(knife.hinges) ? knife.hinges.length : -1,
    foldStages: Array.isArray(knife.foldStages) ? knife.foldStages.length : -1,
    manufacturingReady: knife.manufacturingReady,
    productionReady: knife.productionReady,
    fromPackativeGeom: !!knife.fromPackativeGeom,
  })

  if (!Array.isArray(knife.faces) || knife.faces.length !== 0) {
    fail(`${sizeKey(row)}: faces must be []`)
  }
  if (!Array.isArray(knife.hinges) || knife.hinges.length !== 0) {
    fail(`${sizeKey(row)}: hinges must be []`)
  }
  if (!Array.isArray(knife.foldStages) || knife.foldStages.length !== 0) {
    fail(`${sizeKey(row)}: foldStages must be []`)
  }
  if (knife.manufacturingReady !== false || knife.productionReady !== false) {
    fail(`${sizeKey(row)}: manufacturingReady/productionReady must be false`)
  }
  if (!cutCount || !creaseCount) {
    fail(`${sizeKey(row)}: expected Cutting and Creasing segments (cuts=${cutCount}, creases=${creaseCount})`)
  }

  if (
    String(row.template_id) === CRASHLOCK_PILOT.template_id &&
    Number(row.L_mm) === CRASHLOCK_PILOT.L &&
    Number(row.W_mm) === CRASHLOCK_PILOT.W &&
    Number(row.H_mm) === CRASHLOCK_PILOT.H
  ) {
    if (cutCount !== CRASHLOCK_PILOT.cuts || creaseCount !== CRASHLOCK_PILOT.creases) {
      fail(
        `crashlock pilot ${CRASHLOCK_PILOT.L}x${CRASHLOCK_PILOT.W}x${CRASHLOCK_PILOT.H}: expected Cutting=${CRASHLOCK_PILOT.cuts} Creasing=${CRASHLOCK_PILOT.creases}, got ${cutCount}/${creaseCount}`,
      )
    }
  }
}

const summary = {
  ok: errors.length === 0,
  catalogAssets: assets.length,
  publishableParsed: parseRows.length,
  referencedGeom: referenced.size,
  warnings,
  errors,
  parseRows,
}

console.log(JSON.stringify(summary, null, 2))
if (errors.length) {
  console.error(`\nverify-packative-geom FAILED (${errors.length} error(s))`)
  process.exit(1)
}
console.error(`\nverify-packative-geom OK (${parseRows.length} SVG parsed)`)
