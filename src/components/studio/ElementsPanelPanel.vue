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
.pane{display:flex;flex-direction:column;gap:10px}
h2{margin:0;font-size:14px;color:var(--studio-ink, var(--bc-ink))}
.hint{margin:0;font-size:12px;color:var(--studio-ink-muted, #64748b)}
.actions{display:flex;flex-wrap:wrap;gap:8px}
button{
  border:0;
  border-radius:var(--studio-radius-sm, 8px);
  background:var(--bc-steel);
  color:#fff;
  padding:9px 14px;
  cursor:pointer;
  font-size:13px;
  font-weight:600;
  transition:background var(--studio-ease, 160ms ease);
}
button:hover:not(:disabled){background:var(--bc-steel-hover)}
button:disabled{opacity:.45;cursor:not-allowed}
</style>
