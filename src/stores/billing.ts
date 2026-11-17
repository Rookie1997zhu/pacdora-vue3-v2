import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ApiError } from '../api/client'
import {
  fetchEntitlement,
  requestExportGrant,
  submitUpgradeIntent,
  type Entitlement,
} from '../api/billing'

export const useBillingStore = defineStore('billing', () => {
  const entitlement = ref<Entitlement | null>(null)
  const loaded = ref(false)
  const error = ref('')
  const errorCode = ref('')
  const busy = ref(false)

  const remainingLabel = computed(() => {
    const ent = entitlement.value
    if (!ent) return ''
    if (ent.unlimited) return '∞'
    return String(ent.remaining ?? 0)
  })

  const quotaExceeded = computed(
    () => !!entitlement.value && !entitlement.value.unlimited && (entitlement.value.remaining ?? 0) <= 0,
  )

  function applyEntitlement(ent: Entitlement | null | undefined) {
    if (ent) entitlement.value = ent
  }

  async function refresh() {
    error.value = ''
    errorCode.value = ''
    try {
      entitlement.value = await fetchEntitlement()
    } catch (e: unknown) {
      entitlement.value = null
      if (e instanceof ApiError && e.status === 401) return
      error.value = e instanceof Error ? e.message : 'entitlement_failed'
      errorCode.value = e instanceof ApiError ? e.code : 'ENTITLEMENT_FAILED'
    } finally {
      loaded.value = true
    }
  }

  async function grantForLabExport(format?: string) {
    busy.value = true
    error.value = ''
    errorCode.value = ''
    try {
      const result = await requestExportGrant(format)
      applyEntitlement(result.entitlement)
      return result
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        error.value = e.message
        errorCode.value = e.code
        if (e.data && typeof e.data === 'object') {
          applyEntitlement(e.data as Entitlement)
        }
      } else {
        error.value = 'grant_failed'
        errorCode.value = 'EXPORT_GRANT_FAILED'
      }
      throw e
    } finally {
      busy.value = false
    }
  }

  async function submitIntent(plan: string, note: string, contact: string) {
    busy.value = true
    error.value = ''
    errorCode.value = ''
    try {
      return await submitUpgradeIntent({ plan, note, contact })
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        error.value = e.message
        errorCode.value = e.code
      } else {
        error.value = 'intent_failed'
      }
      throw e
    } finally {
      busy.value = false
    }
  }

  function reset() {
    entitlement.value = null
    loaded.value = false
    error.value = ''
    errorCode.value = ''
    busy.value = false
  }

  return {
    entitlement,
    loaded,
    error,
    errorCode,
    busy,
    remainingLabel,
    quotaExceeded,
    applyEntitlement,
    refresh,
    grantForLabExport,
    submitIntent,
    reset,
  }
})
