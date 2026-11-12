import fs from 'node:fs'
import path from 'node:path'
import { configDir, dataRaw, reportsDir } from '../paths.ts'

export type SizeMm = { L: number; W: number; H: number; group?: string; note?: string }

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function keyOf(p: SizeMm) {
  return `${p.L}x${p.W}x${p.H}`
}

export async function collectPapiEps() {
  const scope = JSON.parse(fs.readFileSync(path.join(configDir, 'access-scope.json'), 'utf8'))
  const matrix = JSON.parse(fs.readFileSync(path.join(configDir, 'sample-matrix.json'), 'utf8'))
  if (!scope.live_collection) {
    throw new Error('live_collection=false; refusing online collect')
  }

  const cfg = scope.collection
  const liveDir = path.join(dataRaw, 'live')
  fs.mkdirSync(liveDir, { recursive: true })

  const planned: SizeMm[] = []
  for (const [group, pts] of Object.entries(matrix.planned_groups) as Array<[string, SizeMm[]]>) {
    for (const p of pts) planned.push({ ...p, group })
  }
  // de-dupe by LWH, keep first group
  const uniq: SizeMm[] = []
  const seen = new Set<string>()
  for (const p of planned) {
    const k = keyOf(p)
    if (seen.has(k)) continue
    seen.add(k)
    uniq.push(p)
  }

  const budget = Math.min(cfg.max_samples_per_batch || 30, uniq.length)
  const queue = uniq.slice(0, budget)
  const jobs: any[] = []
  let collected = 0
  let failed = 0

  for (let i = 0; i < queue.length; i++) {
    const p = queue[i]
    const jobId = `job_${Date.now()}_${i}`
    const sampleId = `live-crashlock-${p.L}_${p.W}_${p.H}`
    const url = `${cfg.endpoint}?productCode=${encodeURIComponent(scope.pilot_product)}&length=${p.L}&width=${p.W}&height=${p.H}&format=${cfg.format}`
    const started = new Date().toISOString()
    let status = 0
    let ok = false
    let reason = ''
    let bytes = 0
    let contentType = ''
    let outFile = ''
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'User-Agent': cfg.user_agent, Accept: '*/*' },
      })
      status = res.status
      contentType = res.headers.get('content-type') || ''
      const buf = Buffer.from(await res.arrayBuffer())
      bytes = buf.length
      if (status === 401 || status === 403) {
        reason = `http_${status}_stop_source`
        jobs.push({ jobId, sampleId, params: p, url, started, status, ok, reason, bytes, contentType })
        failed++
        break
      }
      if (status === 429) {
        reason = `http_429_retry_after_${res.headers.get('retry-after') || 'none'}`
        jobs.push({ jobId, sampleId, params: p, url, started, status, ok, reason, bytes, contentType })
        failed++
        break
      }
      const head = buf.subarray(0, 32).toString('latin1')
      const looksEps = head.startsWith('%!PS') || head.includes('EPSF') || buf[0] === 0xc5
      const tooSmall = bytes < 1500
      if (!res.ok || !looksEps || tooSmall) {
        reason = !res.ok ? `http_${status}` : tooSmall ? 'too_small_probably_stub' : 'not_eps_header'
        ok = false
        failed++
      } else {
        outFile = path.join(liveDir, `${sampleId}.eps`)
        fs.writeFileSync(outFile, buf)
        fs.writeFileSync(
          path.join(liveDir, `${sampleId}.meta.json`),
          JSON.stringify(
            {
              sampleId,
              product: scope.pilot_product,
              length: p.L,
              width: p.W,
              height: p.H,
              group: p.group,
              source: 'papi.public.online.model',
              url,
              contentType,
              bytes,
              collected_at: started,
              format: 'eps',
            },
            null,
            2,
          ),
        )
        ok = true
        reason = 'eps_saved'
        collected++
      }
    } catch (e: any) {
      reason = `fetch_error:${e?.message || e}`
      failed++
    }
    jobs.push({ jobId, sampleId, params: p, url, started, status, ok, reason, bytes, contentType, outFile: outFile || null })
    if (i < queue.length - 1) await sleep(cfg.min_interval_ms || 5000)
  }

  scope.online_collection_count = collected
  scope.offline = false
  scope.live_collection = true
  fs.writeFileSync(path.join(configDir, 'access-scope.json'), JSON.stringify(scope, null, 2))

  const log = {
    generated_at: new Date().toISOString(),
    live_collection: true,
    paid_actions: false,
    endpoint: cfg.endpoint,
    planned: uniq.length,
    attempted: queue.length,
    collected,
    failed,
    jobs,
    message: `本轮在线采集 ${collected} 条 EPS（public papi model；未爬 /editor/）`,
  }
  fs.writeFileSync(path.join(reportsDir, 'online-collect-log.json'), JSON.stringify(log, null, 2))
  console.log(log.message)
  return log
}
