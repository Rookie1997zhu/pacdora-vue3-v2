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
.tool-rail{
  display:flex;
  flex-direction:column;
  gap:12px;
  height:100%;
  min-height:0;
}
.tabs{
  display:flex;
  flex-direction:column;
  gap:2px;
  padding:4px;
  border-radius:var(--studio-radius-sm, 8px);
  background:var(--studio-muted, #f1f5f9);
  border:0;
}
.tabs button{
  border:0;
  background:transparent;
  border-radius:6px;
  padding:9px 12px;
  font-size:13px;
  font-weight:500;
  cursor:pointer;
  color:var(--studio-ink-muted, var(--bc-ink-muted));
  text-align:left;
  transition:background var(--studio-ease, 160ms ease), color var(--studio-ease, 160ms ease);
}
.tabs button:hover{
  background:rgba(255,255,255,.7);
  color:var(--studio-ink, var(--bc-ink));
}
.tabs button.on{
  background:var(--studio-card-bg, #fff);
  color:var(--bc-steel);
  font-weight:600;
  box-shadow:0 1px 2px rgba(15,23,42,.06);
}
.tabs button:focus-visible{
  outline:none;
  box-shadow:var(--bc-focus);
}
.body{
  flex:1;
  min-height:0;
  overflow:auto;
  display:flex;
  flex-direction:column;
  gap:14px;
  padding-top:2px;
}
.pane{display:flex;flex-direction:column;gap:10px}
h2{
  margin:0;
  font-size:14px;
  font-family:var(--bc-font-display);
  color:var(--studio-ink, var(--bc-ink));
}
.hint{margin:0;font-size:12px;color:var(--studio-ink-muted, var(--bc-ink-muted))}
.upload{display:flex;flex-direction:column;gap:8px;font-size:13px;color:var(--studio-ink, var(--bc-ink));font-weight:500}
.upload input{
  font:inherit;
  padding:8px;
  border:1px dashed var(--studio-border, #e2e8f0);
  border-radius:var(--studio-radius-sm, 8px);
  background:var(--studio-card-bg, #fff);
}
</style>
