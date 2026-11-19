/**
 * Workbench catalog: API `data.workbench` preferred, static fallback,
 * plus imported folding/tray presets from catalog.
 */
import { ENGINE_VERSION, ensureTemplate } from '../../../packages/geometry-engine/index.js'
import { getMaterialProfile, listMaterialProfiles } from '../../../packages/geometry-engine/materialProfiles.js'
import { fetchProduct, type WorkbenchApiPayload } from '../../api/catalog'
import { PRESETS } from '../../catalog/index.js'
import { getTemplate, TEMPLATES } from '../../templates/index.js'

export type WorkbenchSizeMode = 'inner' | 'outer' | 'manufacturing'

/**
 * How closely an imported box matches its reference dieline at the reference size
 * (scripts/annotate-preset-fidelity.mjs). Only 'exact' and 'close' are customizable.
 */
export type WorkbenchFidelity = 'exact' | 'close' | 'none'

export type WorkbenchManifest = {
  slug: string
  templateId: string
  labelZh: string
  labelKo: string
  labelEn: string
  defaultParams: {
    lengthMm: number
    widthMm: number
    heightMm: number
    thicknessMm: number
    sizeMode: WorkbenchSizeMode
    materialId: string
    fluteDirection: 'L' | 'W'
    bleedInputMm: number
    advanced: Record<string, number>
  }
  materialIds: string[]
  tiers: Array<'vector_proof' | 'engineering'>
  family: 'corrugated' | 'board'
  engineVersion?: string
  engineMismatch?: boolean
  serverOnly?: boolean
  advancedRequiresPlan?: boolean
  /** Imported boxes only; built-in templates have none */
  fidelity?: WorkbenchFidelity
  /**
   * Fixed-spec box: no parametric template matches its structure, so the reference dieline is
   * shown as captured. Size and structure cannot be changed; no save / export.
   */
  /** templateKey: the fixed-snapshot template the server saves and exports this box under */
  locked?: { sourceNum: string; geomPublicRel: string; templateKey: string }
  /**
   * Customizable box whose folded 3D does not match the reference sample (or has no fold recipe):
   * the 3D panel shows the reference sample's own fold instead. It does not follow size changes.
   */
  fold3dReference?: { sourceNum: string; geomPublicRel: string }
  /**
   * Size-interpolated boxes: the inner-size range checked against reference dielines. Inside it the
   * dieline follows the reference samples; outside it is an approximation. Structure params are fixed.
   */
  verifiedRange?: { length: [number, number]; width: [number, number]; height: [number, number] }
  /** 'verified': every validation size inside the range matched; 'improved': one did not */
  sampledQuality?: 'verified' | 'improved'
}

const corrugatedMaterials = ['flute-e', 'flute-b', 'kraft']
const boardMaterials = ['kraft-250', 'kraft-350', 'art-250', 'art-350', 'white-board', 'kraft', 'white']

/** @type {WorkbenchManifest[]} */
export const WORKBENCH_MANIFESTS: WorkbenchManifest[] = [
  {
    slug: 'folding-tuck-demo',
    templateId: 'tuck-end-straight',
    labelZh: '折叠盒（直插舌示意）',
    labelKo: '접이식 박스(직선 삽입)',
    labelEn: 'Folding Tuck Demo',
    defaultParams: {
      lengthMm: 80,
      widthMm: 50,
      heightMm: 150,
      thicknessMm: 0.5,
      sizeMode: 'inner',
      materialId: 'kraft-250',
      fluteDirection: 'L',
      bleedInputMm: 3,
      advanced: {},
    },
    materialIds: boardMaterials,
    tiers: ['vector_proof', 'engineering'],
    family: 'board',
  },
  {
    slug: 'tray-drawer-demo',
    templateId: 'drawer-tray',
    labelZh: '托盘盒（抽屉托盘示意）',
    labelKo: '트레이 박스(서랍형)',
    labelEn: 'Tray Drawer Demo',
    defaultParams: {
      lengthMm: 200,
      widthMm: 110,
      heightMm: 50,
      thicknessMm: 0.5,
      sizeMode: 'inner',
      materialId: 'kraft-250',
      fluteDirection: 'L',
      bleedInputMm: 3,
      advanced: {},
    },
    materialIds: boardMaterials,
    tiers: ['vector_proof', 'engineering'],
    family: 'board',
  },
  {
    slug: 'mailer-parametric-demo',
    templateId: 'mailer-parametric-demo',
    labelZh: '翻盖邮寄盒',
    labelKo: '플립 메일러 박스',
    labelEn: 'Flip Mailer',
    defaultParams: {
      lengthMm: 315,
      widthMm: 202,
      heightMm: 62,
      thicknessMm: 1.5,
      sizeMode: 'manufacturing',
      materialId: 'flute-e',
      fluteDirection: 'L',
      bleedInputMm: 3,
      advanced: {},
    },
    materialIds: corrugatedMaterials,
    tiers: ['vector_proof', 'engineering'],
    family: 'corrugated',
  },
  {
    slug: 'fefco-0201',
    templateId: 'fefco-0201',
    labelZh: 'FEFCO 0201 开槽纸箱',
    labelKo: 'FEFCO 0201 골판 상자',
    labelEn: 'FEFCO 0201',
    defaultParams: {
      lengthMm: 400,
      widthMm: 300,
      heightMm: 200,
      thicknessMm: 3,
      sizeMode: 'manufacturing',
      materialId: 'flute-b',
      fluteDirection: 'L',
      bleedInputMm: 5,
      advanced: {},
    },
    materialIds: ['flute-b', 'flute-e', 'kraft'],
    tiers: ['vector_proof', 'engineering'],
    family: 'corrugated',
  },
  {
    slug: 'tuck-end-straight',
    templateId: 'tuck-end-straight',
    labelZh: '直插舌盒',
    labelKo: '직선 삽입 상자',
    labelEn: 'Straight Tuck End',
    defaultParams: {
      lengthMm: 80,
      widthMm: 50,
      heightMm: 150,
      thicknessMm: 0.5,
      sizeMode: 'inner',
      materialId: 'kraft-250',
      fluteDirection: 'L',
      bleedInputMm: 3,
      advanced: {},
    },
    materialIds: boardMaterials,
    tiers: ['vector_proof', 'engineering'],
    family: 'board',
  },
  {
    slug: 'productbox-crashlock',
    templateId: 'productbox-crashlock',
    labelZh: '自锁底盒',
    labelKo: '자동잠금 바닥 상자',
    labelEn: 'Crashlock Bottom',
    defaultParams: {
      lengthMm: 100,
      widthMm: 80,
      heightMm: 80,
      thicknessMm: 0.6,
      sizeMode: 'inner',
      materialId: 'kraft-350',
      fluteDirection: 'L',
      bleedInputMm: 3,
      advanced: {},
    },
    materialIds: boardMaterials,
    tiers: ['vector_proof', 'engineering'],
    family: 'board',
  },
  {
    slug: 'aircraft-mailer',
    templateId: 'rea-aircraft',
    labelZh: '飞机盒',
    labelKo: '비행기박스',
    labelEn: 'Aircraft Mailer',
    defaultParams: {
      lengthMm: 300,
      widthMm: 200,
      heightMm: 60,
      thicknessMm: 1.5,
      sizeMode: 'manufacturing',
      materialId: 'flute-e',
      fluteDirection: 'L',
      bleedInputMm: 3,
      advanced: {},
    },
    materialIds: corrugatedMaterials,
    tiers: ['vector_proof'],
    family: 'corrugated',
  },
]

const BY_SLUG = new Map(WORKBENCH_MANIFESTS.map((m) => [m.slug, m]))

function majorMinor(v: string): string {
  const parts = String(v || '').split('.')
  return `${parts[0] || '0'}.${parts[1] || '0'}`
}

function fromApi(slug: string, productName: string, nameKo: string, wb: WorkbenchApiPayload): WorkbenchManifest {
  const fallback = BY_SLUG.get(slug)
  const dp = wb.default_params || {}
  const engineVersion = wb.engine_version || ENGINE_VERSION
  return {
    slug,
    templateId: wb.template_key,
    labelZh: productName || fallback?.labelZh || slug,
    labelKo: nameKo || fallback?.labelKo || productName || slug,
    labelEn: fallback?.labelEn || productName || slug,
    defaultParams: {
      lengthMm: Number(dp.lengthMm ?? fallback?.defaultParams.lengthMm ?? 300),
      widthMm: Number(dp.widthMm ?? fallback?.defaultParams.widthMm ?? 200),
      heightMm: Number(dp.heightMm ?? fallback?.defaultParams.heightMm ?? 60),
      thicknessMm: Number(dp.thicknessMm ?? fallback?.defaultParams.thicknessMm ?? 1.5),
      sizeMode: (dp.sizeMode as WorkbenchSizeMode) || fallback?.defaultParams.sizeMode || 'inner',
      materialId: String(dp.materialId || fallback?.defaultParams.materialId || 'kraft'),
      fluteDirection: (dp.fluteDirection as 'L' | 'W') || 'L',
      bleedInputMm: Number(dp.bleedInputMm ?? 3),
      advanced: { ...((dp.advanced as Record<string, number>) || {}) },
    },
    materialIds: wb.material_ids?.length ? wb.material_ids : fallback?.materialIds || ['kraft'],
    tiers: (wb.tiers?.filter((x) => x === 'vector_proof' || x === 'engineering') as WorkbenchManifest['tiers']) ||
      fallback?.tiers ||
      ['vector_proof'],
    family: fallback?.family || 'corrugated',
    engineVersion,
    engineMismatch: majorMinor(engineVersion) !== majorMinor(ENGINE_VERSION),
    serverOnly: !!wb.server_only,
    advancedRequiresPlan: !!wb.advanced_requires_plan,
  }
}

export function getWorkbenchManifest(slug: string): WorkbenchManifest | null {
  const key = String(slug || '').trim()
  return BY_SLUG.get(key) || manifestFromImportPreset(key)
}

type ImportPreset = {
  id?: string
  sourceNum?: string
  label?: string
  categoryId?: string
  categoryLabel?: string
  length?: number
  width?: number
  height?: number
  thickness?: number
  materialId?: string
  templateId?: string | null
  hasGeometry?: boolean
  coverRel?: string
  geomPublicRel?: string
  geomRel?: string
  structureCode?: string
  fidelity?: WorkbenchFidelity
  /** scripts/annotate-preset-fold3d.mjs: does the template fold like the reference sample */
  fold3d?: 'ok' | 'differs' | 'none'
  /** Captured structure params kept for this template: code → [value, min, max, grade] */
  openParams?: Record<string, [number, number | null, number | null, number | null]>
}

/**
 * Captured structure params → initial advanced values, limited to codes the template
 * actually defines and clamped to the template's numeric range.
 */
function advancedFromPreset(preset: ImportPreset): Record<string, number> {
  const out: Record<string, number> = {}
  if (!preset.openParams || !preset.templateId) return out
  // Registered templates only: an unloaded spec must not borrow the default template's params
  const defs = ((TEMPLATES as Record<string, { paramDefs?: unknown[] }>)[String(preset.templateId)]?.paramDefs || []) as Array<{
    code?: string
    min?: unknown
    max?: unknown
  }>
  for (const d of defs) {
    const row = d.code ? preset.openParams[d.code] : undefined
    if (!d.code || !Array.isArray(row)) continue
    let v = Number(row[0])
    if (!Number.isFinite(v)) continue
    if (typeof d.min === 'number' && Number.isFinite(d.min)) v = Math.max(d.min, v)
    if (typeof d.max === 'number' && Number.isFinite(d.max)) v = Math.min(d.max, v)
    out[d.code] = v
  }
  return out
}

function isCustomizableFidelity(f: WorkbenchFidelity | undefined): f is 'exact' | 'close' {
  return f === 'exact' || f === 'close'
}

function lockedSource(preset: ImportPreset): { sourceNum: string; geomPublicRel: string; templateKey: string } | null {
  const rel = String(preset.geomPublicRel || preset.geomRel || '')
  if (!preset.hasGeometry || !preset.sourceNum || !rel) return null
  // Same key scheme as the catalogue seed: `fixed-<num>` for shipping, `fixed-<category>-<num>` otherwise
  const cat = String(preset.categoryId || 'shipping')
  const templateKey = cat === 'shipping' ? `fixed-${preset.sourceNum}` : `fixed-${cat}-${preset.sourceNum}`
  return { sourceNum: String(preset.sourceNum), geomPublicRel: rel, templateKey }
}

function lockedManifest(preset: ImportPreset): WorkbenchManifest | null {
  const locked = lockedSource(preset)
  if (!locked) return null
  const corrugated = preset.categoryId === 'shipping' || preset.categoryId === 'mailer'
  const label = String(preset.label || preset.sourceNum || preset.id)
  return {
    slug: String(preset.id),
    templateId: '',
    labelZh: label,
    labelKo: label,
    labelEn: label,
    defaultParams: {
      lengthMm: Number(preset.length) || 100,
      widthMm: Number(preset.width) || 80,
      heightMm: Number(preset.height) || 0,
      thicknessMm: Number(preset.thickness) || (corrugated ? 1.5 : 0.5),
      sizeMode: 'inner',
      materialId: corrugated ? 'kraft' : 'white',
      fluteDirection: 'L',
      bleedInputMm: 3,
      advanced: {},
    },
    materialIds: [corrugated ? 'kraft' : 'white'],
    tiers: ['vector_proof'],
    family: corrugated ? 'corrugated' : 'board',
    engineVersion: ENGINE_VERSION,
    fidelity: 'none',
    locked,
  }
}

function manifestFromImportPreset(slug: string): WorkbenchManifest | null {
  const preset = (PRESETS as ImportPreset[]).find((p) => p.id === slug)
  if (!preset) return null
  // Structure does not match any parametric template: show the reference dieline as a fixed spec
  if (!preset.templateId || !isCustomizableFidelity(preset.fidelity)) return lockedManifest(preset)
  const family =
    preset.categoryId === 'shipping' || preset.categoryId === 'mailer' ? 'corrugated' : 'board'
  const materialIds = family === 'corrugated' ? corrugatedMaterials : boardMaterials
  const materialId =
    preset.materialId && materialIds.includes(preset.materialId)
      ? preset.materialId
      : materialIds[0]
  return {
    slug: String(preset.id),
    templateId: String(preset.templateId),
    labelZh: String(preset.label || preset.sourceNum || slug),
    labelKo: String(preset.label || preset.sourceNum || slug),
    labelEn: String(preset.label || preset.sourceNum || slug),
    defaultParams: {
      lengthMm: Number(preset.length) || 100,
      widthMm: Number(preset.width) || 80,
      heightMm: Number(preset.height) || 50,
      thicknessMm: Number(preset.thickness) || (family === 'corrugated' ? 1.5 : 0.5),
      sizeMode: 'inner',
      materialId,
      fluteDirection: 'L',
      bleedInputMm: 3,
      advanced: advancedFromPreset(preset),
    },
    materialIds,
    tiers: ['vector_proof', 'engineering'],
    family,
    engineVersion: ENGINE_VERSION,
    fidelity: preset.fidelity,
    fold3dReference:
      preset.fold3d && preset.fold3d !== 'ok' ? lockedSource(preset) || undefined : undefined,
    verifiedRange: (TEMPLATES as Record<string, any>)[String(preset.templateId)]?.verifiedRange || undefined,
    sampledQuality: (TEMPLATES as Record<string, any>)[String(preset.templateId)]?.sampledQuality || undefined,
  }
}

export type WorkbenchCatalogItem = {
  slug: string
  label: string
  categoryId: string
  categoryLabel: string
  templateId: string | null
  customizable: boolean
  coverRel?: string
  length?: number
  width?: number
  height?: number
  source: 'builtin' | 'import'
  fidelity?: WorkbenchFidelity
  /** Fixed-spec box: can be opened to view the reference dieline, not customized */
  locked?: boolean
}

/** Built-in manifests + folding/tray imports for the 定制 hub. */
/** Imported categories offered in the workbench list */
export const WORKBENCH_IMPORT_CATEGORIES = ['folding', 'tray', 'gift', 'square'] as const
export type WorkbenchCategoryFilter = (typeof WORKBENCH_IMPORT_CATEGORIES)[number] | 'all'

export function listWorkbenchCatalog(filterCategory?: WorkbenchCategoryFilter): WorkbenchCatalogItem[] {
  const cat = filterCategory || 'all'
  const items: WorkbenchCatalogItem[] = []

  for (const m of WORKBENCH_MANIFESTS) {
    const builtinCat =
      m.slug.startsWith('folding-') || m.slug === 'tuck-end-straight' || m.slug === 'productbox-crashlock'
        ? 'folding'
        : m.slug.startsWith('tray-')
          ? 'tray'
          : 'builtin'
    if (cat !== 'all' && builtinCat !== cat) continue
    items.push({
      slug: m.slug,
      label: m.labelZh,
      categoryId: builtinCat,
      categoryLabel:
        builtinCat === 'folding' ? '折叠盒' : builtinCat === 'tray' ? '托盘盒' : '内置',
      templateId: m.templateId,
      customizable: true,
      source: 'builtin',
      length: m.defaultParams.lengthMm,
      width: m.defaultParams.widthMm,
      height: m.defaultParams.heightMm,
    })
  }

  for (const p of PRESETS as ImportPreset[]) {
    if (!(WORKBENCH_IMPORT_CATEGORIES as readonly string[]).includes(String(p.categoryId))) continue
    if (cat !== 'all' && p.categoryId !== cat) continue
    items.push({
      slug: String(p.id || ''),
      label: String(p.label || p.sourceNum || ''),
      categoryId: String(p.categoryId),
      categoryLabel: String(p.categoryLabel || p.categoryId),
      templateId: p.templateId ? String(p.templateId) : null,
      customizable: !!p.templateId && isCustomizableFidelity(p.fidelity),
      fidelity: p.fidelity || 'none',
      locked: !(p.templateId && isCustomizableFidelity(p.fidelity)) && !!lockedSource(p),
      coverRel: p.coverRel,
      length: p.length,
      width: p.width,
      height: p.height,
      source: 'import',
    })
  }

  // Built-in first, then customizable imports (exact before close), unsupported last
  const rank = (x: WorkbenchCatalogItem) =>
    x.source === 'builtin' ? 0 : x.fidelity === 'exact' ? 1 : x.fidelity === 'close' ? 2 : x.locked ? 3 : 4
  return items
    .filter((x) => x.slug)
    .map((x, i) => ({ x, i }))
    .sort((a, b) => rank(a.x) - rank(b.x) || a.i - b.i)
    .map(({ x }) => x)
}

/** API first, static + import fallback. */
export async function loadWorkbenchManifest(slug: string): Promise<WorkbenchManifest | null> {
  const key = String(slug || '').trim()
  if (!key) return null
  if (!key.startsWith('import-')) {
    try {
      const product = await fetchProduct(key)
      if (product.workbench && (product.capabilities?.workbench === true || product.workbench)) {
        await ensureTemplate(product.workbench.template_key)
        return fromApi(key, product.name, product.name_ko || '', product.workbench)
      }
    } catch {
      /* fall through */
    }
  }
  // Imported boxes use per-box spec templates: load it before building the manifest (paramDefs, limits)
  const preset = (PRESETS as ImportPreset[]).find((p) => p.id === key)
  if (preset?.templateId && isCustomizableFidelity(preset.fidelity)) await ensureTemplate(String(preset.templateId))
  return getWorkbenchManifest(key)
}

export function isWorkbenchEnabled(): boolean {
  return String(import.meta.env.VITE_WORKBENCH || '') === '1'
}

export function workbenchMaterialOptions(manifest: WorkbenchManifest) {
  const ids = manifest.materialIds.length
    ? manifest.materialIds
    : listMaterialProfiles().map((p: { id: string }) => p.id)
  return ids
    .map((id: string) => getMaterialProfile(id))
    .filter(Boolean)
}

export function templateForManifest(manifest: WorkbenchManifest) {
  // Fixed-spec boxes have no parametric template (getTemplate would fall back to the default one)
  if (manifest.locked) return null
  return getTemplate(manifest.templateId)
}
