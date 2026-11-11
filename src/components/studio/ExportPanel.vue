<template>
  <div class="export-panel">
    <h2>{{ t('studio.exportTitle') }}</h2>
    <p class="lead">{{ t('studio.exportLead') }}</p>
    <p class="hint">{{ t('studio.exportProof') }}</p>
    <div class="actions">
      <button type="button" :disabled="disabled" @click="onStart('svg')">{{ t('studio.exportSvg') }}</button>
      <button type="button" :disabled="disabled" @click="onStart('dxf')">{{ t('studio.exportDxf') }}</button>
      <button type="button" :disabled="disabled" @click="onStart('pdf')">{{ t('studio.exportPdf') }}</button>
    </div>
    <template v-if="design.canExportManufacturing">
      <p class="hint mfg">{{ t('studio.exportManufacturing') }}</p>
      <div class="actions">
        <button type="button" :disabled="disabled" @click="onStart('svg', 'manufacturing')">
          {{ t('studio.exportMfgSvg') }}
        </button>
        <button type="button" :disabled="disabled" @click="onStart('dxf', 'manufacturing')">
          {{ t('studio.exportMfgDxf') }}
        </button>
        <button type="button" :disabled="disabled" @click="onStart('pdf', 'manufacturing')">
          {{ t('studio.exportMfgPdf') }}
        </button>
      </div>
    </template>
    <p v-if="!design.currentRevisionId" class="hint">{{ t('studio.exportNoRevision') }}</p>
    <p v-if="statusText" class="job">{{ statusText }}</p>
    <p v-if="exportStore.error" class="err">{{ displayError }}</p>
    <button
      v-if="exportStore.currentJob?.status === 'succeeded'"
      type="button"
      class="download"
      :disabled="exportStore.busy"
      @click="exportStore.download()"
    >
      {{ t('studio.exportDownload') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ExportFormat, ExportTier } from '../../api/exports'
import { useDesignStore } from '../../stores/design'
import { useExportStore } from '../../stores/export'

const { t } = useI18n()
const design = useDesignStore()
const exportStore = useExportStore()

const disabled = computed(
  () => exportStore.busy || !design.currentRevisionId || design.document?.geometry.mode === 'model_only',
)

const statusText = computed(() => {
  const job = exportStore.currentJob
  if (!job) return ''
  if (job.status === 'queued') return t('studio.exportQueued')
  if (job.status === 'running') return t('studio.exportRunning')
  if (job.status === 'succeeded') {
    return job.quality_tier === 'manufacturing' ? t('studio.exportMfgReady') : t('studio.exportReady')
  }
  if (job.status === 'failed') return t('studio.exportFailed')
  return `${t('studio.exportTitle')}: ${job.status}`
})

const displayError = computed(() => {
  if (exportStore.errorCode === 'NO_REVISION' || exportStore.error === 'no_revision') {
    return t('studio.exportNoRevision')
  }
  if (exportStore.errorCode === 'MANUFACTURING_BLOCKED') {
    return t('studio.exportManufacturingBlocked')
  }
  if (exportStore.errorCode === 'APPROX_BLOCKED') {
    return t('studio.exportApproxBlocked')
  }
  if (exportStore.errorCode === 'NO_APPROVAL') {
    return t('studio.exportNoApproval')
  }
  return exportStore.error || t('studio.exportFailed')
})

async function onStart(format: ExportFormat, tier: ExportTier = 'vector_proof') {
  await exportStore.start(format, tier)
}
</script>

<style scoped>
.export-panel{display:flex;flex-direction:column;gap:8px;margin:14px 0 4px}
h2{margin:0;font-size:13px;letter-spacing:.04em}
.lead,.hint,.job{margin:0;font-size:12px;color:#637587}
.hint.mfg{margin-top:4px;color:#3d5a54}
.actions{display:flex;flex-wrap:wrap;gap:8px}
button{border:0;border-radius:6px;background:var(--bc-ink,#111827);color:#fff;padding:8px 12px;cursor:pointer;font:inherit;font-size:12px;font-weight:600}
button:disabled{opacity:.45;cursor:not-allowed}
button.download{align-self:flex-start}
.err{margin:0;font-size:12px;color:#9a4339}
</style>
