import type { StudioKnife } from './knifeAdapter'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — shared mjs implementation
import {
  buildNetRegistration as buildNetRegistrationJs,
  NET_MAX_EDGE_PX,
  NET_POLARITY,
  NET_PX_PER_MM,
} from './netMasks.mjs'

export { NET_MAX_EDGE_PX, NET_POLARITY, NET_PX_PER_MM }

export type MaskRing = number[]

export type NetBoundingBoxMm = {
  minX: number
  minY: number
  widthMm: number
  heightMm: number
}

export type NetRegistration = {
  netBoundingBoxMm: NetBoundingBoxMm
  pxPerMm: number
  maxEdgePx: number
  polarity: typeof NET_POLARITY
  totalMask: MaskRing[]
  printableMask: MaskRing[]
  mainMask: MaskRing[]
  geometryHash: string
  maskHash: string
}

export function buildNetRegistration(knife: StudioKnife, geometryHash: string): NetRegistration {
  return buildNetRegistrationJs(knife, geometryHash) as NetRegistration
}
