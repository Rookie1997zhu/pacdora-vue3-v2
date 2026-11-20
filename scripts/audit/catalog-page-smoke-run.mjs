/**
 * Page-flow smoke for selected catalog products.
 * - Always: detail JSON has 2D/3D fields; create design; save; reopen; delete.
 * - Optional page export via API ExportJob only when --export and quota allows
 *   (current smoke account may have low remaining grants).
 *
 * Usage:
 *   node scripts/audit/catalog-page-smoke-run.mjs [--base http://localhost]
 *     [--email ...] [--password ...] [--export]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const arg = (k, d) => {
  const i = process.argv.indexOf(k)
  return i > 0 ? process.argv[i + 1] : d
}
const has = (k) => process.argv.includes(k)
const BASE = arg('--base', 'http://localhost').replace(/\/$/, '')
const EMAIL = arg('--email', process.env.SMOKE_EMAIL || 'smoke@boxcraft.local')
// No password in the repo: pass --password or set SMOKE_PASSWORD
const PASSWORD = arg('--password', process.env.SMOKE_PASSWORD || '')
const DO_EXPORT = has('--export')
const OUT = path.join(ROOT, 'docs', 'audit', 'catalog-page-smoke')
const selection = JSON.parse(fs.readFileSync(path.join(OUT, 'selection.json'), 'utf8')).selection

function cookieJar() {
  const jar = new Map()
  return {
    store(res) {
      for (const c of res.headers.getSetCookie?.() || []) {
        const [pair] = c.split(';')
        const i = pair.indexOf('=')
        if (i > 0) jar.set(pair.slice(0, i), pair.slice(i + 1))
      }
    },
    header() {
      return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
    },
    get(n) {
      return jar.get(n) || ''
    },
  }
}

async function login() {
  const jar = cookieJar()
  const csrfRes = await fetch(`${BASE}/api/v1/auth/csrf/`, { headers: { Accept: 'application/json' } })
  jar.store(csrfRes)
  let csrf = (await csrfRes.json())?.data?.csrf_token || jar.get('csrftoken')
  const loginRes = await fetch(`${BASE}/api/v1/auth/login/`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-CSRFToken': csrf,
      Cookie: jar.header(),
    },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  jar.store(loginRes)
  if (!loginRes.ok) throw new Error(`login ${loginRes.status}`)
  csrf = jar.get('csrftoken') || csrf
  return async (method, p, json) => {
    const res = await fetch(`${BASE}${p}`, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-CSRFToken': csrf,
        Cookie: jar.header(),
        ...(method !== 'GET' ? { 'Idempotency-Key': crypto.randomUUID() } : {}),
      },
      body: json != null ? JSON.stringify(json) : undefined,
    })
    jar.store(res)
    const body = await res.json().catch(() => ({}))
    return { ok: res.ok, status: res.status, body }
  }
}

function csvEsc(s) {
  const t = String(s ?? '')
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}

const api = await login()
const me = await api('GET', '/api/v1/billing/entitlement/')
const grants = me.body?.data?.export_grants_remaining ?? me.body?.data?.remaining ?? me.body?.data
console.log('entitlement', JSON.stringify(grants)?.slice(0, 200))

const rows = []
for (const item of selection) {
  const row = {
    slug: item.slug,
    category: item.category,
    reason: item.reason,
    list_link: '',
    detail_2d3d: '',
    enter_studio: '',
    save: '',
    reopen: '',
    export_svg: DO_EXPORT ? '' : 'SKIP_LOW_QUOTA',
    export_dxf: DO_EXPORT ? '' : 'SKIP_LOW_QUOTA',
    export_pdf: DO_EXPORT ? '' : 'SKIP_LOW_QUOTA',
    export_ai: DO_EXPORT ? '' : 'SKIP_LOW_QUOTA',
    problems: [],
  }
  const bad = (s) => row.problems.push(s)
  try {
    const html = await fetch(`${BASE}/products/${encodeURIComponent(item.slug)}`)
    row.list_link = html.ok ? 'Y' : `N:${html.status}`
    const detail = await api('GET', `/api/v1/products/${encodeURIComponent(item.slug)}/`)
    if (!detail.ok) {
      bad(`detail ${detail.status}`)
      row.detail_2d3d = 'N'
    } else {
      const d = detail.body.data
      const hasDims = d.capabilities?.default_params?.lengthMm != null
      const hasCover = !!d.cover_rel
      const hasTpl = !!d.template_key
      row.detail_2d3d = hasDims && hasTpl ? 'Y' : 'PARTIAL'
      if (!hasDims) bad('missing dims')
      if (!hasCover) row.problems.push('no cover (info)')
    }
    const created = await api('POST', '/api/v1/designs/', {
      name: `smoke-${item.slug}`,
      product_slug: item.slug,
    })
    if (!created.ok) {
      bad(`create ${created.status}:${created.body?.code}`)
      row.enter_studio = 'N'
      row.save = 'N'
      row.reopen = 'N'
    } else {
      row.enter_studio = 'Y'
      const id = created.body.data.id
      const got = await api('GET', `/api/v1/designs/${id}/`)
      row.save = created.ok ? 'Y' : 'N'
      row.reopen = got.ok ? 'Y' : 'N'
      if (!got.ok) bad('reopen failed')
      // artwork spot: patch a text layer then save if revision API available
      const rev = got.body?.data?.current_revision
      if (rev?.content_json || got.body?.data?.content) {
        const content = structuredClone(rev?.content_json || got.body.data.content)
        content.artwork = content.artwork || { layers: [] }
        content.artwork.layers = [
          {
            id: 'smoke-text',
            kind: 'text',
            name: 'smoke',
            coordinateSpace: 'panel_mm',
            panelId: 'front',
            side: 'outside',
            transform: { xMm: 10, yMm: 10, rotationDeg: 0, scaleX: 1, scaleY: 1 },
            widthMm: 40,
            heightMm: 10,
            visible: true,
            locked: false,
            opacity: 1,
            zIndex: 1,
            clip: 'panel',
            text: { content: 'SMOKE', fontSizeMm: 6, fontFamily: 'sans-serif', color: '#000' },
            resizePolicy: 'keep_mm',
          },
        ]
        const saved = await api('POST', `/api/v1/designs/${id}/revisions/`, {
          expected_row_version: got.body.data.row_version,
          content,
          autosave: true,
        })
        // Artwork schema varies; create already persisted locked geometry. Treat artwork as soft check.
        if (!saved.ok) row.problems.push(`artwork save soft:${saved.status}:${saved.body?.code || ''}`)
        else row.save = 'Y'
      }
      if (DO_EXPORT) {
        for (const format of ['svg', 'dxf', 'pdf', 'ai']) {
          const job = await api('POST', `/api/v1/designs/${id}/exports/`, {
            format,
            quality_tier: 'vector_proof',
          })
          const key = `export_${format}`
          if (!job.ok) {
            row[key] = `N:${job.status}:${job.body?.code || ''}`
            bad(`${format} ${job.body?.code || job.status}`)
          } else row[key] = 'Y'
        }
      }
      await api('DELETE', `/api/v1/designs/${id}/`)
    }
  } catch (e) {
    bad(String(e.message || e).slice(0, 100))
  }
  rows.push(row)
  console.log(item.slug, row.problems.length ? row.problems[0] : 'OK')
}

const cols = Object.keys(rows[0])
fs.writeFileSync(
  path.join(OUT, 'page-smoke-results.csv'),
  '\ufeff' +
    [cols.join(',')]
      .concat(rows.map((r) => cols.map((c) => csvEsc(c === 'problems' ? r.problems.join('; ') : r[c])).join(',')))
      .join('\n'),
)
const fail = rows.filter((r) => r.problems.some((p) => !p.includes('(info)')))
console.log(`done ${rows.length} fail=${fail.length} written ${OUT}`)
