<template>
  <div class="tool-rail">
    <nav class="tabs" role="tablist">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        role="tab"
        :aria-selected="active === tab.id"
        :class="{ on: active === tab.id }"
        @click="active = tab.id"
      >
        {{ t(tab.labelKey) }}
      </button>
    </nav>
    <div class="body">
      <AiPanel v-if="active === 'ai'" />
      <div v-else-if="active === 'upload'" class="pane">
        <h2>{{ t('studio.toolUpload') }}</h2>
        <p class="hint">{{ t('studio.selectPanelHint') }}: {{ design.selectedPanelId || '—' }}</p>
        <label class="upload">
          {{ t('studio.uploadImage') }}
          <input type="file" accept="image/png,image/jpeg,image/webp" @change="onFile" />
        </label>
      </div>
      <TextToolPanel v-else-if="active === 'text'" />
      <ElementsPanelPanel v-else-if="active === 'elements'" />
      <LayersPanel v-else-if="active === 'layers'" />
      <SelectionPanel v-if="design.selectedLayer" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ApiError } from '../../api/client'
import { useDesignStore } from '../../stores/design'
import AiPanel from './AiPanel.vue'
import ElementsPanelPanel from './ElementsPanelPanel.vue'
import LayersPanel from './LayersPanel.vue'
import SelectionPanel from './SelectionPanel.vue'
import TextToolPanel from './TextToolPanel.vue'

const { t } = useI18n()
const design = useDesignStore()
const active = ref<'ai' | 'upload' | 'text' | 'elements' | 'layers'>('layers')

const tabs = [
  { id: 'ai' as const, labelKey: 'studio.toolAi' },
  { id: 'upload' as const, labelKey: 'studio.toolUpload' },
  { id: 'text' as const, labelKey: 'studio.toolText' },
  { id: 'elements' as const, labelKey: 'studio.toolElements' },
  { id: 'layers' as const, labelKey: 'studio.toolLayers' },
]

async function onFile(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    await design.addImageLayer(file)
  } catch (e: unknown) {
    design.error = e instanceof ApiError ? e.message : t('studio.uploadFailed')
  } finally {
    input.value = ''
  }
}
</script>

<style scoped>
.tool-rail{display:flex;flex-direction:column;gap:10px;height:100%;min-height:0}
.tabs{
  display:flex;
  flex-direction:column;
  gap:4px;
  padding-bottom:8px;
  border-bottom:1px solid var(--bc-line);
}
.tabs button{
  border:1px solid transparent;
  background:transparent;
  border-radius:var(--bc-radius-sm);
  padding:8px 10px;
  font-size:12px;
  font-weight:600;
  cursor:pointer;
  color:var(--bc-ink-muted);
  text-align:left;
}
.tabs button:hover{background:var(--bc-paper);color:var(--bc-ink)}
.tabs button.on{
  background:var(--bc-steel-soft);
  border-color:transparent;
  color:var(--bc-steel);
}
.body{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:12px}
.pane{display:flex;flex-direction:column;gap:8px}
h2{margin:0;font-size:14px;font-family:var(--bc-font-display)}
.hint{margin:0;font-size:12px;color:var(--bc-ink-muted)}
.upload{display:flex;flex-direction:column;gap:6px;font-size:13px}
.upload input{font:inherit}
</style>
