import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  createExportJob,
  downloadExportJob,
  fetchExportJob,
  type ExportFormat,
  type ExportJob,
  type ExportTier,
} from '../api/exports'
import { ApiError } from '../api/client'
import { useDesignStore } from './design'

export const useExportStore = defineStore('export', () => {
  const currentJob = ref<ExportJob | null>(null)
  const busy = ref(false)
  const error = ref('')
  const errorCode = ref('')
  let pollTimer: ReturnType<typeof setTimeout> | null = null

  function stopPoll() {
    if (pollTimer) clearTimeout(pollTimer)
    pollTimer = null
  }

  async function pollJob(jobId: string) {
    stopPoll()
    const job = await fetchExportJob(jobId)
    currentJob.value = job
    if (job.status === 'queued' || job.status === 'running') {
      pollTimer = setTimeout(() => {
        void pollJob(jobId)
      }, 1200)
      return
    }
    if (job.status === 'failed') {
      error.value = job.error_message || job.error_code || 'failed'
      errorCode.value = job.error_code || 'EXPORT_FAILED'
    }
  }

  async function start(format: ExportFormat, qualityTier: ExportTier = 'vector_proof') {
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
        },
        crypto.randomUUID(),
      )
      currentJob.value = job
      if (job.status === 'queued' || job.status === 'running') {
        await pollJob(job.id)
      } else if (job.status === 'failed') {
        error.value = job.error_message || job.error_code || 'failed'
        errorCode.value = job.error_code || 'EXPORT_FAILED'
      }
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        error.value = e.message
        errorCode.value = e.code
      } else {
        error.value = 'export_failed'
      }
    } finally {
      busy.value = false
    }
  }

  async function download() {
    if (!currentJob.value || currentJob.value.status !== 'succeeded') return
    busy.value = true
    error.value = ''
    try {
      const { blob, filename } = await downloadExportJob(currentJob.value.id)
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

  function reset() {
    stopPoll()
    currentJob.value = null
    busy.value = false
    error.value = ''
    errorCode.value = ''
  }

  return {
    currentJob,
    busy,
    error,
    errorCode,
    start,
    download,
    reset,
  }
})
