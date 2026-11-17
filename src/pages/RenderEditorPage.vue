<template>
  <div class="page">
    <header class="top">
      <div class="top-nav">
        <RouterLink to="/render">← {{ t('render.title') }}</RouterLink>
        <RouterLink v-if="linkedDesignId" class="back-design" :to="`/designs/${linkedDesignId}`">
          {{ t('render.backToDesign') }}
        </RouterLink>
      </div>
      <input class="name" :value="store.name" @change="onNameChange" :aria-label="t('render.sceneName')" />
      <span class="status-chip" :data-tone="artifactChipTone">{{ artifactChipLabel }}</span>
      <div class="status">
        <span>{{ saveLabel }}</span>
        <button type="button" :disabled="store.saving || !store.dirty" @click="store.flushSave()">{{ t('render.saveNow') }}</button>
        <button type="button" :disabled="!store.canUndo" @click="onUndo">{{ t('render.undo') }}</button>
        <button type="button" :disabled="!store.canRedo" @click="onRedo">{{ t('render.redo') }}</button>
        <button type="button" @click="onResetView">{{ t('render.resetView') }}</button>
        <div class="xform" role="group" :aria-label="t('render.transformMode')">
          <button type="button" :class="{ on: transformMode === 'translate' }" @click="setMode('translate')">{{ t('render.move') }}</button>
          <button type="button" :class="{ on: transformMode === 'rotate' }" @click="setMode('rotate')">{{ t('render.rotate') }}</button>
          <button type="button" :class="{ on: transformMode === 'scale' }" @click="setMode('scale')">{{ t('render.scale') }}</button>
        </div>
        <button type="button" class="primary" :disabled="rendering || jobStore.busy || !store.sceneId || !hasRenderable" @click="renderDialogOpen = true">
          {{ rendering || jobStore.busy ? t('render.rendering') : t('render.renderCloud') }}
        </button>
        <button
          type="button"
          :disabled="(!canDownload && !canRerenderAfterMiss) || jobStore.busy"
          @click="canDownload ? onDownload() : onRenderConfirm()"
        >
          {{ canDownload ? t('render.download') : canRerenderAfterMiss ? t('render.rerender') : t('render.download') }}
        </button>
      </div>
    </header>

    <p v-if="bootError" class="pad err">{{ bootError }}</p>
    <p v-else-if="store.loading && !engineReady" class="pad">{{ t('render.loading') }}</p>

    <main v-else class="layout">
      <aside class="side left">
        <h2>{{ t('render.models') }}</h2>
        <button type="button" class="bc-btn bc-btn--primary" @click="pickerOpen = true">{{ t('render.addDesign') }}</button>
        <ul class="model-list">
          <li v-for="m in store.content.models" :key="m.id" :class="{ on: selectedId === m.id && selectedKind === 'model' }" @click="selectModel(m.id)">
            <strong>{{ m.name || m.designId.slice(0, 8) }}</strong>
            <button type="button" class="ghost" @click.stop="removeModel(m.id)">{{ t('render.remove') }}</button>
          </li>
        </ul>
        <p v-if="!store.content.models.length" class="hint">{{ t('render.modelsEmpty') }}</p>

        <h2 class="mt">{{ t('render.props') }}</h2>
        <div class="row">
          <select v-model="propScope">
            <option value="official">{{ t('render.propsOfficial') }}</option>
            <option value="mine">{{ t('render.propsMine') }}</option>
          </select>
          <button type="button" @click="refreshProps">{{ t('render.refresh') }}</button>
        </div>
        <ul class="model-list">
          <li v-for="p in propCatalog" :key="p.id">
            <button type="button" class="linkish" @click="addProp(p)">{{ p.name }}</button>
            <button v-if="!p.is_official" type="button" class="ghost" @click="deleteProp(p.id)">{{ t('render.remove') }}</button>
          </li>
        </ul>
        <label class="upload">
          {{ t('render.uploadProp') }}
          <input type="file" accept=".glb,model/gltf-binary" @change="onUploadProp" />
        </label>
        <ul class="model-list">
          <li v-for="p in store.content.props" :key="p.id" :class="{ on: selectedId === p.id && selectedKind === 'prop' }" @click="selectProp(p.id)">
            <strong>{{ p.name || p.propId.slice(0, 8) }}</strong>
            <button type="button" class="ghost" @click.stop="removeProp(p.id)">{{ t('render.remove') }}</button>
          </li>
        </ul>
      </aside>

      <section class="canvas-wrap">
        <div v-if="store.conflict" class="banner">
          <p>{{ t('render.conflictHint') }}</p>
          <button type="button" @click="reloadScene">{{ t('render.reload') }}</button>
        </div>
        <p v-if="store.error && !store.conflict" class="err banner">{{ store.error }}</p>
        <p v-if="jobStore.error" class="err banner">{{ jobLabel }}</p>
        <p v-if="jobStore.currentBatch" class="banner">{{ batchStatusLabel }}</p>
        <p v-else-if="jobStore.currentJob" class="banner">{{ jobStatusLabel }}</p>
        <div ref="canvasHost" class="canvas" />
      </section>

      <aside class="side right">
        <details class="rail-group" open>
          <summary>{{ t('render.groupComposition') }}</summary>
          <section class="panel">
            <h2>{{ t('render.templatePanel') }}</h2>
            <label>
              {{ t('render.template') }}
              <select v-model="selectedTemplateId">
                <option value="">{{ t('render.templateNone') }}</option>
                <option v-for="tpl in templates" :key="tpl.id" :value="tpl.id">{{ tpl.name }}</option>
              </select>
            </label>
            <label v-if="selectedTemplate">
              {{ t('render.templateBindDesign') }}
              <select v-model="templateDesignId">
                <option value="">{{ t('render.pickDesign') }}</option>
                <option v-for="d in designOptions" :key="d.id" :value="d.id">{{ d.name }}</option>
              </select>
            </label>
            <button type="button" :disabled="!selectedTemplateId || !templateDesignId" @click="onApplyTemplate">{{ t('render.applyTemplate') }}</button>
          </section>
          <section v-if="selectedModel" class="panel">
            <h2>{{ t('render.modelPanel') }}</h2>
            <label>
              {{ t('render.foldProgress') }}
              <input v-model.number="foldProgress" type="range" min="0" max="100" @input="onFold" />
              <span>{{ foldProgress }}</span>
            </label>
          </section>
          <section class="panel">
            <h2>{{ t('render.viewsPanel') }}</h2>
            <button type="button" @click="saveView">{{ t('render.saveView') }}</button>
            <ul class="model-list">
              <li v-for="v in store.content.views" :key="v.id">
                <label class="check">
                  <input v-model="batchViewIds" type="checkbox" :value="v.id" />
                  <button type="button" class="linkish" @click="applyView(v.id)">{{ v.name }}</button>
                </label>
                <button type="button" class="ghost" @click="removeView(v.id)">{{ t('render.remove') }}</button>
              </li>
            </ul>
          </section>
        </details>

        <details class="rail-group">
          <summary>{{ t('render.groupMaterialLight') }}</summary>
          <section v-if="selectedModel" class="panel">
            <h2>{{ t('render.modelPanel') }}</h2>
            <label>
              {{ t('render.material') }}
              <select v-model="materialId" @change="onMaterial">
                <option v-for="mid in materialIds" :key="mid" :value="mid">{{ t(`render.mat_${mid}`) }}</option>
              </select>
            </label>
          </section>
          <section class="panel">
            <h2>{{ t('render.lightPanel') }}</h2>
            <label>
              {{ t('render.lightPreset') }}
              <select v-model="lightPreset" @change="onLightPreset">
                <option value="softbox">{{ t('render.presetSoftbox') }}</option>
                <option value="daylight">{{ t('render.presetDaylight') }}</option>
                <option value="warm">{{ t('render.presetWarm') }}</option>
              </select>
            </label>
            <label>
              {{ t('render.sunIntensity') }}
              <input v-model.number="sunIntensity" type="range" min="0" max="5" step="0.05" @input="onLightManual" />
            </label>
            <label>
              {{ t('render.envIntensity') }}
              <input v-model.number="envIntensity" type="range" min="0" max="2" step="0.05" @input="onLightManual" />
            </label>
          </section>
        </details>

        <details class="rail-group">
          <summary>{{ t('render.groupBackgroundEnv') }}</summary>
          <section class="panel">
            <h2>{{ t('render.backgroundPanel') }}</h2>
            <label>
              {{ t('render.hdr') }}
              <select v-model="hdrId" @change="onEnvironment">
                <option value="">{{ t('render.hdrNone') }}</option>
                <option v-for="e in environments" :key="e.id" :value="e.id">{{ e.name }}</option>
              </select>
            </label>
            <label>
              {{ t('render.hdrIntensity') }}
              <input v-model.number="hdrIntensity" type="range" min="0" max="3" step="0.05" @input="onEnvironment" />
            </label>
            <label class="check">
              <input v-model="hdrAsBackground" type="checkbox" @change="onEnvironment" />
              {{ t('render.hdrAsBackground') }}
            </label>
            <label>
              {{ t('render.bgType') }}
              <select v-model="bgType" @change="onBackground">
                <option value="solid">{{ t('render.bgSolid') }}</option>
                <option value="gradient">{{ t('render.bgGradient') }}</option>
              </select>
            </label>
            <label v-if="bgType === 'solid'">
              {{ t('render.bgColor') }}
              <input v-model="bgColor" type="color" @input="onBackground" />
            </label>
            <template v-else>
              <label>
                {{ t('render.bgTop') }}
                <input v-model="bgTop" type="color" @input="onBackground" />
              </label>
              <label>
                {{ t('render.bgBottom') }}
                <input v-model="bgBottom" type="color" @input="onBackground" />
              </label>
            </template>
            <label class="check">
              <input v-model="groundVisible" type="checkbox" @change="onGround" />
              {{ t('render.groundVisible') }}
            </label>
          </section>
        </details>

        <details class="rail-group" open>
          <summary>{{ t('render.groupOutput') }}</summary>
          <section class="panel">
            <h2>{{ t('render.outputPanel') }}</h2>
            <label>
              {{ t('render.aspect') }}
              <select v-model="aspect" @change="onAspect">
                <option value="1:1">1:1</option>
                <option value="4:3">4:3</option>
                <option value="16:9">16:9</option>
                <option value="3:4">3:4</option>
                <option value="9:16">9:16</option>
              </select>
            </label>
            <p class="hint">{{ t('render.outputSizePreview', { size: outputSizeLabel }) }}</p>
          </section>
        </details>
      </aside>
    </main>

    <div v-if="pickerOpen" class="modal" role="dialog" :aria-label="t('render.addDesign')">
      <div class="modal-card">
        <header>
          <h2>{{ t('render.pickDesign') }}</h2>
          <button type="button" @click="pickerOpen = false">×</button>
        </header>
        <p v-if="pickerLoading">{{ t('render.loading') }}</p>
        <ul v-else class="picker-list">
          <li v-for="d in designOptions" :key="d.id">
            <button type="button" @click="addDesign(d)">
              <strong>{{ d.name }}</strong>
              <span>{{ d.product_slug || '—' }}</span>
            </button>
          </li>
        </ul>
        <p v-if="!pickerLoading && !designOptions.length" class="hint">{{ t('render.noDesigns') }}</p>
      </div>
    </div>

    <div v-if="renderDialogOpen" class="modal" role="dialog" :aria-label="t('render.renderCloud')">
      <div class="modal-card">
        <header>
          <h2>{{ t('render.renderCloud') }}</h2>
          <button type="button" @click="renderDialogOpen = false">×</button>
        </header>
        <dl class="confirm-summary">
          <div>
            <dt>{{ t('render.confirmScene') }}</dt>
            <dd>{{ store.name || t('render.untitled') }}</dd>
          </div>
          <div>
            <dt>{{ t('render.confirmViews') }}</dt>
            <dd>{{ viewCountLabel }}</dd>
          </div>
          <div>
            <dt>{{ t('render.confirmPixels') }}</dt>
            <dd>{{ outputSizeLabel }}</dd>
          </div>
          <div>
            <dt>{{ t('render.confirmFormat') }}</dt>
            <dd>{{ renderFormat.toUpperCase() }}</dd>
          </div>
          <div>
            <dt>{{ t('render.confirmQuota') }}</dt>
            <dd>{{ quotaHint }}</dd>
          </div>
        </dl>
        <p class="hint ephemeral-note">{{ t('render.confirmEphemeral') }}</p>
        <label>
          {{ t('render.resolution') }}
          <select v-model="renderRes">
            <option value="2k">2K</option>
            <option value="4k">4K</option>
          </select>
        </label>
        <label>
          {{ t('render.format') }}
          <select v-model="renderFormat">
            <option value="png">PNG</option>
            <option value="jpg">JPG</option>
          </select>
        </label>
        <label class="check">
          <input v-model="renderBatchMode" type="checkbox" />
          {{ t('render.batchSelectedViews') }}
        </label>
        <button type="button" class="primary" :disabled="rendering || jobStore.busy" @click="onRenderConfirm">{{ t('render.startRender') }}</button>
      </div>
    </div>

    <div
      v-if="progressOpen"
      class="modal progress-modal"
      role="dialog"
      :aria-label="t('render.progressTitle')"
      aria-live="polite"
    >
      <div class="modal-card progress-card">
        <header>
          <h2>{{ progressTitle }}</h2>
        </header>
        <p class="progress-msg">{{ progressMessage }}</p>
        <div
          class="progress-track"
          role="progressbar"
          :aria-valuemin="progressHasRatio ? 0 : undefined"
          :aria-valuemax="progressHasRatio ? 100 : undefined"
          :aria-valuenow="progressHasRatio ? progressPercent : undefined"
          :aria-busy="progressIndeterminate ? 'true' : undefined"
        >
          <div
            class="progress-fill"
            :style="progressHasRatio ? { width: `${progressPercent}%` } : { width: '42%' }"
            :class="{ indeterminate: progressIndeterminate || !progressHasRatio }"
          />
        </div>
        <p class="progress-meta">{{ progressMeta }}</p>
        <div class="progress-actions">
          <button
            v-if="progressDone && canDownload"
            type="button"
            class="primary"
            @click="onDownload"
          >
            {{ t('render.download') }}
          </button>
          <button
            v-else-if="progressDone && artifactExpired"
            type="button"
            class="primary"
            @click="onRenderConfirm"
          >
            {{ t('render.rerender') }}
          </button>
          <button v-if="progressDone || progressFailed || artifactExpired" type="button" @click="progressOpen = false">
            {{ t('render.progressClose') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { ApiError } from '../api/client'
import { fetchDesign, fetchDesigns, type DesignListItem } from '../api/designs'
import {
  renderEnvironmentDownloadUrl,
  renderEnvironmentList,
  renderPropDelete,
  renderPropDownloadUrl,
  renderPropList,
  renderPropUpload,
  renderSceneTemplateList,
  type RenderEnvironmentItem,
  type RenderPropItem,
  type RenderSceneTemplateItem,
} from '../api/renderScenes'
import {
  applyLightPreset,
  ASPECT_RATIOS,
  MATERIAL_PRESET_IDS,
  newModelId,
  newPropId,
  newViewId,
  normalizeRenderScene,
  type BackgroundType,
  type LightPreset,
  type OutputAspect,
  type RenderSceneDocumentV2,
  type RenderSceneModelV2,
  type RenderScenePropV2,
} from '../../packages/render-scene-schema/renderScene'
import { BOARD_MATERIAL_IDS } from '../boardMaterial.js'
import { createRenderScene } from '../render/renderScene.js'
import { bakeArtworkMaps } from '../studio/artworkBake'
import { resolveEngineKnife } from '../studio/knifeAdapter'
import { useAuthStore } from '../stores/auth'
import { useBillingStore } from '../stores/billing'
import { useRenderJobStore } from '../stores/renderJob'
import { useRenderSceneStore } from '../stores/renderScene'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const billing = useBillingStore()
const store = useRenderSceneStore()
const jobStore = useRenderJobStore()

const canvasHost = ref<HTMLElement | null>(null)
const bootError = ref('')
const engineReady = ref(false)
const selectedId = ref<string | null>(null)
const selectedKind = ref<'model' | 'prop' | null>(null)
const transformMode = ref<'translate' | 'rotate' | 'scale'>('translate')
const pickerOpen = ref(false)
const pickerLoading = ref(false)
const designOptions = ref<DesignListItem[]>([])
const rendering = ref(false)
const foldProgress = ref(100)
const materialId = ref('kraft')
const lightPreset = ref<LightPreset>('softbox')
const sunIntensity = ref(1.6)
const envIntensity = ref(0.85)
const bgType = ref<BackgroundType>('solid')
const bgColor = ref('#F5F6F8')
const bgTop = ref('#EEF1F5')
const bgBottom = ref('#D8DEE8')
const groundVisible = ref(true)
const aspect = ref<OutputAspect>('1:1')
const hdrId = ref('')
const hdrIntensity = ref(1)
const hdrAsBackground = ref(false)
const propScope = ref<'official' | 'mine'>('official')
const propCatalog = ref<RenderPropItem[]>([])
const environments = ref<RenderEnvironmentItem[]>([])
const templates = ref<RenderSceneTemplateItem[]>([])
const selectedTemplateId = ref('')
const templateDesignId = ref('')
const batchViewIds = ref<string[]>([])
const renderDialogOpen = ref(false)
const renderRes = ref<'2k' | '4k'>('2k')
const renderFormat = ref<'png' | 'jpg'>('png')
const renderBatchMode = ref(false)
const progressOpen = ref(false)
const progressStartedAt = ref(0)
const progressTick = ref(0)
let progressTickTimer: ReturnType<typeof setInterval> | null = null

function startProgressTicker() {
  stopProgressTicker()
  progressStartedAt.value = Date.now()
  progressTick.value = 0
  progressTickTimer = setInterval(() => {
    progressTick.value += 1
  }, 500)
}
function stopProgressTicker() {
  if (progressTickTimer) {
    clearInterval(progressTickTimer)
    progressTickTimer = null
  }
}

let engine: ReturnType<typeof createRenderScene> | null = null
const loadedDesignIds = new Set<string>()
const loadedPropIds = new Set<string>()

const materialIds = (BOARD_MATERIAL_IDS as string[]) || [...MATERIAL_PRESET_IDS]

const saveLabel = computed(() => {
  if (store.saving) return t('render.saving')
  if (store.dirty) return t('render.unsaved')
  return t('render.saved')
})

const selectedModel = computed(() =>
  selectedKind.value === 'model' ? store.content.models.find((m) => m.id === selectedId.value) || null : null,
)
const selectedTemplate = computed(() => templates.value.find((x) => x.id === selectedTemplateId.value) || null)
const hasRenderable = computed(() => store.content.models.length + store.content.props.length > 0)
const canDownload = computed(() => jobStore.hasDownloadableResult())

const linkedDesignId = computed(() => store.content.models[0]?.designId || '')

const outputPixels = computed(() => {
  const ratio = ASPECT_RATIOS[aspect.value] || ASPECT_RATIOS[store.content.output.aspect] || 1
  const width = renderRes.value === '4k' ? 3840 : 2048
  const height = Math.max(256, Math.round(width / ratio))
  return { width, height }
})
const outputSizeLabel = computed(() => `${outputPixels.value.width}×${outputPixels.value.height}`)
const viewCount = computed(() => {
  if (renderBatchMode.value && batchViewIds.value.length) return batchViewIds.value.length
  return 1
})
const viewCountLabel = computed(() => t('render.confirmViewCount', { n: viewCount.value }))
const quotaHint = computed(() => {
  const ent = billing.entitlement
  if (!ent) return t('render.confirmQuotaUnknown')
  if (ent.unlimited) return t('render.confirmQuotaUnlimited')
  return t('render.confirmQuotaRemaining', { n: ent.remaining ?? 0 })
})

const progressActive = computed(() => rendering.value || jobStore.busy)
const renderSucceeded = computed(
  () =>
    jobStore.currentJob?.status === 'succeeded' ||
    jobStore.currentBatch?.status === 'succeeded' ||
    jobStore.currentBatch?.status === 'partial',
)
const artifactExpired = computed(
  () =>
    renderSucceeded.value &&
    (jobStore.artifactStatus === 'missing' ||
      jobStore.artifactStatus === 'not_ready' ||
      jobStore.errorCode === 'ARTIFACT_EXPIRED'),
)
const canRerenderAfterMiss = computed(() => artifactExpired.value && !canDownload.value)
const progressFailed = computed(() => {
  // Job already succeeded: download/ephemeral misses must not flip UI to "render failed".
  if (renderSucceeded.value) return false
  return (
    !!(jobStore.errorCode || jobStore.error) ||
    jobStore.currentJob?.status === 'failed' ||
    jobStore.currentBatch?.status === 'failed'
  )
})
const artifactChipTone = computed(() => {
  if (jobStore.busy || rendering.value) return 'busy'
  if (artifactExpired.value) return 'expired'
  if (canDownload.value) return 'ready'
  if (progressFailed.value) return 'failed'
  return 'idle'
})
const artifactChipLabel = computed(() => {
  if (jobStore.busy || rendering.value) return t('render.chipBusy')
  if (artifactExpired.value) return t('render.chipExpired')
  if (canDownload.value) return t('render.chipReady')
  if (progressFailed.value) return t('render.chipFailed')
  return t('render.chipIdle')
})
const progressDone = computed(() => !progressActive.value && renderSucceeded.value)
const progressIndeterminate = computed(
  () => progressActive.value && !progressDone.value && !progressFailed.value,
)
/** Only batch completion ratio is a real measured percent; single-job uses stages. */
const progressHasRatio = computed(() => {
  if (progressFailed.value || progressDone.value) return true
  const batch = jobStore.currentBatch
  return !!(batch && batch.job_count > 0)
})

const progressPercent = computed(() => {
  if (progressFailed.value || progressDone.value) return 100
  const batch = jobStore.currentBatch
  if (batch && batch.job_count > 0) {
    const done = batch.succeeded_count + batch.failed_count
    return Math.min(100, Math.round((done / batch.job_count) * 100))
  }
  return 0
})

const progressTitle = computed(() => {
  if (progressFailed.value) return t('render.progressFailed')
  if (artifactExpired.value && progressDone.value) return t('render.artifactExpiredTitle')
  if (progressDone.value) return t('render.progressDone')
  return t('render.progressTitle')
})

const progressMessage = computed(() => {
  if (progressFailed.value) return jobLabel.value || t('render.progressFailedHint')
  if (artifactExpired.value && progressDone.value) return t('render.artifactExpiredHint')
  if (progressDone.value) {
    if (jobStore.downloadStatus === 'fetching') return t('render.progressFetching')
    return t('render.progressDoneHint')
  }
  if (jobStore.downloadStatus === 'fetching') return t('render.progressFetching')
  const status = jobStore.currentBatch?.status || jobStore.currentJob?.status || 'queued'
  if (status === 'running') return t('render.progressRunning')
  if (status === 'queued') return t('render.progressQueued')
  return t('render.progressPreparing')
})

const progressMeta = computed(() => {
  void progressTick.value
  const elapsedSec = Math.max(0, Math.floor((Date.now() - (progressStartedAt.value || Date.now())) / 1000))
  if (jobStore.currentBatch) {
    const b = jobStore.currentBatch
    return t('render.progressBatchMeta', {
      ok: b.succeeded_count,
      fail: b.failed_count,
      total: b.job_count,
      sec: elapsedSec,
    })
  }
  const job = jobStore.currentJob
  if (job) {
    return t('render.progressJobMeta', {
      status: job.status,
      w: job.width,
      h: job.height,
      sec: elapsedSec,
    })
  }
  return t('render.progressElapsed', { sec: elapsedSec })
})

watch(progressActive, (active) => {
  if (active) {
    progressOpen.value = true
    startProgressTicker()
  } else {
    stopProgressTicker()
  }
})

const jobStatusLabel = computed(() => {
  const job = jobStore.currentJob
  if (!job) return ''
  return t('render.jobStatus', { status: job.status, w: job.width, h: job.height })
})
const batchStatusLabel = computed(() => {
  const b = jobStore.currentBatch
  if (!b) return ''
  return t('render.batchStatus', {
    status: b.status,
    ok: b.succeeded_count,
    fail: b.failed_count,
    total: b.job_count,
  })
})
const jobLabel = computed(() => {
  if (jobStore.errorCode === 'EXPORT_QUOTA_EXCEEDED') return t('billing.quotaExceeded')
  if (jobStore.errorCode === 'RENDER_4K_DISABLED') return t('render.fourKDisabled')
  if (jobStore.errorCode === 'ARTIFACT_EXPIRED') return t('render.artifactExpiredHint')
  if (jobStore.errorCode === 'RENDER_NOT_READY') {
    if (renderSucceeded.value) return t('render.artifactExpiredHint')
    return t('render.downloadNotReady')
  }
  if (jobStore.errorCode === 'RENDER_BUSY') return t('render.renderBusy')
  return jobStore.error
})

function syncPanelsFromDoc(doc: RenderSceneDocumentV2) {
  lightPreset.value = doc.light.preset
  sunIntensity.value = doc.light.sunIntensity
  envIntensity.value = doc.light.envIntensity
  bgType.value = doc.background.type
  bgColor.value = doc.background.color
  bgTop.value = doc.background.gradient.top
  bgBottom.value = doc.background.gradient.bottom
  groundVisible.value = doc.ground.visible
  aspect.value = doc.output.aspect
  hdrId.value = doc.environment.hdrId || ''
  hdrIntensity.value = doc.environment.intensity
  hdrAsBackground.value = doc.environment.useAsBackground
  if (selectedModel.value) {
    foldProgress.value = selectedModel.value.foldProgress
    materialId.value = selectedModel.value.materialId || 'kraft'
  }
}

function currentDoc(): RenderSceneDocumentV2 {
  return normalizeRenderScene(store.content)
}

async function applyEnv(doc: RenderSceneDocumentV2) {
  await engine?.applyDocumentEnv(doc, {
    resolveHdrUrl: (id) => (id ? renderEnvironmentDownloadUrl(id) : null),
  })
}

function pushDoc(mutator: (doc: RenderSceneDocumentV2) => RenderSceneDocumentV2) {
  const next = mutator(JSON.parse(JSON.stringify(currentDoc())) as RenderSceneDocumentV2)
  store.markDirty(next)
  void applyEnv(next)
}

function onNameChange(ev: Event) {
  store.setName((ev.target as HTMLInputElement).value)
}
function onResetView() {
  engine?.resetView()
}
function onUndo() {
  store.undo()
  syncPanelsFromDoc(store.content)
  void applyEnv(store.content)
  void loadModelMeshes(store.content)
  void loadPropMeshes(store.content)
}
function onRedo() {
  store.redo()
  syncPanelsFromDoc(store.content)
  void applyEnv(store.content)
  void loadModelMeshes(store.content)
  void loadPropMeshes(store.content)
}
function setMode(mode: 'translate' | 'rotate' | 'scale') {
  transformMode.value = mode
  engine?.setTransformMode(mode)
}
function selectModel(id: string) {
  selectedId.value = id
  selectedKind.value = 'model'
  engine?.setSelected(id, 'model')
  const m = store.content.models.find((x) => x.id === id)
  if (m) {
    foldProgress.value = m.foldProgress
    materialId.value = m.materialId || 'kraft'
  }
}
function selectProp(id: string) {
  selectedId.value = id
  selectedKind.value = 'prop'
  engine?.setSelected(id, 'prop')
}
function onFold() {
  if (!selectedId.value || selectedKind.value !== 'model') return
  engine?.updateModelEntry(selectedId.value, { foldProgress: foldProgress.value })
  pushDoc((doc) => ({
    ...doc,
    models: doc.models.map((m) => (m.id === selectedId.value ? { ...m, foldProgress: foldProgress.value } : m)),
  }))
}
function onMaterial() {
  if (!selectedId.value || selectedKind.value !== 'model') return
  engine?.updateModelEntry(selectedId.value, { materialId: materialId.value })
  pushDoc((doc) => ({
    ...doc,
    models: doc.models.map((m) => (m.id === selectedId.value ? { ...m, materialId: materialId.value } : m)),
  }))
}
function onLightPreset() {
  pushDoc((doc) => applyLightPreset(doc, lightPreset.value))
  const next = store.content
  sunIntensity.value = next.light.sunIntensity
  envIntensity.value = next.light.envIntensity
  if (next.environment.hdrId) hdrId.value = next.environment.hdrId
}
function onLightManual() {
  pushDoc((doc) => ({
    ...doc,
    light: { ...doc.light, sunIntensity: sunIntensity.value, envIntensity: envIntensity.value },
  }))
}
function onBackground() {
  pushDoc((doc) => ({
    ...doc,
    background: { type: bgType.value, color: bgColor.value, gradient: { top: bgTop.value, bottom: bgBottom.value } },
  }))
}
function onEnvironment() {
  pushDoc((doc) => ({
    ...doc,
    environment: {
      hdrId: hdrId.value || null,
      intensity: hdrIntensity.value,
      rotation: doc.environment.rotation || 0,
      useAsBackground: hdrAsBackground.value,
    },
  }))
}
function onGround() {
  pushDoc((doc) => ({ ...doc, ground: { ...doc.ground, visible: groundVisible.value } }))
}
function onAspect() {
  pushDoc((doc) => ({ ...doc, output: { aspect: aspect.value } }))
}

function syncTransformsIntoDoc() {
  if (!engine) return
  const entries = engine.getModelEntries()
  const propEntries = engine.getPropEntries()
  const cam = engine.captureCamera()
  pushDoc((doc) => ({
    ...doc,
    camera: cam,
    models: doc.models.map((m) => {
      const e = entries.find((x) => x.id === m.id)
      return e ? { ...m, ...e } : m
    }),
    props: doc.props.map((p) => {
      const e = propEntries.find((x) => x.id === p.id)
      return e ? { ...p, ...e } : p
    }),
  }))
}

async function loadModelMeshes(doc: RenderSceneDocumentV2) {
  if (!engine) return
  const keep = new Set(doc.models.map((m) => m.id))
  for (const id of [...loadedDesignIds]) {
    if (!keep.has(id)) {
      engine.removeModel(id)
      loadedDesignIds.delete(id)
    }
  }
  for (const entry of doc.models) {
    try {
      const design = await fetchDesign(entry.designId)
      if (!design.content) continue
      const knife = await resolveEngineKnife(design.content)
      const thickness = design.content.geometry.params.thicknessMm
      const maps = await bakeArtworkMaps(design.content, { side: 'outside' })
      const named: RenderSceneModelV2 = {
        ...entry,
        name: entry.name || design.name,
        revisionId: entry.revisionId || design.current_revision_id,
        materialId: entry.materialId || design.content.geometry.params.materialId || 'kraft',
      }
      await engine.upsertModel(named, { knife, thicknessMm: thickness, artworkMaps: maps })
      loadedDesignIds.add(named.id)
    } catch (e) {
      console.warn('render model load failed', entry.designId, e)
    }
  }
}

async function loadPropMeshes(doc: RenderSceneDocumentV2) {
  if (!engine) return
  const keep = new Set(doc.props.map((p) => p.id))
  for (const id of [...loadedPropIds]) {
    if (!keep.has(id)) {
      engine.removeProp(id)
      loadedPropIds.delete(id)
    }
  }
  for (const entry of doc.props) {
    try {
      const url = renderPropDownloadUrl(entry.propId)
      await engine.upsertProp(entry, { url })
      loadedPropIds.add(entry.id)
    } catch (e) {
      console.warn('render prop load failed', entry.propId, e)
    }
  }
}

async function reloadScene() {
  if (!store.sceneId) return
  await store.load(store.sceneId)
  syncPanelsFromDoc(store.content)
  await applyEnv(store.content)
  await loadModelMeshes(store.content)
  await loadPropMeshes(store.content)
}

function removeModel(id: string) {
  engine?.removeModel(id)
  loadedDesignIds.delete(id)
  if (selectedId.value === id) {
    selectedId.value = null
    selectedKind.value = null
  }
  pushDoc((doc) => ({ ...doc, models: doc.models.filter((m) => m.id !== id) }))
}
function removeProp(id: string) {
  engine?.removeProp(id)
  loadedPropIds.delete(id)
  if (selectedId.value === id) {
    selectedId.value = null
    selectedKind.value = null
  }
  pushDoc((doc) => ({ ...doc, props: doc.props.filter((p) => p.id !== id) }))
}

async function refreshProps() {
  propCatalog.value = await renderPropList(propScope.value)
}
watch(propScope, () => {
  void refreshProps()
})

async function addProp(p: RenderPropItem) {
  const entry: RenderScenePropV2 = {
    id: newPropId(),
    source: p.is_official ? 'official' : 'upload',
    propId: p.id,
    assetId: p.asset_id,
    name: p.name,
    position: { x: store.content.props.length * 80, y: 0, z: 80 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: 1,
  }
  const next = normalizeRenderScene({ ...store.content, props: [...store.content.props, entry] })
  store.markDirty(next)
  await loadPropMeshes(next)
  selectProp(entry.id)
}

async function deleteProp(id: string) {
  await renderPropDelete(id)
  await refreshProps()
}

async function onUploadProp(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const prop = await renderPropUpload(file, file.name.replace(/\.glb$/i, ''))
    propScope.value = 'mine'
    await refreshProps()
    await addProp(prop)
  } catch (e) {
    console.warn(e)
    bootError.value = e instanceof ApiError ? e.message : t('render.uploadPropFailed')
  } finally {
    input.value = ''
  }
}

function saveView() {
  if (!engine) return
  const cam = engine.captureCamera()
  const name = t('render.viewName', { n: store.content.views.length + 1 })
  pushDoc((doc) => ({
    ...doc,
    views: [...doc.views, { id: newViewId(), name, camera: cam, output: { aspect: doc.output.aspect } }],
  }))
}
function applyView(id: string) {
  const view = store.content.views.find((v) => v.id === id)
  if (!view) return
  pushDoc((doc) => ({
    ...doc,
    camera: { ...view.camera },
    output: view.output?.aspect ? { aspect: view.output.aspect } : doc.output,
  }))
}
function removeView(id: string) {
  batchViewIds.value = batchViewIds.value.filter((x) => x !== id)
  pushDoc((doc) => ({ ...doc, views: doc.views.filter((v) => v.id !== id) }))
}

async function onApplyTemplate() {
  if (!selectedTemplateId.value || !templateDesignId.value) return
  const slots = selectedTemplate.value?.slot_ids?.length ? selectedTemplate.value.slot_ids : ['main']
  await store.applyTemplate({
    templateId: selectedTemplateId.value,
    bindings: slots.map((slotId) => ({ slotId, designId: templateDesignId.value })),
  })
  syncPanelsFromDoc(store.content)
  await applyEnv(store.content)
  await loadModelMeshes(store.content)
  await loadPropMeshes(store.content)
}

async function openPicker() {
  pickerOpen.value = true
  pickerLoading.value = true
  try {
    designOptions.value = await fetchDesigns('active')
  } finally {
    pickerLoading.value = false
  }
}
watch(pickerOpen, (v) => {
  if (v) void openPicker()
})

async function addDesign(d: DesignListItem) {
  pickerOpen.value = false
  const entry: RenderSceneModelV2 = {
    id: newModelId(),
    designId: d.id,
    revisionId: d.current_revision_id,
    name: d.name,
    position: { x: store.content.models.length * 120, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: 1,
    foldProgress: 100,
    materialId: 'kraft',
  }
  const next = normalizeRenderScene({ ...store.content, models: [...store.content.models, entry] })
  store.markDirty(next)
  await loadModelMeshes(next)
  selectModel(entry.id)
}

function onDownload() {
  if (jobStore.currentBatch) void jobStore.downloadBatch()
  else void jobStore.download()
}

async function onRenderConfirm() {
  if (jobStore.hasUnconfirmedResults) {
    const ok = window.confirm(t('render.confirmClearResults'))
    if (!ok) return
  }

  renderDialogOpen.value = false
  progressOpen.value = true
  rendering.value = true
  startProgressTicker()
  jobStore.reset()

  if (!engine || !store.sceneId) {
    jobStore.error = t('render.renderStartFailed')
    jobStore.errorCode = 'RENDER_START_FAILED'
    rendering.value = false
    stopProgressTicker()
    return
  }

  try {
    syncTransformsIntoDoc()
    await store.flushSave()
    if (!hasRenderable.value) {
      throw new Error(t('render.modelsEmpty'))
    }
    const glbBuf = await engine.exportGlb()
    if (!glbBuf || (glbBuf as ArrayBuffer).byteLength < 100) {
      throw new Error(t('render.exportGlbFailed'))
    }
    const ratio = ASPECT_RATIOS[store.content.output.aspect] || 1
    const width = renderRes.value === '4k' ? 3840 : 2048
    const height = Math.max(256, Math.round(width / ratio))
    const glb = new Blob([glbBuf as BlobPart], { type: 'model/gltf-binary' })
    if (renderBatchMode.value && batchViewIds.value.length) {
      await jobStore.startBatch({
        sceneId: store.sceneId,
        glb,
        width,
        height,
        format: renderFormat.value,
        viewIds: [...batchViewIds.value],
        sceneSnapshot: store.content,
      })
    } else {
      await jobStore.start({
        sceneId: store.sceneId,
        glb,
        width,
        height,
        format: renderFormat.value,
        sceneSnapshot: store.content,
      })
    }
  } catch (e: unknown) {
    const message =
      e instanceof ApiError ? e.message : e instanceof Error ? e.message : t('render.renderStartFailed')
    jobStore.error = message
    jobStore.errorCode = e instanceof ApiError ? e.code : 'RENDER_START_FAILED'
  } finally {
    rendering.value = false
    stopProgressTicker()
  }
}

function onKeydown(ev: KeyboardEvent) {
  const mod = ev.ctrlKey || ev.metaKey
  if (!mod) return
  const target = ev.target as HTMLElement | null
  if (
    target &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable ||
      ev.isComposing)
  ) {
    return
  }
  if (ev.key === 'z' && !ev.shiftKey) {
    ev.preventDefault()
    onUndo()
  } else if (ev.key === 'y' || (ev.key === 'z' && ev.shiftKey)) {
    ev.preventDefault()
    onRedo()
  }
}

onMounted(async () => {
  await auth.refreshMe()
  if (!auth.isAuthenticated) {
    await router.replace({ path: '/account/login', query: { next: route.fullPath } })
    return
  }
  const id = String(route.params.id || '')
  try {
    await store.load(id)
    ;[environments.value, templates.value] = await Promise.all([
      renderEnvironmentList(),
      renderSceneTemplateList(),
    ])
    designOptions.value = await fetchDesigns('active')
    void billing.refresh()
    await refreshProps()
  } catch (e: unknown) {
    bootError.value = e instanceof ApiError ? e.message : t('render.loadFailed')
    return
  }
  if (!canvasHost.value) return
  engine = createRenderScene(canvasHost.value, {
    onSelectModel: (mid) => {
      selectedId.value = mid
      selectedKind.value = mid ? 'model' : null
      const m = store.content.models.find((x) => x.id === mid)
      if (m) {
        foldProgress.value = m.foldProgress
        materialId.value = m.materialId || 'kraft'
      }
    },
    onSelectProp: (pid) => {
      if (pid) {
        selectedId.value = pid
        selectedKind.value = 'prop'
      }
    },
    onTransformChange: () => syncTransformsIntoDoc(),
    onCameraChange: () => syncTransformsIntoDoc(),
  })
  engineReady.value = true
  syncPanelsFromDoc(store.content)
  await applyEnv(store.content)
  await loadModelMeshes(store.content)
  await loadPropMeshes(store.content)
  engine.resetView()
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  stopProgressTicker()
  void store.flushSave()
  engine?.dispose()
  engine = null
  store.reset()
  jobStore.reset()
})
</script>

<style scoped>
.page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #eceff3;
  color: var(--bc-ink);
  font-family: var(--bc-font-ui);
}
.top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: #fff;
  border-bottom: 1px solid var(--bc-line);
}
.top-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.85rem;
}
.back-design {
  color: var(--bc-ink);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.status-chip {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 0.75rem;
  letter-spacing: 0.02em;
  border: 1px solid var(--bc-line);
  background: #f4f6f8;
  color: var(--bc-muted);
  white-space: nowrap;
}
.status-chip[data-tone='ready'] {
  background: #e8f5ee;
  border-color: #b7dfc8;
  color: #1f6b45;
}
.status-chip[data-tone='busy'] {
  background: #eef3ff;
  border-color: #c5d4f5;
  color: #3557a0;
}
.status-chip[data-tone='expired'] {
  background: #fff6e8;
  border-color: #efd2a3;
  color: #8a5a12;
}
.status-chip[data-tone='failed'] {
  background: #fdeceb;
  border-color: #f0c2bc;
  color: #9b2c20;
}
.name {
  min-width: 160px;
  flex: 1;
  border: 1px solid var(--bc-line);
  padding: 6px 10px;
  font: inherit;
}
.status {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.rail-group {
  border: 0;
  margin: 0 0 10px;
  padding: 0;
}
.rail-group > summary {
  cursor: pointer;
  list-style: none;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--bc-muted);
  padding: 4px 2px 8px;
}
.rail-group > summary::-webkit-details-marker {
  display: none;
}
.rail-group[open] > summary {
  color: var(--bc-ink);
}
.confirm-summary {
  margin: 0 0 12px;
  display: grid;
  gap: 8px;
}
.confirm-summary > div {
  display: grid;
  grid-template-columns: 96px 1fr;
  gap: 8px;
  font-size: 0.9rem;
}
.confirm-summary dt {
  margin: 0;
  color: var(--bc-muted);
}
.confirm-summary dd {
  margin: 0;
  color: var(--bc-ink);
  font-weight: 600;
}
.ephemeral-note {
  margin: 0 0 12px;
}
.status button,
.xform button,
.panel button,
.row button {
  border: 1px solid var(--bc-line);
  background: #fff;
  padding: 6px 10px;
  cursor: pointer;
}
.status .primary,
.xform .on,
.modal-card .primary {
  background: var(--bc-ink);
  color: #fff;
  border-color: var(--bc-ink);
}
.layout {
  flex: 1;
  display: grid;
  grid-template-columns: 240px 1fr 280px;
  min-height: 0;
}
.side {
  background: #fff;
  border-right: 1px solid var(--bc-line);
  padding: 14px;
  overflow: auto;
}
.side.right {
  border-right: 0;
  border-left: 1px solid var(--bc-line);
}
.canvas-wrap {
  position: relative;
  min-height: 480px;
}
.canvas {
  position: absolute;
  inset: 0;
}
.model-list {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  display: grid;
  gap: 8px;
}
.model-list li {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--bc-line);
  cursor: pointer;
  align-items: center;
}
.model-list li.on {
  border-color: var(--bc-ink);
  background: #f4f6f8;
}
.panel {
  margin-bottom: 18px;
}
.panel label,
.modal-card label {
  display: grid;
  gap: 4px;
  margin-bottom: 10px;
  font-size: 0.9rem;
}
.check {
  display: flex !important;
  align-items: center;
  gap: 8px;
}
.hint,
.pad {
  padding: 16px;
  color: var(--bc-muted);
}
.err {
  color: #a11;
}
.banner {
  position: relative;
  z-index: 2;
  margin: 8px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--bc-line);
}
.ghost {
  border: 0;
  background: transparent;
  cursor: pointer;
  color: var(--bc-muted);
}
.linkish {
  border: 0;
  background: transparent;
  cursor: pointer;
  text-align: left;
  padding: 0;
  font: inherit;
}
.mt {
  margin-top: 18px;
}
.row {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}
.upload {
  display: grid;
  gap: 4px;
  margin-top: 10px;
  font-size: 0.85rem;
}
.modal {
  position: fixed;
  inset: 0;
  background: rgba(20, 24, 30, 0.45);
  display: grid;
  place-items: center;
  z-index: 50;
}
.modal-card {
  width: min(480px, 92vw);
  max-height: 80vh;
  overflow: auto;
  background: #fff;
  padding: 16px;
  border: 1px solid var(--bc-line);
}
.modal-card header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.picker-list {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  display: grid;
  gap: 8px;
}
.picker-list button {
  width: 100%;
  text-align: left;
  display: grid;
  gap: 2px;
  padding: 10px;
  border: 1px solid var(--bc-line);
  background: #fff;
  cursor: pointer;
}
.progress-modal {
  z-index: 60;
}
.progress-card {
  width: min(420px, 92vw);
}
.progress-msg {
  margin: 8px 0 14px;
  color: var(--bc-ink);
}
.progress-track {
  height: 10px;
  border-radius: 999px;
  background: #e6eaef;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: var(--bc-ink);
  border-radius: 999px;
  transition: width 0.35s ease;
}
.progress-fill.indeterminate {
  background: linear-gradient(90deg, #9aa3ad 0%, var(--bc-ink) 50%, #9aa3ad 100%);
  background-size: 200% 100%;
  animation: progress-slide 1.2s linear infinite;
}
.progress-meta {
  margin: 10px 0 0;
  font-size: 0.85rem;
  color: var(--bc-muted);
}
.progress-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  justify-content: flex-end;
}
@keyframes progress-slide {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}
@media (max-width: 960px) {
  .layout {
    grid-template-columns: 1fr;
  }
  .side {
    border: 0;
    border-bottom: 1px solid var(--bc-line);
  }
  .canvas-wrap {
    min-height: 360px;
  }
}
</style>
