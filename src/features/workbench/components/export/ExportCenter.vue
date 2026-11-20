<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useBillingStore } from '../../../../stores/billing'
import { useDesignStore } from '../../../../stores/design'
import { useExportStore } from '../../../../stores/export'
import type { ExportFormat, ExportTier } from '../../../../api/exports'
import { useAuthStore } from '../../../../stores/auth'
import { useKnifeStore } from '../../stores/knife'
import { useWorkbenchStore } from '../../stores/workbench'
import GateDialog from './GateDialog.vue'
import ExportNotices from '../../../../components/export/ExportNotices.vue'

const props = defineProps<{
  designId: string | null
  revisionId: string | null
  exportBlocked?: boolean
  checkpoint: () => Promise<void>
  ensureDesign: () => Promise<boolean>
  loginWithClaim: () => void
}>()

const { t, locale } = useI18n()
const auth = useAuthStore()
const billing = useBillingStore()
const design = useDesignStore()
const exportStore = useExportStore()
const wb = useWorkbenchStore()
const knife = useKnifeStore()
const { jobList, busy, error, errorCode } = storeToRefs(exportStore)

const open = ref(false)
const format = ref<ExportFormat>('pdf')
const tier = ref<ExportTier>('vector_proof')
const showDimensions = ref(true)
const showBleed = ref(true)
const showFaceNames = ref(false)
const showTitleBlock = ref(true)
const gate = ref<'login' | 'quota' | 'validation' | null>(null)
const gateDetail = ref('')

const tiers = computed(() => wb.manifest?.tiers || ['vector_proof'])
const engineeringDisabled = computed(() => {
  if (!tiers.value.includes('engineering')) return true
  // Domain check is soft on UI; server enforces. Prefer dimensions when knife has inner dims.
  return false
})

const remainingLabel = computed(() => {
  const e = billing.entitlement
  if (!e) return ''
  if (e.unlimited) return t('workbench.quotaUnlimited')
  return t('workbench.quotaRemaining', { n: e.remaining ?? 0 })
})

onMounted(() => {
  if (auth.isAuthenticated) void billing.refresh()
})

watch(
  () => props.designId,
  (id) => {
    if (id) {
      design.designId = id
      void exportStore.restoreForDesign(id)
    }
  },
  { immediate: true },
)

watch(
  () => props.revisionId,
  (id) => {
    if (id) design.currentRevisionId = id
  },
  { immediate: true },
)

function tierLabel(code: string) {
  if (code === 'vector_proof') return t('workbench.tierVectorProof')
  if (code === 'engineering') return t('workbench.tierEngineering')
  return code
}

function statusLabel(code: string) {
  if (code === 'queued') return t('workbench.statusQueued')
  if (code === 'running') return t('workbench.statusRunning')
  if (code === 'succeeded') return t('workbench.statusSucceeded')
  if (code === 'failed') return t('workbench.statusFailed')
  if (code === 'cancelled' || code === 'canceled') return t('workbench.statusCancelled')
  return code
}

async function requestExport() {
  if (!auth.isAuthenticated) {
    gate.value = 'login'
    return
  }
  if (props.exportBlocked) {
    gate.value = 'validation'
    gateDetail.value = t('workbench.driftBlocked')
    return
  }
  if (knife.blockingIssues.length) {
    gate.value = 'validation'
    gateDetail.value = t('workbench.gateValidationBody')
    return
  }
  await billing.refresh()
  const ent = billing.entitlement
  if (ent && !ent.unlimited && (ent.remaining ?? 0) <= 0) {
    gate.value = 'quota'
    return
  }
  const ok = await props.ensureDesign()
  if (!ok) return
  await props.checkpoint()
  if (props.exportBlocked) {
    gate.value = 'validation'
    gateDetail.value = t('workbench.driftBlocked')
    return
  }
  if (props.designId) design.designId = props.designId
  if (props.revisionId) design.currentRevisionId = props.revisionId
  open.value = true
}

async function submit() {
  await props.checkpoint()
  if (props.designId) design.designId = props.designId
  if (props.revisionId) design.currentRevisionId = props.revisionId
  if (props.exportBlocked) {
    gate.value = 'validation'
    gateDetail.value = t('workbench.driftBlocked')
    return
  }
  await exportStore.start(
    format.value,
    tier.value,
    {
      showDimensions: showDimensions.value,
      showBleed: showBleed.value,
      showFaceNames: showFaceNames.value,
      showTitleBlock: tier.value === 'engineering' ? true : showTitleBlock.value,
      displayUnit: wb.displayUnit,
      locale: locale.value?.startsWith('ko') ? 'ko-KR' : 'zh-CN',
    },
    'workbench',
  )
}

defineExpose({ requestExport })
</script>

<template>
  <div class="wrap">
    <button type="button" class="cta" @click="requestExport">{{ t('workbench.export') }}</button>
    <p v-if="remainingLabel" class="quota">{{ remainingLabel }} · {{ t('workbench.exportCostHint') }}</p>

    <div v-if="open" class="panel">
      <header>
        <strong>{{ t('workbench.exportCenter') }}</strong>
        <button type="button" class="ghost" @click="open = false">{{ t('workbench.close') }}</button>
      </header>

      <label>
        {{ t('workbench.exportFormat') }}
        <select v-model="format">
          <option value="pdf">PDF</option>
          <option value="dxf">DXF</option>
          <option value="ai">AI</option>
          <option value="svg">SVG</option>
        </select>
      </label>

      <fieldset>
        <legend>{{ t('workbench.exportTier') }}</legend>
        <label><input v-model="tier" type="radio" value="vector_proof" /> {{ t('workbench.tierProof') }}</label>
        <label :class="{ muted: engineeringDisabled || !tiers.includes('engineering') }">
          <input
            v-model="tier"
            type="radio"
            value="engineering"
            :disabled="engineeringDisabled || !tiers.includes('engineering')"
          />
          {{ t('workbench.tierEngineering') }}
        </label>
      </fieldset>
      <p class="hint">
        {{ t('workbench.tierHint') }}
        <RouterLink to="/legal/disclaimer">{{ t('workbench.disclaimerLink') }}</RouterLink>
      </p>

      <label><input v-model="showDimensions" type="checkbox" /> {{ t('workbench.optDims') }}</label>
      <label><input v-model="showBleed" type="checkbox" /> {{ t('workbench.optBleed') }}</label>
      <label><input v-model="showFaceNames" type="checkbox" /> {{ t('workbench.optFaces') }}</label>
      <label>
        <input v-model="showTitleBlock" type="checkbox" :disabled="tier === 'engineering'" />
        {{ t('workbench.optTitle') }}
      </label>

      <button type="button" class="primary" :disabled="busy" @click="submit">
        {{ busy ? t('workbench.exporting') : t('workbench.startExport') }}
      </button>
      <p v-if="error" class="err">{{ error }} <span v-if="errorCode">({{ errorCode }})</span></p>

      <ul v-if="jobList.length" class="queue">
        <li v-for="j in jobList" :key="j.id">
          <span>{{ j.format.toUpperCase() }} · {{ tierLabel(j.quality_tier) }} · {{ statusLabel(j.status) }}</span>
          <span class="q-actions">
            <button v-if="j.status === 'succeeded'" type="button" @click="exportStore.downloadJob(j.id)">{{ t('workbench.downloadAgain') }}</button>
            <button v-if="j.status === 'queued'" type="button" @click="exportStore.cancel(j.id)">{{ t('workbench.cancel') }}</button>
            <button v-if="j.status === 'failed' && (j.attempts || 0) < 2" type="button" @click="exportStore.retry(j.id)">{{ t('workbench.retry') }}</button>
          </span>
          <ExportNotices v-if="j.status === 'succeeded'" class="q-notices" :preflight="j.preflight" />
        </li>
      </ul>
    </div>

    <GateDialog
      :kind="gate"
      :detail="gateDetail"
      @close="gate = null"
      @login="loginWithClaim(); gate = null"
      @upgrade="gate = null"
    />
  </div>
</template>

<style scoped>
.wrap{display:flex;flex-direction:column;gap:6px}
.cta,.primary{height:34px;padding:0 14px;border-radius:8px;border:1px solid var(--bc-steel);background:var(--bc-steel);color:#fff;cursor:pointer;font-size:13px}
.quota{margin:0;font-size:11px;color:var(--bc-ink-muted)}
.panel{background:#fff;border:1px solid var(--bc-line);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px}
header{display:flex;justify-content:space-between;align-items:center}
label,fieldset{font-size:12px;color:var(--bc-ink);display:flex;gap:8px;align-items:center;flex-wrap:wrap}
select{height:30px;border-radius:6px;border:1px solid var(--bc-line-strong)}
.hint{margin:0;font-size:11px;color:var(--bc-ink-muted)}
.err{margin:0;color:#b42318;font-size:12px}
.queue{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.queue li{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;font-size:12px;padding:6px 0;border-top:1px solid var(--bc-line)}
.q-notices{flex-basis:100%;margin-top:0}
.q-actions{display:flex;gap:4px}
.q-actions button,.ghost{height:28px;padding:0 8px;border-radius:6px;border:1px solid var(--bc-line-strong);background:#fff;cursor:pointer;font-size:11px}
.muted{opacity:.55}
</style>
