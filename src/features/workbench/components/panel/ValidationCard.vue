<script setup lang="ts">
import { computed } from 'vue'
import { useKnifeStore } from '../../stores/knife'
import { useI18n } from 'vue-i18n'

const knife = useKnifeStore()
const { t } = useI18n()

const level = computed(() => {
  const issues = knife.issues || []
  if (knife.status === 'error') return 'error'
  if (issues.some((i: any) => i.severity === 'blocking') || knife.status === 'invalid') return 'error'
  if (issues.some((i: any) => i.severity === 'warning')) return 'warn'
  if (issues.length) return 'info'
  return 'ok'
})

const items = computed(() => (knife.issues || []).slice(0, 6))
</script>

<template>
  <div class="card" :class="level" role="status" aria-live="polite">
    <div class="title">
      <template v-if="level === 'ok'">{{ t('workbench.validationOk') }}</template>
      <template v-else-if="level === 'error'">{{ t('workbench.validationError', { n: items.filter((i:any)=>i.severity==='blocking').length || items.length }) }}</template>
      <template v-else>{{ t('workbench.validationWarn', { n: items.length }) }}</template>
    </div>
    <ul v-if="items.length">
      <li v-for="(it, idx) in items" :key="idx">{{ it.message }}</li>
    </ul>
    <p v-if="knife.status === 'invalid'" class="hint">{{ t('workbench.showingLastValid') }}</p>
  </div>
</template>

<style scoped>
.card{border-radius:8px;padding:10px 12px;font-size:12px;border:1px solid var(--bc-line)}
.card.ok{background:#f1faf4;border-color:#bfe5cd;color:var(--bc-ok)}
.card.warn{background:var(--bc-warn-bg);border-color:var(--bc-warn-line);color:var(--bc-warn)}
.card.error{background:#fdf1ef;border-color:#e8b4ae;color:var(--bc-danger)}
.card.info{background:#f1f5f9;color:var(--bc-ink-muted)}
.title{font-weight:600;margin-bottom:4px}
ul{margin:0;padding-left:16px}
.hint{margin:6px 0 0;opacity:.85}
</style>
