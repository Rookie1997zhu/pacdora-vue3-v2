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

    <main v-else class="layout">
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
        <h1>{{ design.name }}</h1>
        <p class="meta">{{ design.document.geometry.templateId }} · {{ design.document.geometry.mode }} · row {{ design.rowVersion }}</p>

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
          {{ t('studio.material') }}
          <select v-model="materialId" @change="onParams">
            <option value="kraft">{{ t('lab.kraft') }}</option>
            <option value="white">{{ t('lab.white') }}</option>
            <option value="blue">{{ t('lab.blue') }}</option>
          </select>
        </label>
        <p class="hash">geometryHash: {{ design.document.geometry.geometryHash }}</p>

        <h2>{{ t('outbox.title') }}</h2>
        <label class="check">
          <input v-model="outboxEnabled" type="checkbox" @change="onOutbox" />
          {{ t('outbox.enable') }}
        </label>
        <p v-if="outboxEnabled" class="hint outbox-on">{{ t('studio.outboxEnabledBadge') }}</p>
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
        </template>

        <ExportPanel />

        <h2>{{ t('quote.title') }}</h2>
        <p class="hint">{{ t('quote.lead') }}</p>
        <button type="button" class="quote-btn" :disabled="quote.busy || !design.currentRevisionId" @click="onRequestQuote">
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
          class="quote-btn"
          :disabled="cart.busy || !design.currentRevisionId"
          @click="onAddToCart"
        >
          {{ cart.busy ? t('cart.adding') : t('cart.add') }}
        </button>
        <p v-if="cartMsg" class="hint">{{ cartMsg }}</p>
        <p v-if="cart.error" class="err">{{ cart.error }}</p>
        <p class="meta"><RouterLink to="/cart">{{ t('cart.title') }}</RouterLink> · <RouterLink to="/orders">{{ t('order.title') }}</RouterLink></p>
      </aside>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { ApiError } from '../api/client'
import ExportPanel from '../components/studio/ExportPanel.vue'
import StudioCanvas2D from '../components/studio/StudioCanvas2D.vue'
import StudioFoldPreview from '../components/studio/StudioFoldPreview.vue'
import ToolRail from '../components/studio/ToolRail.vue'
import { useAuthStore } from '../stores/auth'
import { useCartStore } from '../stores/cart'
import { useDesignStore } from '../stores/design'
import { useExportStore } from '../stores/export'
import { useQuoteStore } from '../stores/quote'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const design = useDesignStore()
const quote = useQuoteStore()
const cart = useCartStore()
const exportStore = useExportStore()
const bootError = ref('')
const cartMsg = ref('')
const viewMode = ref<'2d' | '3d'>('2d')

const lengthMm = ref(0)
const widthMm = ref(0)
const heightMm = ref(0)
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

function syncFromDoc() {
  const doc = design.document
  if (!doc) return
  lengthMm.value = doc.geometry.params.lengthMm
  widthMm.value = doc.geometry.params.widthMm
  heightMm.value = doc.geometry.params.heightMm
  materialId.value = doc.geometry.params.materialId
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

function onParams() {
  design.updateParams({
    lengthMm: lengthMm.value,
    widthMm: widthMm.value,
    heightMm: heightMm.value,
    materialId: materialId.value,
  })
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
  min-height:100vh;
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
}
.side{
  background:var(--bc-paper-elevated);
  border:1px solid var(--bc-line);
  border-radius:var(--bc-radius);
  padding:14px;
  overflow:auto;
}
.side.left{padding:10px}
.canvas-wrap{min-height:0;display:flex;flex-direction:column;gap:8px}
h1{margin:0;font-size:18px;font-family:var(--bc-font-display);letter-spacing:-0.02em}
h2{margin:14px 0 8px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--bc-ink-muted)}
.meta,.hash{margin:0;font-size:12px;color:var(--bc-ink-muted)}
.row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
label{display:flex;flex-direction:column;gap:4px;font-size:12px}
.check{flex-direction:row;align-items:center;gap:8px}
input,select{
  border:1px solid var(--bc-line-strong);
  border-radius:var(--bc-radius-sm);
  padding:8px 10px;
  font:inherit;
  background:#fff;
}
.hint{margin:0;font-size:12px;color:var(--bc-warn)}
.err{color:var(--bc-danger)}
.banner{margin:0;background:#fff;border:1px solid #f0c2bc;border-radius:var(--bc-radius-sm);padding:8px 10px}
.quote-btn{
  border:0;
  border-radius:var(--bc-radius-sm);
  background:var(--bc-ink);
  color:#fff;
  padding:8px 12px;
  cursor:pointer;
  font:inherit;
  font-weight:600;
}
.quote-btn:disabled{opacity:.55;cursor:not-allowed}
.quote-box{
  margin-top:8px;
  padding:10px;
  border:1px solid var(--bc-line);
  border-radius:var(--bc-radius);
  background:var(--bc-paper);
  display:flex;
  flex-direction:column;
  gap:6px;
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
.outbox-on{color:var(--bc-steel)}
.pad{padding:32px 20px}
@media (max-width:1100px){
  .layout{grid-template-columns:1fr;grid-template-rows:auto 480px auto}
}
</style>
