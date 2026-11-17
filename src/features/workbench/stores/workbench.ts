import { defineStore } from 'pinia'
import { getWorkbenchManifest, type WorkbenchManifest, type WorkbenchSizeMode } from '../manifest'
import { decodeWorkbenchUrl, encodeWorkbenchUrl } from '../lib/urlCodec.mjs'

export type WorkbenchParams = {
  lengthMm: number
  widthMm: number
  heightMm: number
  thicknessMm: number
  sizeMode: WorkbenchSizeMode
  materialId: string
  fluteDirection: 'L' | 'W'
  bleedInputMm: number
  advanced: Record<string, number>
}

export type WorkbenchView = {
  showBleed: boolean
  showTrim: boolean
  showCrease: boolean
  showDims: boolean
  showFaceNames: boolean
}

type Snapshot = WorkbenchParams

const VIEW_KEY = 'bc.workbench.view'
const DRAFT_PREFIX = 'bc.workbench.draft.'

function loadView(): WorkbenchView {
  try {
    const raw = localStorage.getItem(VIEW_KEY)
    if (raw) return { ...defaultView(), ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return defaultView()
}

function defaultView(): WorkbenchView {
  return { showBleed: true, showTrim: true, showCrease: true, showDims: true, showFaceNames: false }
}

function cloneParams(p: WorkbenchParams): Snapshot {
  return {
    ...p,
    advanced: { ...p.advanced },
  }
}

export const useWorkbenchStore = defineStore('workbench', {
  state: () => ({
    slug: '' as string,
    manifest: null as WorkbenchManifest | null,
    params: {
      lengthMm: 300,
      widthMm: 200,
      heightMm: 60,
      thicknessMm: 1.5,
      sizeMode: 'inner' as WorkbenchSizeMode,
      materialId: 'kraft',
      fluteDirection: 'L' as 'L' | 'W',
      bleedInputMm: 3,
      advanced: {} as Record<string, number>,
    },
    displayUnit: 'mm' as 'mm' | 'in',
    /** Multi-piece boxes: the piece currently shown (null = template default) */
    pieceId: null as string | null,
    view: loadView(),
    hover: { face: null as string | null, fold: null as string | null, param: null as string | null },
    past: [] as Snapshot[],
    future: [] as Snapshot[],
    _mergeTimer: null as ReturnType<typeof setTimeout> | null,
    _dirtySincePush: false,
  }),
  getters: {
    title(state) {
      if (!state.manifest) return state.slug
      return state.manifest.labelZh
    },
    canUndo: (s) => s.past.length > 0,
    canRedo: (s) => s.future.length > 0,
  },
  actions: {
    loadManifest(slug: string, manifest?: WorkbenchManifest | null) {
      const m = manifest ?? getWorkbenchManifest(slug)
      this.slug = slug
      this.manifest = m
      if (!m) return false
      this.params = cloneParams(m.defaultParams)
      this.pieceId = null
      this.displayUnit = 'mm'
      this.past = []
      this.future = []
      return true
    },
    loadFromUrl(search: string) {
      if (!this.manifest) return
      const decoded = decodeWorkbenchUrl(search, { defaults: this.manifest.defaultParams })
      this.params = {
        lengthMm: decoded.lengthMm ?? this.manifest.defaultParams.lengthMm,
        widthMm: decoded.widthMm ?? this.manifest.defaultParams.widthMm,
        heightMm: decoded.heightMm ?? this.manifest.defaultParams.heightMm,
        thicknessMm: decoded.thicknessMm ?? this.manifest.defaultParams.thicknessMm,
        sizeMode: decoded.sizeMode,
        materialId: decoded.materialId,
        fluteDirection: decoded.fluteDirection,
        bleedInputMm: decoded.bleedInputMm ?? 3,
        // URL carries only values that differ from this box's starting params
        advanced: { ...(this.manifest.defaultParams.advanced || {}), ...(decoded.advanced || {}) },
      }
      this.displayUnit = decoded.displayUnit
    },
    loadDraft() {
      if (!this.slug) return false
      try {
        const raw = localStorage.getItem(DRAFT_PREFIX + this.slug)
        if (!raw) return false
        const data = JSON.parse(raw)
        if (data?.params) {
          // Box starting params stay as the base: drafts saved before a template gained them must not blank them
          this.params = {
            ...this.params,
            ...data.params,
            advanced: { ...(this.manifest?.defaultParams.advanced || {}), ...(data.params.advanced || {}) },
          }
          if (data.displayUnit) this.displayUnit = data.displayUnit
          return true
        }
      } catch { /* ignore */ }
      return false
    },
    saveDraft() {
      if (!this.slug) return
      try {
        localStorage.setItem(DRAFT_PREFIX + this.slug, JSON.stringify({
          params: this.params,
          displayUnit: this.displayUnit,
          savedAt: Date.now(),
        }))
      } catch { /* ignore */ }
    },
    toQueryString() {
      if (!this.manifest) return ''
      const sp = encodeWorkbenchUrl(
        { ...this.params, displayUnit: this.displayUnit },
        this.manifest.defaultParams,
      )
      const s = sp.toString()
      return s ? `?${s}` : ''
    },
    _pushHistory() {
      this.past.push(cloneParams(this.params))
      if (this.past.length > 50) this.past.shift()
      this.future = []
      this._dirtySincePush = false
    },
    _scheduleHistory() {
      if (!this._dirtySincePush) {
        this._pushHistory()
        this._dirtySincePush = true
      }
      if (this._mergeTimer) clearTimeout(this._mergeTimer)
      this._mergeTimer = setTimeout(() => {
        this._dirtySincePush = false
        this.saveDraft()
      }, 600)
    },
    setDim(key: 'lengthMm' | 'widthMm' | 'heightMm', value: number) {
      if (!Number.isFinite(value)) return
      this._scheduleHistory()
      this.params[key] = value
    },
    setSizeMode(mode: WorkbenchSizeMode, fillFrom?: { length: number; width: number; height: number }) {
      this._scheduleHistory()
      this.params.sizeMode = mode
      if (fillFrom) {
        this.params.lengthMm = fillFrom.length
        this.params.widthMm = fillFrom.width
        this.params.heightMm = fillFrom.height
      }
    },
    setMaterial(id: string, thicknessMm?: number) {
      this._scheduleHistory()
      this.params.materialId = id
      if (thicknessMm != null && Number.isFinite(thicknessMm)) this.params.thicknessMm = thicknessMm
    },
    setThickness(v: number) {
      if (!Number.isFinite(v)) return
      this._scheduleHistory()
      this.params.thicknessMm = v
    },
    setBleed(v: number) {
      if (!Number.isFinite(v)) return
      this._scheduleHistory()
      this.params.bleedInputMm = Math.max(0, Math.min(10, v))
    },
    setFluteDirection(d: 'L' | 'W') {
      this._scheduleHistory()
      this.params.fluteDirection = d
    },
    setAdvanced(code: string, value: number | null) {
      this._scheduleHistory()
      if (value == null || !Number.isFinite(value)) {
        // Back to this box's own starting value when it has one, else to the template's auto value
        const next = { ...this.params.advanced }
        const preset = this.manifest?.defaultParams.advanced?.[code]
        if (preset != null && Number.isFinite(preset)) next[code] = preset
        else delete next[code]
        this.params.advanced = next
      } else {
        this.params.advanced = { ...this.params.advanced, [code]: value }
      }
    },
    resetAdvanced() {
      this._scheduleHistory()
      this.params.advanced = { ...(this.manifest?.defaultParams.advanced || {}) }
    },
    setPiece(id: string | null) {
      this.pieceId = id || null
    },
    setDisplayUnit(u: 'mm' | 'in') {
      this.displayUnit = u
      this.saveDraft()
    },
    setView(partial: Partial<WorkbenchView>) {
      this.view = { ...this.view, ...partial }
      try { localStorage.setItem(VIEW_KEY, JSON.stringify(this.view)) } catch { /* ignore */ }
    },
    setHover(partial: Partial<{ face: string | null; fold: string | null; param: string | null }>) {
      this.hover = { ...this.hover, ...partial }
    },
    undo() {
      if (!this.past.length) return
      this.future.unshift(cloneParams(this.params))
      this.params = this.past.pop()!
      this.saveDraft()
    },
    redo() {
      if (!this.future.length) return
      this.past.push(cloneParams(this.params))
      this.params = this.future.shift()!
      this.saveDraft()
    },
  },
})
