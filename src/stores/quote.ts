import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ApiError } from '../api/client'
import { createQuote, fetchQuote, type Quote } from '../api/quotes'
import { useDesignStore } from './design'

export const useQuoteStore = defineStore('quote', () => {
  const current = ref<Quote | null>(null)
  const busy = ref(false)
  const error = ref('')
  const errorCode = ref('')

  function reset() {
    current.value = null
    busy.value = false
    error.value = ''
    errorCode.value = ''
  }

  async function requestQuote(quantity?: number) {
    const design = useDesignStore()
    error.value = ''
    errorCode.value = ''
    if (!design.currentRevisionId) {
      errorCode.value = 'NO_REVISION'
      error.value = 'NO_REVISION'
      return null
    }
    const qty = Math.max(1, Number(quantity ?? design.document?.outbox?.quantity ?? 1) || 1)
    busy.value = true
    try {
      if (design.dirty) {
        await design.save(true)
      }
      const revisionId = design.currentRevisionId
      if (!revisionId) {
        errorCode.value = 'NO_REVISION'
        error.value = 'NO_REVISION'
        return null
      }
      current.value = await createQuote({
        design_revision_id: revisionId,
        quantity: qty,
      })
      return current.value
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        errorCode.value = e.code
        error.value = e.message
      } else {
        error.value = e instanceof Error ? e.message : 'quote failed'
      }
      return null
    } finally {
      busy.value = false
    }
  }

  async function reload(id: string) {
    error.value = ''
    errorCode.value = ''
    busy.value = true
    try {
      current.value = await fetchQuote(id)
      return current.value
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        errorCode.value = e.code
        error.value = e.message
      } else {
        error.value = e instanceof Error ? e.message : 'quote failed'
      }
      return null
    } finally {
      busy.value = false
    }
  }

  return {
    current,
    busy,
    error,
    errorCode,
    reset,
    requestQuote,
    reload,
  }
})
