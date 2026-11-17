<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useKnifeStore } from '../../stores/knife'
import { useWorkbenchStore } from '../../stores/workbench'
import { useViewport } from '../../composables/useViewport'
import { templateForManifest } from '../../manifest'
import { useUnit } from '../../composables/useUnit'
import { segmentsToPath, faceToPath, loopToPath } from '../../lib/pathToSvg.mjs'
import { buildDimAnnotations } from '../../../../dimAnnotations.js'

const { t } = useI18n()
const knifeStore = useKnifeStore()
const wb = useWorkbenchStore()
const { format, formatPair } = useUnit()
const root = ref<HTMLElement | null>(null)
const svgEl = ref<SVGSVGElement | null>(null)
const { scale, tx, ty, fit, userMoved, watchResize } = useViewport(root, svgEl)
/** Keep the dieline clear of the legend / size summary overlaid at the top of the canvas */
const FIT_INSETS = { top: 84, right: 12, bottom: 12, left: 12 }
let fittedTemplate = ''

const knife = computed(() => knifeStore.displayKnife)
/** Multi-piece boxes (lid + base, inserts…): one piece is drawn at a time */
const pieceOptions = computed<Array<{ id: string; label: string }>>(() => {
  if (!wb.manifest) return []
  const tpl = templateForManifest(wb.manifest)
  const list = Array.isArray(tpl?.pieces) ? tpl.pieces : []
  return list.length > 1 ? list.map((p: any) => ({ id: String(p.id), label: String(p.label || p.id) })) : []
})
const activePiece = computed(() => wb.pieceId || knife.value?.piece || pieceOptions.value[0]?.id || '')
function pickPiece(id: string) {
  if (id === activePiece.value) return
  wb.setPiece(id)
  fittedTemplate = ''
}
const trimPath = computed(() => knife.value?.cutPath || segmentsToPath(knife.value?.cuts || []))
const creasePath = computed(() => segmentsToPath(knife.value?.folds || []))
const bleedPath = computed(() => knife.value?.bleedPath || loopToPath(knife.value?.bleedLoop || []))
const faces = computed(() => knife.value?.faces || [])
const dims = computed<DimAnnotation[]>(() => {
  if (!knife.value) return []
  try { return buildDimAnnotations(knife.value) || [] } catch { return [] }
})

const summary = computed(() => {
  const d = knife.value?.dimensions
  const s = knife.value?.stats
  if (!d) return null
  return {
    panel: formatPair(d.panel.length, d.panel.width, d.panel.height),
    inner: formatPair(d.inner.length, d.inner.width, d.inner.height),
    outer: formatPair(d.outer.length, d.outer.width, d.outer.height),
    sheet: s ? `${format(s.sheetWidthMm)} × ${format(s.sheetHeightMm)}` : '',
    cut: s ? `${(s.cutLengthMm / 1000).toFixed(2)} m` : '',
    crease: s ? `${(s.creaseLengthMm / 1000).toFixed(2)} m` : '',
  }
})

/** Extent to fit: faces plus bleed outline (knife.bounds covers faces only) */
function fitBounds(k: any) {
  const b = k?.bounds
  if (!b) return null
  let { minX, minY, maxX, maxY } = b
  for (const p of (k.bleedLoop || []) as Array<[number, number]>) {
    if (!Array.isArray(p)) continue
    if (p[0] < minX) minX = p[0]
    if (p[0] > maxX) maxX = p[0]
    if (p[1] < minY) minY = p[1]
    if (p[1] > maxY) maxY = p[1]
  }
  // Replayed reference dielines have no bleed loop: leave room for their bleed outline instead
  if (!Array.isArray(k.bleedLoop) || !k.bleedLoop.length) {
    const pad = Math.max(0, Number(k.bleedEffective ?? k.bleed ?? 0) || 0)
    minX -= pad
    minY -= pad
    maxX += pad
    maxY += pad
  }
  return { minX, minY, maxX, maxY }
}

function autoFit(force = false) {
  const k = knife.value
  const b = fitBounds(k)
  if (!b) return
  const tpl = `${String(k?.template || '')}#${String(k?.piece || '')}`
  // Auto-fit until the user zooms / pans by hand; a different template always refits.
  if (!force && userMoved.value && tpl === fittedTemplate) return
  if (fit(b, 0.04, FIT_INSETS)) fittedTemplate = tpl
}

watch(knife, async () => {
  await nextTick()
  autoFit()
}, { immediate: true })

// Container had no size yet on first knife, or the window / side panels changed size.
watchResize(() => autoFit())

const DIM_FONT_PX = 11

type DimAnnotation = {
  kind: 'overall' | 'face'
  label: string
  name?: string
  valueMm?: number
  wMm?: number
  hMm?: number
  lines: Array<{ x1: number; y1: number; x2: number; y2: number }>
  polys: number[][][]
  text?: { x: number; y: number; anchor?: string; value: string }
}

function polyPoints(poly: number[][]) {
  return poly.map((pt) => `${pt[0]},${pt[1]}`).join(' ')
}

/** Text in the current display unit; overall dims keep only the axis letter (L / W / H) */
function dimText(a: DimAnnotation) {
  if (a.kind === 'overall' && Number.isFinite(a.valueMm)) {
    const axis = String(a.name || '').replace(/\(.*\)/, '').trim()
    return `${axis} ${format(a.valueMm as number)}`.trim()
  }
  if (a.kind === 'face' && Number.isFinite(a.wMm) && Number.isFinite(a.hMm)) {
    return `${format(a.wMm as number)}×${format(a.hMm as number)}`
  }
  return a.text?.value || a.label
}

/** Per-face "w×h" is hidden when the face is too small on screen to hold it */
function dimTextVisible(a: DimAnnotation) {
  if (a.kind !== 'face') return true
  const textPx = dimText(a).length * DIM_FONT_PX * 0.6
  return (a.wMm || 0) * scale.value >= textPx + 6 && (a.hMm || 0) * scale.value >= DIM_FONT_PX + 6
}

function onFaceEnter(name: string) {
  wb.setHover({ face: name })
}
function onFaceLeave() {
  wb.setHover({ face: null })
}

function doFit() {
  autoFit(true)
}
</script>

<template>
  <section class="canvas" ref="root">
    <div class="legend">
      <span><i class="sw bleed" />{{ t('workbench.legendBleed') }}</span>
      <span><i class="sw trim" />{{ t('workbench.legendTrim') }}</span>
      <span><i class="sw crease" />{{ t('workbench.legendCrease') }}</span>
    </div>
    <div v-if="summary" class="summary left">
      <template v-if="knife?.lockedSample">
        <div>{{ t('workbench.modeInner') }} {{ summary.inner }}</div>
      </template>
      <template v-else>
        <div>{{ t('workbench.modeMfg') }} {{ summary.panel }}</div>
        <div>{{ t('workbench.modeInner') }} {{ summary.inner }}</div>
        <div>{{ t('workbench.modeOuter') }} {{ summary.outer }}</div>
      </template>
    </div>
    <div v-if="summary" class="summary right">
      <div>{{ t('workbench.sheet') }} {{ summary.sheet }}</div>
      <div>{{ t('workbench.cutLen') }} {{ summary.cut }} · {{ t('workbench.creaseLen') }} {{ summary.crease }}</div>
    </div>
    <p v-if="knifeStore.status === 'invalid'" class="stale">{{ t('workbench.showingLastValid') }}</p>

    <svg ref="svgEl" class="svg" xmlns="http://www.w3.org/2000/svg">
      <g :transform="`translate(${tx},${ty}) scale(${scale})`">
        <g v-if="wb.view.showBleed" class="layer bleed">
          <path :d="bleedPath" fill="none" stroke="#46ba00" stroke-width="1" vector-effect="non-scaling-stroke" />
        </g>
        <g class="layer faces">
          <path
            v-for="f in faces"
            :key="f.name"
            :d="faceToPath(f)"
            :class="{ hot: wb.hover.face === f.name }"
            fill="rgba(238,246,246,.55)"
            stroke="none"
            @pointerenter="onFaceEnter(f.name)"
            @pointerleave="onFaceLeave"
          />
        </g>
        <g v-if="wb.view.showTrim" class="layer trim">
          <path :d="trimPath" fill="none" stroke="#2028b0" stroke-width="1.4" vector-effect="non-scaling-stroke" />
        </g>
        <g v-if="wb.view.showCrease" class="layer crease">
          <path :d="creasePath" fill="none" stroke="#fa0000" stroke-width="1.1" stroke-dasharray="5 3" vector-effect="non-scaling-stroke" />
        </g>
        <g v-if="wb.view.showDims" class="layer dims">
          <g v-for="(a, i) in dims" :key="i">
            <line
              v-for="(ln, j) in a.lines"
              :key="'l' + j"
              :x1="ln.x1" :y1="ln.y1" :x2="ln.x2" :y2="ln.y2"
              stroke="#2563eb" stroke-width="1" vector-effect="non-scaling-stroke"
            />
            <polygon
              v-for="(poly, j) in a.polys"
              :key="'p' + j"
              :points="polyPoints(poly)"
              fill="#2563eb"
            />
            <text
              v-if="a.text && dimTextVisible(a)"
              :x="a.text.x"
              :y="a.text.y"
              fill="#2563eb"
              :font-size="DIM_FONT_PX / scale"
              :text-anchor="a.text.anchor || 'middle'"
              dominant-baseline="middle"
              class="dim-text"
            >{{ dimText(a) }}</text>
          </g>
        </g>
        <g v-if="wb.view.showFaceNames">
          <text
            v-for="f in faces" :key="'n'+f.name"
            :x="f.x + f.w / 2" :y="f.y + f.h / 2"
            text-anchor="middle" dominant-baseline="middle"
            fill="#64748b" :font-size="11 / scale"
          >{{ f.name }}</text>
        </g>
      </g>
    </svg>

    <div v-if="pieceOptions.length" class="pieces" role="tablist" :aria-label="t('workbench.pieces')">
      <span class="pieces-label">{{ t('workbench.pieces') }}</span>
      <button
        v-for="p in pieceOptions"
        :key="p.id"
        type="button"
        role="tab"
        :aria-selected="p.id === activePiece"
        :class="{ on: p.id === activePiece }"
        @click="pickPiece(p.id)"
      >{{ p.label }}</button>
    </div>
    <div class="toolbar">
      <button type="button" @click="doFit">{{ t('workbench.fit') }}</button>
      <label><input type="checkbox" :checked="wb.view.showBleed" @change="wb.setView({ showBleed: ($event.target as HTMLInputElement).checked })" /> {{ t('workbench.legendBleed') }}</label>
      <label><input type="checkbox" :checked="wb.view.showTrim" @change="wb.setView({ showTrim: ($event.target as HTMLInputElement).checked })" /> {{ t('workbench.legendTrim') }}</label>
      <label><input type="checkbox" :checked="wb.view.showCrease" @change="wb.setView({ showCrease: ($event.target as HTMLInputElement).checked })" /> {{ t('workbench.legendCrease') }}</label>
      <label><input type="checkbox" :checked="wb.view.showDims" @change="wb.setView({ showDims: ($event.target as HTMLInputElement).checked })" /> {{ t('workbench.legendDims') }}</label>
      <label><input type="checkbox" :checked="wb.view.showFaceNames" @change="wb.setView({ showFaceNames: ($event.target as HTMLInputElement).checked })" /> {{ t('workbench.legendFaces') }}</label>
    </div>
  </section>
</template>

<style scoped>
.canvas{
  position:relative;background:#fff;border:1px solid var(--bc-line);border-radius:12px;
  min-height:420px;height:100%;overflow:hidden;display:flex;flex-direction:column;
}
.svg{flex:1 1 0;width:100%;min-height:0;touch-action:none;cursor:default}
.legend,.summary{position:absolute;z-index:2;font-size:11px;color:var(--bc-ink-muted);pointer-events:none}
.legend{top:10px;left:12px;display:flex;gap:10px}
.summary.left{top:36px;left:12px;line-height:1.45}
.summary.right{top:10px;right:12px;text-align:right;line-height:1.45}
.sw{display:inline-block;width:14px;height:2px;margin-right:4px;vertical-align:middle}
.sw.bleed{background:#46ba00}.sw.trim{background:#2028b0}.sw.crease{background:#fa0000}
.dim-text{pointer-events:none;paint-order:stroke;stroke:#fff;stroke-width:3px;stroke-linejoin:round}
.faces path{cursor:pointer}.faces path.hot{fill:rgba(0,104,104,.25)}
.toolbar{
  display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:8px 10px;
  border-top:1px solid var(--bc-line);font-size:12px;background:#fafbfc
}
.pieces{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px 10px;border-top:1px solid var(--bc-line);font-size:12px;background:#fff}
.pieces-label{color:var(--bc-ink-muted);margin-right:2px}
.pieces button{border:1px solid var(--bc-line-strong);border-radius:999px;background:#fff;padding:3px 10px;cursor:pointer;font:inherit}
.pieces button.on{background:var(--bc-steel);border-color:var(--bc-steel);color:#fff}
.toolbar button{border:1px solid var(--bc-line-strong);border-radius:6px;background:#fff;padding:4px 8px;cursor:pointer}
.stale{position:absolute;bottom:48px;left:12px;z-index:2;font-size:11px;color:var(--bc-warn);background:var(--bc-warn-bg);padding:4px 8px;border-radius:6px}
</style>
