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

export async function fetchProducts() {
  const res = await apiRequest<{ items: ProductSummary[] }>('/products/')
  return res.data.items
}

export async function fetchProduct(slug: string) {
  const res = await apiRequest<ProductDetail>(`/products/${encodeURIComponent(slug)}/`)
  return res.data
}
