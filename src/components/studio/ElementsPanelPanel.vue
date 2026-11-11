<template>
  <div class="pane">
    <h2>{{ t('studio.toolElements') }}</h2>
    <p class="hint">{{ t('studio.selectPanelHint') }}: {{ design.selectedPanelId || '—' }}</p>
    <div class="actions">
      <button type="button" :disabled="!design.selectedPanelId" @click="design.addShapeLayer('rect')">
        {{ t('studio.addRect') }}
      </button>
      <button type="button" :disabled="!design.selectedPanelId" @click="design.addShapeLayer('ellipse')">
        {{ t('studio.addEllipse') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useDesignStore } from '../../stores/design'

const { t } = useI18n()
const design = useDesignStore()
</script>

<style scoped>
.pane{display:flex;flex-direction:column;gap:8px}
h2{margin:0;font-size:14px}
.hint{margin:0;font-size:12px;color:#637587}
.actions{display:flex;flex-wrap:wrap;gap:8px}
button{border:0;border-radius:8px;background:#0f6e68;color:#fff;padding:8px 12px;cursor:pointer;font-size:13px}
button:disabled{opacity:.45;cursor:not-allowed}
</style>
