import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ApiError } from '../api/client'
import {
  renderBatchCreate,
  renderBatchGet,
  renderJobCreate,
  renderJobDownload,
  renderJobGet,
  type RenderBatch,
  type RenderJob,
} from '../api/renderScenes'
import type { Entitlement } from '../api/billing'
import type { RenderSceneDocumentV2 } from '../../packages/render-scene-schema/renderScene'
import { useBillingStore } from './billing'

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'render.png'
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Delay revoke: immediate revoke can cancel the browser download.
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function sleep(ms: number, assignTimer: (id: ReturnType<typeof setTimeout>) => void) {
  return new Promise<void>((resolve) => {
    assignTimer(setTimeout(resolve, ms))
  })
}

type CachedResult = { blob: Blob; filename: string }

export const useRenderJobStore = defineStore('renderJob', () => {
  const currentJob = ref<RenderJob | null>(null)
  const currentBatch = ref<RenderBatch | null>(null)
  const busy = ref(false)
  const error = ref('')
  const errorCode = ref('')
  /** Local cache so re-download works after server deletes ephemeral file. */
  const resultCache = ref<Record<string, CachedResult>>({})
  const inflightFetches = new Map<string, Promise<CachedResult>>()
  let pollTimer: ReturnType<typeof setTimeout> | null = null
  let pollGeneration = 0

  function stopPoll() {
    pollGeneration += 1
    if (pollTimer) clearTimeout(pollTimer)
    pollTimer = null
  }

  function clearResultCache() {
    resultCache.value = {}
    inflightFetches.clear()
  }

  function cacheResult(jobId: string, blob: Blob, filename: string) {
    resultCache.value = {
      ...resultCache.value,
      [jobId]: { blob, filename },
    }
  }

  async function pollJob(jobId: string) {
    const gen = ++pollGeneration
    if (pollTimer) {
      clearTimeout(pollTimer)
      pollTimer = null
    }
    while (gen === pollGeneration) {
      try {
        const job = await renderJobGet(jobId)
        if (gen !== pollGeneration) return
        currentJob.value = job
        if (job.status === 'queued' || job.status === 'running') {
          await sleep(1500, (id) => {
            pollTimer = id
          })
          continue
        }
        if (job.status === 'failed') {
          error.value = job.error_message || job.error_code || 'failed'
          errorCode.value = job.error_code || 'RENDER_FAILED'
        } else if (job.status === 'succeeded') {
          await download()
        }
        return
      } catch (e: unknown) {
        if (gen !== pollGeneration) return
        error.value = e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'poll_failed'
        errorCode.value = e instanceof ApiError ? e.code : 'RENDER_POLL_FAILED'
        return
      }
    }
  }

  async function pollBatch(batchId: string) {
    const gen = ++pollGeneration
    if (pollTimer) {
      clearTimeout(pollTimer)
      pollTimer = null
    }
    while (gen === pollGeneration) {
      try {
        const batch = await renderBatchGet(batchId)
        if (gen !== pollGeneration) return
        currentBatch.value = batch
        if (batch.job_ids?.length) {
          const preferred =
            batch.job_ids.find((id) => id === currentJob.value?.id) ||
            batch.job_ids[batch.job_ids.length - 1]
          try {
            currentJob.value = await renderJobGet(preferred)
          } catch {
            /* ignore per-job fetch */
          }
        }
        if (batch.status === 'queued' || batch.status === 'running') {
          await sleep(1500, (id) => {
            pollTimer = id
          })
          continue
        }
        if (batch.status === 'failed') {
          error.value = batch.error_message || batch.error_code || 'failed'
          errorCode.value = batch.error_code || 'RENDER_FAILED'
        }
        // Prefer a succeeded job for single-click download.
        if (batch.job_ids?.length) {
          for (const id of batch.job_ids) {
            try {
              const job = await renderJobGet(id)
              if (job.status === 'succeeded') {
                currentJob.value = job
                break
              }
            } catch {
              /* ignore */
            }
          }
        }
        if (batch.status === 'succeeded' || batch.status === 'partial') {
          await downloadBatch()
        }
        return
      } catch (e: unknown) {
        if (gen !== pollGeneration) return
        error.value = e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'poll_failed'
        errorCode.value = e instanceof ApiError ? e.code : 'RENDER_POLL_FAILED'
        return
      }
    }
  }

  async function start(opts: {
    sceneId: string
    glb: Blob
    width: number
    height: number
    format?: 'png' | 'jpg'
    sceneSnapshot?: RenderSceneDocumentV2
  }) {
    error.value = ''
    errorCode.value = ''
    clearResultCache()
    busy.value = true
    currentBatch.value = null
    try {
      const job = await renderJobCreate(
        opts.sceneId,
        {
          glb: opts.glb,
          width: opts.width,
          height: opts.height,
          format: opts.format || 'png',
          scene_snapshot: opts.sceneSnapshot,
        },
        crypto.randomUUID(),
      )
      currentJob.value = job
      if (job.status === 'queued' || job.status === 'running') {
        await pollJob(job.id)
      } else if (job.status === 'succeeded') {
        await download()
      } else if (job.status === 'failed') {
        error.value = job.error_message || job.error_code || 'failed'
        errorCode.value = job.error_code || 'RENDER_FAILED'
      }
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        error.value = e.message
        errorCode.value = e.code
        if (e.code === 'EXPORT_QUOTA_EXCEEDED' && e.data && typeof e.data === 'object') {
          useBillingStore().applyEntitlement(e.data as Entitlement)
        }
      } else {
        error.value = 'render_failed'
        errorCode.value = 'RENDER_FAILED'
      }
    } finally {
      busy.value = false
      void useBillingStore().refresh()
    }
  }

  async function startBatch(opts: {
    sceneId: string
    glb: Blob
    width: number
    height: number
    format?: 'png' | 'jpg'
    viewIds: string[]
    sceneSnapshot?: RenderSceneDocumentV2
  }) {
    error.value = ''
    errorCode.value = ''
    clearResultCache()
    busy.value = true
    try {
      const batch = await renderBatchCreate(
        opts.sceneId,
        {
          glb: opts.glb,
          width: opts.width,
          height: opts.height,
          format: opts.format || 'png',
          viewIds: opts.viewIds,
          scene_snapshot: opts.sceneSnapshot,
        },
        crypto.randomUUID(),
      )
      currentBatch.value = batch
      if (batch.status === 'queued' || batch.status === 'running') {
        await pollBatch(batch.id)
      } else if (batch.status === 'succeeded' || batch.status === 'partial') {
        await downloadBatch()
      } else if (batch.status === 'failed') {
        error.value = batch.error_message || batch.error_code || 'failed'
        errorCode.value = batch.error_code || 'RENDER_FAILED'
      }
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        error.value = e.message
        errorCode.value = e.code
        if (e.code === 'EXPORT_QUOTA_EXCEEDED' && e.data && typeof e.data === 'object') {
          useBillingStore().applyEntitlement(e.data as Entitlement)
        }
      } else {
        error.value = 'render_failed'
        errorCode.value = 'RENDER_FAILED'
      }
    } finally {
      busy.value = false
      void useBillingStore().refresh()
    }
  }

  async function fetchAndCacheJob(jobId: string): Promise<CachedResult> {
    const cached = resultCache.value[jobId]
    if (cached) return cached
    const pending = inflightFetches.get(jobId)
    if (pending) return pending
    const request = (async () => {
      const { blob, filename } = await renderJobDownload(jobId)
      cacheResult(jobId, blob, filename)
      return { blob, filename }
    })()
    inflightFetches.set(jobId, request)
    try {
      return await request
    } finally {
      inflightFetches.delete(jobId)
    }
  }

  async function download() {
    if (!currentJob.value || currentJob.value.status !== 'succeeded') {
      error.value = error.value || 'render_not_ready'
      errorCode.value = errorCode.value || 'RENDER_NOT_READY'
      return
    }
    const jobId = currentJob.value.id
    busy.value = true
    error.value = ''
    errorCode.value = ''
    try {
      const { blob, filename } = await fetchAndCacheJob(jobId)
      triggerBlobDownload(blob, filename)
    } catch (e: unknown) {
      // Server may have already deleted the ephemeral file after first download.
      const cached = resultCache.value[jobId]
      if (cached) {
        triggerBlobDownload(cached.blob, cached.filename)
        error.value = ''
        errorCode.value = ''
        return
      }
      const code = e instanceof ApiError ? e.code : 'RENDER_DOWNLOAD_FAILED'
      // Do not overwrite a successful render with a soft download miss.
      if (code === 'ASSET_MISSING' || code === 'RENDER_NOT_READY') {
        error.value = ''
        errorCode.value = ''
        return
      }
      error.value = e instanceof Error ? e.message : 'download_failed'
      errorCode.value = code
    } finally {
      busy.value = false
    }
  }

  async function downloadBatch() {
    const batch = currentBatch.value
    if (!batch?.job_ids?.length) {
      // Fall back to single job if batch metadata is missing.
      await download()
      return
    }
    busy.value = true
    error.value = ''
    errorCode.value = ''
    try {
      let downloaded = 0
      for (const jobId of batch.job_ids) {
        const job = await renderJobGet(jobId)
        if (job.status !== 'succeeded') continue
        try {
          const { blob, filename } = await fetchAndCacheJob(jobId)
          triggerBlobDownload(blob, filename)
          downloaded += 1
        } catch (e: unknown) {
          const cached = resultCache.value[jobId]
          if (cached) {
            triggerBlobDownload(cached.blob, cached.filename)
            downloaded += 1
          } else {
            const code = e instanceof ApiError ? e.code : ''
            if (code !== 'ASSET_MISSING' && code !== 'RENDER_NOT_READY') throw e
          }
        }
        // Small gap so browsers don't collapse multiple downloads.
        await sleep(300, (id) => {
          pollTimer = id
        })
      }
      if (!downloaded) {
        error.value = 'render_not_ready'
        errorCode.value = 'RENDER_NOT_READY'
      }
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'download_failed'
      errorCode.value = e instanceof ApiError ? e.code : 'RENDER_DOWNLOAD_FAILED'
    } finally {
      busy.value = false
    }
  }

  function reset() {
    stopPoll()
    currentJob.value = null
    currentBatch.value = null
    busy.value = false
    error.value = ''
    errorCode.value = ''
    clearResultCache()
  }

  return {
    currentJob,
    currentBatch,
    busy,
    error,
    errorCode,
    resultCache,
    start,
    startBatch,
    download,
    downloadBatch,
    reset,
  }
})
