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
  // Params as the page first showed them. Until the user changes something there is nothing worth
  // saving, so merely opening a box must not add a design to "My designs".
  let baseline: string | null = null
  // The design was deleted (or is no longer ours): stop saving to it instead of retrying forever.
  let gone = false

  function fingerprint() {
    return JSON.stringify(wb.params)
  }

  function clientHash(): string {
    const k = knife.displayKnife
    return String(k?.geometryHash || k?.canonicalHash || 'pending')
  }

  /**
   * The browser engine does not compute the canonical geometry hash (it is produced by the geometry
   * service). Sending the 'pending' placeholder made the server report a drift on every save and
   * blocked export. Only send a hash when there is a real one to compare; otherwise the server's
   * geometry is authoritative.
   */
  function clientHashForServer(): string | undefined {
    // Fixed spec: the server derives its own hash from the locked size; there is nothing to compare
    if (wb.manifest?.locked) return undefined
    const h = clientHash()
    return h && h !== 'pending' ? h : undefined
  }

  /** Fixed-spec boxes are saved under their fixed-snapshot template (size locked on the server) */
  function saveTemplateId(): string {
    return wb.manifest?.locked?.templateKey || wb.manifest?.templateId || ''
  }

  function saveParams() {
    const params = { ...wb.params, advanced: { ...wb.params.advanced } }
    const fixed = wb.manifest?.locked ? wb.manifest.defaultParams : null
    // The size of a fixed spec is not the user's to change (a stale share link could carry other values)
    if (fixed) Object.assign(params, { lengthMm: fixed.lengthMm, widthMm: fixed.widthMm, heightMm: fixed.heightMm })
    return params
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
        templateId: saveTemplateId(),
        pieceId: wb.pieceId,
        templateVersion: '1',
        params: saveParams(),
        geometryHash: clientHash(),
      })
      const design = await createDesign({
        name,
        product_slug: wb.slug,
        content,
        client_geometry_hash: clientHashForServer(),
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

  type SaveOpts = { autosave?: boolean; force?: boolean; passive?: boolean }
  // One save at a time. Overlapping triggers (autosave timer, tab hidden, export) used to post the
  // same content twice; a call that arrives mid-save waits and then saves only if something changed.
  let inFlight: Promise<void> | null = null

  async function save(opts: SaveOpts = {}) {
    while (inFlight) await inFlight
    inFlight = saveNow(opts).finally(() => {
      inFlight = null
    })
    return inFlight
  }

  async function saveNow(opts: SaveOpts) {
    await bootstrapped
    if (gone) return
    if (!auth.isAuthenticated) return
    if (geometryDrift.value && !opts.force) return
    if (!wb.manifest) return
    if (knife.status === 'computing') return
    // An invalid size (e.g. the dieline falls apart, OUTLINE_BROKEN) is not written; the server rejects it too
    if (knife.status === 'invalid') return
    // Nothing changed since the last successful save: there is no new revision to write, even for a
    // forced checkpoint (export and tab-hidden call it every time). Force still re-saves after a drift.
    if (fingerprint() === lastSavedFingerprint && designId.value && revisionId.value && !(opts.force && geometryDrift.value)) {
      if (!geometryDrift.value) status.value = 'saved'
      return
    }
    if (!designId.value) {
      // Background saves (autosave timer, tab hidden) only create a design once the user has edited
      if ((opts.autosave || opts.passive) && (baseline === null || fingerprint() === baseline)) return
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
        templateId: saveTemplateId(),
        pieceId: wb.pieceId,
        templateVersion: '1',
        params: saveParams(),
        geometryHash: clientHash(),
      })
      const result = await saveDesignRevision(
        designId.value,
        {
          content,
          expected_row_version: rowVersion.value,
          autosave: !!opts.autosave,
          client_geometry_hash: clientHashForServer(),
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
      if (e instanceof ApiError && (e.status === 403 || e.status === 404)) gone = true
      status.value = 'error'
      errorMessage.value = e instanceof ApiError ? e.message : 'save_failed'
    }
  }

  function scheduleAutosave() {
    if (!auth.isAuthenticated) return
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

  // Resolves once the ?design= link has been looked up. Saving before that would create a
  // second design, because the session is restored asynchronously after the page mounts.
  let bootstrapped: Promise<void> = Promise.resolve()

  function waitForAuth(): Promise<void> {
    if (auth.loaded) return Promise.resolve()
    return new Promise((resolve) => {
      const stop = watch(
        () => auth.loaded,
        (v) => {
          if (v) {
            stop()
            resolve()
          }
        },
      )
    })
  }

  async function bootstrapFromRoute() {
    const qDesign = typeof route.query.design === 'string' ? route.query.design : ''
    const claim = route.query.claim === '1' || route.query.claim === 'true'
    await waitForAuth()
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
      if (saveTimer) {
        clearTimeout(saveTimer)
        saveTimer = null
      }
      void save({ force: true, passive: true })
    }
  }

  // Record the starting params once the box has loaded and its first dieline is computed
  const stopBaseline = watch(
    () => !!wb.manifest && knife.status !== 'computing' && knife.status !== 'idle',
    (ready) => {
      if (!ready || baseline !== null) return
      baseline = fingerprint()
      queueMicrotask(() => stopBaseline())
    },
    { immediate: true },
  )

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
    bootstrapped = bootstrapFromRoute().catch(() => {})
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
