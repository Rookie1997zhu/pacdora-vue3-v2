export const API_BASE = (import.meta.env.VITE_API_BASE || '/api/v1').replace(/\/$/, '')

let csrfToken = ''

function getCookie(name: string): string {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[$()*+.?[\\\]^{|}-]/g, '\\$&')}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : ''
}

export async function ensureCsrf(): Promise<string> {
  if (csrfToken) return csrfToken
  const res = await fetch(`${API_BASE}/auth/csrf/`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`csrf_failed_${res.status}`)
  const body = await res.json()
  csrfToken = body?.data?.csrf_token || getCookie('csrftoken')
  return csrfToken
}

export function clearCsrfCache(): void {
  csrfToken = ''
}

export type ApiEnvelope<T = unknown> = {
  code: string
  message: string
  data: T
  request_id?: string
  errors?: Record<string, string[]>
}

export class ApiError extends Error {
  status: number
  code: string
  errors?: Record<string, string[]>
  data?: unknown
  requestId?: string

  constructor(status: number, envelope: Partial<ApiEnvelope> & { data?: unknown }) {
    super(envelope.message || `HTTP ${status}`)
    this.status = status
    this.code = envelope.code || 'HTTP_ERROR'
    this.errors = envelope.errors
    this.data = envelope.data
    this.requestId = envelope.request_id
  }
}

export type ApiRequestOptions = RequestInit & {
  json?: unknown
  idempotencyKey?: string
  formData?: FormData
}

export async function apiRequest<T = unknown>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiEnvelope<T>> {
  const headers = new Headers(options.headers || {})
  headers.set('Accept', 'application/json')
  const method = (options.method || 'GET').toUpperCase()
  if (method !== 'GET' && method !== 'HEAD') {
    const token = await ensureCsrf()
    headers.set('X-CSRFToken', token)
  }
  if (options.idempotencyKey) {
    headers.set('Idempotency-Key', options.idempotencyKey)
  }
  let body = options.body
  if (options.formData) {
    body = options.formData
  } else if (options.json !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(options.json)
  }
  const res = await fetch(`${API_BASE}${path.startsWith('/') ? path : `/${path}`}`, {
    ...options,
    method,
    headers,
    body,
    credentials: 'include',
  })
  const text = await res.text()
  let envelope: ApiEnvelope<T> & { data?: unknown }
  try {
    envelope = text ? JSON.parse(text) : ({ code: 'EMPTY', message: '', data: null as T })
  } catch {
    throw new ApiError(res.status, { code: 'INVALID_JSON', message: text.slice(0, 200) })
  }
  if (!res.ok) throw new ApiError(res.status, envelope)
  return envelope
}

export async function apiUpload<T = unknown>(path: string, formData: FormData): Promise<ApiEnvelope<T>> {
  return apiRequest<T>(path, { method: 'POST', formData })
}
