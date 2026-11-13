import { apiRequest } from './client'

export type ProductSummary = {
  id: string
  slug: string
  name: string
  name_ko?: string
  category: string
  description: string
  template_key: string
  geometry_mode: 'parametric' | 'fixed_snapshot' | 'model_only'
  capabilities: Record<string, unknown>
  cover_rel?: string
  sort_order?: number
}

export type ParamLimits = {
  length?: [number, number]
  width?: [number, number]
  height?: [number, number]
}

export type ProductDetail = ProductSummary & {
  variants: Array<{ id: string; code: string; material_id: string; min_quantity: number }>
  template_version?: {
    version: string
    engine_version: string
    capabilities: Record<string, unknown>
    limits?: ParamLimits
  }
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

export async function fetchProducts() {
  const res = await apiRequest<{ items: ProductSummary[] }>('/products/')
  return res.data.items
}

export async function fetchProduct(slug: string) {
  const res = await apiRequest<ProductDetail>(`/products/${encodeURIComponent(slug)}/`)
  return res.data
}
