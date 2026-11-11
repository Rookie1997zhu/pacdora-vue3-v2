import { API_BASE, apiRequest, apiUpload } from './client'
import type { DesignDocumentV1 } from '../../packages/design-schema/designDocument'
import type { ParamLimits } from './catalog'

export type DesignListItem = {
  id: string
  name: string
  status: 'active' | 'archived'
  row_version: number
  product_slug: string | null
  current_revision_id: string | null
  preview_asset_id?: string | null
  thumbnail_ready?: boolean
  updated_at: string
  created_at: string
}

export type DesignCapabilities = {
  editable_size?: boolean
  canExportManufacturing?: boolean
  geometry_mode?: string | null
}

export type DesignDetail = DesignListItem & {
  content: DesignDocumentV1 | null
  current_revision_no: number | null
  organization_id: string
  param_limits?: ParamLimits
  capabilities?: DesignCapabilities
}

export type SaveRevisionResult = {
  design_id: string
  row_version: number
  revision: { id: string; revision_no: number; content_hash: string; geometry_hash: string; created_at: string }
  content: DesignDocumentV1
}

export type AssetMeta = {
  id: string
  mime: string
  byte_size: number
  width_px: number | null
  height_px: number | null
  status: string
  original_filename: string
  thumbnail_ready?: boolean
}

export async function fetchAssetThumbnailObjectUrl(assetId: string): Promise<string | null> {
  const res = await fetch(`${API_BASE}/assets/${assetId}/thumbnail/`, {
    credentials: 'include',
    headers: { Accept: 'image/webp,image/*,*/*' },
  })
  if (!res.ok) return null
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

export async function fetchDesigns(status?: string) {
  const q = status ? `?status=${encodeURIComponent(status)}` : ''
  const res = await apiRequest<{ items: DesignListItem[] }>(`/designs/${q}`)
  return res.data.items
}

export async function fetchDesign(id: string) {
  const res = await apiRequest<DesignDetail>(`/designs/${id}/`)
  return res.data
}

export async function createDesign(payload: { name: string; product_slug?: string; content?: DesignDocumentV1 }) {
  const res = await apiRequest<DesignDetail>('/designs/', { method: 'POST', json: payload })
  return res.data
}

export async function patchDesign(id: string, payload: { name?: string; status?: 'active' | 'archived' }) {
  const res = await apiRequest<DesignDetail>(`/designs/${id}/`, { method: 'PATCH', json: payload })
  return res.data
}

export async function copyDesign(id: string, name?: string) {
  const res = await apiRequest<DesignDetail>(`/designs/${id}/copy/`, { method: 'POST', json: { name } })
  return res.data
}

export async function saveDesignRevision(
  id: string,
  payload: { content: DesignDocumentV1; expected_row_version: number },
  idempotencyKey: string,
) {
  const res = await apiRequest<SaveRevisionResult>(`/designs/${id}/revisions/`, {
    method: 'POST',
    json: payload,
    idempotencyKey,
  })
  return res.data
}

export async function uploadAsset(file: File) {
  const fd = new FormData()
  fd.append('file', file)
  const res = await apiUpload<AssetMeta>('/assets/', fd)
  return res.data
}
