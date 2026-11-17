import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ENGINE_VERSION } from '../../../../packages/geometry-engine/index.js'
import type { DesignDocumentV1 } from '../../../../packages/design-schema/designDocument'
import { createDesign, fetchDesign, saveDesignRevision } from '../../../api/designs'
import { ApiError } from '../../../api/client'
import { useAuthStore } from '../../../stores/auth'
import { useKnifeStore } from '../stores/knife'
import { useWorkbenchStore } from '../stores/workbench'

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'conflict' | 'error' | 'drift'

function buildDocument(opts: {
  designId?: string | null
  locale: 'zh-CN' | 'ko-KR'
  slug: string
  templateId: string
  templateVersion: string
  params: DesignDocumentV1['geometry']['params']
  geometryHash: string
  pieceId?: string | null
}): DesignDocumentV1 {
  return {
    schemaVersion: 'boxcraft.design.v1',
    designId: opts.designId || undefined,
    locale: opts.locale,
    geometry: {
      mode: 'parametric',
      templateId: opts.templateId,
      templateVersion: opts.templateVersion,
      engineVersion: ENGINE_VERSION,
      pieceId: opts.pieceId || null,
      params: opts.params,
      geometryHash: opts.geometryHash,
    },
    artwork: { backgroundColor: null, layers: [] },
    workbench: {
      source: 'workbench',
      slug: opts.slug,
      clientEngineVersion: ENGINE_VERSION,
    },
    aiSettings: null,
    outbox: {
      enabled: false,
      sizingMode: 'grow',
      quantity: 1,
      thicknessMm: 3,
      gapsMm: { length: 5, width: 5, height: 5 },
    },
  }
}

export function useAutosave() {
  const route = useRoute()
  const router = useRouter()
  const auth = useAuthStore()
  const wb = useWorkbenchStore()
  const knife = useKnifeStore()

  const designId = ref<string | null>(null)
  const rowVersion = ref(1)
  const revisionId = ref<string | null>(null)
  const status = ref<SaveStatus>('idle')
  const errorMessage = ref('')
  const geometryDrift = ref(false)
  const exportBlocked = computed(() => geometryDrift.value || status.value === 'drift')

  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let creating = false
  let lastSavedFingerprint = ''

  function fingerprint() {
    return JSON.stringify(wb.params)
  }

  function clientHash(): string {
    const k = knife.displayKnife
    return String(k?.geometryHash || k?.canonicalHash || 'pending')
  }

  function locale(): 'zh-CN' | 'ko-KR' {
    return String(route.query.lang || '').startsWith('ko') ? 'ko-KR' : 'zh-CN'
  }

  function loginWithClaim() {
    const q = wb.toQueryString()
    const next = `${route.path}${q}${q.includes('?') ? '&' : '?'}claim=1`
    router.push({ name: 'login', query: { next } })
  }

  async function ensureDesign(): Promise<boolean> {
    // Fixed-spec boxes are view-only: there is no parametric template to save against
    if (wb.manifest?.locked) return false
    if (designId.value) return true
    if (!auth.isAuthenticated) {
      loginWithClaim()
      return false
    }
    if (!wb.manifest) return false
    if (creating) return false
    creating = true
    status.value = 'saving'
    try {
      const name = `${wb.manifest.labelEn || wb.manifest.labelZh} ${Math.round(wb.params.lengthMm)}x${Math.round(wb.params.widthMm)}x${Math.round(wb.params.heightMm)}`
      const content = buildDocument({
        locale: locale(),
        slug: wb.slug,
        templateId: wb.manifest.templateId,
        pieceId: wb.pieceId,
        templateVersion: '1',
        params: {
          ...wb.params,
          advanced: { ...wb.params.advanced },
        },
        geometryHash: clientHash(),
      })
      const design = await createDesign({
        name,
        product_slug: wb.slug,
        content,
        client_geometry_hash: clientHash(),
      })
      designId.value = design.id
      rowVersion.value = design.row_version
      revisionId.value = design.current_revision_id
      lastSavedFingerprint = fingerprint()
      status.value = 'saved'
      const query = { ...route.query, design: design.id }
      delete (query as Record<string, unknown>).claim
      await router.replace({ path: route.path, query })
      return true
    } catch (e) {
      status.value = 'error'
      errorMessage.value = e instanceof ApiError ? e.message : 'create_failed'
      return false
    } finally {
      creating = false
    }
  }

  async function save(opts: { autosave?: boolean; force?: boolean } = {}) {
    if (!auth.isAuthenticated) return
    if (wb.manifest?.locked) return
    if (geometryDrift.value && !opts.force) return
    if (!wb.manifest) return
    if (knife.status === 'computing') return
    if (!opts.force && fingerprint() === lastSavedFingerprint && designId.value) {
      status.value = 'saved'
      return
    }
    if (!designId.value) {
      const ok = await ensureDesign()
      if (!ok) return
      return
    }
    status.value = 'saving'
    try {
      const content = buildDocument({
        designId: designId.value,
        locale: locale(),
        slug: wb.slug,
        templateId: wb.manifest.templateId,
        pieceId: wb.pieceId,
        templateVersion: '1',
        params: {
          ...wb.params,
          advanced: { ...wb.params.advanced },
        },
        geometryHash: clientHash(),
      })
      const result = await saveDesignRevision(
        designId.value,
        {
          content,
          expected_row_version: rowVersion.value,
          autosave: !!opts.autosave,
          client_geometry_hash: clientHash(),
        },
        crypto.randomUUID(),
      )
      rowVersion.value = result.row_version
      revisionId.value = result.revision.id
      lastSavedFingerprint = fingerprint()
      if (result.geometry_drift) {
        geometryDrift.value = true
        status.value = 'drift'
      } else {
        status.value = 'saved'
      }
    } catch (e) {
      if (e instanceof ApiError && e.code === 'DESIGN_VERSION_CONFLICT') {
        status.value = 'conflict'
        errorMessage.value = e.message
        return
      }
      status.value = 'error'
      errorMessage.value = e instanceof ApiError ? e.message : 'save_failed'
    }
  }

  function scheduleAutosave() {
    if (!auth.isAuthenticated) return
    if (wb.manifest?.locked) return
    status.value = designId.value ? 'dirty' : status.value
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      void save({ autosave: true })
    }, 3000)
  }

  async function checkpoint() {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    await save({ autosave: false, force: true })
  }

  async function reloadAfterConflict() {
    if (!designId.value) return
    const design = await fetchDesign(designId.value)
    rowVersion.value = design.row_version
    revisionId.value = design.current_revision_id
    if (design.content?.geometry?.params) {
      const p = design.content.geometry.params
      wb.params = {
        lengthMm: p.lengthMm,
        widthMm: p.widthMm,
        heightMm: p.heightMm,
        thicknessMm: p.thicknessMm,
        sizeMode: p.sizeMode as any,
        materialId: p.materialId,
        fluteDirection: p.fluteDirection,
        bleedInputMm: p.bleedInputMm,
        advanced: { ...(p.advanced as Record<string, number>) },
      }
    }
    geometryDrift.value = false
    lastSavedFingerprint = fingerprint()
    status.value = 'saved'
  }

  async function bootstrapFromRoute() {
    const qDesign = typeof route.query.design === 'string' ? route.query.design : ''
    const claim = route.query.claim === '1' || route.query.claim === 'true'
    if (qDesign && auth.isAuthenticated) {
      designId.value = qDesign
      try {
        const design = await fetchDesign(qDesign)
        rowVersion.value = design.row_version
        revisionId.value = design.current_revision_id
        lastSavedFingerprint = fingerprint()
        status.value = 'saved'
      } catch {
        designId.value = null
      }
    }
    if (claim && auth.isAuthenticated && !designId.value) {
      await ensureDesign()
    }
  }

  function onVisibility() {
    if (document.visibilityState === 'hidden' && auth.isAuthenticated) {
      void checkpoint()
    }
  }

  watch(
    () => wb.params,
    () => {
      if (!auth.isAuthenticated) return
      scheduleAutosave()
    },
    { deep: true },
  )

  onMounted(() => {
    document.addEventListener('visibilitychange', onVisibility)
    void bootstrapFromRoute()
  })

  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisibility)
    if (saveTimer) clearTimeout(saveTimer)
  })

  return {
    designId,
    revisionId,
    rowVersion,
    status,
    errorMessage,
    geometryDrift,
    exportBlocked,
    ensureDesign,
    save,
    checkpoint,
    loginWithClaim,
    reloadAfterConflict,
    scheduleAutosave,
  }
}
