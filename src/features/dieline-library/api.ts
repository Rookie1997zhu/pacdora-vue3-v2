import { API_BASE, apiRequest } from '../../api/client'

export type UsageGrant = {
  can_store: boolean
  can_transform: boolean
  can_use_internally: boolean
  can_use_commercially: boolean
  can_show_public_preview: boolean
  can_redistribute_files: boolean
  valid_until: string | null
  attribution: string
}

export type RevisionSummary = {
  id: string
  revision_no: number
  format: string
  sha256: string
  original_filename: string
  captured_at: string | null
  acquisition_status: string
  rights_status: string
  manufacturing_status: string
  publication_status: string
  asset_id: string
  preview_asset_id: string | null
  has_preview: boolean
  usage_grant?: UsageGrant | null
}

export type VariantSummary = {
  id: string
  title_zh: string
  title_ko: string
  family_id: string | null
  family_name_zh: string | null
  family_name_ko: string | null
  family_category: string | null
  formats: string[]
  length_mm: string | null
  width_mm: string | null
  height_mm: string | null
  dimension_basis: string
  material_name: string
  thickness_mm: string | null
  is_example: boolean
  created_at: string | null
  preview_revision_id: string | null
  has_preview: boolean
}

export type VariantDetail = VariantSummary & {
  revisions: RevisionSummary[]
  current_revision: RevisionSummary | null
}

export type VariantListFilters = {
  q?: string
  category?: string
  file_format?: string
  min_l?: string
  max_l?: string
  min_w?: string
  max_w?: string
  min_h?: string
  max_h?: string
  rights_status?: string
  acquisition_status?: string
  manufacturing_status?: string
  include_examples?: boolean
  all?: boolean
}

export type VariantListResult = {
  items: VariantSummary[]
  inventory_count: number
}

function buildQuery(filters: VariantListFilters = {}): string {
  const params = new URLSearchParams()
  const entries: Array<[keyof VariantListFilters, string | boolean | undefined]> = [
    ['q', filters.q],
    ['category', filters.category],
    ['file_format', filters.file_format],
    ['min_l', filters.min_l],
    ['max_l', filters.max_l],
    ['min_w', filters.min_w],
    ['max_w', filters.max_w],
    ['min_h', filters.min_h],
    ['max_h', filters.max_h],
    ['rights_status', filters.rights_status],
    ['acquisition_status', filters.acquisition_status],
    ['manufacturing_status', filters.manufacturing_status],
  ]
  for (const [key, value] of entries) {
    if (typeof value === 'string' && value.trim()) params.set(key, value.trim())
  }
  if (filters.include_examples) params.set('include_examples', '1')
  if (filters.all) params.set('all', '1')
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export async function fetchVariants(filters: VariantListFilters = {}): Promise<VariantListResult> {
  const res = await apiRequest<VariantListResult>(`/dieline-library/variants/${buildQuery(filters)}`)
  return res.data
}

export async function fetchVariant(id: string): Promise<VariantDetail> {
  const res = await apiRequest<VariantDetail>(`/dieline-library/variants/${encodeURIComponent(id)}/`)
  return res.data
}

export async function fetchRevisionPreviewBlob(revisionId: string): Promise<Blob> {
  const res = await fetch(
    `${API_BASE}/dieline-library/revisions/${encodeURIComponent(revisionId)}/preview/`,
    { credentials: 'include', headers: { Accept: 'image/svg+xml,application/octet-stream,*/*' } },
  )
  if (!res.ok) {
    throw new Error(`preview_${res.status}`)
  }
  return res.blob()
}

export async function downloadRevision(revisionId: string, filenameHint?: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/dieline-library/revisions/${encodeURIComponent(revisionId)}/download/`,
    { credentials: 'include' },
  )
  if (!res.ok) {
    throw new Error(`download_${res.status}`)
  }
  const blob = await res.blob()
  const disposition = res.headers.get('Content-Disposition') || ''
  const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i)
  const filename = filenameHint || (match ? decodeURIComponent(match[1].replace(/"/g, '')) : `revision-${revisionId}`)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function canDownloadRevision(rev: RevisionSummary | null | undefined): boolean {
  if (!rev) return false
  if (rev.publication_status === 'revoked') return false
  const grant = rev.usage_grant
  if (!grant) return false
  if (grant.valid_until && new Date(grant.valid_until).getTime() < Date.now()) return false
  return Boolean(grant.can_redistribute_files || grant.can_use_internally)
}
