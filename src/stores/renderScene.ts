import { defineStore } from 'pinia'
import { computed, ref, toRaw } from 'vue'
import { ApiError } from '../api/client'
import {
  renderSceneApplyTemplate,
  renderSceneCreate,
  renderSceneGet,
  renderSceneUpdate,
  type RenderSceneDetail,
} from '../api/renderScenes'
import {
  createDefaultRenderScene,
  normalizeRenderScene,
  type RenderSceneDocumentV2,
} from '../../packages/render-scene-schema/renderScene'

const HISTORY_LIMIT = 50

/** Vue reactive proxies are not structuredClone-able; JSON clone matches design store. */
function cloneDoc(doc: RenderSceneDocumentV2): RenderSceneDocumentV2 {
  return JSON.parse(JSON.stringify(toRaw(doc))) as RenderSceneDocumentV2
}

export const useRenderSceneStore = defineStore('renderScene', () => {
  const sceneId = ref<string | null>(null)
  const name = ref('未命名场景')
  const rowVersion = ref(1)
  const content = ref<RenderSceneDocumentV2>(createDefaultRenderScene())
  const dirty = ref(false)
  const saving = ref(false)
  const loading = ref(false)
  const error = ref('')
  const errorCode = ref('')
  const conflict = ref(false)
  const past = ref<RenderSceneDocumentV2[]>([])
  const future = ref<RenderSceneDocumentV2[]>([])

  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let saveSeq = 0
  let skipHistory = false

  const modelCount = computed(() => content.value.models.length)
  const propCount = computed(() => content.value.props.length)
  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)

  function pushHistory(prev: RenderSceneDocumentV2) {
    if (skipHistory) return
    past.value = [...past.value.slice(-(HISTORY_LIMIT - 1)), cloneDoc(prev)]
    future.value = []
  }

  function applyDetail(detail: RenderSceneDetail) {
    sceneId.value = detail.id
    name.value = detail.name
    rowVersion.value = detail.row_version
    content.value = normalizeRenderScene(detail.content)
    dirty.value = false
    conflict.value = false
    error.value = ''
    errorCode.value = ''
    past.value = []
    future.value = []
  }

  async function load(id: string) {
    loading.value = true
    error.value = ''
    try {
      const detail = await renderSceneGet(id)
      applyDetail(detail)
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'load_failed'
      errorCode.value = e instanceof ApiError ? e.code : 'LOAD_FAILED'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function create(payload?: {
    name?: string
    design_id?: string
    revision_id?: string | null
    content?: RenderSceneDocumentV2
  }) {
    loading.value = true
    error.value = ''
    try {
      const detail = await renderSceneCreate({
        name: payload?.name,
        design_id: payload?.design_id,
        revision_id: payload?.revision_id,
        content: payload?.content || createDefaultRenderScene(),
      })
      applyDetail(detail)
      return detail
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'create_failed'
      errorCode.value = e instanceof ApiError ? e.code : 'CREATE_FAILED'
      throw e
    } finally {
      loading.value = false
    }
  }

  function markDirty(next?: RenderSceneDocumentV2, opts?: { recordHistory?: boolean }) {
    if (next) {
      if (opts?.recordHistory !== false) pushHistory(content.value)
      content.value = normalizeRenderScene(next)
    } else if (opts?.recordHistory !== false) {
      pushHistory(content.value)
    }
    dirty.value = true
    scheduleSave()
  }

  function setName(next: string) {
    name.value = next
    dirty.value = true
    scheduleSave()
  }

  function undo() {
    if (!past.value.length) return
    const prev = past.value[past.value.length - 1]
    past.value = past.value.slice(0, -1)
    future.value = [...future.value, cloneDoc(content.value)]
    skipHistory = true
    content.value = normalizeRenderScene(prev)
    dirty.value = true
    scheduleSave()
    skipHistory = false
  }

  function redo() {
    if (!future.value.length) return
    const next = future.value[future.value.length - 1]
    future.value = future.value.slice(0, -1)
    past.value = [...past.value, cloneDoc(content.value)]
    skipHistory = true
    content.value = normalizeRenderScene(next)
    dirty.value = true
    scheduleSave()
    skipHistory = false
  }

  async function applyTemplate(payload: {
    templateId: string
    bindings: Array<{ slotId: string; designId: string; revisionId?: string | null }>
  }) {
    if (!sceneId.value) throw new Error('no scene')
    const detail = await renderSceneApplyTemplate(sceneId.value, {
      ...payload,
      expected_row_version: rowVersion.value,
    })
    pushHistory(content.value)
    applyDetail(detail)
    return detail
  }

  function scheduleSave(delayMs = 800) {
    if (!sceneId.value) return
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      void flushSave()
    }, delayMs)
  }

  async function flushSave() {
    if (!sceneId.value || !dirty.value || saving.value) return
    const seq = ++saveSeq
    saving.value = true
    error.value = ''
    errorCode.value = ''
    try {
      const detail = await renderSceneUpdate(sceneId.value, {
        expected_row_version: rowVersion.value,
        name: name.value,
        content: content.value,
      })
      if (seq !== saveSeq) return
      sceneId.value = detail.id
      name.value = detail.name
      rowVersion.value = detail.row_version
      content.value = normalizeRenderScene(detail.content)
      dirty.value = false
      conflict.value = false
      error.value = ''
      errorCode.value = ''
    } catch (e: unknown) {
      if (e instanceof ApiError && e.code === 'ROW_VERSION_CONFLICT') {
        conflict.value = true
        errorCode.value = e.code
        error.value = e.message
        const data = e.data as { row_version?: number; content?: unknown; name?: string } | undefined
        if (data?.content) {
          content.value = normalizeRenderScene(data.content)
          rowVersion.value = Number(data.row_version) || rowVersion.value
          if (data.name) name.value = data.name
          dirty.value = false
        }
      } else {
        error.value = e instanceof ApiError ? e.message : 'save_failed'
        errorCode.value = e instanceof ApiError ? e.code : 'SAVE_FAILED'
      }
    } finally {
      saving.value = false
    }
  }

  function reset() {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = null
    sceneId.value = null
    name.value = '未命名场景'
    rowVersion.value = 1
    content.value = createDefaultRenderScene()
    dirty.value = false
    saving.value = false
    loading.value = false
    error.value = ''
    errorCode.value = ''
    conflict.value = false
    past.value = []
    future.value = []
  }

  return {
    sceneId,
    name,
    rowVersion,
    content,
    dirty,
    saving,
    loading,
    error,
    errorCode,
    conflict,
    modelCount,
    propCount,
    canUndo,
    canRedo,
    load,
    create,
    markDirty,
    setName,
    undo,
    redo,
    applyTemplate,
    flushSave,
    reset,
  }
})
