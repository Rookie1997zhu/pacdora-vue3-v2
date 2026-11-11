import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type {
  ArtworkLayer,
  CropBox,
  DesignDocumentV1,
  ShapeStyle,
  TextStyle,
} from '../../packages/design-schema/designDocument'
import type { ParamLimits } from '../api/catalog'
import { ApiError } from '../api/client'
import { fetchDesign, saveDesignRevision, uploadAsset } from '../api/designs'
import { revokeAllAssetUrls } from '../studio/assetUrl'
import { geometryFingerprint, migrateLayers } from '../studio/artworkResize'
import { clearDraft, loadDraft, saveDraft } from '../studio/draftRepository'
import { buildStudioKnife } from '../studio/knifeAdapter'

function newIdempotencyKey() {
  return crypto.randomUUID()
}

function cloneDoc(doc: DesignDocumentV1): DesignDocumentV1 {
  return JSON.parse(JSON.stringify(doc)) as DesignDocumentV1
}

const SIZE_KEYS = new Set(['lengthMm', 'widthMm', 'heightMm', 'thicknessMm', 'sizeMode', 'bleedInputMm'])

const LIMIT_FIELD_MAP: Array<{ param: 'lengthMm' | 'widthMm' | 'heightMm'; limit: keyof ParamLimits }> = [
  { param: 'lengthMm', limit: 'length' },
  { param: 'widthMm', limit: 'width' },
  { param: 'heightMm', limit: 'height' },
]

function findOutOfRangeField(
  params: DesignDocumentV1['geometry']['params'],
  limits: ParamLimits | null,
): string | null {
  if (!limits) return null
  for (const { param, limit } of LIMIT_FIELD_MAP) {
    const range = limits[limit]
    if (!Array.isArray(range) || range.length !== 2) continue
    const val = Number(params[param])
    if (!Number.isFinite(val) || val < range[0] || val > range[1]) return param
  }
  return null
}

export const useDesignStore = defineStore('design', () => {
  const designId = ref<string | null>(null)
  const name = ref('')
  const rowVersion = ref(1)
  const currentRevisionId = ref<string | null>(null)
  const document = ref<DesignDocumentV1 | null>(null)
  const dirty = ref(false)
  const saving = ref(false)
  const conflict = ref(false)
  const lastSavedAt = ref<string | null>(null)
  const error = ref('')
  const errorCode = ref('')
  const saveStatus = ref<'idle' | 'dirty' | 'saving' | 'saved' | 'conflict' | 'error'>('idle')
  const selectedLayerId = ref<string | null>(null)
  const selectedPanelId = ref<string | null>(null)
  const editSide = ref<'outside' | 'inside'>('outside')
  const showBleed = ref(true)
  const showCut = ref(true)

  try {
    const raw = localStorage.getItem('boxcraft.studio.uiPrefs')
    if (raw) {
      const prefs = JSON.parse(raw) as { showBleed?: boolean; showCut?: boolean }
      if (typeof prefs.showBleed === 'boolean') showBleed.value = prefs.showBleed
      if (typeof prefs.showCut === 'boolean') showCut.value = prefs.showCut
    }
  } catch {
    /* ignore */
  }

  function persistUiPrefs() {
    try {
      localStorage.setItem(
        'boxcraft.studio.uiPrefs',
        JSON.stringify({ showBleed: showBleed.value, showCut: showCut.value }),
      )
    } catch {
      /* ignore */
    }
  }

  watch([showBleed, showCut], () => persistUiPrefs())
  const sizeLockedReason = ref('')
  const paramLimits = ref<ParamLimits | null>(null)
  const canExportManufacturing = ref(false)
  const draftPrompt = ref<'none' | 'recover' | 'server_newer'>('none')
  const pendingDraft = ref<DesignDocumentV1 | null>(null)

  const past = ref<DesignDocumentV1[]>([])
  const future = ref<DesignDocumentV1[]>([])

  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let pendingIdemKey: string | null = null
  let historySuspended = false

  const editableSize = computed(() => document.value?.geometry.mode === 'parametric')

  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)
  const layers = computed(() => document.value?.artwork.layers || [])
  const selectedLayer = computed(
    () => layers.value.find((l) => l.id === selectedLayerId.value) || null,
  )
  const pendingAdaptLayers = computed(() =>
    layers.value.filter(
      (l) => l.adaptStatus === 'needs_adapt' || l.adaptStatus === 'needs_rebind',
    ),
  )
  const pendingAdaptCount = computed(() => pendingAdaptLayers.value.length)

  function pushHistory() {
    if (historySuspended || !document.value) return
    past.value = [...past.value.slice(-49), cloneDoc(document.value)]
    future.value = []
  }

  function applyDocument(next: DesignDocumentV1, opts?: { history?: boolean; dirty?: boolean }) {
    if (opts?.history !== false) pushHistory()
    document.value = next
    if (opts?.dirty !== false) markDirty(true)
  }

  async function persistLocalDraft() {
    if (!designId.value || !document.value) return
    try {
      await saveDraft({
        designId: designId.value,
        rowVersion: rowVersion.value,
        document: cloneDoc(document.value),
        updatedAt: new Date().toISOString(),
        dirty: dirty.value,
      })
    } catch {
      /* ignore quota */
    }
  }

  async function load(id: string) {
    error.value = ''
    errorCode.value = ''
    conflict.value = false
    sizeLockedReason.value = ''
    draftPrompt.value = 'none'
    pendingDraft.value = null
    past.value = []
    future.value = []
    selectedLayerId.value = null
    selectedPanelId.value = null
    const detail = await fetchDesign(id)
    designId.value = detail.id
    name.value = detail.name
    rowVersion.value = detail.row_version
    currentRevisionId.value = detail.current_revision_id
    document.value = detail.content
    paramLimits.value = detail.param_limits || null
    canExportManufacturing.value = Boolean(detail.capabilities?.canExportManufacturing)
    dirty.value = false
    saveStatus.value = 'saved'
    lastSavedAt.value = detail.updated_at

    try {
      const draft = await loadDraft(id)
      if (draft?.document && draft.dirty) {
        if (draft.rowVersion < detail.row_version) {
          draftPrompt.value = 'server_newer'
          pendingDraft.value = draft.document
        } else if (draft.rowVersion <= detail.row_version) {
          draftPrompt.value = 'recover'
          pendingDraft.value = draft.document
        }
      }
    } catch {
      /* ignore */
    }
  }

  function acceptDraft() {
    if (!pendingDraft.value) return
    document.value = cloneDoc(pendingDraft.value)
    dirty.value = true
    saveStatus.value = 'dirty'
    draftPrompt.value = 'none'
    pendingDraft.value = null
    scheduleAutosave()
  }

  function discardDraft() {
    draftPrompt.value = 'none'
    pendingDraft.value = null
    if (designId.value) void clearDraft(designId.value)
  }

  function markDirty(schedule = true) {
    if (!document.value) return
    dirty.value = true
    conflict.value = false
    saveStatus.value = 'dirty'
    void persistLocalDraft()
    if (schedule) scheduleAutosave()
  }

  function requirePanel(panelId?: string | null) {
    const target = panelId || selectedPanelId.value
    if (!target) {
      error.value = '请先选择刀版面板'
      return null
    }
    return target
  }

  function nextZ() {
    return (document.value?.artwork.layers.length || 0) + 1
  }

  function updateParams(partial: Partial<DesignDocumentV1['geometry']['params']>) {
    if (!document.value) return
    const touchingSize = Object.keys(partial).some((k) => SIZE_KEYS.has(k))
    if (document.value.geometry.mode !== 'parametric' && touchingSize) {
      sizeLockedReason.value = 'fixed'
      errorCode.value = 'SIZE_LOCKED'
      error.value = '固定快照产品不可改尺'
      return
    }
    sizeLockedReason.value = ''
    error.value = ''
    errorCode.value = ''

    const nextParams = { ...document.value.geometry.params, ...partial }
    if (touchingSize && findOutOfRangeField(nextParams, paramLimits.value)) {
      errorCode.value = 'OUT_OF_RANGE'
      error.value = 'OUT_OF_RANGE'
      return
    }

    let nextLayers = document.value.artwork.layers
    const staged: DesignDocumentV1 = {
      ...document.value,
      geometry: { ...document.value.geometry, params: nextParams },
    }
    const nextHash = geometryFingerprint(staged)

    if (touchingSize && nextLayers.length > 0) {
      try {
        const oldKnife = buildStudioKnife(document.value)
        const newKnife = buildStudioKnife(staged)
        nextLayers = migrateLayers(nextLayers, oldKnife, newKnife, nextHash)
      } catch (e: unknown) {
        error.value = e instanceof Error ? e.message : 'resize migrate failed'
        return
      }
    }

    applyDocument({
      ...document.value,
      geometry: {
        ...document.value.geometry,
        params: nextParams,
      },
      artwork: {
        ...document.value.artwork,
        layers: nextLayers,
      },
    })
  }

  function updateOutbox(partial: Partial<NonNullable<DesignDocumentV1['outbox']>>) {
    if (!document.value) return
    const prev = document.value.outbox || {
      enabled: false,
      sizingMode: 'grow' as const,
      quantity: 1,
      thicknessMm: 3,
      gapsMm: { length: 5, width: 5, height: 5 },
      fixedInnerMm: null,
      manualLayout: null,
      catalogPresetId: null,
    }
    const next = {
      ...prev,
      ...partial,
      gapsMm: { ...prev.gapsMm, ...(partial.gapsMm || {}) },
    }
    if ('fixedInnerMm' in partial) next.fixedInnerMm = partial.fixedInnerMm ?? null
    if ('manualLayout' in partial) next.manualLayout = partial.manualLayout ?? null
    if (!next.enabled) {
      // Keep fields for restore, but UI/3D must treat disabled as no packing.
      next.enabled = false
    }
    applyDocument({
      ...document.value,
      outbox: next,
    })
  }

  function updateLayer(layerId: string, patch: Partial<ArtworkLayer>) {
    if (!document.value) return
    const layersNext = document.value.artwork.layers.map((l) =>
      l.id === layerId ? ({ ...l, ...patch } as ArtworkLayer) : l,
    )
    applyDocument({
      ...document.value,
      artwork: { ...document.value.artwork, layers: layersNext },
    })
  }

  function setCrop(layerId: string, crop: CropBox | null) {
    updateLayer(layerId, { crop })
  }

  function selectLayer(id: string | null) {
    selectedLayerId.value = id
  }

  function selectPanel(id: string | null) {
    selectedPanelId.value = id
  }

  function layerGeomMeta(): Pick<ArtworkLayer, 'sourceGeometryHash' | 'adaptStatus' | 'side'> {
    return {
      side: editSide.value,
      sourceGeometryHash: document.value ? geometryFingerprint(document.value) : null,
      adaptStatus: 'ok',
    }
  }

  function clearLayerAdapt(layerId: string) {
    if (!document.value) return
    const hash = geometryFingerprint(document.value)
    updateLayer(layerId, { adaptStatus: 'ok', sourceGeometryHash: hash })
  }

  function rebindLayerToSelectedPanel(layerId: string) {
    if (!document.value) return
    const target = requirePanel()
    if (!target) return
    const hash = geometryFingerprint(document.value)
    updateLayer(layerId, {
      panelId: target,
      adaptStatus: 'ok',
      sourceGeometryHash: hash,
    })
  }

  async function addImageLayer(file: File, panelId?: string | null) {
    if (!document.value) return
    const targetPanel = requirePanel(panelId)
    if (!targetPanel) return
    const asset = await uploadAsset(file)
    const layer: ArtworkLayer = {
      id: crypto.randomUUID(),
      kind: 'image',
      name: file.name || 'image',
      coordinateSpace: 'panel_mm',
      panelId: targetPanel,
      pieceId: null,
      ...layerGeomMeta(),
      transform: { xMm: 10, yMm: 10, rotationDeg: 0, scaleX: 1, scaleY: 1 },
      widthMm: 50,
      heightMm: 50,
      visible: true,
      locked: false,
      opacity: 1,
      zIndex: nextZ(),
      clip: 'panel',
      assetId: asset.id,
      text: null,
      shape: null,
      crop: null,
      resizePolicy: 'keep_mm',
      anchor: null,
    }
    applyDocument({
      ...document.value,
      artwork: {
        ...document.value.artwork,
        layers: [...document.value.artwork.layers, layer],
      },
    })
    selectedLayerId.value = layer.id
  }

  function addTextLayer(panelId?: string | null, text?: Partial<TextStyle>) {
    if (!document.value) return
    const targetPanel = requirePanel(panelId)
    if (!targetPanel) return
    const style: TextStyle = {
      content: text?.content || 'Text',
      fontFamily: text?.fontFamily || 'Noto Sans SC',
      fontSizeMm: text?.fontSizeMm ?? 8,
      fill: text?.fill || '#16343c',
      align: text?.align || 'left',
    }
    const layer: ArtworkLayer = {
      id: crypto.randomUUID(),
      kind: 'text',
      name: style.content.slice(0, 24) || 'text',
      coordinateSpace: 'panel_mm',
      panelId: targetPanel,
      pieceId: null,
      ...layerGeomMeta(),
      transform: { xMm: 12, yMm: 12, rotationDeg: 0, scaleX: 1, scaleY: 1 },
      widthMm: 60,
      heightMm: 20,
      visible: true,
      locked: false,
      opacity: 1,
      zIndex: nextZ(),
      clip: 'panel',
      assetId: null,
      text: style,
      shape: null,
      crop: null,
      resizePolicy: 'keep_mm',
      anchor: null,
    }
    applyDocument({
      ...document.value,
      artwork: { ...document.value.artwork, layers: [...document.value.artwork.layers, layer] },
    })
    selectedLayerId.value = layer.id
  }

  function addShapeLayer(shapeType: ShapeStyle['shapeType'], panelId?: string | null) {
    if (!document.value) return
    const targetPanel = requirePanel(panelId)
    if (!targetPanel) return
    const shape: ShapeStyle = {
      shapeType,
      fill: shapeType === 'rect' ? '#0f6e6833' : '#c45c2633',
      stroke: '#0f6e68',
      strokeWidthMm: 0.4,
    }
    const layer: ArtworkLayer = {
      id: crypto.randomUUID(),
      kind: 'shape',
      name: shapeType,
      coordinateSpace: 'panel_mm',
      panelId: targetPanel,
      pieceId: null,
      ...layerGeomMeta(),
      transform: { xMm: 15, yMm: 15, rotationDeg: 0, scaleX: 1, scaleY: 1 },
      widthMm: 40,
      heightMm: 30,
      visible: true,
      locked: false,
      opacity: 1,
      zIndex: nextZ(),
      clip: 'panel',
      assetId: null,
      text: null,
      shape,
      crop: null,
      resizePolicy: 'keep_mm',
      anchor: null,
    }
    applyDocument({
      ...document.value,
      artwork: { ...document.value.artwork, layers: [...document.value.artwork.layers, layer] },
    })
    selectedLayerId.value = layer.id
  }

  function setLayerVisible(layerId: string, visible: boolean) {
    updateLayer(layerId, { visible })
  }

  function setLayerLocked(layerId: string, locked: boolean) {
    updateLayer(layerId, { locked })
  }

  function deleteLayer(layerId: string) {
    if (!document.value) return
    applyDocument({
      ...document.value,
      artwork: {
        ...document.value.artwork,
        layers: document.value.artwork.layers.filter((l) => l.id !== layerId),
      },
    })
    if (selectedLayerId.value === layerId) selectedLayerId.value = null
  }

  function duplicateLayer(layerId: string) {
    if (!document.value) return
    const src = document.value.artwork.layers.find((l) => l.id === layerId)
    if (!src) return
    const copy = {
      ...JSON.parse(JSON.stringify(src)),
      id: crypto.randomUUID(),
      name: `${src.name} copy`,
      zIndex: nextZ(),
      transform: {
        ...src.transform,
        xMm: src.transform.xMm + 5,
        yMm: src.transform.yMm + 5,
      },
    } as ArtworkLayer
    applyDocument({
      ...document.value,
      artwork: {
        ...document.value.artwork,
        layers: [...document.value.artwork.layers, copy],
      },
    })
    selectedLayerId.value = copy.id
  }

  function reorderLayer(layerId: string, direction: 'up' | 'down') {
    if (!document.value) return
    const sorted = [...document.value.artwork.layers].sort((a, b) => a.zIndex - b.zIndex)
    const idx = sorted.findIndex((l) => l.id === layerId)
    if (idx < 0) return
    const swapWith = direction === 'up' ? idx + 1 : idx - 1
    if (swapWith < 0 || swapWith >= sorted.length) return
    const a = sorted[idx]
    const b = sorted[swapWith]
    const layersNext = document.value.artwork.layers.map((l) => {
      if (l.id === a.id) return { ...l, zIndex: b.zIndex }
      if (l.id === b.id) return { ...l, zIndex: a.zIndex }
      return l
    })
    applyDocument({
      ...document.value,
      artwork: { ...document.value.artwork, layers: layersNext },
    })
  }

  function undo() {
    if (!document.value || past.value.length === 0) return
    future.value = [...future.value, cloneDoc(document.value)]
    const prev = past.value[past.value.length - 1]
    past.value = past.value.slice(0, -1)
    historySuspended = true
    document.value = prev
    historySuspended = false
    markDirty()
  }

  function redo() {
    if (!document.value || future.value.length === 0) return
    past.value = [...past.value, cloneDoc(document.value)]
    const next = future.value[future.value.length - 1]
    future.value = future.value.slice(0, -1)
    historySuspended = true
    document.value = next
    historySuspended = false
    markDirty()
  }

  function scheduleAutosave() {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      void save()
    }, 1500)
  }

  async function save(force = false) {
    if (!designId.value || !document.value) return
    if (!dirty.value && !force) return
    if (conflict.value) return
    if (saving.value) return
    saving.value = true
    saveStatus.value = 'saving'
    error.value = ''
    errorCode.value = ''
    if (findOutOfRangeField(document.value.geometry.params, paramLimits.value)) {
      saving.value = false
      saveStatus.value = 'error'
      errorCode.value = 'OUT_OF_RANGE'
      error.value = 'OUT_OF_RANGE'
      return
    }
    if (!pendingIdemKey) pendingIdemKey = newIdempotencyKey()
    const key = pendingIdemKey
    try {
      const result = await saveDesignRevision(
        designId.value,
        { content: document.value, expected_row_version: rowVersion.value },
        key,
      )
      historySuspended = true
      document.value = result.content
      historySuspended = false
      rowVersion.value = result.row_version
      currentRevisionId.value = result.revision.id
      dirty.value = false
      pendingIdemKey = null
      lastSavedAt.value = result.revision.created_at
      saveStatus.value = 'saved'
      await clearDraft(designId.value)
    } catch (e: unknown) {
      await persistLocalDraft()
      if (e instanceof ApiError && e.code === 'DESIGN_VERSION_CONFLICT') {
        conflict.value = true
        saveStatus.value = 'conflict'
        error.value = e.message
      } else if (e instanceof ApiError && e.code === 'OUT_OF_RANGE') {
        saveStatus.value = 'error'
        errorCode.value = 'OUT_OF_RANGE'
        error.value = 'OUT_OF_RANGE'
      } else {
        saveStatus.value = 'error'
        error.value = e instanceof Error ? e.message : 'save failed'
      }
    } finally {
      saving.value = false
    }
  }

  async function reloadAfterConflict() {
    if (!designId.value) return
    await load(designId.value)
    pendingIdemKey = null
  }

  function reset() {
    if (debounceTimer) clearTimeout(debounceTimer)
    revokeAllAssetUrls()
    designId.value = null
    name.value = ''
    currentRevisionId.value = null
    document.value = null
    dirty.value = false
    saving.value = false
    conflict.value = false
    error.value = ''
    errorCode.value = ''
    saveStatus.value = 'idle'
    pendingIdemKey = null
    selectedLayerId.value = null
    selectedPanelId.value = null
    editSide.value = 'outside'
    showBleed.value = true
    showCut.value = true
    sizeLockedReason.value = ''
    paramLimits.value = null
    canExportManufacturing.value = false
    draftPrompt.value = 'none'
    pendingDraft.value = null
    past.value = []
    future.value = []
  }

  return {
    designId,
    name,
    rowVersion,
    currentRevisionId,
    document,
    dirty,
    saving,
    conflict,
    lastSavedAt,
    error,
    errorCode,
    saveStatus,
    selectedLayerId,
    selectedPanelId,
    editSide,
    showBleed,
    showCut,
    selectedLayer,
    pendingAdaptLayers,
    pendingAdaptCount,
    sizeLockedReason,
    paramLimits,
    canExportManufacturing,
    draftPrompt,
    pendingDraft,
    editableSize,
    canUndo,
    canRedo,
    layers,
    load,
    acceptDraft,
    discardDraft,
    markDirty,
    updateParams,
    updateOutbox,
    updateLayer,
    setCrop,
    selectLayer,
    selectPanel,
    clearLayerAdapt,
    rebindLayerToSelectedPanel,
    addImageLayer,
    addTextLayer,
    addShapeLayer,
    setLayerVisible,
    setLayerLocked,
    deleteLayer,
    duplicateLayer,
    reorderLayer,
    undo,
    redo,
    save,
    reloadAfterConflict,
    reset,
  }
})
