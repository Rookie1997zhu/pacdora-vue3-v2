import { apiRequest } from './client'

export type PageMeta = {
  page: number
  page_size: number
  total: number
  has_next: boolean
}

export type ListResult<T> = { items: T[]; page: PageMeta }

function qs(params: Record<string, string | number | undefined | null> = {}) {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return
    sp.set(k, String(v))
  })
  const s = sp.toString()
  return s ? `?${s}` : ''
}

async function getList<T>(path: string, params?: Record<string, string | number | undefined | null>) {
  const res = await apiRequest<ListResult<T>>(`${path}${qs(params || {})}`)
  return res.data
}

export const consoleApi = {
  overview: () => apiRequest('/console/overview/').then((r) => r.data),
  users: (p?: Record<string, string | number | undefined>) => getList('/console/users/', p),
  patchUser: (id: string, body: Record<string, unknown>) =>
    apiRequest(`/console/users/${id}/`, { method: 'PATCH', json: body }).then((r) => r.data),
  orgs: (p?: Record<string, string | number | undefined>) => getList('/console/orgs/', p),
  orgMembers: (orgId: string, p?: Record<string, string | number | undefined>) =>
    apiRequest(`/console/orgs/${orgId}/members/${qs(p || {})}`).then((r) => r.data),
  patchOrgMember: (orgId: string, body: Record<string, unknown>) =>
    apiRequest(`/console/orgs/${orgId}/members/`, { method: 'PATCH', json: body }).then((r) => r.data),
  products: (p?: Record<string, string | number | undefined>) => getList('/console/catalog/products/', p),
  patchProduct: (id: string, body: Record<string, unknown>) =>
    apiRequest(`/console/catalog/products/${id}/`, { method: 'PATCH', json: body }).then((r) => r.data),
  approvals: (p?: Record<string, string | number | undefined>) => getList('/console/catalog/approvals/', p),
  patchApproval: (id: string, body: Record<string, unknown>) =>
    apiRequest(`/console/catalog/approvals/${id}/`, { method: 'PATCH', json: body }).then((r) => r.data),
  designs: (p?: Record<string, string | number | undefined>) => getList('/console/designs/', p),
  exports: (p?: Record<string, string | number | undefined>) => getList('/console/exports/', p),
  retryExport: (id: string) =>
    apiRequest(`/console/exports/${id}/retry/`, { method: 'POST', json: {} }).then((r) => r.data),
  cancelExport: (id: string) =>
    apiRequest(`/console/exports/${id}/cancel/`, { method: 'POST', json: {} }).then((r) => r.data),
  orders: (p?: Record<string, string | number | undefined>) => getList('/console/orders/', p),
  orderManualQuote: (id: string, body: Record<string, unknown>) =>
    apiRequest(`/console/orders/${id}/manual-quote/`, { method: 'POST', json: body }).then((r) => r.data),
  orderConfirm: (id: string, body: Record<string, unknown>) =>
    apiRequest(`/console/orders/${id}/confirm/`, { method: 'POST', json: body }).then((r) => r.data),
  orderCancel: (id: string, body: Record<string, unknown>) =>
    apiRequest(`/console/orders/${id}/cancel/`, { method: 'POST', json: body }).then((r) => r.data),
  quotes: (p?: Record<string, string | number | undefined>) => getList('/console/quotes/', p),
  dielineVariants: (p?: Record<string, string | number | undefined>) =>
    getList('/console/dielines/variants/', p),
  dielineRevisions: (p?: Record<string, string | number | undefined>) =>
    getList('/console/dielines/revisions/', p),
  publishRevision: (id: string, action: string) =>
    apiRequest(`/console/dielines/revisions/${id}/publish/`, {
      method: 'POST',
      json: { action },
    }).then((r) => r.data),
  grantRevision: (id: string, body: Record<string, unknown>) =>
    apiRequest(`/console/dielines/revisions/${id}/grant/`, { method: 'POST', json: body }).then((r) => r.data),
  acquisitionJobs: (p?: Record<string, string | number | undefined>) =>
    getList('/console/dielines/acquisition-jobs/', p),
  retryAcquisition: (id: string) =>
    apiRequest(`/console/dielines/acquisition-jobs/${id}/retry/`, { method: 'POST', json: {} }).then(
      (r) => r.data,
    ),
  assets: (p?: Record<string, string | number | undefined>) => getList('/console/assets/', p),
  regenThumb: (id: string) =>
    apiRequest(`/console/assets/${id}/regenerate-thumbnail/`, { method: 'POST', json: {} }).then((r) => r.data),
  aiJobs: (p?: Record<string, string | number | undefined>) => getList('/console/ai/jobs/', p),
  aiUsage: (p?: Record<string, string | number | undefined>) => getList('/console/ai/usage/', p),
  aiConfig: () => apiRequest('/console/ai/config/').then((r) => r.data),
  saveAiConfig: (body: Record<string, unknown>) =>
    apiRequest('/console/ai/config/', { method: 'PUT', json: body }).then((r) => r.data),
  testAiConfig: () => apiRequest('/console/ai/config/test/', { method: 'POST', json: {} }).then((r) => r.data),
  audit: (p?: Record<string, string | number | undefined>) => getList('/console/audit/', p),
}
