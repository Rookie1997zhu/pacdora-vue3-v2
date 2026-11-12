<template>
  <div class="studio-canvas">
    <div class="canvas-toolbar">
      <div class="side-toggle" role="group" :aria-label="t('studio.editSide')">
        <button type="button" :class="{ on: design.editSide === 'outside' }" @click="design.editSide = 'outside'">
          {{ t('studio.sideOutside') }}
        </button>
        <button type="button" :class="{ on: design.editSide === 'inside' }" @click="design.editSide = 'inside'">
          {{ t('studio.sideInside') }}
        </button>
      </div>
      <label class="guide">
        <input v-model="design.showCut" type="checkbox" />
        {{ t('studio.showCut') }}
      </label>
      <label class="guide">
        <input v-model="design.showBleed" type="checkbox" />
        {{ t('studio.showBleed') }}
      </label>
    </div>
    <div ref="hostRef" class="stage-host">
    <v-stage
      v-if="ready"
      :config="stageConfig"
      @mousedown="onStageMouseDown"
      @touchstart="onStageMouseDown"
    >
      <v-layer>
        <v-rect :config="{ x: 0, y: 0, width: size.w, height: size.h, fill: '#eef2f3' }" />
        <v-group :config="{ x: origin.x, y: origin.y, scaleX: vp.pxPerMm, scaleY: vp.pxPerMm }">
          <v-line
            v-for="face in knife.faces"
            :key="'f-' + face.name"
            :config="{
              points: face.points.map((v, i) => (i % 2 === 0 ? v - knife.minX : v - knife.minY)),
              closed: true,
              stroke: face.name === design.selectedPanelId ? '#0f6e68' : '#2028b0',
              strokeWidth: face.name === design.selectedPanelId ? 1.2 : 0.7,
              fill: face.name === design.selectedPanelId ? 'rgba(15,110,104,0.12)' : 'rgba(255,255,255,0.85)',
              name: `face:${face.name}`,
            }"
            @click="() => onFaceClick(face.name)"
            @tap="() => onFaceClick(face.name)"
          />
          <v-group
            v-for="group in netLayerGroups"
            :key="'net-' + group.panelId + '-' + group.clip"
            :config="group.groupConfig"
          >
            <template v-for="item in group.items" :key="item.layer.id">
              <v-image
                v-if="item.kind === 'image'"
                :config="item.config"
                @dragend="(e: any) => onLayerDragEnd(item.layer.id, e)"
                @transformend="(e: any) => onLayerTransformEnd(item.layer.id, e)"
                @click="() => design.selectLayer(item.layer.id)"
                @tap="() => design.selectLayer(item.layer.id)"
              />
            </template>
          </v-group>
          <v-group
            v-for="group in panelLayerGroups"
            :key="'clip-' + group.panelId + '-' + group.clip"
            :config="group.groupConfig"
          >
            <template v-for="item in group.items" :key="item.layer.id">
              <v-image
                v-if="item.kind === 'image'"
                :config="item.config"
                @dragend="(e: any) => onLayerDragEnd(item.layer.id, e)"
                @transformend="(e: any) => onLayerTransformEnd(item.layer.id, e)"
                @click="() => design.selectLayer(item.layer.id)"
                @tap="() => design.selectLayer(item.layer.id)"
              />
              <v-text
                v-else-if="item.kind === 'text'"
                :config="item.config"
                @dragend="(e: any) => onLayerDragEnd(item.layer.id, e)"
                @transformend="(e: any) => onLayerTransformEnd(item.layer.id, e)"
                @click="() => design.selectLayer(item.layer.id)"
                @tap="() => design.selectLayer(item.layer.id)"
              />
              <v-rect
                v-else-if="item.kind === 'shape' && item.shapeType === 'rect'"
                :config="item.config"
                @dragend="(e: any) => onLayerDragEnd(item.layer.id, e)"
                @transformend="(e: any) => onLayerTransformEnd(item.layer.id, e)"
                @click="() => design.selectLayer(item.layer.id)"
                @tap="() => design.selectLayer(item.layer.id)"
              />
              <v-ellipse
                v-else-if="item.kind === 'shape' && item.shapeType === 'ellipse'"
                :config="item.config"
                @dragend="(e: any) => onLayerDragEnd(item.layer.id, e)"
                @transformend="(e: any) => onLayerTransformEnd(item.layer.id, e)"
                @click="() => design.selectLayer(item.layer.id)"
                @tap="() => design.selectLayer(item.layer.id)"
              />
            </template>
          </v-group>
          <v-line
            v-for="(fold, i) in knife.folds"
            :key="'fold-' + i"
            :config="{
              points: fold.points.map((v, idx) => (idx % 2 === 0 ? v - knife.minX : v - knife.minY)),
              stroke: '#fa0000',
              strokeWidth: 0.6,
              dash: [2, 2],
              listening: false,
            }"
          />
          <v-line
            v-for="(path, i) in visibleBleedPaths"
            :key="'bleed-' + i"
            :config="{
              points: path.points.map((v, idx) => (idx % 2 === 0 ? v - knife.minX : v - knife.minY)),
              closed: true,
              stroke: '#46ba00',
              strokeWidth: 0.9,
              opacity: 0.85,
              listening: false,
            }"
          />
          <v-line
            v-for="(path, i) in visibleCutPaths"
            :key="'cut-' + i"
            :config="{
              points: path.points.map((v, idx) => (idx % 2 === 0 ? v - knife.minX : v - knife.minY)),
              closed: true,
              stroke: '#2028b0',
              strokeWidth: 1.1,
              opacity: 0.9,
              listening: false,
            }"
          />
        </v-group>
        <v-transformer ref="trRef" :config="{ rotateEnabled: true, boundBoxFunc: boundBox }" />
      </v-layer>
    </v-stage>
    </div>
    <p v-if="canvasError" class="err">{{ canvasError }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ArtworkLayer } from '../../../packages/design-schema/designDocument'
import { useDesignStore } from '../../stores/design'
import { resolveAssetObjectUrl } from '../../studio/assetUrl'
import { fitViewport, type Viewport } from '../../studio/coordinates'
import { buildStudioKnifeAsync, type StudioFace, type StudioKnife } from '../../studio/knifeAdapter'
import { buildNetRegistration } from '../../studio/netMasks'

const { t } = useI18n()
const design = useDesignStore()
const hostRef = ref<HTMLElement | null>(null)
const trRef = ref<{ getNode: () => any } | null>(null)
const size = ref({ w: 640, h: 480 })
const ready = ref(false)
const canvasError = ref('')
const imageCache = ref<Record<string, HTMLImageElement>>({})

const emptyKnife = (): StudioKnife => ({
  templateId: '',
  minX: 0,
  minY: 0,
  widthMm: 100,
  heightMm: 100,
  faces: [],
  folds: [],
  cutPaths: [],
  bleedPaths: [],
})

const knife = ref<StudioKnife>(emptyKnife())
let knifeLoadToken = 0

async function reloadKnife() {
  const token = ++knifeLoadToken
  if (!design.document) {
    knife.value = emptyKnife()
    return
  }
  try {
    const next = await buildStudioKnifeAsync(design.document)
    if (token !== knifeLoadToken) return
    knife.value = next
    canvasError.value = ''
  } catch (e: unknown) {
    if (token !== knifeLoadToken) return
    canvasError.value = e instanceof Error ? e.message : 'knife failed'
    knife.value = emptyKnife()
  }
}

const vp = computed<Viewport>(() => fitViewport(knife.value.widthMm, knife.value.heightMm, size.value.w, size.value.h))
const origin = computed(() => ({ x: vp.value.offsetX, y: vp.value.offsetY }))
const stageConfig = computed(() => ({ width: size.value.w, height: size.value.h }))
const visibleBleedPaths = computed(() => (design.showBleed ? knife.value.bleedPaths : []))
const visibleCutPaths = computed(() => (design.showCut ? knife.value.cutPaths : []))

type LayerItem = {
  layer: ArtworkLayer
  kind: 'image' | 'text' | 'shape'
  shapeType?: 'rect' | 'ellipse'
  config: Record<string, unknown>
}

type LayerGroup = {
  panelId: string
  clip: string
  groupConfig: Record<string, unknown>
  items: LayerItem[]
}

function faceLocalPoints(face: StudioFace): number[] {
  return face.points.map((v, i) => (i % 2 === 0 ? v - knife.value.minX : v - knife.value.minY))
}

function makeClipFunc(face: StudioFace | undefined) {
  if (!face) return undefined
  const pts = faceLocalPoints(face)
  return (ctx: CanvasRenderingContext2D) => {
    if (pts.length < 6) return
    ctx.beginPath()
    ctx.moveTo(pts[0], pts[1])
    for (let i = 2; i < pts.length; i += 2) {
      ctx.lineTo(pts[i], pts[i + 1])
    }
    ctx.closePath()
  }
}

function makePrintableClipFunc(rings: number[][]) {
  const minX = knife.value.minX
  const minY = knife.value.minY
  const localRings = rings
    .map((pts) => pts.map((v, i) => (i % 2 === 0 ? v - minX : v - minY)))
    .filter((pts) => pts.length >= 6)
  if (!localRings.length) return undefined
  return (ctx: CanvasRenderingContext2D) => {
    ctx.beginPath()
    for (const pts of localRings) {
      ctx.moveTo(pts[0], pts[1])
      for (let i = 2; i < pts.length; i += 2) {
        ctx.lineTo(pts[i], pts[i + 1])
      }
      ctx.closePath()
    }
  }
}

function panelPos(layer: ArtworkLayer, face: StudioFace) {
  return {
    x: face.x - knife.value.minX + layer.transform.xMm,
    y: face.y - knife.value.minY + layer.transform.yMm,
  }
}

function netPos(layer: ArtworkLayer) {
  return {
    x: layer.transform.xMm - knife.value.minX,
    y: layer.transform.yMm - knife.value.minY,
  }
}

function buildItem(layer: ArtworkLayer, pos: { x: number; y: number }): LayerItem | null {
  const common = {
    id: `layer-${layer.id}`,
    x: pos.x,
    y: pos.y,
    rotation: layer.transform.rotationDeg,
    opacity: layer.opacity,
    draggable: !layer.locked,
    listening: true,
    name: `layer:${layer.id}`,
  }

  if (layer.kind === 'image' && layer.assetId) {
    const img = imageCache.value[layer.assetId]
    if (!img) return null
    const crop = layer.crop
    const cropCfg = crop
      ? {
          x: crop.x * img.naturalWidth,
          y: crop.y * img.naturalHeight,
          width: Math.max(1, crop.w * img.naturalWidth),
          height: Math.max(1, crop.h * img.naturalHeight),
        }
      : undefined
    return {
      layer,
      kind: 'image',
      config: {
        ...common,
        image: img,
        width: layer.widthMm,
        height: layer.heightMm,
        ...(cropCfg ? { crop: cropCfg } : {}),
      },
    }
  }

  if (layer.kind === 'text' && layer.text) {
    return {
      layer,
      kind: 'text',
      config: {
        ...common,
        text: layer.text.content,
        fontFamily: layer.text.fontFamily,
        fontSize: layer.text.fontSizeMm,
        fill: layer.text.fill,
        align: layer.text.align,
        width: layer.widthMm,
        height: layer.heightMm,
        wrap: 'word',
      },
    }
  }

  if (layer.kind === 'shape' && layer.shape) {
    if (layer.shape.shapeType === 'ellipse') {
      return {
        layer,
        kind: 'shape',
        shapeType: 'ellipse',
        config: {
          ...common,
          radiusX: layer.widthMm / 2,
          radiusY: layer.heightMm / 2,
          offsetX: -layer.widthMm / 2,
          offsetY: -layer.heightMm / 2,
          fill: layer.shape.fill,
          stroke: layer.shape.stroke,
          strokeWidth: layer.shape.strokeWidthMm,
        },
      }
    }
    return {
      layer,
      kind: 'shape',
      shapeType: 'rect',
      config: {
        ...common,
        width: layer.widthMm,
        height: layer.heightMm,
        fill: layer.shape.fill,
        stroke: layer.shape.stroke,
        strokeWidth: layer.shape.strokeWidthMm,
      },
    }
  }

  return null
}

const visibleLayers = computed(() =>
  [...(design.document?.artwork.layers || [])]
    .filter((l) => l.visible && (l.side || 'outside') === design.editSide)
    .sort((a, b) => a.zIndex - b.zIndex),
)

const netRegistration = computed(() => {
  const hash = design.document?.geometry?.geometryHash || ''
  try {
    return buildNetRegistration(knife.value, hash)
  } catch {
    return null
  }
})

const netLayerGroups = computed<LayerGroup[]>(() => {
  const buckets = new Map<string, LayerGroup>()
  const printableRings = netRegistration.value?.printableMask || []
  for (const layer of visibleLayers.value) {
    if (layer.coordinateSpace !== 'net_mm') continue
    const item = buildItem(layer, netPos(layer))
    if (!item) continue
    const clipKey = layer.clip === 'printable' ? 'printable' : 'none'
    const key = `net::${clipKey}`
    let group = buckets.get(key)
    if (!group) {
      group = {
        panelId: 'net',
        clip: clipKey,
        groupConfig:
          clipKey === 'printable'
            ? { clipFunc: makePrintableClipFunc(printableRings), listening: true }
            : { listening: true },
        items: [],
      }
      buckets.set(key, group)
    }
    group.items.push(item)
  }
  return [...buckets.values()]
})

const panelLayerGroups = computed<LayerGroup[]>(() => {
  const faces = Object.fromEntries(knife.value.faces.map((f) => [f.name, f]))
  const buckets = new Map<string, LayerGroup>()
  for (const layer of visibleLayers.value) {
    if (layer.coordinateSpace === 'net_mm') continue
    const face = faces[layer.panelId || '']
    if (!face) continue
    const item = buildItem(layer, panelPos(layer, face))
    if (!item) continue
    const clipKey = layer.clip === 'panel' ? 'panel' : 'none'
    const key = `${layer.panelId || 'none'}::${clipKey}`
    let group = buckets.get(key)
    if (!group) {
      group = {
        panelId: layer.panelId || 'none',
        clip: clipKey,
        groupConfig:
          clipKey === 'panel'
            ? { clipFunc: makeClipFunc(face), listening: true }
            : { listening: true },
        items: [],
      }
      buckets.set(key, group)
    }
    group.items.push(item)
  }
  return [...buckets.values()]
})

function boundBox(oldBox: { width: number; height: number }, newBox: { width: number; height: number }) {
  if (Math.abs(newBox.width) < 2 || Math.abs(newBox.height) < 2) return oldBox
  return newBox
}

function onFaceClick(name: string) {
  design.selectPanel(name)
  design.selectLayer(null)
}

function onStageMouseDown(e: any) {
  if (e.target === e.target.getStage()) {
    design.selectLayer(null)
    attachTransformer()
  }
}

function sheetFromNode(layer: ArtworkLayer, x: number, y: number) {
  if (layer.coordinateSpace === 'net_mm') {
    return { xMm: x + knife.value.minX, yMm: y + knife.value.minY }
  }
  const face = knife.value.faces.find((f) => f.name === layer.panelId)
  if (!face) return null
  return {
    xMm: x - (face.x - knife.value.minX),
    yMm: y - (face.y - knife.value.minY),
  }
}

function onLayerDragEnd(layerId: string, e: any) {
  const node = e.target
  const layer = design.document?.artwork.layers.find((l) => l.id === layerId)
  if (!layer) return
  let x = node.x()
  let y = node.y()
  if (layer.kind === 'shape' && layer.shape?.shapeType === 'ellipse') {
    x -= layer.widthMm / 2
    y -= layer.heightMm / 2
  }
  const next = sheetFromNode(layer, x, y)
  if (!next) return
  design.updateLayer(layerId, {
    transform: { ...layer.transform, xMm: next.xMm, yMm: next.yMm },
  })
}

function onLayerTransformEnd(layerId: string, e: any) {
  const node = e.target
  const scaleX = node.scaleX()
  const scaleY = node.scaleY()
  const layer = design.document?.artwork.layers.find((l) => l.id === layerId)
  if (!layer) return
  if (layer.coordinateSpace !== 'net_mm' && !knife.value.faces.find((f) => f.name === layer.panelId)) return

  let widthMm: number
  let heightMm: number
  if (layer.kind === 'shape' && layer.shape?.shapeType === 'ellipse') {
    widthMm = Math.max(1, (node.radiusX() || 1) * 2 * scaleX)
    heightMm = Math.max(1, (node.radiusY() || 1) * 2 * scaleY)
    node.scaleX(1)
    node.scaleY(1)
    node.radiusX(widthMm / 2)
    node.radiusY(heightMm / 2)
    node.offsetX(-widthMm / 2)
    node.offsetY(-heightMm / 2)
  } else {
    widthMm = Math.max(1, node.width() * scaleX)
    heightMm = Math.max(1, node.height() * scaleY)
    node.scaleX(1)
    node.scaleY(1)
    node.width(widthMm)
    node.height(heightMm)
  }

  let x = node.x()
  let y = node.y()
  if (layer.kind === 'shape' && layer.shape?.shapeType === 'ellipse') {
    x -= widthMm / 2
    y -= heightMm / 2
  }
  const next = sheetFromNode(layer, x, y)
  if (!next) return
  design.updateLayer(layerId, {
    widthMm,
    heightMm,
    transform: {
      ...layer.transform,
      xMm: next.xMm,
      yMm: next.yMm,
      rotationDeg: node.rotation(),
      scaleX: 1,
      scaleY: 1,
    },
  })
}

async function ensureImages() {
  const ids = (design.document?.artwork.layers || [])
    .filter((l) => l.kind === 'image' && l.assetId)
    .map((l) => l.assetId!)
  for (const id of ids) {
    if (imageCache.value[id]) continue
    try {
      const url = await resolveAssetObjectUrl(id)
      const img = new window.Image()
      img.crossOrigin = 'anonymous'
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('image load failed'))
        img.src = url
      })
      imageCache.value = { ...imageCache.value, [id]: img }
    } catch (e: unknown) {
      canvasError.value = e instanceof Error ? e.message : 'image failed'
    }
  }
}

function attachTransformer() {
  nextTick(() => {
    const tr = trRef.value?.getNode?.()
    if (!tr) return
    const stage = tr.getStage()
    if (!stage) return
    const selected = design.selectedLayerId
    if (!selected) {
      tr.nodes([])
      tr.getLayer()?.batchDraw()
      return
    }
    const layer = design.document?.artwork.layers.find((l) => l.id === selected)
    if (!layer || layer.locked) {
      tr.nodes([])
      tr.getLayer()?.batchDraw()
      return
    }
    const node = stage.findOne(`#layer-${selected}`)
    if (node) {
      tr.nodes([node])
    } else {
      tr.nodes([])
    }
    tr.getLayer()?.batchDraw()
  })
}

function measure() {
  const el = hostRef.value
  if (!el) return
  // Cap height so a layout feedback loop cannot inflate Konva stage / page scroll.
  const nextW = Math.max(1, el.clientWidth)
  const nextH = Math.max(1, Math.min(el.clientHeight || 0, 4096))
  if (nextW === size.value.w && nextH === size.value.h && ready.value) return
  size.value = { w: nextW, h: nextH }
  ready.value = true
}

let ro: ResizeObserver | null = null
onMounted(() => {
  measure()
  ro = new ResizeObserver(() => measure())
  if (hostRef.value) ro.observe(hostRef.value)
  void ensureImages().then(attachTransformer)
})

onUnmounted(() => {
  ro?.disconnect()
})

watch(
  () => design.document?.artwork.layers,
  async () => {
    await ensureImages()
    attachTransformer()
  },
  { deep: true },
)

watch(
  () => design.selectedLayerId,
  () => attachTransformer(),
)

watch(
  () => design.editSide,
  () => {
    attachTransformer()
  },
)

watch(
  () => [
    design.document?.geometry.mode,
    design.document?.geometry.templateId,
    design.document?.geometry.params.lengthMm,
    design.document?.geometry.params.widthMm,
    design.document?.geometry.params.heightMm,
    design.document?.geometry.params.thicknessMm,
    design.document?.geometry.params.materialId,
    design.document?.geometry.params.advanced?.sourceNum,
  ],
  () => {
    void reloadKnife()
  },
  { immediate: true },
)
</script>

<style scoped>
.studio-canvas{position:relative;width:100%;height:100%;min-height:0;background:#e8eef0;border-radius:12px;overflow:hidden;display:flex;flex-direction:column}
.canvas-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 10px;background:#f4f8f8;border-bottom:1px solid #d5e0e4;z-index:2;flex-shrink:0}
.stage-host{flex:1;min-height:0;position:relative;overflow:hidden}
.side-toggle{display:inline-flex;border:1px solid #cfd8de;border-radius:8px;overflow:hidden}
.side-toggle button{border:0;background:#fff;color:#16343c;padding:5px 10px;cursor:pointer;font-size:12px}
.side-toggle button.on{background:#0f6e68;color:#fff}
.guide{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#16343c}
.err{position:absolute;left:12px;bottom:12px;margin:0;background:#fff4e5;border:1px solid #e6c48a;border-radius:8px;padding:6px 10px;font-size:12px;z-index:2}
</style>
