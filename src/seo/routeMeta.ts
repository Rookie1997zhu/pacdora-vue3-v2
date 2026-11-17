import type { Router } from 'vue-router'
import { i18n } from '../i18n/index.js'

type SeoMsg = {
  title?: string
  description?: string
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  if (typeof document === 'undefined') return
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertLink(rel: string, href: string, attrs: Record<string, string> = {}) {
  if (typeof document === 'undefined') return
  const selector = Object.entries(attrs)
    .map(([k, v]) => `[${k}="${v}"]`)
    .join('')
  let el = document.head.querySelector(`link[rel="${rel}"]${selector}`) as HTMLLinkElement | null
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v))
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

function tSeo(key: string): SeoMsg {
  const tm = i18n.global.t
  return {
    title: String(tm(`seo.${key}.title`)),
    description: String(tm(`seo.${key}.description`)),
  }
}

export type PageSeoInput = {
  title: string
  description: string
  path: string
  noindex?: boolean
  ogType?: string
  ogImage?: string
}

export function applyPageSeo(input: PageSeoInput) {
  if (typeof document === 'undefined') return
  const title = input.title || 'BOXCRAFT'
  const description = input.description || 'BOXCRAFT packaging dieline studio'
  document.title = title
  upsertMeta('name', 'description', description)
  upsertMeta('property', 'og:title', title)
  upsertMeta('property', 'og:description', description)
  upsertMeta('property', 'og:type', input.ogType || 'website')
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const canonical = `${origin}${input.path}`
  upsertMeta('property', 'og:url', canonical)
  if (input.ogImage) {
    upsertMeta('property', 'og:image', input.ogImage)
  }
  upsertLink('canonical', canonical)
  upsertLink('alternate', `${origin}${input.path}`, { hreflang: 'zh' })
  upsertLink('alternate', `${origin}${input.path}`, { hreflang: 'ko' })
  upsertLink('alternate', `${origin}${input.path}`, { hreflang: 'x-default' })
  upsertMeta('name', 'robots', input.noindex ? 'noindex,nofollow' : 'index,follow')
}

export function applyRouteSeo(path: string, seoKey: string, noindex = false) {
  const msg = tSeo(seoKey)
  const title = msg.title && !msg.title.startsWith('seo.') ? msg.title : 'BOXCRAFT'
  const description =
    msg.description && !msg.description.startsWith('seo.')
      ? msg.description
      : 'BOXCRAFT packaging dieline studio'
  applyPageSeo({ title, description, path, noindex, ogType: 'website' })
}

export function installRouteSeo(router: Router) {
  router.afterEach((to) => {
    const seoKey = (to.meta.seoKey as string) || 'default'
    // Workbench default pages are indexable; parameterized share URLs are not.
    const workbenchNoindex =
      to.name === 'workbench' && Object.keys(to.query || {}).some((k) => k !== 'v')
    const noindex = Boolean(to.meta.noindex) || workbenchNoindex
    applyRouteSeo(to.path, seoKey, noindex)
  })
}
