import { defineStore } from 'pinia'
import { createEngineClient, type EngineClient } from '../engine/engineClient'
import { useWorkbenchStore } from './workbench'
import { computeKnifeStats } from '../../../../packages/geometry-engine/index.js'

export type KnifeStatus = 'idle' | 'computing' | 'ok' | 'invalid' | 'error'

export const useKnifeStore = defineStore('workbenchKnife', {
  state: () => ({
    knife: null as any,
    lastValid: null as any,
    status: 'idle' as KnifeStatus,
    issues: [] as any[],
    limits: null as Record<string, [number, number] | null> | null,
    computeMs: 0,
    lastSeq: 0,
    errorMessage: '' as string,
    _client: null as EngineClient | null,
    _watchStop: null as null | (() => void),
  }),
  getters: {
    displayKnife(state) {
      return state.knife || state.lastValid
    },
    blockingIssues(state) {
      return (state.issues || []).filter((i: any) => i.severity === 'blocking')
    },
  },
  actions: {
    ensureClient() {
      if (!this._client) this._client = createEngineClient()
      return this._client
    },
    async recompute() {
      const wb = useWorkbenchStore()
      if (!wb.manifest) return
      if (wb.manifest.locked) {
        // Fixed spec: show the captured reference dieline as is (no engine, no params)
        this.status = 'computing'
        try {
          // @ts-expect-error JS module
          const { loadPacdoraGeomKnife } = await import('../../../pacdoraGeomKnife.js')
          const p = wb.manifest.defaultParams
          const k = await loadPacdoraGeomKnife(wb.manifest.locked.sourceNum, {
            geomPublicRel: wb.manifest.locked.geomPublicRel,
            label: wb.manifest.labelZh,
            length: p.lengthMm,
            width: p.widthMm,
            height: p.heightMm,
            thickness: p.thicknessMm,
          })
          const knife = { ...k, lockedSample: true }
          if (!knife.stats) knife.stats = computeKnifeStats(knife)
          this.knife = knife
          this.lastValid = knife
          this.issues = []
          this.limits = null
          this.status = 'ok'
          this.errorMessage = ''
        } catch (err: unknown) {
          this.status = 'error'
          this.errorMessage = err instanceof Error ? err.message : String(err)
        }
        return
      }
      const client = this.ensureClient()
      this.status = 'computing'
      const result = await client.compute({
        templateId: wb.manifest.templateId,
        lengthMm: wb.params.lengthMm,
        widthMm: wb.params.widthMm,
        heightMm: wb.params.heightMm,
        thicknessMm: wb.params.thicknessMm,
        sizeMode: wb.params.sizeMode,
        materialId: wb.params.materialId,
        fluteDirection: wb.params.fluteDirection,
        bleedInputMm: wb.params.bleedInputMm,
        advanced: wb.params.advanced,
        pieceId: wb.pieceId,
      })
      // Drop stale
      if (result.seq < client.latestSeq()) return
      this.lastSeq = result.seq
      this.computeMs = result.computeMs
      if (!result.ok || !result.knife) {
        this.status = 'error'
        this.errorMessage = result.error?.message || 'engine error'
        return
      }
      this.limits = result.limits || null
      const blocking = (result.knife.issues || []).filter((i: any) => i.severity === 'blocking')
      const contractFail = result.knife.validation && result.knife.validation.ok === false
      if (contractFail || blocking.length) {
        this.status = 'invalid'
        this.knife = null
        this.issues = result.knife.issues || []
        // Keep lastValid for canvas
        if (!this.lastValid) {
          this.lastValid = result.knife
        }
        return
      }
      this.knife = result.knife
      this.lastValid = result.knife
      this.issues = result.knife.issues || []
      this.status = 'ok'
      this.errorMessage = ''
    },
    dispose() {
      this._client?.dispose()
      this._client = null
      if (this._watchStop) {
        this._watchStop()
        this._watchStop = null
      }
    },
  },
})
