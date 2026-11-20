<template>
  <AppShell>
    <main v-if="product" class="wrap">
      <p class="back">
        <RouterLink :to="backToProducts">← {{ t('studio.products') }}</RouterLink>
      </p>
      <div class="layout">
        <aside class="preview">
          <div class="slot" aria-hidden="true">
            <img v-if="product.cover_rel" class="cover" :src="coverUrl(product.cover_rel)" alt="" />
            <span v-else class="box-shape" />
            <em class="bc-badge bc-badge--overlay" :data-kind="geometryBadgeKind(product.geometry_mode)">
              {{ geometryBadgeLabel(product.geometry_mode) }}
            </em>
          </div>
          <p class="meta">
            <span class="bc-chip" :data-kind="categoryBadgeKind(product.category)">{{ product.category }}</span>
          </p>
        </aside>
        <section class="detail">
          <header class="bc-page-header">
            <div>
              <h1>{{ displayName }}</h1>
            </div>
          </header>
          <div class="capability" role="list">
            <span class="cap" role="listitem">{{ geometryBadgeLabel(product.geometry_mode) }}</span>
            <span v-if="wbFidelityLabel" class="cap" role="listitem">{{ wbFidelityLabel }}</span>
            <span v-if="isWorkbenchLocked" class="cap warn" role="listitem">{{ t('workbench.fidelityLocked') }}</span>
          </div>
          <p class="boundary">{{ t('studio.capabilityBoundaryNote') }}</p>
          <p class="desc">{{ product.description }}</p>

          <div class="facts">
            <p>
              <strong>{{ t('studio.sizeMode') }}</strong>
              {{ sizeModeLabel }}
            </p>
            <p>
              <strong>{{ t('studio.paperStock') }}</strong>
              {{ paperLabel(getPaperById(paperId) || resolvePaperFromParams({}), locale) }}
              · {{ (getPaperById(paperId) || resolvePaperFromParams({})).thicknessMm }} mm
            </p>
            <p v-if="tierLabels">
              <strong>{{ t('workbench.infoTiers') }}</strong>
              {{ tierLabels }}
            </p>
          </div>

          <details class="tech">
            <summary>{{ t('studio.techDetails') }}</summary>
            <dl>
              <div>
                <dt>slug</dt>
                <dd>{{ product.slug }}</dd>
              </div>
              <div>
                <dt>template_key</dt>
                <dd>{{ product.template_key }}</dd>
              </div>
              <div>
                <dt>engine</dt>
                <dd>{{ product.template_version?.engine_version || '—' }}</dd>
              </div>
              <div>
                <dt>template_version</dt>
                <dd>{{ product.template_version?.version || '—' }}</dd>
              </div>
              <div v-if="wbManifest?.fidelity">
                <dt>fidelity</dt>
                <dd>{{ wbManifest.fidelity }} · {{ t('studio.fidelityNotCertification') }}</dd>
              </div>
            </dl>
          </details>

          <div class="cta-row">
            <RouterLink
              v-if="canCustomizeStructure"
              class="bc-btn bc-btn--primary"
              :to="{ name: 'workbench', params: { slug: product.slug } }"
            >
              {{ t('studio.ctaAdjustStructure') }}
            </RouterLink>
            <RouterLink
              v-else-if="canViewLocked"
              class="bc-btn bc-btn--primary"
              :to="{ name: 'workbench', params: { slug: product.slug } }"
            >
              {{ t('studio.ctaViewLocked') }}
            </RouterLink>
            <p v-else-if="!canCreateStudio" class="hint">{{ t('studio.ctaUnavailable') }}</p>
          </div>

          <form v-if="canCreateStudio" class="form" @submit.prevent="onCreate">
            <h2>{{ t('studio.ctaEnterStudio') }}</h2>
            <label>
              {{ t('studio.designName') }}
              <input v-model="designName" required maxlength="200" />
            </label>
            <div class="row">
              <label>
                L (mm)
                <input
                  v-model.number="lengthMm"
                  type="number"
                  :min="lengthMin"
                  :max="lengthMax"
                  step="0.1"
                  :disabled="!editable"
                />
              </label>
              <label>
                W (mm)
                <input
                  v-model.number="widthMm"
                  type="number"
                  :min="widthMin"
                  :max="widthMax"
                  step="0.1"
                  :disabled="!editable"
                />
              </label>
              <label>
                H (mm)
                <input
                  v-model.number="heightMm"
                  type="number"
                  :min="heightMin"
                  :max="heightMax"
                  step="0.1"
                  :disabled="!editable"
                />
              </label>
            </div>
            <label>
              {{ t('studio.paperStock') }}
              <select v-model="paperId">
                <option v-for="p in PAPER_CATALOG" :key="p.id" :value="p.id">
                  {{ paperLabel(p, locale) }}
                </option>
              </select>
            </label>
            <p v-if="!editable" class="hint">{{ t('studio.sizeLocked') }}</p>
            <p v-else-if="outOfRange" class="hint bc-err">{{ t('studio.outOfRange') }}</p>
            <p v-if="studioBlocked" class="hint">{{ t('studio.lockedCreateNote') }}</p>
            <p v-if="error" class="bc-err">{{ error }}</p>
            <div class="actions">
              <button class="bc-btn bc-btn--primary" type="submit" :disabled="busy || studioBlocked">
                {{ t('studio.ctaEnterStudio') }}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
    <p v-else-if="loading" class="pad">{{ t('studio.loading') }}</p>
    <p v-else class="pad bc-err">{{ error || t('studio.loadFailed') }}</p>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import {
  categoryBadgeKind,
  fetchProduct,
  geometryBadgeKind,
  type ProductDetail,
} from '../api/catalog'
import { createDesign } from '../api/designs'
import { ApiError } from '../api/client'
// @ts-expect-error JS asset helper
import { publicAssetUrl } from '../assetUrl.js'
import { PAPER_CATALOG, getPaperById, paperLabel, resolvePaperFromParams } from '../catalog/paperCatalog.js'
import AppShell from '../components/layout/AppShell.vue'
import { useAuthStore } from '../stores/auth'
import { getWorkbenchManifest, isWorkbenchEnabled } from '../features/workbench/manifest'

function coverUrl(rel: string) {
  return publicAssetUrl(rel)
}

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

function geometryBadgeLabel(mode: ProductDetail['geometry_mode']) {
  if (mode === 'fixed_snapshot') return t('site.sizeLockedBadge')
  if (mode === 'model_only') return t('site.modelOnlyBadge')
  return t('site.customSizeBadge')
}

const product = ref<ProductDetail | null>(null)
const loading = ref(true)
const busy = ref(false)
const error = ref('')
const designName = ref('')
const lengthMm = ref(300)
const widthMm = ref(200)
const heightMm = ref(50)
const paperId = ref('kraft-250')

const displayName = computed(() => {
  const p = product.value
  if (!p) return ''
  return locale.value === 'ko-KR' && p.name_ko ? p.name_ko : p.name
})

const editable = computed(() => product.value?.geometry_mode === 'parametric')

const wbManifest = computed(() => {
  if (!product.value || !isWorkbenchEnabled()) return null
  return getWorkbenchManifest(product.value.slug)
})

const isWorkbenchLocked = computed(() => !!wbManifest.value?.locked)

const canCustomizeStructure = computed(() => {
  if (!isWorkbenchEnabled() || !product.value || isWorkbenchLocked.value) return false
  if (!wbManifest.value) return false
  return (
    product.value.geometry_mode === 'parametric' &&
    (product.value.capabilities?.workbench === true ||
      !!product.value.workbench ||
      !!wbManifest.value)
  )
})

const canViewLocked = computed(() => isWorkbenchEnabled() && isWorkbenchLocked.value)

/** Studio cannot open it: workbench-locked and not a fixed-snapshot product */
const studioBlocked = computed(
  () => isWorkbenchLocked.value && product.value?.geometry_mode !== 'fixed_snapshot',
)

/** Studio create: parametric or fixed that can still open a design, but not locked-only dead ends. */
const canCreateStudio = computed(() => {
  if (!product.value) return false
  if (product.value.geometry_mode === 'model_only' && !canCustomizeStructure.value && !canViewLocked.value) {
    return false
  }
  // A fixed-snapshot product opens in Studio with its reference dieline replayed as is, whether or
  // not the workbench can customise that structure. (The workbench 'fixed spec' flag only means the
  // size cannot be changed there; it must not block artwork design.)
  return product.value.geometry_mode === 'parametric' || product.value.geometry_mode === 'fixed_snapshot'
})

const wbFidelityLabel = computed(() => {
  const f = wbManifest.value?.fidelity
  if (f === 'exact') return t('workbench.fidelityExact')
  if (f === 'close') return t('workbench.fidelityClose')
  return ''
})

const tierLabels = computed(() => {
  const tiers = wbManifest.value?.tiers
  if (!tiers?.length) return ''
  return tiers
    .map((code) => {
      if (code === 'vector_proof') return t('workbench.tierVectorProof')
      if (code === 'engineering') return t('workbench.tierEngineering')
      return code
    })
    .join(' · ')
})

const sizeModeLabel = computed(() => {
  const defaults = (product.value?.capabilities?.default_params || {}) as Record<string, string>
  const mode = defaults.sizeMode || 'inner'
  if (mode === 'outer') return t('studio.sizeModeOuter')
  if (mode === 'manufacturing') return t('workbench.modeMfg')
  return t('studio.sizeModeInner')
})

const backToProducts = computed(() => {
  const q: Record<string, string> = {}
  if (route.query.q) q.q = String(route.query.q)
  if (route.query.cat) q.cat = String(route.query.cat)
  return { path: '/products', query: q }
})

const limits = computed(() => product.value?.template_version?.limits || null)
const lengthMin = computed(() => limits.value?.length?.[0] ?? 1)
const lengthMax = computed(() => limits.value?.length?.[1] ?? undefined)
const widthMin = computed(() => limits.value?.width?.[0] ?? 1)
const widthMax = computed(() => limits.value?.width?.[1] ?? undefined)
const heightMin = computed(() => limits.value?.height?.[0] ?? 0)
const heightMax = computed(() => limits.value?.height?.[1] ?? undefined)

const outOfRange = computed(() => {
  if (!editable.value || !limits.value) return false
  const checks: Array<[number, [number, number] | undefined]> = [
    [lengthMm.value, limits.value.length],
    [widthMm.value, limits.value.width],
    [heightMm.value, limits.value.height],
  ]
  return checks.some(([val, range]) => {
    if (!range) return false
    return !Number.isFinite(val) || val < range[0] || val > range[1]
  })
})

onMounted(async () => {
  try {
    await auth.refreshMe()
    product.value = await fetchProduct(String(route.params.slug))
    designName.value = product.value.name
    const defaults = (product.value.capabilities?.default_params || {}) as Record<string, number | string>
    if (typeof defaults.lengthMm === 'number') lengthMm.value = defaults.lengthMm
    if (typeof defaults.widthMm === 'number') widthMm.value = defaults.widthMm
    if (typeof defaults.heightMm === 'number') heightMm.value = defaults.heightMm
    if (typeof defaults.materialId === 'string' || typeof defaults.thicknessMm === 'number') {
      const resolved = resolvePaperFromParams({
        materialId: typeof defaults.materialId === 'string' ? defaults.materialId : undefined,
        thicknessMm: typeof defaults.thicknessMm === 'number' ? defaults.thicknessMm : undefined,
        advanced: (defaults.advanced as Record<string, unknown>) || {},
      })
      paperId.value = resolved.id
    }
  } catch (e: unknown) {
    error.value = e instanceof ApiError ? e.message : t('studio.loadFailed')
  } finally {
    loading.value = false
  }
})

async function onCreate() {
  if (!product.value) return
  if (studioBlocked.value) {
    error.value = t('studio.lockedCreateNote')
    return
  }
  if (!auth.isAuthenticated) {
    await router.push({ path: '/account/login', query: { next: route.fullPath } })
    return
  }
  if (outOfRange.value) {
    error.value = t('studio.outOfRange')
    return
  }
  busy.value = true
  error.value = ''
  try {
    const caps = product.value.capabilities || {}
    const defaults = (caps.default_params || {}) as Record<string, unknown>
    const paper = getPaperById(paperId.value) || resolvePaperFromParams({})
    const advanced: Record<string, number | string> = {
      ...((defaults.advanced as Record<string, number | string>) || {}),
      paperId: paper.id,
    }
    const sourceRaw = caps.source_num ?? advanced.sourceNum
    if (sourceRaw != null && sourceRaw !== '') {
      const n = Number(sourceRaw)
      if (Number.isFinite(n) && n > 0) advanced.sourceNum = Math.trunc(n)
    }
    const content = {
      schemaVersion: 'boxcraft.design.v1' as const,
      locale: (locale.value === 'ko-KR' ? 'ko-KR' : 'zh-CN') as 'zh-CN' | 'ko-KR',
      geometry: {
        mode: product.value.geometry_mode,
        templateId: product.value.template_key,
        templateVersion: product.value.template_version?.version || '1',
        engineVersion: product.value.template_version?.engine_version || 'boxcraft.knife.v3',
        params: {
          lengthMm: lengthMm.value,
          widthMm: widthMm.value,
          heightMm: heightMm.value,
          thicknessMm: paper.thicknessMm,
          sizeMode: (defaults.sizeMode as 'inner' | 'outer') || 'inner',
          fluteDirection: (defaults.fluteDirection as 'L' | 'W') || 'L',
          materialId: paper.mapMaterialId,
          bleedInputMm: Number(defaults.bleedInputMm ?? 3),
          advanced,
        },
        geometryHash: 'pending',
      },
      artwork: { backgroundColor: null, layers: [] },
      aiSettings: null,
      outbox: {
        enabled: false,
        sizingMode: 'grow' as const,
        quantity: 1,
        thicknessMm: 3,
        gapsMm: { length: 5, width: 5, height: 5 },
      },
    }
    const design = await createDesign({
      name: designName.value.trim(),
      product_slug: product.value.slug,
      content,
    })
    await router.push(`/designs/${design.id}`)
  } catch (e: unknown) {
    if (e instanceof ApiError && e.code === 'SIZE_LOCKED') {
      error.value = t('studio.sizeLockedError')
    } else if (e instanceof ApiError && e.code === 'OUT_OF_RANGE') {
      error.value = t('studio.outOfRange')
    } else {
      error.value = e instanceof ApiError ? e.message : t('studio.createFailed')
    }
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.wrap {
  max-width: 1100px;
  margin: 0 auto;
  padding: clamp(24px, 4vw, 40px) clamp(16px, 3vw, 28px) 80px;
}

.back {
  margin: 0 0 12px;
  font-size: 13px;
}
.back a {
  color: var(--bc-steel);
  text-decoration: none;
  font-weight: 600;
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 28px;
  align-items: start;
  animation: fade-rise 500ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes fade-rise {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .layout {
    animation: none;
  }
}

.preview {
  position: sticky;
  top: calc(var(--bc-header-h) + 16px);
}

.slot {
  aspect-ratio: 1;
  background: var(--bc-slot);
  border: 1px solid var(--bc-line);
  border-radius: var(--bc-radius);
  position: relative;
  display: grid;
  place-items: center;
}

.box-shape {
  width: 42%;
  height: 34%;
  background: #fff;
  border: 1.5px solid var(--bc-ink);
  box-shadow: 12px 12px 0 -1px #fff, 12px 12px 0 0 var(--bc-steel);
}

.cover {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 16px;
  display: block;
}

.meta {
  margin: 12px 0 0;
}

.detail .bc-page-header {
  margin-bottom: 10px;
}

.capability {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 8px;
}

.cap {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--bc-steel-soft);
  color: var(--bc-steel);
}

.cap.warn {
  background: var(--bc-warn-bg);
  color: var(--bc-warn);
}

.boundary {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--bc-ink-faint);
  line-height: 1.45;
}

.desc {
  margin: 0 0 16px;
  color: var(--bc-ink-muted);
  font-size: var(--bc-fs-body);
}

.facts {
  margin: 0 0 14px;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid var(--bc-line);
  background: var(--bc-paper-elevated);
  font-size: 13px;
  color: var(--bc-ink-muted);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.facts p {
  margin: 0;
}
.facts strong {
  color: var(--bc-ink);
  margin-right: 6px;
}

.tech {
  margin: 0 0 16px;
  border: 1px solid var(--bc-line);
  border-radius: 10px;
  padding: 4px 12px 8px;
  background: #fff;
}
.tech summary {
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  padding: 8px 0;
}
.tech dl {
  margin: 0;
  display: grid;
  gap: 6px;
  font-size: 12px;
}
.tech dl > div {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 8px;
}
.tech dt {
  color: var(--bc-ink-muted);
  margin: 0;
}
.tech dd {
  margin: 0;
  word-break: break-all;
}

.cta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
  align-items: center;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  border: 1px solid var(--bc-line);
  border-radius: var(--bc-radius);
  background: var(--bc-paper-elevated);
}

.form h2 {
  margin: 0;
  font-size: 16px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
}

input,
select {
  border: 1px solid var(--bc-line-strong);
  border-radius: var(--bc-radius-sm);
  padding: 10px 12px;
  background: #fff;
}

.row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.hint {
  margin: 0;
  font-size: 13px;
  color: var(--bc-warn);
}

.pad {
  padding: 48px 24px;
}

@media (max-width: 860px) {
  .layout {
    grid-template-columns: 1fr;
  }
  .preview {
    position: static;
  }
  .row {
    grid-template-columns: 1fr;
  }
}
</style>
