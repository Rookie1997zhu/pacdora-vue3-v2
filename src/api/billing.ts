import { apiRequest } from './client'

export type Entitlement = {
  organization_id: string
  plan: 'free' | 'annual' | string
  annual_active: boolean
  annual_expires_at: string | null
  free_export_limit: number
  exports_used: number
  remaining: number | null
  unlimited: boolean
}

export type ExportGrantResult = {
  grant_id: string
  remaining: number | null
  plan: string
  unlimited: boolean
  entitlement: Entitlement
}

export type UpgradeIntentResult = {
  id: string
  plan: string
  status: string
  note: string
  contact: string
  created_at: string
}

export function fetchEntitlement() {
  return apiRequest<Entitlement>('/billing/entitlement/').then((r) => r.data)
}

export function requestExportGrant(format?: string) {
  return apiRequest<ExportGrantResult>('/billing/export-grants/', {
    method: 'POST',
    json: { format: format || '' },
  }).then((r) => r.data)
}

export function submitUpgradeIntent(body: { plan: string; note?: string; contact?: string }) {
  return apiRequest<UpgradeIntentResult>('/billing/upgrade-intents/', {
    method: 'POST',
    json: body,
  }).then((r) => r.data)
}
