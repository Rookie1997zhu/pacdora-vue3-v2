<template>
  <div class="ai-panel">
    <h2>{{ t('studio.aiTitle') }}</h2>
    <label>
      {{ t('studio.aiMode') }}
      <select v-model="ai.mode" :disabled="ai.busy">
        <option value="image">{{ t('studio.aiModeImage') }}</option>
        <option value="main_area">{{ t('studio.aiModeMainArea') }}</option>
      </select>
    </label>
    <p v-if="!ai.activeCapability.enabled" class="blocked">
      {{ t('studio.aiUnavailable') }}
      <span v-if="ai.activeCapability.reason">({{ ai.activeCapability.reason }})</span>
    </p>
    <label>
      {{ t('studio.aiPrompt') }}
      <textarea v-model="ai.prompt" rows="3" maxlength="4000" :disabled="!ai.activeCapability.enabled || ai.busy" />
    </label>
    <div class="actions">
      <button type="button" :disabled="!ai.activeCapability.enabled || ai.busy || !ai.prompt.trim()" @click="onGenerate">
        {{ t('studio.aiGenerate') }}
      </button>
      <button
        type="button"
        :disabled="!ai.currentJob || !['queued', 'running'].includes(ai.currentJob.status) || ai.busy"
        @click="ai.cancel()"
      >
        {{ t('studio.aiCancel') }}
      </button>
    </div>
    <p v-if="ai.currentJob" class="job">
      {{ t('studio.aiJobStatus') }}: {{ ai.currentJob.status }}
      <span v-if="ai.currentJob.error_message"> · {{ ai.currentJob.error_message }}</span>
    </p>
    <p v-if="ai.error" class="err">{{ ai.error }}</p>
    <p v-if="ai.mode === 'image'" class="hint">{{ t('studio.aiApplyHint') }}: {{ design.selectedPanelId || '—' }}</p>
    <template v-else>
      <p class="hint">{{ t('studio.aiApplyNetHint') }}</p>
      <p class="hint">{{ t('studio.aiMaskMultimodal') }}</p>
    </template>
    <h3>{{ t('studio.aiGallery') }}</h3>
    <ul class="gallery">
      <li v-for="item in ai.gallery" :key="item.job_id">
        <div class="meta">
          <strong>{{ item.prompt.slice(0, 48) }}</strong>
          <span>{{ opLabel(item.operation) }} · {{ item.asset.id }}</span>
        </div>
        <button type="button" :disabled="ai.busy || applyDisabled(item)" @click="onApply(item)">
          {{ isMainAreaItem(item) ? t('studio.aiApplyNet') : t('studio.aiApply') }}
        </button>
      </li>
      <li v-if="!ai.gallery.length" class="empty">{{ t('studio.aiGalleryEmpty') }}</li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { GeneratedAssetItem } from '../../api/ai'
import { useAiStore } from '../../stores/ai'
import { useDesignStore } from '../../stores/design'

const { t } = useI18n()
const ai = useAiStore()
const design = useDesignStore()

function isMainAreaItem(item: GeneratedAssetItem) {
  return (item.operation || '') === 'main_area_generate'
}

function opLabel(op?: string) {
  if (op === 'main_area_generate') return t('studio.aiModeMainArea')
  return t('studio.aiModeImage')
}

function applyDisabled(item: GeneratedAssetItem) {
  if (isMainAreaItem(item)) return !design.document
  return !design.selectedPanelId
}

async function refresh() {
  if (!design.designId) return
  await ai.loadCapabilities()
  await ai.loadGallery(design.designId)
}

async function onGenerate() {
  if (!design.designId) return
  await ai.generate(design.designId)
}

async function onApply(item: GeneratedAssetItem) {
  if (isMainAreaItem(item)) {
    await ai.apply(item.job_id, null)
  } else {
    await ai.apply(item.job_id, design.selectedPanelId || '')
  }
}

onMounted(() => {
  void refresh()
})

watch(
  () => design.designId,
  () => {
    void refresh()
  },
)

onUnmounted(() => {
  ai.reset()
})
</script>

<style scoped>
.ai-panel{display:flex;flex-direction:column;gap:8px}
h2,h3{margin:0;font-size:13px;letter-spacing:.04em}
label{display:flex;flex-direction:column;gap:4px;font-size:12px}
textarea,select{border:1px solid #cfd8de;border-radius:8px;padding:8px 10px;font:inherit;resize:vertical}
.actions{display:flex;gap:8px;flex-wrap:wrap}
button{border:0;border-radius:6px;background:var(--bc-ink,#111827);color:#fff;padding:8px 12px;cursor:pointer;font-size:12px;font-weight:600}
button:disabled{opacity:.45;cursor:not-allowed}
.blocked,.err{margin:0;font-size:12px;color:#9a4339}
.hint,.job{margin:0;font-size:12px;color:#637587}
.gallery{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.gallery li{border:1px solid #d5e0e4;border-radius:10px;padding:8px 10px;background:#fff;display:flex;flex-direction:column;gap:6px}
.meta{display:flex;flex-direction:column;gap:2px}
.meta span{font-size:11px;color:#637587}
.empty{color:#637587;border-style:dashed}
</style>
