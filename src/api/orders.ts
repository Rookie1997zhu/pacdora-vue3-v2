import { apiRequest } from './client'

export type OrderStatus = 'pending_manual' | 'quoted' | 'confirmed' | 'cancelled'
export type OrderLineStatus = 'priced' | 'pending_manual'

export type OrderItem = {
  id: string
  design_id: string
  design_revision_id: string
  quote_id: string | null
  quantity: number
  unit_amount: string | null
  line_amount: string | null
  line_status: OrderLineStatus
}

export type Order = {
  id: string
  organization_id: string
  order_no: string
  status: OrderStatus
  currency: string
  total_amount: string | null
  payment_mode: string
  items_snapshot: Array<Record<string, unknown>>
  items: OrderItem[]
  row_version: number
  idempotency_key: string
  created_at: string | null
  updated_at: string | null
}

export async function fetchOrders() {
  const res = await apiRequest<{ items: Order[] }>('/orders/')
  return res.data.items
}

export async function fetchOrder(id: string) {
  const res = await apiRequest<Order>(`/orders/${id}/`)
  return res.data
}

export async function checkoutOrder(idempotencyKey: string) {
  const res = await apiRequest<Order>('/orders/', {
    method: 'POST',
    json: {},
    idempotencyKey,
  })
  return res.data
}

export async function manualQuoteOrder(
  id: string,
  payload: { expected_row_version: number; lines: Array<{ id: string; line_amount: string }> },
) {
  const res = await apiRequest<Order>(`/orders/${id}/manual-quote/`, {
    method: 'POST',
    json: payload,
  })
  return res.data
}

export async function confirmOrder(id: string, expected_row_version: number) {
  const res = await apiRequest<Order>(`/orders/${id}/confirm/`, {
    method: 'POST',
    json: { expected_row_version },
  })
  return res.data
}

export async function cancelOrder(id: string, expected_row_version: number) {
  const res = await apiRequest<Order>(`/orders/${id}/cancel/`, {
    method: 'POST',
    json: { expected_row_version },
  })
  return res.data
}
