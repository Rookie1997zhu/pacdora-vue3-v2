import { apiRequest } from './client'

export type ProductSummary = {
  id: string
  slug: string
  name: string
  name_ko?: string
  category: string
  status?: string
  description?: string
  template_key: string
  geometry_mode: 'parametric' | 'fixed_snapshot' | 'model_only'
  capabilities?: Record<string, unknown>
  cover_rel?: string
  sort_order?: number
}

export type ParamLimits = {
  length?: [number, number]
  width?: [number, number]
  height?: [number, number]
}

export type WorkbenchApiPayload = {
  template_key: string
  template_version: string
  engine_version: string
  default_params: Record<string, unknown>
  limits: Record<string, unknown>
  material_ids: string[]
  engineering_domain: Record<string, unknown> | null
  tiers: string[]
  advanced_requires_plan?: boolean
  server_only?: boolean
}

export type ProductDetail = ProductSummary & {
  description?: string
  capabilities?: Record<string, unknown>
  variants: Array<{ id: string; code: string; material_id: string; min_quantity: number }>
  template_version?: {
    version: string
    engine_version: string
    capabilities: Record<string, unknown>
    limits?: ParamLimits
  }
  workbench?: WorkbenchApiPayload | null
}

export type ProductListParams = {
  page?: number
  page_size?: number
  category?: string
  q?: string
}

export type ProductListPage = {
  items: ProductSummary[]
  page: number
  page_size: number
  total: number
  has_next: boolean
  categories?: string[]
}

/** Badge kind shared with LAB / --bc-badge-* tokens */
export type BadgeKind = 'telescoping' | 'openTop' | 'flat' | 'lidded' | 'special'

export function geometryBadgeKind(mode: ProductSummary['geometry_mode']): BadgeKind {
  if (mode === 'fixed_snapshot') return 'flat'
  if (mode === 'model_only') return 'special'
  return 'telescoping'
}

export function categoryBadgeKind(category: string): BadgeKind {
  const key = String(category || '').toLowerCase()
  if (key === 'shipping') return 'telescoping'
  if (key === 'mailer') return 'openTop'
  if (key === 'carton') return 'lidded'
  if (key === 'tuck' || key === 'crashlock') return 'special'
  return 'flat'
}

function qs(params: Record<string, string | number | undefined | null> = {}) {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return
    sp.set(k, String(v))
  })
  const s = sp.toString()
  return s ? `?${s}` : ''
}

export async function fetchProducts(params?: ProductListParams): Promise<ProductListPage> {
  const res = await apiRequest<ProductListPage>(`/products/${qs(params || {})}`)
  return res.data
}

export async function fetchProduct(slug: string) {
  const res = await apiRequest<ProductDetail>(`/products/${encodeURIComponent(slug)}/`)
  return res.data
}
