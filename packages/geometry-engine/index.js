/**
 * BOXCRAFT geometry-engine facade (v3.1).
 * Re-exports engine modules from src/ without relocating files,
 * so existing imports and Dockerfile.geometry stay unchanged.
 */
export const ENGINE_VERSION = '3.1.0'
export const SCHEMA = 'boxcraft.knife.v3'
export const SCHEMA_MINOR = 1

export {
  createKnife,
  deriveSizes,
  derivePanelSizes,
  resolveParams,
  limitsFor,
  effectiveBleedMm,
  BLEED_EXTRA_MM,
  holeLoop,
  expandBleedLoop,
  expandBleedLoops,
  pathsFromCuts,
  computeKnifeStats,
  buildKnifeIssues,
} from '../../src/knife.js'

export {
  validateKnife,
  assertStableTopology,
  orderFaces,
  BLOCKING_CHECK_IDS,
  FACE_ORDER,
} from '../../src/knifeContract.js'

export {
  anglesAtProgress,
  stageIndexAt,
  buildDepthFoldStages,
  foldStagesFromAnimation,
  translatedFaces,
  translationsAtProgress,
} from '../../src/foldStages.js'

export {
  buildDimAnnotations,
  dimAnnotationsToSvg,
  fallbackSizeArrowData,
  sizeArrowDataFromBounds,
} from '../../src/dimAnnotations.js'

export {
  TEMPLATES,
  TEMPLATE_LIST,
  DEFAULT_TEMPLATE_ID,
  getTemplate,
  registerTemplate,
} from '../../src/templates/index.js'

export {
  ensureTemplate,
  ensureTemplates,
  isTemplateLoaded,
  isSpecTemplateId,
} from '../../src/templates/lazy.js'

export {
  MATERIAL_PROFILES,
  getMaterialProfile,
  resolveEngineMaterialId,
  listMaterialProfiles,
} from './materialProfiles.js'
