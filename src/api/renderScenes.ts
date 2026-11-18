import { API_BASE, ApiError, apiRequest } from './client'
import type { RenderSceneDocumentV2 } from '../../packages/render-scene-schema/renderScene'

export type RenderSceneListItem = {
  id: string
  name: string
  row_version: number
  schema_version: string
  cover_asset_id: string | null
  model_count: number
  prop_count?: number
  updated_at: string
  created_at: string
}

export type RenderSceneDetail = RenderSceneListItem & {
  content: RenderSceneDocumentV2
  organization_id: string
}

export type RenderJob = {
  id: string
  scene_id: string
  batch_id?: string | null
  view_id?: string
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  width: number
  height: number
  format: 'png' | 'jpg'
  result_asset_id: string | null
  input_asset_id: string | null
  checksum: string
  error_code: string
  error_message: string
  samples: number
  duration_ms: number | null
  created_at: string
  updated_at: string
  finished_at: string | null
}

export type RenderBatch = {
  id: string
  scene_id: string
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'partial'
  width: number
  height: number
  format: 'png' | 'jpg'
  view_ids: string[]
  job_count: number
  succeeded_count: number
  failed_count: number
  job_ids: string[]
  error_code: string
  error_message: string
  created_at: string
  updated_at: string
  finished_at: string | null
}

export type RenderPropItem = {
  id: string
  name: string
  slug: string
  source: 'official' | 'upload'
  is_official: boolean
  asset_id: string | null
  download_url: string
  created_at: string
  updated_at: string
}

export type RenderEnvironmentItem = {
  id: string
  name: string
  default_intensity: number
  download_url: string
  sort_order: number
}

export type RenderSceneTemplateItem = {
  id: string
  name: string
  tier: string
  slot_ids: string[]
  sort_order: number
  content_json: RenderSceneDocumentV2
}

export async function renderSceneList() {
  const res = await apiRequest<{ items: RenderSceneListItem[] }>('/render-scenes/')
  return res.data.items
}

export async function renderSceneGet(id: string) {
  const res = await apiRequest<RenderSceneDetail>(`/render-scenes/${id}/`)
  return res.data
}

export async function renderSceneCreate(payload: {
  name?: string
  content?: RenderSceneDocumentV2
  design_id?: string
  revision_id?: string | null
}) {
  const res = await apiRequest<RenderSceneDetail>('/render-scenes/', {
    method: 'POST',
    json: payload,
  })
  return res.data
}

export async function renderSceneUpdate(
  id: string,
  payload: {
    expected_row_version: number
    name?: string
    content?: RenderSceneDocumentV2
  },
) {
  const res = await apiRequest<RenderSceneDetail>(`/render-scenes/${id}/`, {
    method: 'PATCH',
    json: payload,
  })
  return res.data
}

export async function renderSceneCopy(id: string, name?: string) {
  const res = await apiRequest<RenderSceneDetail>(`/render-scenes/${id}/copy/`, {
    method: 'POST',
    json: name ? { name } : {},
  })
  return res.data
}

export async function renderSceneDelete(id: string) {
  await apiRequest(`/render-scenes/${id}/`, { method: 'DELETE' })
}

export async function renderSceneApplyTemplate(
  id: string,
  payload: {
    templateId: string
    bindings: Array<{ slotId: string; designId: string; revisionId?: string | null }>
    expected_row_version: number
  },
) {
  const res = await apiRequest<RenderSceneDetail>(`/render-scenes/${id}/apply-template/`, {
    method: 'POST',
    json: payload,
  })
  return res.data
}

export async function renderJobCreate(
  sceneId: string,
  payload: {
    glb: Blob
    width: number
    height: number
    format?: 'png' | 'jpg'
    scene_snapshot?: RenderSceneDocumentV2
  },
  idempotencyKey: string,
) {
  const form = new FormData()
  form.append('file', payload.glb, 'scene.glb')
  form.append('width', String(payload.width))
  form.append('height', String(payload.height))
  form.append('format', payload.format || 'png')
  if (payload.scene_snapshot) {
    form.append('scene_snapshot', JSON.stringify(payload.scene_snapshot))
  }
  const res = await apiRequest<RenderJob>(`/render-scenes/${sceneId}/render-jobs/`, {
    method: 'POST',
    formData: form,
    idempotencyKey,
  })
  return res.data
}

export async function renderBatchCreate(
  sceneId: string,
  payload: {
    glb: Blob
    width: number
    height: number
    format?: 'png' | 'jpg'
    viewIds: string[]
    scene_snapshot?: RenderSceneDocumentV2
  },
  idempotencyKey: string,
) {
  const form = new FormData()
  form.append('file', payload.glb, 'scene.glb')
  form.append('width', String(payload.width))
  form.append('height', String(payload.height))
  form.append('format', payload.format || 'png')
  form.append('view_ids', JSON.stringify(payload.viewIds))
  if (payload.scene_snapshot) {
    form.append('scene_snapshot', JSON.stringify(payload.scene_snapshot))
  }
  const res = await apiRequest<RenderBatch>(`/render-scenes/${sceneId}/render-batches/`, {
    method: 'POST',
    formData: form,
    idempotencyKey,
  })
  return res.data
}

export async function renderBatchGet(batchId: string) {
  const res = await apiRequest<RenderBatch>(`/render-batches/${batchId}/`)
  return res.data
}

export async function renderJobGet(jobId: string) {
  const res = await apiRequest<RenderJob>(`/render-jobs/${jobId}/`)
  return res.data
}

export async function renderJobList(sceneId: string) {
  const res = await apiRequest<{ items: RenderJob[] }>(`/render-scenes/${sceneId}/render-jobs/`)
  return res.data.items
}

export async function renderJobDownload(jobId: string): Promise<{ blob: Blob; filename: string }> {
  const tokenHeaders: HeadersInit = { Accept: 'image/png,image/jpeg,*/*' }
  const res = await fetch(`${API_BASE}/render-jobs/${jobId}/download/`, {
    credentials: 'include',
    headers: tokenHeaders,
  })
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    let code = 'RENDER_DOWNLOAD_FAILED'
    try {
      const body = await res.json()
      message = body?.message || message
      if (typeof body?.code === 'string' && body.code) code = body.code
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, { message, code })
  }
  const blob = await res.blob()
  const cd = res.headers.get('Content-Disposition') || ''
  const match = /filename="?([^";]+)"?/i.exec(cd)
  return { blob, filename: match?.[1] || `render-${jobId}.png` }
}

export async function renderPropList(scope: 'official' | 'mine' = 'official') {
  const res = await apiRequest<{ items: RenderPropItem[] }>(`/render-props/?scope=${scope}`)
  return res.data.items
}

export async function renderPropUpload(file: Blob, name?: string) {
  const form = new FormData()
  form.append('file', file, (file as File).name || 'prop.glb')
  if (name) form.append('name', name)
  const res = await apiRequest<RenderPropItem>('/render-props/', {
    method: 'POST',
    formData: form,
  })
  return res.data
}

export async function renderPropDelete(id: string) {
  await apiRequest(`/render-props/${id}/`, { method: 'DELETE' })
}

export function renderPropDownloadUrl(id: string) {
  return `${API_BASE}/render-props/${id}/download/`
}

export async function renderEnvironmentList() {
  const res = await apiRequest<{ items: RenderEnvironmentItem[] }>('/render-environments/')
  return res.data.items
}

export function renderEnvironmentDownloadUrl(id: string) {
  return `${API_BASE}/render-environments/${id}/download/`
}

export async function renderSceneTemplateList() {
  const res = await apiRequest<{ items: RenderSceneTemplateItem[] }>('/render-scene-templates/')
  return res.data.items
}

export async function renderSceneTemplateGet(id: string) {
  const res = await apiRequest<RenderSceneTemplateItem>(`/render-scene-templates/${id}/`)
  return res.data
}
