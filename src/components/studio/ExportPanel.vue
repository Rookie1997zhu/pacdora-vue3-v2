<template>
  <div class="export-panel">
    <h2>{{ t('studio.exportTitle') }}</h2>
    <p class="lead">{{ t('studio.exportLead') }}</p>
    <p class="hint">{{ t('studio.exportProof') }}</p>
    <p class="hint disclaimer">
      {{ t('studio.exportDisclaimerShort') }}
      <RouterLink to="/legal/disclaimer">{{ t('legal.navLink') }}</RouterLink>
    </p>
    <p v-if="auth.isAuthenticated" class="quota">
      {{ t('billing.remaining') }}:
      <strong>{{ billing.entitlement?.unlimited ? t('billing.unlimited') : remaining }}</strong>
      <RouterLink class="upgrade" to="/account/upgrade">{{ t('billing.upgradeLink') }}</RouterLink>
    </p>
    <p v-else class="quota warn">
      {{ t('billing.loginToExport') }}
      <RouterLink to="/account/login">{{ t('auth.signIn') }}</RouterLink>
    </p>
    <div class="actions">
      <button type="button" class="secondary" :disabled="disabled" @click="onStart('svg')">{{ t('studio.exportSvg') }}</button>
      <button type="button" class="secondary" :disabled="disabled" @click="onStart('dxf')">{{ t('studio.exportDxf') }}</button>
      <button type="button" class="secondary" :disabled="disabled" @click="onStart('pdf')">{{ t('studio.exportPdf') }}</button>
      <button type="button" class="secondary" :disabled="disabled" @click="onStart('ai')">{{ t('studio.exportAi') }}</button>
    </div>
    <template v-if="design.canExportManufacturing">
      <p class="hint mfg">{{ t('studio.exportManufacturing') }}</p>
      <div class="actions">
        <button type="button" class="secondary" :disabled="disabled" @click="onStart('svg', 'manufacturing')">
          {{ t('studio.exportMfgSvg') }}
        </button>
        <button type="button" class="secondary" :disabled="disabled" @click="onStart('dxf', 'manufacturing')">
          {{ t('studio.exportMfgDxf') }}
        </button>
        <button type="button" class="secondary" :disabled="disabled" @click="onStart('pdf', 'manufacturing')">
          {{ t('studio.exportMfgPdf') }}
        </button>
      </div>
    </template>
    <p v-if="!design.currentRevisionId" class="hint">{{ t('studio.exportNoRevision') }}</p>
    <p v-if="statusText" class="job">{{ statusText }}</p>
    <p v-if="exportStore.error" class="err">{{ displayError }}</p>
    <p v-if="exportStore.errorCode === 'EXPORT_QUOTA_EXCEEDED'" class="wall">
      {{ t('billing.quotaExceeded') }}
      <RouterLink to="/account/upgrade">{{ t('billing.upgradeNow') }}</RouterLink>
    </p>
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
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ExportFormat, ExportTier } from '../../api/exports'
import { useAuthStore } from '../../stores/auth'
import { useBillingStore } from '../../stores/billing'
import { useDesignStore } from '../../stores/design'
import { useExportStore } from '../../stores/export'

const { t } = useI18n()
const design = useDesignStore()
const exportStore = useExportStore()
const auth = useAuthStore()
const billing = useBillingStore()

const remaining = computed(() => billing.entitlement?.remaining ?? '—')

const disabled = computed(
  () =>
    !auth.isAuthenticated ||
    exportStore.busy ||
    !design.currentRevisionId ||
    design.document?.geometry.mode === 'model_only',
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
  if (exportStore.errorCode === 'EXPORT_QUOTA_EXCEEDED') {
    return t('billing.quotaExceeded')
  }
  if (exportStore.errorCode === 'UNAUTHORIZED' || exportStore.errorCode === 'FORBIDDEN') {
    return t('billing.loginToExport')
  }
  return exportStore.error || t('studio.exportFailed')
})

onMounted(() => {
  if (auth.isAuthenticated) void billing.refresh()
})

async function onStart(format: ExportFormat, tier: ExportTier = 'vector_proof') {
  await exportStore.start(format, tier)
}
</script>

<style scoped>
.export-panel{display:flex;flex-direction:column;gap:10px;margin:0}
h2{
  margin:0;
  font-size:11px;
  letter-spacing:.08em;
  text-transform:uppercase;
  color:var(--studio-ink-muted, #64748b);
  font-weight:600;
}
.lead,.hint,.job,.quota{margin:0;font-size:12px;color:var(--studio-ink-muted, #64748b);line-height:1.45}
.hint.mfg{margin-top:2px;color:var(--bc-steel)}
.hint.disclaimer a{
  margin-left:4px;
  color:var(--bc-steel);
  font-weight:600;
  text-decoration:none;
}
.hint.disclaimer a:hover{text-decoration:underline}
.quota.warn{color:var(--bc-warn)}
.quota .upgrade,.wall a{
  margin-left:8px;
  color:var(--bc-steel);
  font-weight:600;
  text-decoration:none;
}
.quota .upgrade:hover,.wall a:hover{text-decoration:underline}
.actions{display:flex;flex-wrap:wrap;gap:8px}
button{
  border:0;
  border-radius:var(--studio-radius-sm, 8px);
  background:var(--bc-steel);
  color:#fff;
  padding:9px 14px;
  cursor:pointer;
  font:inherit;
  font-size:12px;
  font-weight:600;
  transition:background var(--studio-ease, 160ms ease), color var(--studio-ease, 160ms ease), box-shadow var(--studio-ease, 160ms ease);
}
button.secondary{
  background:transparent;
  color:var(--studio-ink, var(--bc-ink));
  box-shadow:inset 0 0 0 1px var(--studio-border, #e2e8f0);
}
button.secondary:hover:not(:disabled){
  color:var(--bc-steel);
  background:var(--bc-steel-soft);
  box-shadow:inset 0 0 0 1px var(--bc-steel);
}
button:disabled{opacity:.45;cursor:not-allowed}
button.download{
  align-self:stretch;
  margin-top:4px;
  min-height:40px;
}
button.download:hover:not(:disabled){background:var(--bc-steel-hover)}
.err,.wall{margin:0;font-size:12px;color:var(--bc-danger)}
</style>
