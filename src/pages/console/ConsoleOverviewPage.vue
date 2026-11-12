<template>
  <ConsoleShell :title="t('console.nav.overview')">
    <p v-if="error" class="err">{{ error }}</p>
    <p v-else-if="!data" class="muted">{{ t('console.loading') }}</p>
    <div v-else class="grid">
      <div v-for="card in cards" :key="card.key" class="card">
        <p class="label">{{ card.label }}</p>
        <p class="value">{{ card.value }}</p>
      </div>
      <div class="card wide">
        <p class="label">{{ t('console.overview.geometry') }}</p>
        <p class="value">{{ data.health?.geometry?.ok ? t('console.overview.ok') : t('console.overview.down') }}</p>
        <pre class="detail">{{ data.health?.geometry?.detail }}</pre>
      </div>
    </div>
  </ConsoleShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { consoleApi } from '../../api/console'
import ConsoleShell from '../../components/console/ConsoleShell.vue'

const { t } = useI18n()
const data = ref<any>(null)
const error = ref('')

const cards = computed(() => {
  const c = data.value?.counts || {}
  return [
    { key: 'd', label: t('console.overview.designs24h'), value: c.designs_24h ?? '—' },
    { key: 'e', label: t('console.overview.exports24h'), value: c.exports_24h ?? '—' },
    { key: 'o', label: t('console.overview.orders24h'), value: c.orders_24h ?? '—' },
    { key: 'q', label: t('console.overview.quotes24h'), value: c.quotes_24h ?? '—' },
    { key: 'ef', label: t('console.overview.exportFailed'), value: c.export_failed ?? '—' },
    { key: 'af', label: t('console.overview.aiFailed'), value: c.ai_failed ?? '—' },
    { key: 'aq', label: t('console.overview.acqFailed'), value: c.acquisition_failed ?? '—' },
  ]
})

onMounted(async () => {
  try {
    data.value = await consoleApi.overview()
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'load failed'
  }
})
</script>

<style scoped>
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}
.card{background:var(--bc-paper-elevated);border:1px solid var(--bc-line);border-radius:var(--bc-radius);padding:14px}
.card.wide{grid-column:1 / -1}
.label{margin:0;font-size:12px;color:var(--bc-ink-muted);text-transform:uppercase;letter-spacing:.04em}
.value{margin:8px 0 0;font-size:28px;font-family:var(--bc-font-display);font-weight:600}
.detail{margin:8px 0 0;font-size:12px;color:var(--bc-ink-muted);white-space:pre-wrap}
.err{color:var(--bc-danger)}
.muted{color:var(--bc-ink-muted)}
</style>
