import * as THREE from 'three'
import type { ArtworkLayer, DesignDocumentV1 } from '../../packages/design-schema/designDocument'
import { resolveAssetObjectUrl } from './assetUrl'
import { buildStudioKnife, type StudioFace } from './knifeAdapter'
import { buildNetRegistration, NET_MAX_EDGE_PX, NET_PX_PER_MM } from './netMasks'

async function loadImage(assetId: string): Promise<HTMLImageElement> {
  const url = await resolveAssetObjectUrl(assetId)
  const img = new Image()
  img.crossOrigin = 'anonymous'
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('bake_image_failed'))
    img.src = url
  })
  return img
}

function clipPanel(ctx: CanvasRenderingContext2D, face: StudioFace, scale: number) {
  const pts = face.points
  if (pts.length < 6) {
    ctx.beginPath()
    ctx.rect(0, 0, face.w * scale, face.h * scale)
    ctx.clip()
    return
  }
  ctx.beginPath()
  for (let i = 0; i < pts.length; i += 2) {
    const x = (pts[i] - face.x) * scale
    const y = (pts[i + 1] - face.y) * scale
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.clip()
}

function clipPrintableRings(
  ctx: CanvasRenderingContext2D,
  rings: number[][],
  face: StudioFace,
  scale: number,
) {
  if (!rings.length) return
  ctx.beginPath()
  let any = false
  for (const pts of rings) {
    if (!pts || pts.length < 6) continue
    for (let i = 0; i < pts.length; i += 2) {
      const x = (pts[i] - face.x) * scale
      const y = (pts[i + 1] - face.y) * scale
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    any = true
  }
  if (any) ctx.clip()
}

function drawLayerAt(
  ctx: CanvasRenderingContext2D,
  layer: ArtworkLayer,
  scale: number,
  images: Record<string, HTMLImageElement>,
  offsetXMm: number,
  offsetYMm: number,
) {
  const x = (layer.transform.xMm + offsetXMm) * scale
  const y = (layer.transform.yMm + offsetYMm) * scale
  const w = layer.widthMm * scale
  const h = layer.heightMm * scale
  const rot = ((layer.transform.rotationDeg || 0) * Math.PI) / 180

  ctx.save()
  ctx.globalAlpha = layer.opacity
  ctx.translate(x + w / 2, y + h / 2)
  ctx.rotate(rot)
  ctx.translate(-w / 2, -h / 2)

  if (layer.kind === 'image' && layer.assetId) {
    const img = images[layer.assetId]
    if (img) {
      const crop = layer.crop
      if (crop) {
        const sx = crop.x * img.naturalWidth
        const sy = crop.y * img.naturalHeight
        const sw = Math.max(1, crop.w * img.naturalWidth)
        const sh = Math.max(1, crop.h * img.naturalHeight)
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h)
      } else {
        ctx.drawImage(img, 0, 0, w, h)
      }
    }
  } else if (layer.kind === 'text' && layer.text) {
    const fontPx = Math.max(1, layer.text.fontSizeMm * scale)
    ctx.fillStyle = layer.text.fill || '#16343c'
    ctx.font = `${fontPx}px ${layer.text.fontFamily || 'sans-serif'}`
    ctx.textAlign = layer.text.align || 'left'
    ctx.textBaseline = 'top'
    const tx = layer.text.align === 'center' ? w / 2 : layer.text.align === 'right' ? w : 0
    ctx.fillText(layer.text.content || '', tx, 0, w)
  } else if (layer.kind === 'shape' && layer.shape) {
    ctx.fillStyle = layer.shape.fill || 'transparent'
    ctx.strokeStyle = layer.shape.stroke || '#000'
    ctx.lineWidth = Math.max(0.5, layer.shape.strokeWidthMm * scale)
    ctx.beginPath()
    if (layer.shape.shapeType === 'ellipse') {
      ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
    } else {
      ctx.rect(0, 0, w, h)
    }
    ctx.fill()
    if (layer.shape.strokeWidthMm > 0) ctx.stroke()
  }

  ctx.restore()
}

async function bakeFace(
  face: StudioFace,
  panelLayers: ArtworkLayer[],
  netLayers: ArtworkLayer[],
  images: Record<string, HTMLImageElement>,
  printableRings: number[][],
): Promise<THREE.CanvasTexture | null> {
  if (!panelLayers.length && !netLayers.length) return null
  const scale = Math.min(NET_PX_PER_MM, NET_MAX_EDGE_PX / Math.max(face.w, face.h, 1))
  const cw = Math.max(32, Math.min(NET_MAX_EDGE_PX, Math.ceil(face.w * scale)))
  const ch = Math.max(32, Math.min(NET_MAX_EDGE_PX, Math.ceil(face.h * scale)))
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.clearRect(0, 0, cw, ch)
  const px = cw / face.w

  ctx.save()
  clipPanel(ctx, face, px)

  for (const layer of netLayers) {
    if (!layer.visible) continue
    ctx.save()
    if (layer.clip === 'printable') {
      clipPrintableRings(ctx, printableRings, face, px)
    }
    drawLayerAt(ctx, layer, px, images, -face.x, -face.y)
    ctx.restore()
  }

  for (const layer of panelLayers) {
    if (!layer.visible) continue
    drawLayerAt(ctx, layer, px, images, 0, 0)
  }

  ctx.restore()

  const tex = new THREE.CanvasTexture(canvas)
  tex.flipY = true
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

export type BakeSide = 'outside' | 'inside'

/** Bake artwork into per-face CanvasTextures for 3D preview (one side at a time). */
export async function bakeArtworkMaps(
  doc: DesignDocumentV1,
  opts?: { side?: BakeSide },
): Promise<Record<string, THREE.CanvasTexture>> {
  const side: BakeSide = opts?.side || 'outside'
  const knife = buildStudioKnife(doc)
  const registration = buildNetRegistration(knife, doc.geometry.geometryHash || '')
  const faces = Object.fromEntries(knife.faces.map((f) => [f.name, f]))
  const all = [...(doc.artwork.layers || [])]
    .filter((l) => l.visible && (l.side || 'outside') === side)
    .sort((a, b) => a.zIndex - b.zIndex)

  const netLayers = all.filter((l) => l.coordinateSpace === 'net_mm')
  const panelLayers = all.filter(
    (l) => l.coordinateSpace !== 'net_mm' && l.panelId && faces[l.panelId],
  )

  const assetIds = [
    ...new Set(
      [...netLayers, ...panelLayers]
        .filter((l) => l.kind === 'image' && l.assetId)
        .map((l) => l.assetId!),
    ),
  ]
  const images: Record<string, HTMLImageElement> = {}
  await Promise.all(
    assetIds.map(async (id) => {
      try {
        images[id] = await loadImage(id)
      } catch {
        /* skip broken */
      }
    }),
  )

  const byPanel = new Map<string, ArtworkLayer[]>()
  for (const layer of panelLayers) {
    const pid = layer.panelId!
    if (!byPanel.has(pid)) byPanel.set(pid, [])
    byPanel.get(pid)!.push(layer)
  }

  const maps: Record<string, THREE.CanvasTexture> = {}
  for (const face of knife.faces) {
    const facePanels = byPanel.get(face.name) || []
    if (!facePanels.length && !netLayers.length) continue
    const tex = await bakeFace(face, facePanels, netLayers, images, registration.printableMask)
    if (!tex) continue
    // Inside print: horizontal mirror in face UV space so inner face orientation reads correctly.
    if (side === 'inside') {
      tex.wrapS = THREE.RepeatWrapping
      tex.repeat.x = -1
      tex.offset.x = 1
      tex.needsUpdate = true
    }
    maps[face.name] = tex
  }
  return maps
}
