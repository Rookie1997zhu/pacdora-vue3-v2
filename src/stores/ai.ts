import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  applyAiJob,
  cancelAiJob,
  createAiJob,
  fetchAiCapabilities,
  fetchAiJob,
  fetchGeneratedAssets,
  type AiCapabilities,
  type AiJob,
  type GeneratedAssetItem,
} from '../api/ai'
import { ApiError } from '../api/client'
import { buildStudioKnifeAsync } from '../studio/knifeAdapter'
import { buildNetRegistration } from '../studio/netMasks'
import { useDesignStore } from './design'

export type AiMode = 'image' | 'main_area'

export const useAiStore = defineStore('ai', () => {
  const capabilities = ref<AiCapabilities | null>(null)
  const mode = ref<AiMode>('image')
  const prompt = ref('')
  const currentJob = ref<AiJob | null>(null)
  const gallery = ref<GeneratedAssetItem[]>([])
  const busy = ref(false)
  const error = ref('')
  let pollTimer: ReturnType<typeof setTimeout> | null = null

  const imageGenerate = computed(() => {
    const op = capabilities.value?.operations?.find((o) => o.operation === 'image_generate')
    return op || { operation: 'image_generate', enabled: false, reason: 'unknown' }
  })

  const mainAreaGenerate = computed(() => {
    const op = capabilities.value?.operations?.find((o) => o.operation === 'main_area_generate')
    return op || { operation: 'main_area_generate', enabled: false, reason: 'unknown' }
  })

  const activeCapability = computed(() =>
    mode.value === 'main_area' ? mainAreaGenerate.value : imageGenerate.value,
  )

  async function loadCapabilities() {
    capabilities.value = await fetchAiCapabilities()
  }

  async function loadGallery(designId: string) {
    gallery.value = await fetchGeneratedAssets(designId)
  }

  function stopPoll() {
    if (pollTimer) clearTimeout(pollTimer)
    pollTimer = null
  }

  async function pollJob(jobId: string) {
    stopPoll()
    const job = await fetchAiJob(jobId)
    currentJob.value = job
    if (job.status === 'queued' || job.status === 'running') {
      pollTimer = setTimeout(() => {
        void pollJob(jobId)
      }, 1200)
      return
    }
    if (job.status === 'succeeded' && job.design_id) {
      await loadGallery(job.design_id)
    }
  }

  async function generate(designId: string) {
    error.value = ''
    if (!activeCapability.value.enabled) {
      error.value = activeCapability.value.reason || 'unavailable'
      return
    }
    if (!prompt.value.trim()) {
      error.value = 'empty_prompt'
      return
    }
    busy.value = true
    try {
      const operation = mode.value === 'main_area' ? 'main_area_generate' : 'image_generate'
      const payload: { operation: string; prompt: string; registration?: Record<string, unknown> } = {
        operation,
        prompt: prompt.value.trim(),
      }
      if (operation === 'main_area_generate') {
        const design = useDesignStore()
        if (!design.document) {
          error.value = 'no_document'
          return
        }
        const knife = await buildStudioKnifeAsync(design.document)
        const registration = buildNetRegistration(
          knife,
          design.document.geometry.geometryHash || '',
        )
        payload.registration = registration as unknown as Record<string, unknown>
      }
      const job = await createAiJob(designId, payload, crypto.randomUUID())
      currentJob.value = job
      if (job.status === 'queued' || job.status === 'running') {
        await pollJob(job.id)
      } else if (job.status === 'succeeded') {
        await loadGallery(designId)
      } else if (job.status === 'failed') {
        error.value = job.error_message || job.error_code || 'failed'
      }
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'generate_failed'
    } finally {
      busy.value = false
    }
  }

  async function cancel() {
    if (!currentJob.value) return
    busy.value = true
    try {
      currentJob.value = await cancelAiJob(currentJob.value.id)
      stopPoll()
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'cancel_failed'
    } finally {
      busy.value = false
    }
  }

  async function apply(jobId: string, panelId?: string | null) {
    const design = useDesignStore()
    if (!design.designId || !design.document) return
    const item = gallery.value.find((g) => g.job_id === jobId)
    const op = item?.operation || currentJob.value?.operation || (mode.value === 'main_area' ? 'main_area_generate' : 'image_generate')
    const isMainArea = op === 'main_area_generate'

    if (!isMainArea && !panelId) {
      error.value = 'no_panel'
      return
    }

    busy.value = true
    error.value = ''
    try {
      if (isMainArea) {
        const knife = await buildStudioKnifeAsync(design.document)
        const registration = buildNetRegistration(
          knife,
          design.document.geometry.geometryHash || '',
        )
        await applyAiJob(jobId, {
          expected_row_version: design.rowVersion,
          side: design.editSide,
          width_mm: knife.widthMm,
          height_mm: knife.heightMm,
          origin_x_mm: knife.minX,
          origin_y_mm: knife.minY,
          registration: registration as unknown as Record<string, unknown>,
        })
      } else {
        await applyAiJob(jobId, {
          expected_row_version: design.rowVersion,
          panel_id: panelId || '',
          side: design.editSide,
        })
      }
      await design.load(design.designId)
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'apply_failed'
    } finally {
      busy.value = false
    }
  }

  function reset() {
    stopPoll()
    capabilities.value = null
    mode.value = 'image'
    prompt.value = ''
    currentJob.value = null
    gallery.value = []
    busy.value = false
    error.value = ''
  }

  return {
    capabilities,
    mode,
    prompt,
    currentJob,
    gallery,
    busy,
    error,
    imageGenerate,
    mainAreaGenerate,
    activeCapability,
    loadCapabilities,
    loadGallery,
    generate,
    cancel,
    apply,
    reset,
  }
})
