<template>
  <div class="pane">
    <h2>{{ t('studio.toolText') }}</h2>
    <p class="hint">{{ t('studio.selectPanelHint') }}: {{ design.selectedPanelId || '—' }}</p>
    <label>
      {{ t('studio.textContent') }}
      <input v-model="content" type="text" maxlength="500" />
    </label>
    <div class="row">
      <label>
        {{ t('studio.fontSizeMm') }}
        <input v-model.number="fontSizeMm" type="number" min="1" max="200" step="0.5" />
      </label>
      <label>
        {{ t('studio.fillColor') }}
        <input v-model="fill" type="color" />
      </label>
    </div>
    <label>
      {{ t('studio.textAlign') }}
      <select v-model="align">
        <option value="left">{{ t('studio.alignLeft') }}</option>
        <option value="center">{{ t('studio.alignCenter') }}</option>
        <option value="right">{{ t('studio.alignRight') }}</option>
      </select>
    </label>
    <button type="button" :disabled="!design.selectedPanelId" @click="onAdd">
      {{ t('studio.addText') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDesignStore } from '../../stores/design'

const { t } = useI18n()
const design = useDesignStore()
const content = ref('Text')
const fontSizeMm = ref(8)
const fill = ref('#16343c')
const align = ref<'left' | 'center' | 'right'>('left')

function onAdd() {
  design.addTextLayer(design.selectedPanelId, {
    content: content.value || 'Text',
    fontSizeMm: fontSizeMm.value,
    fill: fill.value,
    align: align.value,
  })
}
</script>

<style scoped>
.pane{display:flex;flex-direction:column;gap:8px}
h2{margin:0;font-size:14px}
.hint{margin:0;font-size:12px;color:#637587}
.row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
label{display:flex;flex-direction:column;gap:4px;font-size:12px}
input,select{border:1px solid #cfd8de;border-radius:8px;padding:8px 10px;font:inherit}
button{border:0;border-radius:8px;background:#0f6e68;color:#fff;padding:8px 12px;cursor:pointer;font-size:13px}
button:disabled{opacity:.45;cursor:not-allowed}
</style>
