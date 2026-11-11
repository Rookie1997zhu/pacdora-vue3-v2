<template>
  <div class="layers-panel">
    <div class="head">
      <h2>{{ t('studio.toolLayers') }}</h2>
      <div class="hist">
        <button type="button" :disabled="!design.canUndo" @click="design.undo()">{{ t('studio.undo') }}</button>
        <button type="button" :disabled="!design.canRedo" @click="design.redo()">{{ t('studio.redo') }}</button>
      </div>
    </div>
    <p class="hint">{{ t('studio.selectPanelHint') }}: {{ design.selectedPanelId || '—' }}</p>
    <div v-if="design.pendingAdaptCount" class="adapt-banner">
      <p>{{ t('studio.needsAdaptBanner', { n: design.pendingAdaptCount }) }}</p>
      <ul class="adapt-list">
        <li v-for="layer in design.pendingAdaptLayers" :key="'adapt-' + layer.id">
          <span>{{ layer.name }} · {{ adaptLabel(layer.adaptStatus) }}</span>
          <div class="adapt-actions">
            <button type="button" @click="design.clearLayerAdapt(layer.id)">{{ t('studio.adaptKeep') }}</button>
            <button
              v-if="layer.adaptStatus === 'needs_rebind'"
              type="button"
              @click="design.rebindLayerToSelectedPanel(layer.id)"
            >
              {{ t('studio.adaptRebind') }}
            </button>
            <button type="button" class="ghost" @click="design.clearLayerAdapt(layer.id)">
              {{ t('studio.adaptClear') }}
            </button>
          </div>
        </li>
      </ul>
    </div>
    <ul>
      <li
        v-for="layer in sorted"
        :key="layer.id"
        :class="{ on: layer.id === design.selectedLayerId, warn: !!layer.adaptStatus && layer.adaptStatus !== 'ok' }"
        @click="design.selectLayer(layer.id)"
      >
        <div class="meta">
          <strong>{{ layer.name }}</strong>
          <span>
            {{ layer.kind }} · {{ layer.coordinateSpace || 'panel_mm' }}
            · {{ layer.coordinateSpace === 'net_mm' ? 'net' : layer.panelId || '—' }}
            · {{ layer.side || 'outside' }} · z{{ layer.zIndex }}
            <template v-if="layer.adaptStatus === 'needs_adapt'"> · {{ t('studio.needsAdapt') }}</template>
            <template v-else-if="layer.adaptStatus === 'needs_rebind'"> · {{ t('studio.needsRebind') }}</template>
          </span>
        </div>
        <div class="actions" @click.stop>
          <button type="button" @click="design.setLayerVisible(layer.id, !layer.visible)">
            {{ layer.visible ? t('studio.hide') : t('studio.show') }}
          </button>
          <button type="button" @click="design.setLayerLocked(layer.id, !layer.locked)">
            {{ layer.locked ? t('studio.unlock') : t('studio.lock') }}
          </button>
          <button type="button" @click="design.reorderLayer(layer.id, 'up')">↑</button>
          <button type="button" @click="design.reorderLayer(layer.id, 'down')">↓</button>
          <button type="button" @click="design.duplicateLayer(layer.id)">{{ t('studio.copy') }}</button>
          <button type="button" class="danger" @click="design.deleteLayer(layer.id)">{{ t('studio.delete') }}</button>
        </div>
      </li>
      <li v-if="!sorted.length" class="empty">{{ t('studio.noLayers') }}</li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDesignStore } from '../../stores/design'

const { t } = useI18n()
const design = useDesignStore()

const sorted = computed(() =>
  [...(design.document?.artwork.layers || [])].sort((a, b) => b.zIndex - a.zIndex),
)

function adaptLabel(status: string | null | undefined) {
  if (status === 'needs_rebind') return t('studio.needsRebind')
  if (status === 'needs_adapt') return t('studio.needsAdapt')
  return ''
}
</script>

<style scoped>
.layers-panel{display:flex;flex-direction:column;gap:10px;height:100%}
.head{display:flex;align-items:center;justify-content:space-between;gap:8px}
h2{margin:0;font-size:14px;letter-spacing:.04em}
.hist{display:flex;gap:6px}
button{border:1px solid #cfd8de;background:#f8fbfb;border-radius:8px;padding:4px 8px;cursor:pointer;font-size:12px}
button:disabled{opacity:.4;cursor:not-allowed}
button.ghost{background:#fff}
.hint{margin:0;font-size:12px;color:#637587}
.adapt-banner{border:1px solid #e6c48a;background:#fff8ec;border-radius:10px;padding:8px 10px}
.adapt-banner p{margin:0 0 6px;font-size:12px;color:#7a5a2a}
.adapt-list{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.adapt-list li{display:flex;flex-direction:column;gap:4px;font-size:12px}
.adapt-actions{display:flex;flex-wrap:wrap;gap:4px}
ul{list-style:none;margin:0;padding:0;display:grid;gap:8px;overflow:auto}
li{border:1px solid #d5e0e4;border-radius:10px;padding:8px 10px;background:#fff;cursor:pointer}
li.on{border-color:var(--bc-steel,#2a6f7a);box-shadow:0 0 0 1px var(--bc-steel,#2a6f7a)}
li.warn{border-color:#d4a017}
.meta{display:flex;flex-direction:column;gap:2px;margin-bottom:6px}
.meta span{font-size:12px;color:#637587}
.actions{display:flex;flex-wrap:wrap;gap:4px}
.danger{color:#9a4339}
.empty{color:#637587;cursor:default}
</style>
