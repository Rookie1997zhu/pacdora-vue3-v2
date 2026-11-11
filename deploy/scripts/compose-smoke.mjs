#!/usr/bin/env node
/**
 * Compose / Caddy edge smoke. Fail loudly; never fake success.
 *
 * Usage:
 *   node deploy/scripts/compose-smoke.mjs
 *   BASE_URL=http://localhost SMOKE_EMAIL=... SMOKE_PASSWORD=... node deploy/scripts/compose-smoke.mjs
 *
 * Requires SMOKE_EMAIL + SMOKE_PASSWORD (no silent skip).
 */
import { spawnSync } from 'node:child_process'
import { Buffer } from 'node:buffer'

// Prefer Host matching Caddy SITE_ADDRESS (http://localhost); 127.0.0.1 may miss the site block.
const BASE = (process.env.BASE_URL || 'http://localhost').replace(/\/$/, '')
const COMPOSE_FILE = process.env.COMPOSE_FILE || 'deploy/compose.yaml'
const ENV_FILE = process.env.ENV_FILE || 'deploy/.env'
const SMOKE_EMAIL = (process.env.SMOKE_EMAIL || '').trim()
const SMOKE_PASSWORD = process.env.SMOKE_PASSWORD || ''

function fail(msg, detail) {
  console.error(`FAIL: ${msg}`)
  if (detail) console.error(detail)
  console.error(
    'Hint: docker compose --env-file deploy/.env -f deploy/compose.yaml ps\n' +
      '      docker compose --env-file deploy/.env -f deploy/compose.yaml logs --tail=80 backend caddy geometry worker',
  )
  process.exit(1)
}

/** Minimal cookie jar for session + CSRF across requests. */
function createJar() {
  const jar = new Map()
  return {
    store(res) {
      const raw = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
      const list = raw.length ? raw : []
      // Fallback: single set-cookie header
      if (!list.length) {
        const one = res.headers.get('set-cookie')
        if (one) list.push(one)
      }
      for (const line of list) {
        const part = String(line).split(';')[0]
        const eq = part.indexOf('=')
        if (eq <= 0) continue
        jar.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim())
      }
    },
    header() {
      if (!jar.size) return ''
      return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
    },
    get(name) {
      return jar.get(name) || ''
    },
  }
}

async function request(path, { method = 'GET', headers = {}, body, jar, raw = false } = {}) {
  const url = `${BASE}${path}`
  const h = { ...headers }
  if (jar) {
    const cookie = jar.header()
    if (cookie) h.Cookie = cookie
  }
  let res
  try {
    res = await fetch(url, { method, headers: h, body, redirect: 'follow' })
  } catch (e) {
    fail(`request ${url}`, e instanceof Error ? e.message : String(e))
  }
  if (jar) jar.store(res)
  if (raw) {
    const buf = Buffer.from(await res.arrayBuffer())
    return { res, buf, url, text: '' }
  }
  const text = await res.text()
  return { res, text, url }
}

function tinyPng() {
  // 1x1 PNG
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  )
}

function workerPing() {
  const args = [
    'compose',
    '--env-file',
    ENV_FILE,
    '-f',
    COMPOSE_FILE,
    'exec',
    '-T',
    'worker',
    'celery',
    '-A',
    'config',
    'inspect',
    'ping',
  ]
  const r = spawnSync('docker', args, { encoding: 'utf8', timeout: 60000 })
  const out = `${r.stdout || ''}\n${r.stderr || ''}`
  if (r.status !== 0) {
    fail('worker celery inspect ping exit non-zero', out.slice(0, 800))
  }
  if (!/pong/i.test(out)) {
    fail('worker celery inspect ping missing pong', out.slice(0, 800))
  }
  console.log('ok worker celery inspect ping')
}

async function mediaAcl() {
  if (!SMOKE_EMAIL || !SMOKE_PASSWORD) {
    fail(
      'SMOKE_EMAIL and SMOKE_PASSWORD required for media-acl',
      'Set them in deploy/.env (see deploy/env.example) or the shell env.',
    )
  }
  const jar = createJar()

  {
    const { res, text, url } = await request('/api/v1/auth/csrf/', { jar })
    if (!res.ok) fail(`csrf status ${res.status}`, `${url}\n${text.slice(0, 400)}`)
    let body
    try {
      body = JSON.parse(text)
    } catch {
      fail('csrf JSON parse', text.slice(0, 400))
    }
    const token = body?.data?.csrf_token || jar.get('csrftoken')
    if (!token) fail('csrf token missing', text.slice(0, 400))
    jar._csrf = token
    console.log('ok csrf')
  }

  {
    const { res, text, url } = await request('/api/v1/auth/login/', {
      method: 'POST',
      jar,
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': jar._csrf,
      },
      body: JSON.stringify({ email: SMOKE_EMAIL, password: SMOKE_PASSWORD }),
    })
    if (!res.ok) fail(`login status ${res.status}`, `${url}\n${text.slice(0, 400)}`)
    // Refresh CSRF after login (session may rotate)
    const csrf2 = await request('/api/v1/auth/csrf/', { jar })
    if (csrf2.res.ok) {
      try {
        const b = JSON.parse(csrf2.text)
        jar._csrf = b?.data?.csrf_token || jar.get('csrftoken') || jar._csrf
      } catch {
        /* keep prior */
      }
    }
    console.log('ok login')
  }

  let assetId = ''
  {
    const form = new FormData()
    const blob = new Blob([tinyPng()], { type: 'image/png' })
    form.append('file', blob, 'smoke.png')
    const { res, text, url } = await request('/api/v1/assets/', {
      method: 'POST',
      jar,
      headers: { 'X-CSRFToken': jar._csrf },
      body: form,
    })
    if (res.status !== 201) fail(`asset upload status ${res.status}`, `${url}\n${text.slice(0, 400)}`)
    let body
    try {
      body = JSON.parse(text)
    } catch {
      fail('asset upload JSON parse', text.slice(0, 400))
    }
    assetId = body?.data?.id
    if (!assetId) fail('asset upload missing id', text.slice(0, 400))
    console.log(`ok asset upload id=${assetId}`)
  }

  {
    const { res, buf, url } = await request(`/api/v1/assets/${assetId}/content/`, { jar, raw: true })
    if (!res.ok) fail(`asset content status ${res.status}`, url)
    if (!buf.length) fail('asset content empty', url)
    console.log(`ok asset content bytes=${buf.length}`)
  }

  {
    const { res, url } = await request(`/api/v1/assets/${assetId}/content/`, { raw: true })
    if (![401, 403].includes(res.status)) {
      fail(`unauth asset content expected 401/403 got ${res.status}`, url)
    }
    console.log(`ok unauth asset content → ${res.status}`)
  }

  // P8.2: poll authenticated thumbnail (worker media queue may be async)
  {
    const deadline = Date.now() + 30000
    let lastStatus = 0
    let okThumb = false
    while (Date.now() < deadline) {
      const { res, buf, url } = await request(`/api/v1/assets/${assetId}/thumbnail/`, { jar, raw: true })
      lastStatus = res.status
      if (res.status === 200 && buf.length > 0) {
        const ct = (res.headers.get('content-type') || '').toLowerCase()
        if (!ct.includes('image/')) {
          fail(`thumbnail content-type unexpected ${ct}`, url)
        }
        console.log(`ok thumbnail bytes=${buf.length} content-type=${ct}`)
        okThumb = true
        break
      }
      if (res.status !== 404) {
        fail(`thumbnail unexpected status ${res.status}`, url)
      }
      await new Promise((r) => setTimeout(r, 1000))
    }
    if (!okThumb) {
      fail(`thumbnail not ready within 30s last=${lastStatus}`, assetId)
    }
  }

  {
    const { res, url } = await request(`/api/v1/assets/${assetId}/thumbnail/`, { raw: true })
    if (![401, 403].includes(res.status)) {
      fail(`unauth thumbnail expected 401/403 got ${res.status}`, url)
    }
    console.log(`ok unauth thumbnail → ${res.status}`)
  }
}

function workerActiveQueues() {
  const args = [
    'compose',
    '--env-file',
    ENV_FILE,
    '-f',
    COMPOSE_FILE,
    'exec',
    '-T',
    'worker',
    'celery',
    '-A',
    'config',
    'inspect',
    'active_queues',
  ]
  const r = spawnSync('docker', args, { encoding: 'utf8', timeout: 60000 })
  const out = `${r.stdout || ''}\n${r.stderr || ''}`
  if (r.status !== 0) {
    fail('worker celery inspect active_queues exit non-zero', out.slice(0, 800))
  }
  if (!/\bmedia\b/.test(out)) {
    fail('worker active_queues missing media', out.slice(0, 1200))
  }
  console.log('ok worker active_queues includes media')
}

async function main() {
  console.log(`compose-smoke → ${BASE}`)

  {
    const { res, text, url } = await request('/api/v1/health/')
    if (!res.ok) fail(`health status ${res.status}`, `${url}\n${text.slice(0, 400)}`)
    let body
    try {
      body = JSON.parse(text)
    } catch {
      fail('health JSON parse', text.slice(0, 400))
    }
    if (body?.code !== 'OK') fail('health code != OK', JSON.stringify(body))
    console.log('ok health code=OK')
  }

  {
    const { res, text, url } = await request('/api/v1/products/')
    if (!res.ok) fail(`products status ${res.status}`, `${url}\n${text.slice(0, 400)}`)
    let body
    try {
      body = JSON.parse(text)
    } catch {
      fail('products JSON parse', text.slice(0, 400))
    }
    const items = body?.data?.items
    if (!Array.isArray(items) || items.length < 1) {
      fail('products.items empty', JSON.stringify(body)?.slice(0, 400))
    }
    console.log(`ok products items=${items.length}`)
  }

  {
    const { res, url } = await request('/media/compose-smoke-probe.bin')
    if (res.status !== 404) {
      fail(`media expected 404 got ${res.status}`, url)
    }
    console.log('ok /media → 404')
  }

  {
    const { res, text, url } = await request('/')
    if (!res.ok) fail(`SPA status ${res.status}`, `${url}\n${text.slice(0, 200)}`)
    const lower = text.toLowerCase()
    if (!lower.includes('<div id="app"') && !lower.includes('id="app"')) {
      fail('SPA missing #app root', text.slice(0, 300))
    }
    console.log('ok SPA / has #app')
  }

  await mediaAcl()
  workerPing()
  workerActiveQueues()

  console.log('compose-smoke: all passed')
}

main().catch((e) => fail('unhandled', e instanceof Error ? e.stack : String(e)))
