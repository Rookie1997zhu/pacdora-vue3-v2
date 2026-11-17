<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWorkbenchStore } from '../../stores/workbench'
import { templateForManifest } from '../../manifest'
import BasicTab from './BasicTab.vue'
import AdvancedTab from './AdvancedTab.vue'

const { t, locale } = useI18n()
const wb = useWorkbenchStore()
const tab = ref<'basic' | 'advanced' | 'info'>('basic')

const info = computed(() => {
  if (!wb.manifest) return null
  const tpl = templateForManifest(wb.manifest)
  return {
    standard: tpl?.standard,
    label: locale.value?.startsWith('ko') ? wb.manifest.labelKo : wb.manifest.labelZh,
    tiers: wb.manifest.tiers.join(', '),
    engine: '3.1.0',
  }
})
</script>

<template>
  <aside class="panel">
    <nav class="rail" aria-label="tabs">
      <button type="button" :class="{ on: tab === 'basic' }" @click="tab = 'basic'">{{ t('workbench.tabBasic') }}</button>
      <button type="button" :class="{ on: tab === 'advanced' }" @click="tab = 'advanced'">{{ t('workbench.tabAdvanced') }}</button>
      <button type="button" :class="{ on: tab === 'info' }" @click="tab = 'info'">{{ t('workbench.tabInfo') }}</button>
    </nav>
    <div class="body">
      <BasicTab v-if="tab === 'basic'" />
      <AdvancedTab v-else-if="tab === 'advanced'" />
      <div v-else class="info">
        <h3>{{ info?.label }}</h3>
        <p>{{ t('workbench.infoStandard') }}: {{ info?.standard }}</p>
        <p>{{ t('workbench.infoTiers') }}: {{ info?.tiers }}</p>
        <p>{{ t('workbench.infoEngine') }}: {{ info?.engine }}</p>
        <p class="disc">{{ t('workbench.infoDisclaimer') }}</p>
        <router-link to="/legal/disclaimer">{{ t('workbench.disclaimerLink') }}</router-link>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.panel{
  display:grid;grid-template-columns:56px 1fr;background:#fff;border:1px solid var(--bc-line);
  border-radius:12px;overflow:hidden;min-height:0;
}
.rail{display:flex;flex-direction:column;gap:4px;padding:8px 6px;background:#f1f5f9;border-right:1px solid var(--bc-line)}
.rail button{
  writing-mode:horizontal-tb;font-size:11px;padding:10px 4px;border:0;border-radius:8px;
  background:transparent;color:var(--bc-ink-muted);cursor:pointer
}
.rail button.on{background:var(--bc-steel-soft);color:var(--bc-steel);font-weight:600}
.body{padding:14px;overflow:auto}
.info{font-size:13px;color:var(--bc-ink-muted);line-height:1.6}
.info h3{margin:0 0 8px;color:var(--bc-ink)}
.disc{margin-top:12px}
@media (max-width:767px){
  .panel{grid-template-columns:1fr;grid-template-rows:auto 1fr}
  .rail{flex-direction:row;border-right:0;border-bottom:1px solid var(--bc-line)}
}
</style>
