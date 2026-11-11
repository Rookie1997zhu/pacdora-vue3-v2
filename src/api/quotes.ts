import { apiRequest } from './client'

export type QuoteStatus = 'pending_manual' | 'valid' | 'expired' | 'superseded'

export type Quote = {
  id: string
  organization_id: string
  design_id: string
  design_revision_id: string
  product_id: string | null
  quantity: number
  status: QuoteStatus
  rule_version_id: string | null
  currency: string
  total_amount: string | null
  breakdown: Record<string, unknown>
  input_snapshot: Record<string, unknown>
  input_hash: string
  valid_until: string | null
  created_at: string | null
  payment_mode: string
}

export async function createQuote(payload: { design_revision_id: string; quantity: number }) {
  const res = await apiRequest<Quote>('/quotes/', {
    method: 'POST',
    json: payload,
  })
  return res.data
}

export async function fetchQuote(id: string) {
  const res = await apiRequest<Quote>(`/quotes/${id}/`)
  return res.data
}
