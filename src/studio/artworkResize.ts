import type { ArtworkLayer, DesignDocumentV1 } from '../../packages/design-schema/designDocument'
import type { StudioKnife } from './knifeAdapter'
// Shared pure implementation for Node check scripts + Vite.
import {
  annotateLayerAdapt as annotateLayerAdaptJs,
  geometryFingerprint as geometryFingerprintJs,
  migrateLayers as migrateLayersJs,
} from './artworkResize.mjs'

export function geometryFingerprint(doc: DesignDocumentV1): string {
  return geometryFingerprintJs(doc) as string
}

export function annotateLayerAdapt(
  layers: ArtworkLayer[],
  newKnife: StudioKnife,
  nextHash: string,
): ArtworkLayer[] {
  return annotateLayerAdaptJs(layers, newKnife, nextHash) as ArtworkLayer[]
}

export function migrateLayers(
  layers: ArtworkLayer[],
  oldKnife: StudioKnife,
  newKnife: StudioKnife,
  nextHash?: string | null,
): ArtworkLayer[] {
  return migrateLayersJs(layers, oldKnife, newKnife, nextHash ?? null) as ArtworkLayer[]
}
