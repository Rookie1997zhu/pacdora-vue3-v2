<template>
  <AppShell>
    <main v-if="product" class="wrap">
      <div class="layout">
        <aside class="preview">
          <div class="slot" aria-hidden="true">
            <span class="box-shape" />
            <em class="badge">
              {{ product.geometry_mode === 'fixed_snapshot' ? t('site.sizeLockedBadge') : t('site.customSizeBadge') }}
            </em>
          </div>
          <p class="meta">{{ product.category }} · {{ product.geometry_mode }}</p>
        </aside>
        <section class="detail">
          <h1>{{ locale === 'ko-KR' && product.name_ko ? product.name_ko : product.name }}</h1>
          <p class="desc">{{ product.description }}</p>

          <form class="form" @submit.prevent="onCreate">
            <h2>{{ t('studio.createDesign') }}</h2>
            <label>
              {{ t('studio.designName') }}
              <input v-model="designName" required maxlength="200" />
            </label>
            <div class="row">
              <label>
                L (mm)
                <input v-model.number="lengthMm" type="number" :min="lengthMin" :max="lengthMax" step="0.1" :disabled="!editable" />
              </label>
              <label>
                W (mm)
                <input v-model.number="widthMm" type="number" :min="widthMin" :max="widthMax" step="0.1" :disabled="!editable" />
              </label>
              <label>
                H (mm)
                <input v-model.number="heightMm" type="number" :min="heightMin" :max="heightMax" step="0.1" :disabled="!editable" />
              </label>
            </div>
            <label>
              {{ t('studio.material') }}
              <select v-model="materialId">
                <option value="kraft">{{ t('lab.kraft') }}</option>
                <option value="white">{{ t('lab.white') }}</option>
                <option value="blue">{{ t('lab.blue') }}</option>
              </select>
            </label>
            <p v-if="!editable" class="hint">{{ t('studio.sizeLocked') }}</p>
            <p v-else-if="outOfRange" class="hint bc-err">{{ t('studio.outOfRange') }}</p>
            <p v-if="error" class="bc-err">{{ error }}</p>
            <button class="bc-btn bc-btn--primary" type="submit" :disabled="busy">{{ t('studio.createDesign') }}</button>
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
import { fetchProduct, type ProductDetail } from '../api/catalog'
import { createDesign } from '../api/designs'
import { ApiError } from '../api/client'
import AppShell from '../components/layout/AppShell.vue'
import { useAuthStore } from '../stores/auth'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const product = ref<ProductDetail | null>(null)
const loading = ref(true)
const busy = ref(false)
const error = ref('')
const designName = ref('')
const lengthMm = ref(300)
const widthMm = ref(200)
const heightMm = ref(50)
const materialId = ref('kraft')

const editable = computed(() => product.value?.geometry_mode === 'parametric')

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
    if (typeof defaults.materialId === 'string') materialId.value = defaults.materialId
  } catch (e: unknown) {
    error.value = e instanceof ApiError ? e.message : t('studio.loadFailed')
  } finally {
    loading.value = false
  }
})

async function onCreate() {
  if (!product.value) return
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
          thicknessMm: Number(defaults.thicknessMm ?? 1.5),
          sizeMode: (defaults.sizeMode as 'inner' | 'outer') || 'inner',
          fluteDirection: (defaults.fluteDirection as 'L' | 'W') || 'L',
          materialId: materialId.value,
          bleedInputMm: Number(defaults.bleedInputMm ?? 3),
          advanced: (defaults.advanced as Record<string, number>) || {},
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

.layout {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 28px;
  align-items: start;
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

.badge {
  position: absolute;
  left: 12px;
  top: 12px;
  font-style: normal;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid var(--bc-line);
}

.meta {
  margin: 12px 0 0;
  color: var(--bc-ink-muted);
  font-size: 13px;
}

.detail h1 {
  margin: 0 0 10px;
  font-family: var(--bc-font-display);
  font-size: clamp(24px, 3vw, 34px);
  letter-spacing: -0.02em;
}

.desc {
  margin: 0 0 24px;
  color: var(--bc-ink-muted);
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
