<template>
  <div class="page">
    <header class="top">
      <RouterLink to="/designs">← {{ t('studio.myDesigns') }}</RouterLink>
      <div class="status">
        <span>{{ statusLabel }}</span>
        <div class="view-toggle" role="group" :aria-label="t('studio.viewMode')">
          <button type="button" :class="{ on: viewMode === '2d' }" @click="viewMode = '2d'">{{ t('studio.view2d') }}</button>
          <button type="button" :class="{ on: viewMode === '3d' }" @click="viewMode = '3d'">{{ t('studio.view3d') }}</button>
        </div>
        <button type="button" :disabled="!design.canUndo" @click="design.undo()">{{ t('studio.undo') }}</button>
        <button type="button" :disabled="!design.canRedo" @click="design.redo()">{{ t('studio.redo') }}</button>
        <button type="button" :disabled="design.saving || !design.dirty" @click="design.save(true)">{{ t('studio.saveNow') }}</button>
      </div>
    </header>

    <p v-if="bootError" class="pad err">{{ bootError }}</p>
    <p v-else-if="!design.document" class="pad">{{ t('studio.loading') }}</p>

    <main v-else class="layout studio-layout">
      <aside class="side left">
        <ToolRail />
      </aside>

      <section class="canvas-wrap">
        <div v-if="design.draftPrompt !== 'none'" class="draft">
          <p v-if="design.draftPrompt === 'recover'">{{ t('studio.draftRecoverHint') }}</p>
          <p v-else>{{ t('studio.draftConflictHint') }}</p>
          <div class="draft-actions">
            <button type="button" @click="design.acceptDraft()">{{ t('studio.draftRestore') }}</button>
            <button type="button" class="ghost" @click="design.discardDraft()">{{ t('studio.draftDiscard') }}</button>
          </div>
        </div>
        <div v-if="design.conflict" class="conflict">
          <p>{{ t('studio.conflictHint') }}</p>
          <button type="button" @click="design.reloadAfterConflict()">{{ t('studio.reload') }}</button>
        </div>
        <div v-if="design.pendingAdaptCount" class="adapt">
          <p>{{ t('studio.needsAdaptBanner', { n: design.pendingAdaptCount }) }}</p>
          <p class="meta">{{ t('studio.needsAdaptHint') }}</p>
        </div>
        <p v-if="design.error && !design.conflict" class="err banner">{{ displayError }}</p>
        <StudioCanvas2D v-if="viewMode === '2d'" />
        <StudioFoldPreview v-else />
      </section>

      <aside class="side right">
        <header class="side-head">
          <h1>{{ design.name }}</h1>
          <p class="meta">{{ design.document.geometry.templateId }} · {{ design.document.geometry.mode }} · row {{ design.rowVersion }}</p>
        </header>

        <section class="panel-section">
          <h2>{{ t('studio.geometry') }}</h2>
          <div class="row">
            <label>L<input v-model.number="lengthMm" type="number" :min="lengthMin" :max="lengthMax" step="0.1" :disabled="!design.editableSize" @change="onParams" /></label>
            <label>W<input v-model.number="widthMm" type="number" :min="widthMin" :max="widthMax" step="0.1" :disabled="!design.editableSize" @change="onParams" /></label>
            <label>H<input v-model.number="heightMm" type="number" :min="heightMin" :max="heightMax" step="0.1" :disabled="!design.editableSize" @change="onParams" /></label>
          </div>
          <p v-if="!design.editableSize" class="hint">{{ t('studio.sizeLocked') }}</p>
          <p v-else-if="design.errorCode === 'OUT_OF_RANGE'" class="hint err">{{ t('studio.outOfRange') }}</p>
          <p v-else-if="design.document.artwork.layers.length" class="hint">{{ t('studio.sizeMigrateHint') }}</p>
          <label>
            {{ t('studio.paperStock') }}
            <select v-model="paperId" @change="onPaperChange">
              <option v-for="p in paperOptions" :key="p.id" :value="p.id">{{ paperOptionLabel(p) }}</option>
            </select>
          </label>
          <div class="row">
            <label>
              {{ t('studio.thicknessMm') }}
              <input v-model.number="thicknessMm" type="number" min="0.1" max="50" step="0.01" :disabled="!design.editableSize" @change="onParams" />
            </label>
            <label>
              {{ t('studio.sizeMode') }}
              <select v-model="sizeMode" :disabled="!design.editableSize" @change="onParams">
                <option value="inner">{{ t('studio.sizeModeInner') }}</option>
                <option value="outer">{{ t('studio.sizeModeOuter') }}</option>
              </select>
            </label>
          </div>
          <label>
            {{ t('studio.fluteDirection') }}
            <select v-model="fluteDirection" @change="onParams">
              <option value="L">{{ t('studio.fluteL') }}</option>
              <option value="W">{{ t('studio.fluteW') }}</option>
            </select>
          </label>
          <p v-if="dimsLine" class="dims">{{ dimsLine }}</p>
          <div v-for="risk in paperRisks" :key="risk.code" class="risk" :class="risk.level">{{ riskText(risk.code) }}</div>
          <button type="button" class="bc-btn bc-btn--ghost sample-btn" :disabled="sampleBusy" @click="onApplySample">
            {{ sampleBusy ? t('studio.applyingSample') : t('studio.applySampleDesign') }}
          </button>
          <p v-if="sampleMsg" class="hint">{{ sampleMsg }}</p>
          <p class="hash">geometryHash: {{ design.document.geometry.geometryHash }}</p>
        </section>

        <section class="panel-section">
          <h2>{{ t('outbox.title') }}</h2>
          <label class="check">
            <input v-model="outboxEnabled" type="checkbox" @change="onOutbox" />
            {{ t('outbox.enable') }}
          </label>
          <p v-if="!outboxEnabled" class="hint">{{ t('studio.outboxContinueHint') }}</p>
          <p v-else class="hint outbox-on">{{ t('studio.outboxEnabledBadge') }}</p>
          <template v-if="outboxEnabled">
            <label>
              {{ t('outbox.modeGrow') }}
              <select v-model="outboxSizingMode" @change="onOutbox">
                <option value="grow">{{ t('outbox.modeGrow') }}</option>
                <option value="fixed">{{ t('outbox.modeFixed') }}</option>
              </select>
            </label>
            <div class="row">
              <label>{{ t('outbox.qty') }}<input v-model.number="outboxQty" type="number" min="1" @change="onOutbox" /></label>
              <label>{{ t('outbox.thickness') }}<input v-model.number="outboxThickness" type="number" min="1" step="0.1" @change="onOutbox" /></label>
              <label>{{ t('outbox.gapL') }}<input v-model.number="gapL" type="number" min="0" step="0.1" @change="onOutbox" /></label>
              <label>{{ t('outbox.gapW') }}<input v-model.number="gapW" type="number" min="0" step="0.1" @change="onOutbox" /></label>
              <label>{{ t('outbox.gapH') }}<input v-model.number="gapH" type="number" min="0" step="0.1" @change="onOutbox" /></label>
            </div>
            <template v-if="outboxSizingMode === 'fixed'">
              <p class="hint">{{ t('outbox.fixedSize') }}</p>
              <div class="row">
                <label>{{ t('outbox.fixedL') }}<input v-model.number="fixedL" type="number" min="1" step="0.1" @change="onOutbox" /></label>
                <label>{{ t('outbox.fixedW') }}<input v-model.number="fixedW" type="number" min="1" step="0.1" @change="onOutbox" /></label>
                <label>{{ t('outbox.fixedH') }}<input v-model.number="fixedH" type="number" min="1" step="0.1" @change="onOutbox" /></label>
              </div>
            </template>
            <label class="check">
              <input v-model="outboxManual" type="checkbox" @change="onOutbox" />
              {{ t('outbox.layoutManual') }}
            </label>
            <div v-if="outboxManual" class="row">
              <label>{{ t('outbox.nx') }}<input v-model.number="manualNx" type="number" min="1" @change="onOutbox" /></label>
              <label>{{ t('outbox.ny') }}<input v-model.number="manualNy" type="number" min="1" @change="onOutbox" /></label>
              <label>{{ t('outbox.nz') }}<input v-model.number="manualNz" type="number" min="1" @change="onOutbox" /></label>
              <label class="check">
                <input v-model="manualRotated" type="checkbox" @change="onOutbox" />
                {{ t('outbox.rotated') }}
              </label>
            </div>
            <p v-if="outboxPreviewUnavailable" class="hint">{{ t('studio.outboxPreviewUnavailable') }}</p>
            <div v-else-if="outboxErrorText" class="risk danger">
              <p>{{ outboxErrorText }}</p>
              <p v-if="outboxErrorHintText">{{ outboxErrorHintText }}</p>
              <p class="meta">{{ t('outbox.exportDisabled') }}</p>
            </div>
            <template v-else-if="outboxMappingLine">
              <p class="dims">{{ outboxMappingLine }}</p>
              <p v-if="outboxStatsLine" class="meta">{{ outboxStatsLine }}</p>
              <p v-if="outboxFitLine" class="meta">{{ outboxFitLine }}</p>
            </template>
          </template>
        </section>

        <section class="panel-section">
          <ExportPanel />
          <button
            type="button"
            class="bc-btn bc-btn--ghost"
            style="margin-top: 10px; width: 100%"
            :disabled="!design.designId"
            @click="onOpenRenderer"
          >
            {{ t('render.openInRenderer') }}
          </button>
        </section>

        <section class="panel-section">
          <h2>{{ t('quote.title') }}</h2>
          <p class="hint">{{ t('quote.lead') }}</p>
          <button type="button" class="bc-btn bc-btn--primary" :disabled="quote.busy || !design.currentRevisionId" @click="onRequestQuote">
            {{ quote.busy ? t('quote.requesting') : t('quote.request') }}
          </button>
          <p v-if="quote.error" class="err">{{ quoteError }}</p>
          <div v-if="quote.current" class="quote-box">
            <p v-if="quote.current.status === 'pending_manual'" class="hint">{{ t('quote.pendingManual') }}</p>
            <p v-else-if="quote.current.status === 'valid'">
              {{ t('quote.validTotal', { amount: quote.current.total_amount, currency: quote.current.currency }) }}
            </p>
            <p v-if="quote.current.valid_until" class="meta">{{ t('quote.validUntil', { at: quote.current.valid_until }) }}</p>
            <p class="meta">{{ t('quote.status') }}: {{ quote.current.status }} · qty {{ quote.current.quantity }}</p>
          </div>
          <button
            type="button"
            class="bc-btn bc-btn--primary"
            :disabled="cart.busy || !design.currentRevisionId"
            @click="onAddToCart"
          >
            {{ cart.busy ? t('cart.adding') : t('cart.add') }}
          </button>
          <p v-if="cartMsg" class="hint">{{ cartMsg }}</p>
          <p v-if="cart.error" class="err">{{ cart.error }}</p>
          <p class="meta"><RouterLink to="/cart">{{ t('cart.title') }}</RouterLink> · <RouterLink to="/orders">{{ t('order.title') }}</RouterLink></p>
        </section>
      </aside>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { ApiError } from '../api/client'
import { renderSceneCreate } from '../api/renderScenes'
import { PAPER_CATALOG, getPaperById, resolvePaperFromParams } from '../catalog/paperCatalog.js'
import { evaluatePaperRisks } from '../catalog/paperRiskRules.js'
import ExportPanel from '../components/studio/ExportPanel.vue'
import StudioCanvas2D from '../components/studio/StudioCanvas2D.vue'
import StudioFoldPreview from '../components/studio/StudioFoldPreview.vue'
import ToolRail from '../components/studio/ToolRail.vue'
import { createKnife, deriveSizes } from '../knife.js'
import { buildOutboxKnife } from '../outbox.js'
import { publicAssetUrl } from '../assetUrl.js'
import { buildStudioKnifeAsync, pickMainPanel } from '../studio/knifeAdapter'
import { useAuthStore } from '../stores/auth'
import { useCartStore } from '../stores/cart'
import { useDesignStore } from '../stores/design'
import { useExportStore } from '../stores/export'
import { useQuoteStore } from '../stores/quote'
import { getTemplate } from '../templates/index.js'
// @ts-expect-error JS module
import { ensureTemplate } from '../templates/lazy.js'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const design = useDesignStore()
const quote = useQuoteStore()
const cart = useCartStore()
const exportStore = useExportStore()
const bootError = ref('')
/** Bumped once the design's (lazily loaded) template is registered, so template-derived computeds re-run */
const templateTick = ref(0)
watch(
  () => design.document?.geometry.templateId,
  async (id) => {
    if (!id) return
    await ensureTemplate(id)
    templateTick.value++
  },
  { immediate: true },
)
const cartMsg = ref('')
const sampleBusy = ref(false)
const sampleMsg = ref('')
const viewMode = ref<'2d' | '3d'>('2d')

const lengthMm = ref(0)
const widthMm = ref(0)
const heightMm = ref(0)
const thicknessMm = ref(0.35)
const sizeMode = ref<'inner' | 'outer'>('inner')
const fluteDirection = ref<'L' | 'W'>('L')
const paperId = ref('kraft-250')
const materialId = ref('kraft')
const outboxEnabled = ref(false)
const outboxQty = ref(1)
const outboxSizingMode = ref<'grow' | 'fixed'>('grow')
const outboxThickness = ref(3)
const gapL = ref(5)
const gapW = ref(5)
const gapH = ref(5)
const fixedL = ref(430)
const fixedW = ref(210)
const fixedH = ref(270)
const outboxManual = ref(false)
const manualNx = ref(1)
const manualNy = ref(1)
const manualNz = ref(1)
const manualRotated = ref(false)

const paperOptions = PAPER_CATALOG

const SAMPLE_LOGO = 'boxcraft-logo.png'

const SAMPLE_BY_FAMILY: Record<string, string> = {
  mailer: SAMPLE_LOGO,
  gift: SAMPLE_LOGO,
  square: SAMPLE_LOGO,
  kraft: SAMPLE_LOGO,
  default: SAMPLE_LOGO,
}

const statusLabel = computed(() => {
  switch (design.saveStatus) {
    case 'dirty':
      return t('studio.statusDirty')
    case 'saving':
      return t('studio.statusSaving')
    case 'saved':
      return t('studio.statusSaved')
    case 'conflict':
      return t('studio.statusConflict')
    case 'error':
      return t('studio.statusError')
    default:
      return t('studio.statusIdle')
  }
})

const displayError = computed(() => {
  if (design.errorCode === 'OUT_OF_RANGE') return t('studio.outOfRange')
  return design.error
})

const quoteError = computed(() => {
  if (quote.errorCode === 'NO_REVISION') return t('quote.noRevision')
  return quote.error || t('quote.failed')
})

const lengthMin = computed(() => design.paramLimits?.length?.[0] ?? 1)
const lengthMax = computed(() => design.paramLimits?.length?.[1] ?? undefined)
const widthMin = computed(() => design.paramLimits?.width?.[0] ?? 1)
const widthMax = computed(() => design.paramLimits?.width?.[1] ?? undefined)
const heightMin = computed(() => design.paramLimits?.height?.[0] ?? 0)
const heightMax = computed(() => design.paramLimits?.height?.[1] ?? undefined)

function paperOptionLabel(p: (typeof PAPER_CATALOG)[number]) {
  return String(locale.value || '').startsWith('ko') ? p.labelKo : p.labelZh
}

function riskText(code: string) {
  const map: Record<string, string> = {
    thin_tall: 'studio.riskThinTall',
    thin_mid_height: 'studio.riskThinMid',
    art_tall_prefer_flute: 'studio.riskArtTall',
    art_large_panel: 'studio.riskArtLarge',
    e_flute_tall: 'studio.riskEFluteTall',
    light_gsm_large: 'studio.riskLightLarge',
  }
  return t(map[code] || code)
}

const currentPaper = computed(() => getPaperById(paperId.value) || resolvePaperFromParams({
  materialId: materialId.value,
  thicknessMm: thicknessMm.value,
  advanced: { paperId: paperId.value },
}))

const paperRisks = computed(() =>
  evaluatePaperRisks(currentPaper.value, {
    lengthMm: lengthMm.value,
    widthMm: widthMm.value,
    heightMm: heightMm.value,
  }),
)

const derivedDims = computed(() => {
  void templateTick.value
  const doc = design.document
  if (!doc) return null
  const tpl = getTemplate(doc.geometry.templateId)
  if (!tpl) return null
  try {
    return deriveSizes(tpl, {
      length: lengthMm.value,
      width: widthMm.value,
      height: heightMm.value,
      thickness: thicknessMm.value,
      sizeMode: sizeMode.value,
    })
  } catch {
    return null
  }
})

const dimsLine = computed(() => {
  const d = derivedDims.value
  if (!d?.inner || !d?.outer) return ''
  const fmt = (x: number) => Math.round(Number(x) * 10) / 10
  return t('studio.dimsClearance', {
    il: fmt(d.inner.length),
    iw: fmt(d.inner.width),
    ih: fmt(d.inner.height),
    ol: fmt(d.outer.length),
    ow: fmt(d.outer.width),
    oh: fmt(d.outer.height),
  })
})

const outboxBundle = computed(() => {
  void templateTick.value
  if (!outboxEnabled.value || !design.document) return null
  try {
    const p = design.document.geometry.params
    const tplId = design.document.geometry.templateId
    if (!getTemplate(tplId)) return { error: 'preview_unavailable' as const }
    const inboxKnife = createKnife({
      templateId: tplId,
      length: p.lengthMm,
      width: p.widthMm,
      height: p.heightMm,
      thickness: p.thicknessMm,
      bleed: p.bleedInputMm,
      sizeMode: p.sizeMode,
      fluteDirection: p.fluteDirection,
      materialId: p.materialId,
      params: p.advanced || {},
      previewBleedExtra: 10,
    })
    const bundle = buildOutboxKnife({
      inboxKnife,
      gap: { length: gapL.value, width: gapW.value, height: gapH.value },
      thickness: outboxThickness.value,
      bleed: p.bleedInputMm || 5,
      materialId: materialId.value,
      fluteDirection: fluteDirection.value,
      enabled: true,
      quantity: Math.max(1, Number(outboxQty.value) || 1),
      manualLayout: outboxManual.value
        ? {
            nx: Math.max(1, Number(manualNx.value) || 1),
            ny: Math.max(1, Number(manualNy.value) || 1),
            nz: Math.max(1, Number(manualNz.value) || 1),
            rotated: !!manualRotated.value,
          }
        : null,
      sizingMode: outboxSizingMode.value,
      fixedInner:
        outboxSizingMode.value === 'fixed'
          ? { length: fixedL.value, width: fixedW.value, height: fixedH.value }
          : null,
    })
    return bundle || { error: 'preview_unavailable' as const }
  } catch {
    return { error: 'preview_unavailable' as const }
  }
})

const outboxPreviewUnavailable = computed(() => outboxBundle.value?.error === 'preview_unavailable')
const outboxError = computed(() => {
  const e = outboxBundle.value?.error
  return e && e !== 'preview_unavailable' ? e : null
})
const outboxHint = computed(() => outboxBundle.value?.hint || null)
const outboxPlan = computed(() => outboxBundle.value?.plan || null)
const outboxOuter = computed(() => outboxBundle.value?.outer || null)
const outboxPacking = computed(() => outboxBundle.value?.packing || null)
const outboxStats = computed(() => outboxBundle.value?.stats || null)

const outboxErrorText = computed(() => {
  const err = outboxError.value
  if (!err) return ''
  if (err === 'overLimit') {
    const o = outboxHint.value?.overflow || {}
    return t('outbox.errOverLimit', { ol: o.length || 0, ow: o.width || 0, oh: o.height || 0 })
  }
  if (err === 'noneFit') return t('outbox.errNoneFit')
  if (err === 'fixedOutOfRange') return t('outbox.errFixedRange')
  return String(err)
})

const outboxErrorHintText = computed(() => {
  if (outboxError.value !== 'overLimit') return ''
  const max = outboxHint.value?.maxFit
  return max != null ? t('outbox.errOverLimitHint', { max }) : ''
})

const outboxStatsLine = computed(() => {
  const s = outboxStats.value
  if (!s) return ''
  return [
    t('outbox.unitVol', { v: s.unitLiters }),
    t('outbox.totalVol', { v: s.totalLiters }),
    t('outbox.cavityVol', { v: s.cavityLiters }),
    t('outbox.fillRate', { v: s.fillRate }),
  ].join(' · ')
})

const outboxMappingLine = computed(() => {
  if (outboxError.value || !outboxOuter.value || !outboxPlan.value || !outboxPacking.value) return ''
  return t('outbox.mapping', {
    ol: outboxOuter.value.length,
    ow: outboxOuter.value.width,
    oh: outboxOuter.value.height,
    n: outboxPacking.value.quantity,
    nx: outboxPacking.value.nx,
    ny: outboxPacking.value.ny,
    nz: outboxPacking.value.nz,
    il: outboxPlan.value.inner.length,
    iw: outboxPlan.value.inner.width,
    ih: outboxPlan.value.inner.height,
  })
})

const outboxFitLine = computed(() => {
  if (outboxError.value || !outboxPacking.value || outboxSizingMode.value !== 'fixed') return ''
  return t('outbox.fitResult', {
    n: outboxPacking.value.quantity,
    nx: outboxPacking.value.nx,
    ny: outboxPacking.value.ny,
    nz: outboxPacking.value.nz,
  })
})

function syncFromDoc() {
  const doc = design.document
  if (!doc) return
  const p = doc.geometry.params
  lengthMm.value = p.lengthMm
  widthMm.value = p.widthMm
  heightMm.value = p.heightMm
  thicknessMm.value = p.thicknessMm
  sizeMode.value = p.sizeMode === 'outer' ? 'outer' : 'inner'
  fluteDirection.value = p.fluteDirection === 'W' ? 'W' : 'L'
  materialId.value = p.materialId
  const paper = resolvePaperFromParams(p)
  paperId.value = paper.id
  outboxEnabled.value = !!doc.outbox?.enabled
  outboxQty.value = doc.outbox?.quantity || 1
  outboxSizingMode.value = doc.outbox?.sizingMode === 'fixed' ? 'fixed' : 'grow'
  outboxThickness.value = doc.outbox?.thicknessMm || 3
  gapL.value = doc.outbox?.gapsMm?.length ?? 5
  gapW.value = doc.outbox?.gapsMm?.width ?? 5
  gapH.value = doc.outbox?.gapsMm?.height ?? 5
  fixedL.value = doc.outbox?.fixedInnerMm?.length ?? 430
  fixedW.value = doc.outbox?.fixedInnerMm?.width ?? 210
  fixedH.value = doc.outbox?.fixedInnerMm?.height ?? 270
  outboxManual.value = !!doc.outbox?.manualLayout
  manualNx.value = doc.outbox?.manualLayout?.nx ?? 1
  manualNy.value = doc.outbox?.manualLayout?.ny ?? 1
  manualNz.value = doc.outbox?.manualLayout?.nz ?? 1
  manualRotated.value = !!doc.outbox?.manualLayout?.rotated
}

watch(() => design.document, syncFromDoc, { deep: true })

function onPaperChange() {
  const paper = getPaperById(paperId.value)
  if (!paper) return
  materialId.value = paper.mapMaterialId
  thicknessMm.value = paper.thicknessMm
  onParams()
}

function onParams() {
  const paper = getPaperById(paperId.value)
  const prevAdvanced = { ...(design.document?.geometry.params.advanced || {}) }
  design.updateParams({
    lengthMm: lengthMm.value,
    widthMm: widthMm.value,
    heightMm: heightMm.value,
    thicknessMm: Math.max(0.1, Number(thicknessMm.value) || 0.35),
    sizeMode: sizeMode.value,
    fluteDirection: fluteDirection.value,
    materialId: paper?.mapMaterialId || materialId.value,
    advanced: {
      ...prevAdvanced,
      paperId: paperId.value,
    },
  })
  if (paper) materialId.value = paper.mapMaterialId
}

function pickSampleFile(): string {
  const tid = String(design.document?.geometry.templateId || '').toLowerCase()
  if (tid.includes('mailer') || tid.includes('aircraft')) return SAMPLE_BY_FAMILY.mailer
  if (tid.includes('gift') || tid.includes('magnetic') || tid.includes('boutique')) return SAMPLE_BY_FAMILY.gift
  if (tid.includes('square') || tid.includes('pair')) return SAMPLE_BY_FAMILY.square
  if ((materialId.value || '') === 'kraft') return SAMPLE_BY_FAMILY.kraft
  return SAMPLE_BY_FAMILY.default
}

async function onApplySample() {
  sampleMsg.value = ''
  sampleBusy.value = true
  try {
    if (!design.document) throw new Error(t('studio.loadFailed'))
    const knife = await buildStudioKnifeAsync(design.document)
    let panelId = design.selectedPanelId
    if (!panelId) {
      const main = pickMainPanel(knife)
      if (!main) throw new Error(t('studio.sampleNoPanel'))
      design.selectPanel(main.name)
      panelId = main.name
    } else if (!knife.faces.some((f) => f.name === panelId)) {
      throw new Error(t('studio.sampleNoPanel'))
    }
    const name = pickSampleFile()
    const url = publicAssetUrl(`sample-artworks/${name}`)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`sample ${name} ${res.status}`)
    const blob = await res.blob()
    const file = new File([blob], name, { type: blob.type || 'image/png' })
    await design.addImageLayer(file, panelId, { fitPanel: true })
    sampleMsg.value = t('studio.sampleApplied')
  } catch (e: unknown) {
    sampleMsg.value = e instanceof Error ? `${t('studio.sampleFailed')}: ${e.message}` : t('studio.sampleFailed')
  } finally {
    sampleBusy.value = false
  }
}

function onOutbox() {
  design.updateOutbox({
    enabled: outboxEnabled.value,
    sizingMode: outboxSizingMode.value,
    quantity: Math.max(1, Number(outboxQty.value) || 1),
    thicknessMm: Math.max(0.1, Number(outboxThickness.value) || 3),
    gapsMm: { length: gapL.value, width: gapW.value, height: gapH.value },
    fixedInnerMm:
      outboxSizingMode.value === 'fixed'
        ? { length: fixedL.value, width: fixedW.value, height: fixedH.value }
        : null,
    manualLayout: outboxManual.value
      ? {
          nx: Math.max(1, Number(manualNx.value) || 1),
          ny: Math.max(1, Number(manualNy.value) || 1),
          nz: Math.max(1, Number(manualNz.value) || 1),
          rotated: !!manualRotated.value,
        }
      : null,
  })
}

async function onOpenRenderer() {
  if (!design.designId) return
  if (design.dirty) await design.save(true)
  try {
    const scene = await renderSceneCreate({
      name: `${design.name || t('render.untitled')} · 3D`,
      design_id: design.designId,
      revision_id: design.currentRevisionId,
    })
    await router.push(`/render/${scene.id}`)
  } catch (e: unknown) {
    bootError.value = e instanceof ApiError ? e.message : t('render.createFailed')
  }
}

async function onRequestQuote() {
  onOutbox()
  await quote.requestQuote(outboxQty.value)
}

async function onAddToCart() {
  cartMsg.value = ''
  onOutbox()
  if (design.dirty) await design.save(true)
  if (!design.currentRevisionId) {
    cartMsg.value = t('quote.noRevision')
    return
  }
  const item = await cart.add({
    design_revision_id: design.currentRevisionId,
    quantity: Math.max(1, Number(outboxQty.value) || 1),
    quote_id: quote.current?.id,
  })
  if (item) cartMsg.value = t('cart.added')
}

onMounted(async () => {
  await auth.refreshMe()
  if (!auth.isAuthenticated) {
    await router.push({ path: '/account/login', query: { next: route.fullPath } })
    return
  }
  try {
    quote.reset()
    await design.load(String(route.params.id))
    syncFromDoc()
  } catch (e: unknown) {
    bootError.value = e instanceof ApiError ? e.message : t('studio.loadFailed')
  }
})

onUnmounted(() => {
  quote.reset()
  exportStore.reset()
  design.reset()
})
</script>

<style scoped>
.page{
  height:100vh;
  max-height:100vh;
  overflow:hidden;
  display:flex;
  flex-direction:column;
  background:var(--bc-paper);
  color:var(--bc-ink);
  font-family:var(--bc-font-ui);
}
.top{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:12px;
  padding:10px 16px;
  background:var(--bc-paper-elevated);
  border-bottom:1px solid var(--bc-line);
  color:var(--bc-ink);
}
.top a{
  color:var(--bc-ink);
  text-decoration:none;
  font-weight:600;
  font-size:13px;
}
.status{display:flex;align-items:center;gap:8px;font-size:13px;flex-wrap:wrap;color:var(--bc-ink-muted)}
.status button{
  border:1px solid var(--bc-line-strong);
  border-radius:var(--bc-radius-sm);
  background:var(--bc-ink);
  color:#fff;
  padding:7px 10px;
  cursor:pointer;
  font-weight:600;
}
.status button:disabled{opacity:.45}
.view-toggle{
  display:inline-flex;
  border:1px solid var(--bc-line);
  border-radius:var(--bc-radius-sm);
  overflow:hidden;
}
.view-toggle button{
  border-radius:0;
  background:#fff;
  color:var(--bc-ink-muted);
  border:0;
}
.view-toggle button.on{
  background:var(--bc-steel-soft);
  color:var(--bc-steel);
}
.layout{
  flex:1;
  display:grid;
  grid-template-columns:300px minmax(0,1fr) 300px;
  gap:12px;
  padding:12px;
  min-height:0;
  overflow:hidden;
}
/* Studio-local tokens: Logo teal + slate structure (does not change global --bc-steel) */
.studio-layout{
  --bc-steel:#006868;
  --bc-steel-soft:#eef6f6;
  --bc-steel-hover:#005555;
  --bc-focus:0 0 0 3px rgba(0,104,104,.28);
  --studio-side-bg:#f8fafc;
  --studio-card-bg:#ffffff;
  --studio-muted:#f1f5f9;
  --studio-border:#e2e8f0;
  --studio-border-soft:rgba(15,23,42,.06);
  --studio-ink:#1e293b;
  --studio-ink-muted:#64748b;
  --studio-radius:12px;
  --studio-radius-sm:8px;
  --studio-ease:160ms cubic-bezier(0.22,1,0.36,1);
}
.side{
  background:var(--studio-side-bg);
  border:1px solid var(--studio-border);
  border-radius:var(--studio-radius);
  padding:16px;
  overflow:auto;
  min-height:0;
  max-height:100%;
  box-shadow:var(--bc-shadow-sm);
}
.side.right{
  display:flex;
  flex-direction:column;
  gap:14px;
}
.side.left{padding:12px}
.side-head{display:flex;flex-direction:column;gap:6px;padding-bottom:4px}
.panel-section{
  border:0;
  border-radius:var(--studio-radius);
  background:var(--studio-card-bg);
  padding:14px;
  display:flex;
  flex-direction:column;
  gap:10px;
  box-shadow:inset 0 0 0 1px var(--studio-border-soft);
  animation:section-in 360ms cubic-bezier(0.22,1,0.36,1) both;
}
.panel-section:nth-of-type(1){animation-delay:0ms}
.panel-section:nth-of-type(2){animation-delay:40ms}
.panel-section:nth-of-type(3){animation-delay:80ms}
.panel-section:nth-of-type(4){animation-delay:120ms}
@keyframes section-in{
  from{opacity:0;transform:translateY(6px)}
  to{opacity:1;transform:none}
}
@media (prefers-reduced-motion:reduce){
  .panel-section{animation:none}
}
.canvas-wrap{
  min-height:0;
  height:100%;
  overflow:hidden;
  display:flex;
  flex-direction:column;
  gap:8px;
}
h1{margin:0;font-size:var(--bc-fs-title);font-family:var(--bc-font-display);letter-spacing:-0.02em;color:var(--studio-ink)}
h2{margin:0;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--studio-ink-muted);font-weight:600}
.meta,.hash{margin:0;font-size:var(--bc-fs-small);color:var(--studio-ink-muted)}
.row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
label{display:flex;flex-direction:column;gap:5px;font-size:var(--bc-fs-small);color:var(--studio-ink);font-weight:500}
.check{flex-direction:row;align-items:center;gap:8px}
input,select{
  border:1px solid var(--studio-border);
  border-radius:var(--studio-radius-sm);
  padding:9px 11px;
  font:inherit;
  background:#fff;
  color:var(--studio-ink);
  transition:border-color var(--studio-ease), box-shadow var(--studio-ease);
}
input:hover,select:hover{border-color:#cbd5e1}
input:focus,select:focus{
  outline:none;
  border-color:var(--bc-steel);
  box-shadow:var(--bc-focus);
}
.hint{margin:0;font-size:var(--bc-fs-small);color:var(--bc-warn)}
.err{color:var(--bc-danger)}
.banner{margin:0;background:#fff;border:1px solid #f0c2bc;border-radius:var(--studio-radius-sm);padding:8px 10px}
.quote-box{
  margin-top:4px;
  padding:12px;
  border:0;
  border-radius:var(--studio-radius-sm);
  background:var(--studio-muted);
  box-shadow:inset 0 0 0 1px var(--studio-border-soft);
  display:flex;
  flex-direction:column;
  gap:6px;
}
.panel-section .bc-btn{width:100%;min-height:40px;border-radius:var(--studio-radius-sm);transition:background var(--studio-ease),border-color var(--studio-ease),transform var(--studio-ease)}
.panel-section .bc-btn:hover:not(:disabled){transform:translateY(-1px)}
.panel-section .bc-btn--ghost{
  background:var(--studio-card-bg);
  border-color:var(--studio-border);
  color:var(--studio-ink);
}
.panel-section .bc-btn--ghost:hover:not(:disabled){
  border-color:var(--bc-steel);
  color:var(--bc-steel);
}
.conflict,.draft,.adapt{
  background:var(--bc-warn-bg);
  border:1px solid var(--bc-warn-line);
  border-radius:var(--bc-radius);
  padding:10px;
}
.conflict button,.draft button{
  margin-top:6px;
  border:0;
  border-radius:var(--bc-radius-sm);
  background:var(--bc-ink);
  color:#fff;
  padding:8px 12px;
  cursor:pointer;
}
.draft-actions{display:flex;gap:8px;flex-wrap:wrap}
.draft button.ghost{
  background:#fff;
  color:var(--bc-ink);
  border:1px solid var(--bc-line-strong);
}
.outbox-on{color:var(--bc-steel);font-weight:600}
.dims{margin:0;font-size:var(--bc-fs-small);color:var(--bc-steel);font-weight:600;line-height:1.45}
.risk{
  margin:0;
  font-size:var(--bc-fs-small);
  border-radius:var(--studio-radius-sm);
  padding:8px 10px;
  line-height:1.4;
  border:0;
  box-shadow:inset 0 0 0 1px var(--studio-border-soft);
}
.risk.warn{background:var(--bc-warn-bg);box-shadow:inset 0 0 0 1px var(--bc-warn-line);color:var(--bc-warn)}
.risk.danger{background:#fff5f5;box-shadow:inset 0 0 0 1px #f0c2bc;color:var(--bc-danger)}
.sample-btn{width:100%;min-height:38px}
.pad{padding:32px 20px}
@media (max-width:1100px){
  .page{height:auto;max-height:none;overflow:auto}
  .layout{grid-template-columns:1fr;grid-template-rows:auto 480px auto;overflow:visible}
  .canvas-wrap{height:480px}
}
</style>
