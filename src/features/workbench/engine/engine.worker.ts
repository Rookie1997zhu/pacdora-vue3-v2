/// <reference lib="webworker" />
import { createKnife, validateKnife, limitsFor, getTemplate, ensureTemplate } from '../../../../packages/geometry-engine/index.js'
import { resolveEngineMaterialId, getMaterialProfile } from '../../../../packages/geometry-engine/materialProfiles.js'

export type ComputeRequest = {
  seq: number
  templateId: string
  lengthMm: number
  widthMm: number
  heightMm: number
  thicknessMm: number
  sizeMode: 'inner' | 'outer' | 'manufacturing'
  materialId: string
  fluteDirection: 'L' | 'W'
  bleedInputMm: number
  advanced: Record<string, number>
  /** Multi-piece templates: which piece to generate (default: first) */
  pieceId?: string | null
}

self.onmessage = async (ev: MessageEvent<ComputeRequest>) => {
  const req = ev.data
  const t0 = performance.now()
  try {
    // Spec templates are fetched per box; this worker has its own registry
    await ensureTemplate(req.templateId)
    const profile = getMaterialProfile(req.materialId)
    const engineMaterialId = resolveEngineMaterialId(req.materialId)
    const thicknessMinMm = profile?.thickness?.min
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
      thicknessMinMm,
      piece: req.pieceId || undefined,
    })
    if (!knife.validation) knife.validation = validateKnife(knife)
    const template = getTemplate(req.templateId)
    const limits = limitsFor(template, req.sizeMode, knife.dimensions?.thickness ?? req.thicknessMm)
    ;(self as DedicatedWorkerGlobalScope).postMessage({
      ok: true,
      seq: req.seq,
      knife,
      limits,
      computeMs: performance.now() - t0,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : 'ENGINE_ERROR'
    ;(self as DedicatedWorkerGlobalScope).postMessage({
      ok: false,
      seq: req.seq,
      error: { code, message },
      computeMs: performance.now() - t0,
    })
  }
}

export {}
