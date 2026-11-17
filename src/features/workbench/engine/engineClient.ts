import { createKnife, validateKnife, limitsFor, getTemplate, ensureTemplate } from '../../../../packages/geometry-engine/index.js'
import { resolveEngineMaterialId, getMaterialProfile } from '../../../../packages/geometry-engine/materialProfiles.js'
import type { ComputeRequest } from './engine.worker'

export type EngineResult = {
  ok: boolean
  seq: number
  knife?: any
  limits?: Record<string, [number, number] | null>
  computeMs: number
  error?: { code: string; message: string }
  via: 'worker' | 'main'
}

type Listener = (result: EngineResult) => void

const TIMEOUT_MS = 5000

function computeOnMain(req: ComputeRequest): EngineResult {
  const t0 = performance.now()
  try {
    const profile = getMaterialProfile(req.materialId)
    const engineMaterialId = resolveEngineMaterialId(req.materialId)
    const knife = createKnife({
      templateId: req.templateId,
      length: req.lengthMm,
      width: req.widthMm,
      height: req.heightMm,
      thickness: req.thicknessMm,
      bleed: req.bleedInputMm,
      sizeMode: req.sizeMode,
      fluteDirection: req.fluteDirection,
      materialId: engineMaterialId,
      params: req.advanced || {},
      previewBleedExtra: 0,
      thicknessMinMm: profile?.thickness?.min,
      piece: req.pieceId || undefined,
    })
    if (!knife.validation) knife.validation = validateKnife(knife)
    const template = getTemplate(req.templateId)
    const limits = limitsFor(template, req.sizeMode, knife.dimensions?.thickness ?? req.thicknessMm)
    return { ok: true, seq: req.seq, knife, limits, computeMs: performance.now() - t0, via: 'main' }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : 'ENGINE_ERROR'
    return { ok: false, seq: req.seq, error: { code, message }, computeMs: performance.now() - t0, via: 'main' }
  }
}

export function createEngineClient() {
  let seq = 0
  let worker: Worker | null = null
  let workerFailed = false
  const pending = new Map<number, { resolve: (r: EngineResult) => void; timer: ReturnType<typeof setTimeout> }>()

  function ensureWorker() {
    if (workerFailed || typeof Worker === 'undefined') return null
    if (worker) return worker
    try {
      worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = (ev: MessageEvent) => {
        const data = ev.data as Omit<EngineResult, 'via'>
        const entry = pending.get(data.seq)
        if (!entry) return
        clearTimeout(entry.timer)
        pending.delete(data.seq)
        entry.resolve({ ...data, via: 'worker' })
      }
      worker.onerror = () => {
        workerFailed = true
        try { worker?.terminate() } catch { /* ignore */ }
        worker = null
        for (const [s, entry] of pending) {
          clearTimeout(entry.timer)
          pending.delete(s)
          entry.resolve(computeOnMain({ seq: s } as ComputeRequest))
        }
      }
      return worker
    } catch {
      workerFailed = true
      return null
    }
  }

  function compute(input: Omit<ComputeRequest, 'seq'>, onResult?: Listener): Promise<EngineResult> {
    const mySeq = ++seq
    // Strip Vue reactive proxies — Worker postMessage requires structured-cloneable data.
    const plain = JSON.parse(JSON.stringify(input)) as Omit<ComputeRequest, 'seq'>
    const req: ComputeRequest = { ...plain, seq: mySeq, advanced: { ...(plain.advanced || {}) } }
    const w = ensureWorker()
    if (!w) {
      // No worker: the main-thread registry must hold the (lazily loaded) spec template first
      return ensureTemplate(req.templateId).then(() => {
        const result = computeOnMain(req)
        onResult?.(result)
        return result
      })
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        pending.delete(mySeq)
        const result = computeOnMain(req)
        onResult?.(result)
        resolve(result)
      }, TIMEOUT_MS)
      pending.set(mySeq, {
        resolve: (r) => {
          onResult?.(r)
          resolve(r)
        },
        timer,
      })
      try {
        w.postMessage(req)
      } catch (err) {
        clearTimeout(timer)
        pending.delete(mySeq)
        workerFailed = true
        try { worker?.terminate() } catch { /* ignore */ }
        worker = null
        const result = computeOnMain(req)
        onResult?.(result)
        resolve(result)
      }
    })
  }

  function latestSeq() {
    return seq
  }

  function dispose() {
    for (const [, entry] of pending) clearTimeout(entry.timer)
    pending.clear()
    try { worker?.terminate() } catch { /* ignore */ }
    worker = null
  }

  return { compute, latestSeq, dispose, computeOnMain: (input: Omit<ComputeRequest, 'seq'>) => computeOnMain({ ...input, seq: ++seq }) }
}

export type EngineClient = ReturnType<typeof createEngineClient>
