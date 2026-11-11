export type GeometryMode = 'parametric' | 'fixed_snapshot' | 'model_only'
export type ArtworkKind = 'image' | 'text' | 'shape'
export type CoordSpace = 'panel_mm' | 'net_mm'
export type LayerAdaptStatus = 'ok' | 'needs_adapt' | 'needs_rebind'

export interface TextStyle {
  content: string
  fontFamily: string
  fontSizeMm: number
  fill: string
  align: 'left' | 'center' | 'right'
}

export interface ShapeStyle {
  shapeType: 'rect' | 'ellipse'
  fill: string
  stroke: string
  strokeWidthMm: number
}

/** Normalized crop box relative to source image [0,1] */
export interface CropBox {
  x: number
  y: number
  w: number
  h: number
}

export interface DesignDocumentV1 {
  schemaVersion: 'boxcraft.design.v1'
  designId?: string
  locale: 'zh-CN' | 'ko-KR'
  geometry: {
    mode: GeometryMode
    templateId: string
    templateVersion: string
    engineVersion: string
    sourceAssetId?: string | null
    pieceId?: string | null
    params: {
      lengthMm: number
      widthMm: number
      heightMm: number
      thicknessMm: number
      sizeMode: 'inner' | 'outer'
      fluteDirection: 'L' | 'W'
      materialId: string
      bleedInputMm: number
      advanced: Record<string, number>
    }
    geometryHash: string
  }
  artwork: {
    backgroundColor: string | null
    layers: ArtworkLayer[]
  }
  aiSettings?: {
    mode: 'image' | 'main_area'
    prompt: string
    stylePresetId?: string | null
    generationBackgroundColor?: string | null
    /** Net registration snapshot from knife masks (P4.2); opaque JSON for forward-compat */
    registration?: Record<string, unknown> | null
  } | null
  outbox?: {
    enabled: boolean
    sizingMode: 'grow' | 'fixed'
    quantity: number
    thicknessMm: number
    gapsMm: { length: number; width: number; height: number }
    fixedInnerMm?: { length: number; width: number; height: number } | null
    manualLayout?: { nx: number; ny: number; nz: number; rotated: boolean } | null
    catalogPresetId?: string | null
  } | null
}

export interface ArtworkLayer {
  id: string
  kind: ArtworkKind
  name: string
  coordinateSpace: CoordSpace
  panelId?: string | null
  pieceId?: string | null
  side: 'outside' | 'inside'
  transform: { xMm: number; yMm: number; rotationDeg: number; scaleX: number; scaleY: number }
  widthMm: number
  heightMm: number
  visible: boolean
  locked: boolean
  opacity: number
  zIndex: number
  clip: 'panel' | 'printable' | 'none'
  assetId?: string | null
  text?: TextStyle | null
  shape?: ShapeStyle | null
  crop?: CropBox | null
  resizePolicy: 'keep_mm' | 'scale_with_panel' | 'anchor'
  anchor?: { x: number; y: number } | null
  /** Client/server geometry fingerprint when layer was last accepted */
  sourceGeometryHash?: string | null
  adaptStatus?: LayerAdaptStatus | null
}
