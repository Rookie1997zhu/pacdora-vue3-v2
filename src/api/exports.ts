import { apiRequest, API_BASE, ensureCsrf, ApiError } from './client'

export type ExportFormat = 'svg' | 'dxf' | 'pdf' | 'ai'
export type ExportTier = 'vector_proof' | 'engineering' | 'manufacturing'

export type ExportJob = {
  id: string
  design_id: string
  input_revision_id: string
  format: ExportFormat
  quality_tier: string
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  content_hash: string | null
  geometry_hash: string | null
  engine_version: string | null
  exporter_version: string | null
  preflight: Record<string, unknown>
  result_asset_id: string | null
  checksum: string | null
  error_code: string | null
  error_message: string | null
  attempts?: number
  created_at: string | null
  updated_at: string | null
  finished_at: string | null
}

export type ExportOptions = {
  showDimensions?: boolean
  showBleed?: boolean
  showFaceNames?: boolean
  showTitleBlock?: boolean
  displayUnit?: 'mm' | 'in'
  locale?: 'zh-CN' | 'ko-KR'
}

export async function createExportJob(
  designId: string,
  payload: {
    format: ExportFormat
    quality_tier?: ExportTier
    revision_id?: string
    options?: ExportOptions
    source?: 'workbench' | 'studio'
  },
  idempotencyKey: string,
) {
  const res = await apiRequest<ExportJob>(`/designs/${designId}/exports/`, {
    method: 'POST',
    json: {
      format: payload.format,
      quality_tier: payload.quality_tier || 'vector_proof',
      revision_id: payload.revision_id,
      options: payload.options || {},
      source: payload.source,
    },
    idempotencyKey,
  })
  return res.data
}

export async function fetchExportJob(jobId: string) {
  const res = await apiRequest<ExportJob>(`/exports/${jobId}/`)
  return res.data
}

export async function listExportJobs(params?: { design?: string; status?: string }) {
  const qs = new URLSearchParams()
  if (params?.design) qs.set('design', params.design)
  if (params?.status) qs.set('status', params.status)
  const q = qs.toString()
  const res = await apiRequest<{ items: ExportJob[] }>(`/exports/${q ? `?${q}` : ''}`)
  return res.data.items
}

export async function cancelExportJob(jobId: string) {
  const res = await apiRequest<ExportJob>(`/exports/${jobId}/cancel/`, { method: 'POST', json: {} })
  return res.data
}

export async function retryExportJob(jobId: string) {
  const res = await apiRequest<ExportJob>(`/exports/${jobId}/retry/`, { method: 'POST', json: {} })
  return res.data
}

export async function downloadExportJob(jobId: string): Promise<{ blob: Blob; filename: string }> {
  await ensureCsrf()
  const res = await fetch(`${API_BASE}/exports/${jobId}/download/`, {
    credentials: 'include',
    headers: { Accept: '*/*' },
  })
  if (!res.ok) {
    let code = 'EXPORT_DOWNLOAD_FAILED'
    let message = `HTTP ${res.status}`
    try {
      const body = await res.json()
      code = body?.code || code
      message = body?.message || message
    } catch {
      /* binary or empty */
    }
    throw new ApiError(res.status, { code, message })
  }
  const disposition = res.headers.get('Content-Disposition') || ''
  const star = disposition.match(/filename\*=(?:UTF-8'')?([^;]+)/i)
  const plain = disposition.match(/filename="?([^";]+)"?/i)
  const filename = star
    ? decodeURIComponent(star[1].replace(/"/g, ''))
    : plain
      ? plain[1]
      : `export-${jobId}`
  const blob = await res.blob()
  return { blob, filename }
}

export { API_BASE }
