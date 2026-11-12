import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { evidenceRoot } from '../paths.ts'

export type CollectTarget = {
  L: number
  W: number
  H: number
  priority: number
  reason: string
}

export type CollectAttempt = {
  key: string
  url: string
  reason: string
  status: 'skipped_valid_local' | 'ok' | 'failed'
  httpStatus?: number
  detail?: string
  bytes?: number
  sha256?: string
  path?: string
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export function buildCdnUrl(tenant: string, product: string, t: CollectTarget): string {
  return `https://studio-cdn.packative.com/${tenant}/dielines/${product}/${t.L}_${t.W}_${t.H}/dieline.svg`
}

export function evidenceSvgPath(t: CollectTarget): string {
  return path.join(evidenceRoot, `studio-dieline-productbox-crashlock-${t.L}_${t.W}_${t.H}.svg`)
}

export function isValidDielineSvg(text: string): { ok: boolean; detail: string } {
  if (/AccessDenied|<Error>\s*<Code>/i.test(text)) return { ok: false, detail: 'access_denied_xml' }
  if (!/<svg[\s>]/i.test(text)) return { ok: false, detail: 'missing_svg_root' }
  if (!/ev-style\s*=\s*"Cutting"/i.test(text)) return { ok: false, detail: 'missing_cutting' }
  if (!/ev-style\s*=\s*"Creasing"/i.test(text)) return { ok: false, detail: 'missing_creasing' }
  return { ok: true, detail: 'valid_cutting_creasing_svg' }
}

export function localSvgUsable(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false
  const text = fs.readFileSync(filePath, 'utf8')
  return isValidDielineSvg(text).ok
}

export async function fetchWhitelistSvgs(opts: {
  tenant: string
  product: string
  targets: CollectTarget[]
  maxGets: number
  minIntervalMs: number
  skipExistingValid: boolean
}): Promise<{ attempts: CollectAttempt[]; successCount: number; getCount: number }> {
  const attempts: CollectAttempt[] = []
  let getCount = 0
  let successCount = 0
  const sorted = [...opts.targets].sort((a, b) => a.priority - b.priority || a.L - b.L)

  for (const t of sorted) {
    if (getCount >= opts.maxGets) break
    const key = `${t.L}x${t.W}x${t.H}`
    const outPath = evidenceSvgPath(t)
    const url = buildCdnUrl(opts.tenant, opts.product, t)

    if (opts.skipExistingValid && localSvgUsable(outPath)) {
      attempts.push({ key, url, reason: t.reason, status: 'skipped_valid_local', path: outPath })
      continue
    }

    if (getCount > 0) await sleep(opts.minIntervalMs)
    getCount++

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'image/svg+xml,application/xml,text/xml,*/*' },
        redirect: 'follow',
      })
      const text = await res.text()
      if (res.status === 401 || res.status === 403) {
        attempts.push({
          key,
          url,
          reason: t.reason,
          status: 'failed',
          httpStatus: res.status,
          detail: 'forbidden_or_unauthorized_stop_retry_this_point',
        })
        continue
      }
      if (!res.ok) {
        attempts.push({
          key,
          url,
          reason: t.reason,
          status: 'failed',
          httpStatus: res.status,
          detail: `http_${res.status}`,
        })
        continue
      }
      const check = isValidDielineSvg(text)
      if (!check.ok) {
        attempts.push({
          key,
          url,
          reason: t.reason,
          status: 'failed',
          httpStatus: res.status,
          detail: check.detail,
          bytes: Buffer.byteLength(text),
        })
        continue
      }
      fs.writeFileSync(outPath, text, 'utf8')
      const sha256 = crypto.createHash('sha256').update(text).digest('hex')
      successCount++
      attempts.push({
        key,
        url,
        reason: t.reason,
        status: 'ok',
        httpStatus: res.status,
        detail: check.detail,
        bytes: Buffer.byteLength(text),
        sha256,
        path: outPath,
      })
    } catch (e: unknown) {
      attempts.push({
        key,
        url,
        reason: t.reason,
        status: 'failed',
        detail: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return { attempts, successCount, getCount }
}
