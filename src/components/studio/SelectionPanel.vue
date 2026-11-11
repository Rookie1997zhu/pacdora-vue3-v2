<template>
  <div v-if="layer" class="selection">
    <h2>{{ t('studio.selectionTitle') }}</h2>
    <p class="meta">{{ layer.kind }} · {{ layer.name }}</p>

    <template v-if="layer.kind === 'text' && layer.text">
      <label>
        {{ t('studio.textContent') }}
        <input :value="layer.text.content" type="text" maxlength="500" @change="onTextContent" />
      </label>
      <div class="row">
        <label>
          {{ t('studio.fontSizeMm') }}
          <input
            :value="layer.text.fontSizeMm"
            type="number"
            min="1"
            max="200"
            step="0.5"
            @change="onTextSize"
          />
        </label>
        <label>
          {{ t('studio.fillColor') }}
          <input :value="layer.text.fill" type="color" @input="onTextFill" />
        </label>
      </div>
      <label>
        {{ t('studio.textAlign') }}
        <select :value="layer.text.align" @change="onTextAlign">
          <option value="left">{{ t('studio.alignLeft') }}</option>
          <option value="center">{{ t('studio.alignCenter') }}</option>
          <option value="right">{{ t('studio.alignRight') }}</option>
        </select>
      </label>
    </template>

    <template v-if="layer.kind === 'shape' && layer.shape">
      <div class="row">
        <label>
          {{ t('studio.fillColor') }}
          <input :value="hexOf(layer.shape.fill)" type="color" @input="onShapeFill" />
        </label>
        <label>
          {{ t('studio.strokeColor') }}
          <input :value="hexOf(layer.shape.stroke)" type="color" @input="onShapeStroke" />
        </label>
      </div>
      <label>
        {{ t('studio.strokeWidthMm') }}
        <input
          :value="layer.shape.strokeWidthMm"
          type="number"
          min="0"
          max="20"
          step="0.1"
          @change="onStrokeWidth"
        />
      </label>
    </template>

    <template v-if="layer.kind === 'image'">
      <h3>{{ t('studio.cropTitle') }}</h3>
      <p class="hint">{{ t('studio.cropHint') }}</p>
      <div class="row">
        <label>x<input :value="crop.x" type="number" min="0" max="1" step="0.01" @change="(e) => onCrop('x', e)" /></label>
        <label>y<input :value="crop.y" type="number" min="0" max="1" step="0.01" @change="(e) => onCrop('y', e)" /></label>
        <label>w<input :value="crop.w" type="number" min="0.01" max="1" step="0.01" @change="(e) => onCrop('w', e)" /></label>
        <label>h<input :value="crop.h" type="number" min="0.01" max="1" step="0.01" @change="(e) => onCrop('h', e)" /></label>
      </div>
      <div class="actions">
        <button type="button" @click="applyDefaultCrop">{{ t('studio.cropApply') }}</button>
        <button type="button" class="ghost" @click="clearCrop">{{ t('studio.cropClear') }}</button>
      </div>
    </template>

    <div class="row">
      <label>
        {{ t('studio.opacity') }}
        <input
          :value="layer.opacity"
          type="number"
          min="0"
          max="1"
          step="0.05"
          @change="onOpacity"
        />
      </label>
      <label>
        {{ t('studio.layerSide') }}
        <select :value="layer.side || 'outside'" @change="onSide">
          <option value="outside">{{ t('studio.sideOutside') }}</option>
          <option value="inside">{{ t('studio.sideInside') }}</option>
        </select>
      </label>
    </div>

    <h3>{{ t('studio.resizePolicy') }}</h3>
    <label>
      {{ t('studio.resizePolicy') }}
      <select :value="layer.resizePolicy" @change="onResizePolicy">
        <option value="keep_mm">{{ t('studio.policyKeepMm') }}</option>
        <option value="scale_with_panel">{{ t('studio.policyScale') }}</option>
        <option value="anchor">{{ t('studio.policyAnchor') }}</option>
      </select>
    </label>
    <div v-if="layer.resizePolicy === 'anchor'" class="row">
      <label>
        {{ t('studio.anchorX') }}
        <input :value="layer.anchor?.x ?? 0" type="number" min="0" max="1" step="0.05" @change="(e) => onAnchor('x', e)" />
      </label>
      <label>
        {{ t('studio.anchorY') }}
        <input :value="layer.anchor?.y ?? 0" type="number" min="0" max="1" step="0.05" @change="(e) => onAnchor('y', e)" />
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ArtworkLayer, CropBox } from '../../../packages/design-schema/designDocument'
import { useDesignStore } from '../../stores/design'

const { t } = useI18n()
const design = useDesignStore()
const layer = computed(() => design.selectedLayer)

const crop = computed<CropBox>(() => layer.value?.crop || { x: 0, y: 0, w: 1, h: 1 })

function hexOf(color: string) {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color
  return '#0f6e68'
}

function onTextContent(ev: Event) {
  const l = layer.value
  if (!l?.text) return
  const value = (ev.target as HTMLInputElement).value
  design.updateLayer(l.id, { text: { ...l.text, content: value }, name: value.slice(0, 24) || l.name })
}

function onTextSize(ev: Event) {
  const l = layer.value
  if (!l?.text) return
  const value = Number((ev.target as HTMLInputElement).value)
  design.updateLayer(l.id, { text: { ...l.text, fontSizeMm: value } })
}

function onTextFill(ev: Event) {
  const l = layer.value
  if (!l?.text) return
  design.updateLayer(l.id, { text: { ...l.text, fill: (ev.target as HTMLInputElement).value } })
}

function onTextAlign(ev: Event) {
  const l = layer.value
  if (!l?.text) return
  const value = (ev.target as HTMLSelectElement).value as 'left' | 'center' | 'right'
  design.updateLayer(l.id, { text: { ...l.text, align: value } })
}

function onShapeFill(ev: Event) {
  const l = layer.value
  if (!l?.shape) return
  design.updateLayer(l.id, { shape: { ...l.shape, fill: (ev.target as HTMLInputElement).value } })
}

function onShapeStroke(ev: Event) {
  const l = layer.value
  if (!l?.shape) return
  design.updateLayer(l.id, { shape: { ...l.shape, stroke: (ev.target as HTMLInputElement).value } })
}

function onStrokeWidth(ev: Event) {
  const l = layer.value
  if (!l?.shape) return
  design.updateLayer(l.id, {
    shape: { ...l.shape, strokeWidthMm: Number((ev.target as HTMLInputElement).value) },
  })
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n))
}

function onCrop(key: keyof CropBox, ev: Event) {
  const l = layer.value
  if (!l || l.kind !== 'image') return
  const next = { ...crop.value, [key]: clamp01(Number((ev.target as HTMLInputElement).value)) }
  if (next.x + next.w > 1) next.w = Math.max(0.01, 1 - next.x)
  if (next.y + next.h > 1) next.h = Math.max(0.01, 1 - next.y)
  design.setCrop(l.id, next)
}

function applyDefaultCrop() {
  const l = layer.value
  if (!l || l.kind !== 'image') return
  design.setCrop(l.id, { x: 0.1, y: 0.1, w: 0.8, h: 0.8 })
}

function clearCrop() {
  const l = layer.value
  if (!l || l.kind !== 'image') return
  design.setCrop(l.id, null)
}

function onOpacity(ev: Event) {
  const l = layer.value
  if (!l) return
  design.updateLayer(l.id, { opacity: clamp01(Number((ev.target as HTMLInputElement).value)) })
}

function onSide(ev: Event) {
  const l = layer.value
  if (!l) return
  const side = (ev.target as HTMLSelectElement).value as 'outside' | 'inside'
  design.updateLayer(l.id, { side })
}

function onResizePolicy(ev: Event) {
  const l = layer.value
  if (!l) return
  const resizePolicy = (ev.target as HTMLSelectElement).value as ArtworkLayer['resizePolicy']
  const patch: Partial<ArtworkLayer> = { resizePolicy }
  if (resizePolicy === 'anchor' && !l.anchor) {
    patch.anchor = { x: 0.5, y: 0.5 }
  }
  design.updateLayer(l.id, patch)
}

function onAnchor(key: 'x' | 'y', ev: Event) {
  const l = layer.value
  if (!l) return
  const cur = l.anchor || { x: 0.5, y: 0.5 }
  design.updateLayer(l.id, {
    anchor: { ...cur, [key]: clamp01(Number((ev.target as HTMLInputElement).value)) },
  })
}
</script>

<style scoped>
.selection{display:flex;flex-direction:column;gap:8px;padding-top:8px;border-top:1px solid #e2e8eb}
h2,h3{margin:0;font-size:13px;letter-spacing:.04em}
.meta,.hint{margin:0;font-size:12px;color:#637587}
.row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
label{display:flex;flex-direction:column;gap:4px;font-size:12px}
input,select{border:1px solid #cfd8de;border-radius:8px;padding:8px 10px;font:inherit}
.actions{display:flex;gap:8px;flex-wrap:wrap}
button{border:0;border-radius:8px;background:#0f6e68;color:#fff;padding:7px 10px;cursor:pointer;font-size:12px}
button.ghost{background:#fff;color:#16343c;border:1px solid #cfd8de}
</style>
