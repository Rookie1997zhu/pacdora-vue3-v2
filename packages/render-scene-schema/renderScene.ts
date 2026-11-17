export type LightPreset = 'softbox' | 'daylight' | 'warm'
export type BackgroundType = 'solid' | 'gradient'
export type OutputAspect = '1:1' | '4:3' | '16:9' | '3:4' | '9:16'
export type PropSource = 'official' | 'upload'

export type Vec3 = {
  x: number
  y: number
  z: number
}

export type RenderSceneModelV1 = {
  id: string
  designId: string
  revisionId: string | null
  name?: string
  position: Vec3
  rotation: Vec3
  scale: number
  /** 0 = fully open, 100 = fully closed */
  foldProgress: number
  materialId: string
}

export type RenderSceneModelV2 = RenderSceneModelV1 & {
  slotId?: string
}

export type RenderScenePropV2 = {
  id: string
  source: PropSource
  propId: string
  assetId?: string | null
  name?: string
  position: Vec3
  rotation: Vec3
  scale: number
}

export type RenderSceneViewV2 = {
  id: string
  name: string
  camera: {
    position: Vec3
    target: Vec3
    fov: number
  }
  output?: {
    aspect?: OutputAspect
  }
}

export type RenderSceneEnvironmentV2 = {
  hdrId: string | null
  intensity: number
  rotation: number
  useAsBackground: boolean
}

export type RenderSceneDocumentV1 = {
  schemaVersion: 'boxcraft.render_scene.v1'
  camera: {
    position: Vec3
    target: Vec3
    fov: number
  }
  light: {
    preset: LightPreset
    sunPhi: number
    sunTheta: number
    sunIntensity: number
    envIntensity: number
  }
  background: {
    type: BackgroundType
    color: string
    gradient: { top: string; bottom: string }
  }
  ground: {
    visible: boolean
    shadowIntensity: number
  }
  output: {
    aspect: OutputAspect
  }
  models: RenderSceneModelV1[]
}

export type RenderSceneDocumentV2 = {
  schemaVersion: 'boxcraft.render_scene.v2'
  templateId?: string | null
  camera: {
    position: Vec3
    target: Vec3
    fov: number
  }
  light: {
    preset: LightPreset
    sunPhi: number
    sunTheta: number
    sunIntensity: number
    envIntensity: number
  }
  background: {
    type: BackgroundType
    color: string
    gradient: { top: string; bottom: string }
  }
  ground: {
    visible: boolean
    shadowIntensity: number
  }
  output: {
    aspect: OutputAspect
  }
  environment: RenderSceneEnvironmentV2
  models: RenderSceneModelV2[]
  props: RenderScenePropV2[]
  views: RenderSceneViewV2[]
}

/** Current document type used by the editor. */
export type RenderSceneDocument = RenderSceneDocumentV2
/** @deprecated Use RenderSceneDocument */
export type RenderSceneDocumentV1Compat = RenderSceneDocumentV1

export const RENDER_SCENE_SCHEMA_VERSION = 'boxcraft.render_scene.v2' as const
export const RENDER_SCENE_SCHEMA_VERSION_V1 = 'boxcraft.render_scene.v1' as const

export const MATERIAL_PRESET_IDS = [
  'kraft',
  'white',
  'blue',
  'matte_white',
  'glossy_white',
  'kraft_dark',
  'black',
] as const

export type MaterialPresetId = (typeof MATERIAL_PRESET_IDS)[number]

export const LIGHT_PRESETS: Record<
  LightPreset,
  { sunPhi: number; sunTheta: number; sunIntensity: number; envIntensity: number; hdrId?: string | null }
> = {
  softbox: { sunPhi: 45, sunTheta: 35, sunIntensity: 1.6, envIntensity: 0.85, hdrId: 'studio_soft' },
  daylight: { sunPhi: 55, sunTheta: 140, sunIntensity: 2.2, envIntensity: 0.7, hdrId: 'daylight_sky' },
  warm: { sunPhi: 40, sunTheta: 210, sunIntensity: 1.8, envIntensity: 0.9, hdrId: 'warm_interior' },
}

export const ASPECT_RATIOS: Record<OutputAspect, number> = {
  '1:1': 1,
  '4:3': 4 / 3,
  '16:9': 16 / 9,
  '3:4': 3 / 4,
  '9:16': 9 / 16,
}

function num(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function vec3(v: unknown, fallback: Vec3): Vec3 {
  if (!v || typeof v !== 'object') return { ...fallback }
  const o = v as Record<string, unknown>
  return { x: num(o.x, fallback.x), y: num(o.y, fallback.y), z: num(o.z, fallback.z) }
}

function hexColor(v: unknown, fallback: string): string {
  if (typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v)) return v
  return fallback
}

export function createDefaultRenderScene(): RenderSceneDocumentV2 {
  const light = LIGHT_PRESETS.softbox
  return {
    schemaVersion: RENDER_SCENE_SCHEMA_VERSION,
    templateId: null,
    camera: {
      position: { x: 420, y: 320, z: 420 },
      target: { x: 0, y: 40, z: 0 },
      fov: 38,
    },
    light: {
      preset: 'softbox',
      sunPhi: light.sunPhi,
      sunTheta: light.sunTheta,
      sunIntensity: light.sunIntensity,
      envIntensity: light.envIntensity,
    },
    background: {
      type: 'solid',
      color: '#F5F6F8',
      gradient: { top: '#EEF1F5', bottom: '#D8DEE8' },
    },
    ground: {
      visible: true,
      shadowIntensity: 0.45,
    },
    output: {
      aspect: '1:1',
    },
    environment: {
      hdrId: null,
      intensity: 1,
      rotation: 0,
      useAsBackground: false,
    },
    models: [],
    props: [],
    views: [],
  }
}

export function applyLightPreset(
  doc: RenderSceneDocumentV2,
  preset: LightPreset,
): RenderSceneDocumentV2 {
  const p = LIGHT_PRESETS[preset] || LIGHT_PRESETS.softbox
  const environment = doc.environment || {
    hdrId: null,
    intensity: 1,
    rotation: 0,
    useAsBackground: false,
  }
  return {
    ...doc,
    light: {
      preset,
      sunPhi: p.sunPhi,
      sunTheta: p.sunTheta,
      sunIntensity: p.sunIntensity,
      envIntensity: p.envIntensity,
    },
    environment: {
      ...environment,
      hdrId: p.hdrId ?? environment.hdrId,
    },
  }
}

function normalizeModels(raw: unknown): RenderSceneModelV2[] {
  const modelsRaw = Array.isArray(raw) ? raw : []
  const models: RenderSceneModelV2[] = []
  for (const item of modelsRaw.slice(0, 20)) {
    if (!item || typeof item !== 'object') continue
    const m = item as Record<string, unknown>
    const id = typeof m.id === 'string' && m.id.trim() ? m.id.trim().slice(0, 64) : ''
    const designId = typeof m.designId === 'string' ? m.designId.trim() : ''
    if (!id || !designId) continue
    const revisionId =
      typeof m.revisionId === 'string' && m.revisionId.trim() ? m.revisionId.trim() : null
    const entry: RenderSceneModelV2 = {
      id,
      designId,
      revisionId,
      name: typeof m.name === 'string' ? m.name.slice(0, 200) : undefined,
      position: vec3(m.position, { x: 0, y: 0, z: 0 }),
      rotation: vec3(m.rotation, { x: 0, y: 0, z: 0 }),
      scale: clamp(num(m.scale, 1), 0.01, 10),
      foldProgress: clamp(num(m.foldProgress, 100), 0, 100),
      materialId:
        typeof m.materialId === 'string' && m.materialId.trim()
          ? m.materialId.trim().slice(0, 64)
          : 'kraft',
    }
    if (typeof m.slotId === 'string' && m.slotId.trim()) {
      entry.slotId = m.slotId.trim().slice(0, 64)
    }
    models.push(entry)
  }
  return models
}

function normalizeProps(raw: unknown): RenderScenePropV2[] {
  const propsRaw = Array.isArray(raw) ? raw : []
  const props: RenderScenePropV2[] = []
  for (const item of propsRaw.slice(0, 20)) {
    if (!item || typeof item !== 'object') continue
    const p = item as Record<string, unknown>
    const id = typeof p.id === 'string' && p.id.trim() ? p.id.trim().slice(0, 64) : ''
    const propId = typeof p.propId === 'string' && p.propId.trim() ? p.propId.trim().slice(0, 64) : ''
    const sourceRaw = String(p.source || '')
    const source: PropSource = sourceRaw === 'upload' ? 'upload' : 'official'
    if (!id || !propId) continue
    props.push({
      id,
      source,
      propId,
      assetId:
        typeof p.assetId === 'string' && p.assetId.trim()
          ? p.assetId.trim()
          : p.assetId === null
            ? null
            : undefined,
      name: typeof p.name === 'string' ? p.name.slice(0, 200) : undefined,
      position: vec3(p.position, { x: 0, y: 0, z: 0 }),
      rotation: vec3(p.rotation, { x: 0, y: 0, z: 0 }),
      scale: clamp(num(p.scale, 1), 0.01, 10),
    })
  }
  return props
}

function normalizeViews(raw: unknown, baseCamera: RenderSceneDocumentV2['camera']): RenderSceneViewV2[] {
  const viewsRaw = Array.isArray(raw) ? raw : []
  const views: RenderSceneViewV2[] = []
  for (const item of viewsRaw.slice(0, 20)) {
    if (!item || typeof item !== 'object') continue
    const v = item as Record<string, unknown>
    const id = typeof v.id === 'string' && v.id.trim() ? v.id.trim().slice(0, 64) : ''
    const name = typeof v.name === 'string' && v.name.trim() ? v.name.trim().slice(0, 120) : ''
    if (!id || !name) continue
    const camSrc = (v.camera && typeof v.camera === 'object' ? v.camera : {}) as Record<string, unknown>
    const outSrc = (v.output && typeof v.output === 'object' ? v.output : {}) as Record<string, unknown>
    const aspectRaw = String(outSrc.aspect || '')
    const aspect: OutputAspect | undefined =
      aspectRaw === '4:3' ||
      aspectRaw === '16:9' ||
      aspectRaw === '3:4' ||
      aspectRaw === '9:16' ||
      aspectRaw === '1:1'
        ? aspectRaw
        : undefined
    const view: RenderSceneViewV2 = {
      id,
      name,
      camera: {
        position: vec3(camSrc.position, baseCamera.position),
        target: vec3(camSrc.target, baseCamera.target),
        fov: clamp(num(camSrc.fov, baseCamera.fov), 10, 90),
      },
    }
    if (aspect) view.output = { aspect }
    views.push(view)
  }
  return views
}

/** Normalize any v1/v2/legacy payload into a v2 document. */
export function normalizeRenderScene(raw: unknown): RenderSceneDocumentV2 {
  const base = createDefaultRenderScene()
  if (!raw || typeof raw !== 'object') return base
  const src = raw as Record<string, unknown>

  const cameraSrc = (src.camera && typeof src.camera === 'object' ? src.camera : {}) as Record<
    string,
    unknown
  >
  const lightSrc = (src.light && typeof src.light === 'object' ? src.light : {}) as Record<
    string,
    unknown
  >
  const bgSrc = (src.background && typeof src.background === 'object' ? src.background : {}) as Record<
    string,
    unknown
  >
  const gradSrc = (bgSrc.gradient && typeof bgSrc.gradient === 'object' ? bgSrc.gradient : {}) as Record<
    string,
    unknown
  >
  const groundSrc = (src.ground && typeof src.ground === 'object' ? src.ground : {}) as Record<
    string,
    unknown
  >
  const outputSrc = (src.output && typeof src.output === 'object' ? src.output : {}) as Record<
    string,
    unknown
  >
  const envSrc = (src.environment && typeof src.environment === 'object' ? src.environment : {}) as Record<
    string,
    unknown
  >

  const presetRaw = String(lightSrc.preset || base.light.preset)
  const preset: LightPreset =
    presetRaw === 'daylight' || presetRaw === 'warm' || presetRaw === 'softbox'
      ? presetRaw
      : 'softbox'

  const bgTypeRaw = String(bgSrc.type || base.background.type)
  const bgType: BackgroundType = bgTypeRaw === 'gradient' ? 'gradient' : 'solid'

  const aspectRaw = String(outputSrc.aspect || base.output.aspect)
  const aspect: OutputAspect =
    aspectRaw === '4:3' ||
    aspectRaw === '16:9' ||
    aspectRaw === '3:4' ||
    aspectRaw === '9:16' ||
    aspectRaw === '1:1'
      ? aspectRaw
      : '1:1'

  const camera = {
    position: vec3(cameraSrc.position, base.camera.position),
    target: vec3(cameraSrc.target, base.camera.target),
    fov: clamp(num(cameraSrc.fov, base.camera.fov), 10, 90),
  }

  const models = normalizeModels(src.models)
  const props = normalizeProps(src.props)
  // Combined cap: keep first N by truncating props if needed
  const combined = models.length + props.length
  const trimmedProps = combined > 30 ? props.slice(0, Math.max(0, 30 - models.length)) : props

  const templateId =
    typeof src.templateId === 'string' && src.templateId.trim()
      ? src.templateId.trim().slice(0, 64)
      : src.templateId === null
        ? null
        : null

  return {
    schemaVersion: RENDER_SCENE_SCHEMA_VERSION,
    templateId,
    camera,
    light: {
      preset,
      sunPhi: clamp(num(lightSrc.sunPhi, LIGHT_PRESETS[preset].sunPhi), 0, 180),
      sunTheta: clamp(num(lightSrc.sunTheta, LIGHT_PRESETS[preset].sunTheta), 0, 360),
      sunIntensity: clamp(num(lightSrc.sunIntensity, LIGHT_PRESETS[preset].sunIntensity), 0, 10),
      envIntensity: clamp(num(lightSrc.envIntensity, LIGHT_PRESETS[preset].envIntensity), 0, 5),
    },
    background: {
      type: bgType,
      color: hexColor(bgSrc.color, base.background.color),
      gradient: {
        top: hexColor(gradSrc.top, base.background.gradient.top),
        bottom: hexColor(gradSrc.bottom, base.background.gradient.bottom),
      },
    },
    ground: {
      visible: groundSrc.visible !== false,
      shadowIntensity: clamp(num(groundSrc.shadowIntensity, base.ground.shadowIntensity), 0, 1),
    },
    output: { aspect },
    environment: {
      hdrId:
        typeof envSrc.hdrId === 'string' && envSrc.hdrId.trim()
          ? envSrc.hdrId.trim().slice(0, 64)
          : null,
      intensity: clamp(num(envSrc.intensity, base.environment.intensity), 0, 5),
      rotation: clamp(num(envSrc.rotation, base.environment.rotation), 0, 360),
      useAsBackground: envSrc.useAsBackground === true,
    },
    models,
    props: trimmedProps,
    views: normalizeViews(src.views, camera),
  }
}

export function newModelId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function newPropId(): string {
  return newModelId()
}

export function newViewId(): string {
  return newModelId()
}
