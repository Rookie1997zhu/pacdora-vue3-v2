import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  cancelExportJob,
  createExportJob,
  downloadExportJob,
  fetchExportJob,
  listExportJobs,
  retryExportJob,
  type ExportFormat,
  type ExportJob,
  type ExportOptions,
  type ExportTier,
} from '../api/exports'
import { ApiError } from '../api/client'
import type { Entitlement } from '../api/billing'
import { useBillingStore } from './billing'
import { useDesignStore } from './design'

export const useExportStore = defineStore('export', () => {
  const jobs = ref<Map<string, ExportJob>>(new Map())
  const activeJobId = ref<string | null>(null)
  const busy = ref(false)
  const error = ref('')
  const errorCode = ref('')
  const pollDelay = ref(1200)
  let pollTimer: ReturnType<typeof setTimeout> | null = null
  let hidden = false

  const currentJob = computed(() => {
    if (activeJobId.value && jobs.value.has(activeJobId.value)) {
      return jobs.value.get(activeJobId.value) || null
    }
    const list = [...jobs.value.values()]
    return list.length ? list[list.length - 1] : null
  })

  const jobList = computed(() =>
    [...jobs.value.values()].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))),
  )

  function upsert(job: ExportJob) {
    const next = new Map(jobs.value)
    next.set(job.id, job)
    jobs.value = next
    activeJobId.value = job.id
  }

  function stopPoll() {
    if (pollTimer) clearTimeout(pollTimer)
    pollTimer = null
  }

  function onVisibility() {
    hidden = document.visibilityState === 'hidden'
    if (!hidden && activeJobId.value) {
      const job = jobs.value.get(activeJobId.value)
      if (job && (job.status === 'queued' || job.status === 'running')) {
        void pollJob(activeJobId.value)
      }
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility)
  }

  async function pollJob(jobId: string) {
    stopPoll()
    if (hidden) return
    const job = await fetchExportJob(jobId)
    upsert(job)
    if (job.status === 'queued' || job.status === 'running') {
      const delay = pollDelay.value
      pollDelay.value = Math.min(4000, Math.round(delay * 1.5))
      pollTimer = setTimeout(() => {
        void pollJob(jobId)
      }, delay)
      return
    }
    pollDelay.value = 1200
    if (job.status === 'failed') {
      error.value = job.error_message || job.error_code || 'failed'
      errorCode.value = job.error_code || 'EXPORT_FAILED'
    }
  }

  async function restoreForDesign(designId: string) {
    try {
      const items = await listExportJobs({ design: designId })
      const next = new Map<string, ExportJob>()
      for (const job of items) next.set(job.id, job)
      jobs.value = next
      const running = items.find((j) => j.status === 'queued' || j.status === 'running')
      if (running) {
        activeJobId.value = running.id
        pollDelay.value = 1200
        await pollJob(running.id)
      }
    } catch {
      /* ignore restore errors */
    }
  }

  async function start(
    format: ExportFormat,
    qualityTier: ExportTier = 'vector_proof',
    options: ExportOptions = {},
    source: 'workbench' | 'studio' = 'studio',
  ) {
    const design = useDesignStore()
    error.value = ''
    errorCode.value = ''
    if (!design.designId) {
      error.value = 'no_design'
      return
    }
    if (!design.currentRevisionId) {
      error.value = 'no_revision'
      errorCode.value = 'NO_REVISION'
      return
    }
    busy.value = true
    try {
      const job = await createExportJob(
        design.designId,
        {
          format,
          quality_tier: qualityTier,
          revision_id: design.currentRevisionId,
          options,
          source,
        },
        crypto.randomUUID(),
      )
      upsert(job)
      pollDelay.value = 1200
      if (job.status === 'queued' || job.status === 'running') {
        await pollJob(job.id)
      } else if (job.status === 'failed') {
        error.value = job.error_message || job.error_code || 'failed'
        errorCode.value = job.error_code || 'EXPORT_FAILED'
      } else if (job.status === 'succeeded') {
        await downloadJob(job.id)
      }
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        error.value = e.message
        errorCode.value = e.code
        if (e.code === 'EXPORT_QUOTA_EXCEEDED' && e.data && typeof e.data === 'object') {
          useBillingStore().applyEntitlement(e.data as Entitlement)
        }
      } else {
        error.value = 'export_failed'
      }
    } finally {
      busy.value = false
      void useBillingStore().refresh()
    }
  }

  async function downloadJob(jobId?: string) {
    const id = jobId || currentJob.value?.id
    if (!id) return
    const job = jobs.value.get(id) || currentJob.value
    if (!job || job.status !== 'succeeded') return
    busy.value = true
    error.value = ''
    try {
      const { blob, filename } = await downloadExportJob(id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'download_failed'
      errorCode.value = e instanceof ApiError ? e.code : 'EXPORT_DOWNLOAD_FAILED'
    } finally {
      busy.value = false
    }
  }

  async function download() {
    await downloadJob()
  }

  async function cancel(jobId: string) {
    const job = await cancelExportJob(jobId)
    upsert(job)
    void useBillingStore().refresh()
  }

  async function retry(jobId: string) {
    const job = await retryExportJob(jobId)
    upsert(job)
    pollDelay.value = 1200
    if (job.status === 'queued' || job.status === 'running') await pollJob(job.id)
    void useBillingStore().refresh()
  }

  function reset() {
    stopPoll()
    jobs.value = new Map()
    activeJobId.value = null
    busy.value = false
    error.value = ''
    errorCode.value = ''
    pollDelay.value = 1200
  }

  return {
    jobs,
    jobList,
    currentJob,
    activeJobId,
    busy,
    error,
    errorCode,
    start,
    download,
    downloadJob,
    cancel,
    retry,
    restoreForDesign,
    reset,
  }
})
