<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useWorkbenchStore } from '../stores/workbench'
import { useKnifeStore } from '../stores/knife'
import { useUnit } from '../composables/useUnit'
import type { SaveStatus } from '../composables/useAutosave'

const props = defineProps<{
  saveStatus?: SaveStatus
  onExport?: () => void
  /** Fixed-spec box: view only (no undo history, no design) */
  locked?: boolean
  onCheckpoint?: () => Promise<void>
}>()

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const wb = useWorkbenchStore()
const knife = useKnifeStore()
const { format } = useUnit()
const copied = ref(false)

const title = computed(() => {
  const m = wb.manifest
  if (!m) return wb.slug
  const name = locale.value?.startsWith('ko') ? m.labelKo : m.labelZh
  const d = knife.displayKnife?.dimensions
  const size = d
    ? `${format(d.panel.length)} × ${format(d.panel.width)} × ${format(d.panel.height)}`
    : ''
  return size ? `${name} · ${size}` : name
})

const saveLabel = computed(() => {
  switch (props.saveStatus) {
    case 'dirty':
      return t('workbench.saveDirty')
    case 'saving':
      return t('workbench.saving')
    case 'saved':
      return t('workbench.saved')
    case 'conflict':
      return t('workbench.saveConflict')
    case 'drift':
      return t('workbench.saveDrift')
    case 'error':
      return t('workbench.saveError')
    default:
      return ''
  }
})

async function share() {
  const q = wb.toQueryString()
  const url = `${window.location.origin}${route.path}${q}`
  try {
    await navigator.clipboard.writeText(url)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  } catch {
    window.prompt(t('workbench.copyLink'), url)
  }
}

async function goDesign() {
  if (props.onCheckpoint) await props.onCheckpoint()
  router.push({ name: 'product-detail', params: { slug: wb.slug } })
}
</script>

<template>
  <header class="top">
    <div class="brand">
      <span class="logo" aria-hidden="true" />
      <div>
        <h1>{{ title }}</h1>
        <p class="status" aria-live="polite">
          <template v-if="knife.status === 'computing'">{{ t('workbench.computing') }}</template>
          <template v-else-if="knife.status === 'ok'">{{ t('workbench.ready') }} · {{ Math.round(knife.computeMs) }}ms</template>
          <template v-else-if="knife.status === 'invalid'">{{ t('workbench.invalid') }}</template>
          <template v-else-if="knife.status === 'error'">{{ knife.errorMessage || t('workbench.error') }}</template>
          <span v-if="saveLabel" class="save"> · {{ saveLabel }}</span>
        </p>
      </div>
    </div>
    <div class="actions">
      <button type="button" :disabled="!wb.canUndo" @click="wb.undo()" :title="t('workbench.undo')">↶</button>
      <button type="button" :disabled="!wb.canRedo" @click="wb.redo()" :title="t('workbench.redo')">↷</button>
      <button type="button" @click="share">{{ copied ? t('workbench.copied') : t('workbench.share') }}</button>
      <button v-if="onExport" type="button" class="primary" @click="onExport">{{ t('workbench.export') }}</button>
      <button v-if="!locked" type="button" class="ghost" @click="goDesign">{{ t('workbench.toDesign') }}</button>
    </div>
  </header>
</template>

<style scoped>
.top{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:10px 14px;background:#fff;border:1px solid var(--bc-line);border-radius:12px
}
.brand{display:flex;gap:10px;align-items:center;min-width:0}
.logo{width:24px;height:24px;border-radius:6px;background:var(--bc-steel);flex:0 0 auto}
h1{margin:0;font-size:14px;font-weight:600;color:var(--bc-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.status{margin:2px 0 0;font-size:11px;color:var(--bc-ok)}
.save{color:var(--bc-ink-muted)}
.actions{display:flex;gap:6px;flex-wrap:wrap}
.actions button{
  height:30px;padding:0 12px;border:1px solid var(--bc-line-strong);border-radius:8px;
  background:#fff;cursor:pointer;font-size:12px;color:var(--bc-ink)
}
.actions button:disabled{opacity:.4;cursor:not-allowed}
.actions button.primary{background:var(--bc-steel);color:#fff;border-color:var(--bc-steel)}
.actions button.ghost{color:var(--bc-ink-muted)}
</style>
