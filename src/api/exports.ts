import { apiRequest, API_BASE, ensureCsrf, ApiError } from './client'

export type ExportFormat = 'svg' | 'dxf' | 'pdf'
export type ExportTier = 'vector_proof' | 'manufacturing'

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
  created_at: string | null
  updated_at: string | null
  finished_at: string | null
}

export async function createExportJob(
  designId: string,
  payload: {
    format: ExportFormat
    quality_tier?: ExportTier
    revision_id?: string
    options?: Record<string, unknown>
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
    },
    idempotencyKey,
  })
  return res.data
}

export async function fetchExportJob(jobId: string) {
  const res = await apiRequest<ExportJob>(`/exports/${jobId}/`)
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
  const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i)
  const filename = match ? decodeURIComponent(match[1].replace(/"/g, '')) : `export-${jobId}`
  const blob = await res.blob()
  return { blob, filename }
}

// Re-export base for consumers that need absolute URL construction
export { API_BASE }
