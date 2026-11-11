import { apiRequest } from './client'
import type { Quote } from './quotes'

export type CartItem = {
  id: string
  design_id: string
  design_revision_id: string
  quote_id: string | null
  quote: Quote | null
  quantity: number
  preview_asset_id?: string | null
  thumbnail_ready?: boolean
  created_at: string | null
  updated_at: string | null
}

export type Cart = {
  id: string
  organization_id: string
  status: 'active' | 'checked_out'
  items: CartItem[]
  updated_at: string | null
  created_at: string | null
  payment_mode: string
}

export async function fetchCart() {
  const res = await apiRequest<Cart>('/cart/')
  return res.data
}

export async function addCartItem(payload: {
  design_revision_id: string
  quantity: number
  quote_id?: string
}) {
  const res = await apiRequest<{ item: CartItem; cart: Cart }>('/cart/items/', {
    method: 'POST',
    json: payload,
  })
  return res.data
}

export async function updateCartItem(itemId: string, quantity: number) {
  const res = await apiRequest<{ item: CartItem; cart: Cart }>(`/cart/items/${itemId}/`, {
    method: 'PATCH',
    json: { quantity },
  })
  return res.data
}

export async function removeCartItem(itemId: string) {
  const res = await apiRequest<Cart>(`/cart/items/${itemId}/`, { method: 'DELETE' })
  return res.data
}
