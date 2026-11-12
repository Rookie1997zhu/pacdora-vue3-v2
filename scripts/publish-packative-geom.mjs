/**
 * REA → Lab 官方 SVG 发布 + 旁路 manifest 生成（可重复、幂等）。
 *
 * - 仅 validated|holdout；缺 evidence 或 unvalidated 带 geom 企图 → 失败退出
 * - evidence → public/packative-geom/productbox-crashlock-{L}_{W}_{H}.svg
 * - 回写 packative_catalog.json / .csv 的 geom_rel
 * - 写出 docs/dieline-library/fixtures/packative-crashlock-geom-manifest.json
 *
 * Usage: node scripts/publish-packative-geom.mjs [--dry-run] [--skip-manifest]
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const ALLOWED = new Set(['validated', 'holdout'])
const CATALOG_JSON = path.join(ROOT, 'docs/packative_lab_catalog/packative_catalog.json')
const CATALOG_CSV = path.join(ROOT, 'docs/packative_lab_catalog/packative_catalog.csv')
const EVIDENCE_DIR = path.join(ROOT, 'docs/packative-research/evidence')
const PUBLIC_DIR = path.join(ROOT, 'public/packative-geom')
const MANIFEST_OUT = path.join(ROOT, 'docs/dieline-library/fixtures/packative-crashlock-geom-manifest.json')

const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run')
const skipManifest = args.has('--skip-manifest')

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
}

function evidenceName(row) {
  return `studio-dieline-${row.template_id}-${row.L_mm}_${row.W_mm}_${row.H_mm}.svg`
}

function publicName(row) {
  return `${row.template_id}-${row.L_mm}_${row.W_mm}_${row.H_mm}.svg`
}

function geomRel(row) {
  return `packative-geom/${publicName(row)}`
}

function writeCsv(assets) {
  const cols = [
    'template_id',
    'title_zh',
    'title_ko',
    'L_mm',
    'W_mm',
    'H_mm',
    'dimension_basis',
    'validation_status',
    'rule_or_geom_version',
    'evidence_ref',
    'default_flag',
    'sample_group',
    'product_page',
    'cdn_template',
    'geom_rel',
  ]
  const esc = (v) => {
    const s = v == null ? '' : String(v)
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const lines = [cols.join(',')]
  for (const a of assets) {
    lines.push(
      cols
        .map((c) => {
          if (c === 'default_flag') return esc(a.default_flag ? 'True' : 'False')
          if (c === 'geom_rel') return esc(a.geom_rel || '')
          return esc(a[c])
        })
        .join(','),
    )
  }
  return `${lines.join('\n')}\n`
}

function buildManifest(publishable) {
  return {
    schema_version: '1.0',
    is_example: false,
    provider: 'local_manifest',
    source: {
      source_id: 'packative_official_geom',
      source_type: 'local_evidence',
      notes: 'Validated/holdout Packative crashlock official SVG from research evidence; reference_only.',
    },
    assets: publishable.map((row) => ({
      is_example: false,
      title: { zh: row.title_zh || row.template_id, ko: row.title_ko || null },
      family_name: row.title_zh || 'Packative Crashlock',
      category: 'folding',
      source_template_id: row.template_id,
      template_revision: String(row.rule_or_geom_version || 'geom-1'),
      dimensions: {
        length_mm: Number(row.L_mm),
        width_mm: Number(row.W_mm),
        height_mm: Number(row.H_mm),
        basis: row.dimension_basis || 'inner',
      },
      material: { name: null, thickness_mm: null },
      files: [{ path: geomRel(row), mime: 'image/svg+xml' }],
      meta: {
        validation_status: row.validation_status,
        sample_group: row.sample_group || null,
        evidence_ref: row.evidence_ref || null,
        product_page: row.product_page || null,
      },
      rights: {
        grant_status: 'granted',
        permissions: {
          can_store: true,
          can_transform: false,
          can_use_internally: true,
          can_use_commercially: false,
          can_show_public_preview: true,
          can_redistribute_files: false,
        },
      },
      quality: {
        publication_status: 'published',
        manufacturing_status: 'reference_only',
      },
    })),
  }
}

function main() {
  if (!fs.existsSync(CATALOG_JSON)) {
    console.error(`missing catalog: ${CATALOG_JSON}`)
    process.exit(1)
  }
  const catalogRaw = fs.readFileSync(CATALOG_JSON, 'utf8').replace(/^\uFEFF/, '')
  const catalog = JSON.parse(catalogRaw)
  const assets = Array.isArray(catalog.assets) ? catalog.assets : []
  if (!assets.length) {
    console.error('catalog.assets empty')
    process.exit(1)
  }

  const publishable = []
  const skippedUnvalidated = []
  const errors = []

  for (const row of assets) {
    const status = String(row.validation_status || '')
    if (!ALLOWED.has(status)) {
      if (row.geom_rel) {
        errors.push(`unvalidated row must not carry geom_rel: ${row.L_mm}x${row.W_mm}x${row.H_mm} → ${row.geom_rel}`)
      }
      skippedUnvalidated.push(`${row.L_mm}x${row.W_mm}x${row.H_mm}`)
      // clear any accidental geom_rel on unvalidated when writing back
      row.geom_rel = undefined
      delete row.geom_rel
      continue
    }
    const src = path.join(EVIDENCE_DIR, evidenceName(row))
    if (!fs.existsSync(src)) {
      errors.push(`missing evidence SVG: ${evidenceName(row)}`)
      continue
    }
    publishable.push(row)
  }

  if (errors.length) {
    console.error('publish gates failed:')
    for (const e of errors) console.error(`  - ${e}`)
    process.exit(1)
  }
  if (!publishable.length) {
    console.error('no validated/holdout rows to publish')
    process.exit(1)
  }

  if (!dryRun) fs.mkdirSync(PUBLIC_DIR, { recursive: true })

  const copies = []
  for (const row of publishable) {
    const src = path.join(EVIDENCE_DIR, evidenceName(row))
    const destName = publicName(row)
    const dest = path.join(PUBLIC_DIR, destName)
    const rel = geomRel(row)
    const srcSha = sha256File(src)
    let action = 'write'
    if (fs.existsSync(dest)) {
      const destSha = sha256File(dest)
      action = destSha === srcSha ? 'unchanged' : 'overwrite'
    }
    if (!dryRun && action !== 'unchanged') {
      fs.copyFileSync(src, dest)
    }
    row.geom_rel = rel
    copies.push({
      size: `${row.L_mm}x${row.W_mm}x${row.H_mm}`,
      status: row.validation_status,
      action,
      geom_rel: rel,
      sha256: srcSha.slice(0, 12),
    })
  }

  const catalogOut = {
    ...catalog,
    assets,
    notes: Array.isArray(catalog.notes)
      ? catalog.notes.includes('geom_rel via scripts/publish-packative-geom.mjs')
        ? catalog.notes
        : [...catalog.notes, 'geom_rel via scripts/publish-packative-geom.mjs']
      : catalog.notes,
  }

  const manifest = buildManifest(publishable)

  if (!dryRun) {
    fs.writeFileSync(CATALOG_JSON, `${JSON.stringify(catalogOut, null, 2)}\n`, 'utf8')
    fs.writeFileSync(CATALOG_CSV, writeCsv(assets), 'utf8')
    if (!skipManifest) {
      fs.mkdirSync(path.dirname(MANIFEST_OUT), { recursive: true })
      fs.writeFileSync(MANIFEST_OUT, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    }
  }

  const report = {
    dry_run: dryRun,
    published: copies.length,
    skipped_unvalidated: skippedUnvalidated,
    copies,
    manifest: skipManifest ? null : MANIFEST_OUT.replace(/\\/g, '/'),
    catalog_json: CATALOG_JSON.replace(/\\/g, '/'),
  }
  console.log(JSON.stringify(report, null, 2))
  console.error(
    dryRun
      ? `[dry-run] would publish ${copies.length} geom SVG(s); skip unvalidated=${skippedUnvalidated.length}`
      : `published ${copies.length} geom SVG(s); skip unvalidated=${skippedUnvalidated.length}`,
  )
}

main()
