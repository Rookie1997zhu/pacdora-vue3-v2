export const ENGINE_VERSION: string
export const SCHEMA: string
export const SCHEMA_MINOR: number
export function createKnife(opts?: Record<string, unknown>): any
export function deriveSizes(template: any, opts?: Record<string, unknown>): any
export function derivePanelSizes(opts?: Record<string, unknown>): any
export function resolveParams(template: any, panel: any, T: number, overrides?: Record<string, unknown>): any
export function limitsFor(template: any, sizeMode?: string, T?: number): Record<string, [number, number] | null>
export function effectiveBleedMm(bleed: number, previewBleedExtra?: number): number
export const BLEED_EXTRA_MM: number
export function holeLoop(...args: any[]): any
export function expandBleedLoop(...args: any[]): any
export function expandBleedLoops(...args: any[]): any
export function pathsFromCuts(cuts: any[]): string
export function computeKnifeStats(knife: any): any
export function buildKnifeIssues(knife: any, opts?: Record<string, unknown>): any[]
export function validateKnife(knife: any): any
export function assertStableTopology(a: any, b: any): void
export function orderFaces(...args: any[]): any
export const BLOCKING_CHECK_IDS: readonly string[]
export const FACE_ORDER: readonly string[]
export function anglesAtProgress(...args: any[]): any
export function stageIndexAt(t: number, stageCount: number): number
export function buildDepthFoldStages(...args: any[]): any
export function foldStagesFromAnimation(...args: any[]): any
export function translatedFaces(...args: any[]): any
export function translationsAtProgress(...args: any[]): any
export function buildDimAnnotations(...args: any[]): any
export function dimAnnotationsToSvg(...args: any[]): string
export function fallbackSizeArrowData(...args: any[]): any
export function sizeArrowDataFromBounds(...args: any[]): any
export const TEMPLATES: Record<string, any>
export const TEMPLATE_LIST: any[]
export const DEFAULT_TEMPLATE_ID: string
export function getTemplate(id?: string): any
export function computeKnifeStats(knife: any): any
export function registerTemplate(template: any): any
/** Load a per-box spec template on demand (no-op for built-in / already registered ids) */
export function ensureTemplate(id?: string | null): Promise<any | null>
export function ensureTemplates(ids: Array<string | null | undefined>): Promise<Array<any | null>>
export function isTemplateLoaded(id: string): boolean
export function isSpecTemplateId(id: unknown): boolean
export const MATERIAL_PROFILES: readonly any[]
export function getMaterialProfile(id: string): any
export function resolveEngineMaterialId(id: string): 'kraft' | 'white' | 'blue'
export function listMaterialProfiles(opts?: { includeLegacy?: boolean }): any[]
