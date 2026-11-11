import { apiRequest } from './client'
import type { AssetMeta } from './designs'
import type { SaveRevisionResult } from './designs'

export type AiOperationCap = {
  operation: string
  enabled: boolean
  reason?: string | null
  provider?: string
  model?: string | null
  mask_input?: boolean
}

export type AiCapabilities = {
  provider: string
  model: string | null
  operations: AiOperationCap[]
}

export type AiJob = {
  id: string
  design_id: string
  input_revision_id: string
  operation: string
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  prompt: string
  provider: string
  result_asset_id: string | null
  error_code: string | null
  error_message: string | null
  created_at: string | null
  updated_at: string | null
  finished_at: string | null
}

export type GeneratedAssetItem = {
  job_id: string
  operation?: string
  prompt: string
  asset: AssetMeta
  finished_at: string | null
}

export type ApplyAiJobPayload = {
  expected_row_version: number
  panel_id?: string
  side?: 'outside' | 'inside'
  width_mm?: number
  height_mm?: number
  origin_x_mm?: number
  origin_y_mm?: number
  registration?: Record<string, unknown>
}

export async function fetchAiCapabilities() {
  const res = await apiRequest<AiCapabilities>('/ai/capabilities/')
  return res.data
}

export async function createAiJob(
  designId: string,
  payload: { operation: string; prompt: string; registration?: Record<string, unknown> },
  idempotencyKey: string,
) {
  const res = await apiRequest<AiJob>(`/designs/${designId}/ai-jobs/`, {
    method: 'POST',
    json: payload,
    idempotencyKey,
  })
  return res.data
}

export async function fetchAiJob(jobId: string) {
  const res = await apiRequest<AiJob>(`/ai-jobs/${jobId}/`)
  return res.data
}

export async function cancelAiJob(jobId: string) {
  const res = await apiRequest<AiJob>(`/ai-jobs/${jobId}/cancel/`, { method: 'POST', json: {} })
  return res.data
}

export async function applyAiJob(jobId: string, payload: ApplyAiJobPayload) {
  const res = await apiRequest<SaveRevisionResult>(`/ai-jobs/${jobId}/apply/`, {
    method: 'POST',
    json: payload,
  })
  return res.data
}

export async function fetchGeneratedAssets(designId: string) {
  const res = await apiRequest<{ items: GeneratedAssetItem[] }>(`/designs/${designId}/generated-assets/`)
  return res.data.items
}
