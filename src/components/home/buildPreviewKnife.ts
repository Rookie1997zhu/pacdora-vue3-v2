/**
 * Build a fold knife for homepage on-demand 3D without mounting Workbench stores.
 */
import { computeKnifeStats } from '../../../packages/geometry-engine/index.js'
import { createEngineClient } from '../../features/workbench/engine/engineClient'
import { loadWorkbenchManifest, type WorkbenchManifest } from '../../features/workbench/manifest'

export type PreviewKnifeResult = {
  knife: unknown
  thicknessMm: number
  materialId: string
  manifest: WorkbenchManifest
}

export async function buildPreviewKnifeFromSlug(slug: string): Promise<PreviewKnifeResult> {
  const key = String(slug || '').trim()
  if (!key) throw new Error('missing slug')

  const manifest = await loadWorkbenchManifest(key)
  if (!manifest) throw new Error('manifest unavailable')

  const p = manifest.defaultParams

  if (manifest.locked) {
    // @ts-expect-error JS module
    const { loadPacdoraGeomKnife } = await import('../../pacdoraGeomKnife.js')
    const k = await loadPacdoraGeomKnife(manifest.locked.sourceNum, {
      geomPublicRel: manifest.locked.geomPublicRel,
      label: manifest.labelZh,
      length: p.lengthMm,
      width: p.widthMm,
      height: p.heightMm,
      thickness: p.thicknessMm,
    })
    const knife = { ...k, lockedSample: true }
    if (!knife.stats) knife.stats = computeKnifeStats(knife)
    return {
      knife,
      thicknessMm: p.thicknessMm,
      materialId: p.materialId,
      manifest,
    }
  }

  if (!manifest.templateId) throw new Error('no template')

  const client = createEngineClient()
  try {
    const result = await client.compute({
      templateId: manifest.templateId,
      lengthMm: p.lengthMm,
      widthMm: p.widthMm,
      heightMm: p.heightMm,
      thicknessMm: p.thicknessMm,
      sizeMode: p.sizeMode,
      materialId: p.materialId,
      fluteDirection: p.fluteDirection,
      bleedInputMm: p.bleedInputMm,
      advanced: p.advanced || {},
    })
    if (!result.ok || !result.knife) {
      throw new Error(result.error?.message || 'engine error')
    }
    return {
      knife: result.knife,
      thicknessMm: result.knife.dimensions?.thickness ?? p.thicknessMm,
      materialId: p.materialId,
      manifest,
    }
  } finally {
    client.dispose()
  }
}
