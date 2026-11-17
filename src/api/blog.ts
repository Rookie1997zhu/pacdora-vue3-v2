import { apiRequest } from './client'
import type { PageMeta } from './console'

export type BlogCard = {
  slug: string
  title: string
  summary: string
  cover_url: string
  tags: string[]
  author_name: string
  published_at: string | null
  meta_title: string
  meta_description: string
  locale: string
  fallback: boolean
}

export type BlogDetail = BlogCard & {
  body_html: string
  related: BlogCard[]
}

export type BlogListResult = {
  featured: BlogCard[]
  tags: string[]
  items: BlogCard[]
  page: PageMeta
  locale: string
}

function qs(params: Record<string, string | number | undefined | null> = {}) {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return
    sp.set(k, String(v))
  })
  const s = sp.toString()
  return s ? `?${s}` : ''
}

export function fetchBlogPosts(params?: {
  page?: number
  page_size?: number
  tag?: string
  q?: string
  locale?: string
}) {
  return apiRequest<BlogListResult>(`/blog/posts/${qs(params || {})}`).then((r) => r.data)
}

export function fetchBlogPost(slug: string, locale?: string) {
  return apiRequest<BlogDetail>(`/blog/posts/${encodeURIComponent(slug)}/${qs({ locale })}`).then(
    (r) => r.data,
  )
}
