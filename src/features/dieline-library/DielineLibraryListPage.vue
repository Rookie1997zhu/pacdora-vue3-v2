<template>
  <AppShell>
    <main class="wrap">
      <header class="bc-page-header">
        <div>
          <h1>{{ t('library.title') }}</h1>
          <p>{{ t('library.lead') }}</p>
        </div>
      </header>

      <p v-if="!auth.isAuthenticated" class="bc-err">
        {{ t('auth.needLogin') }} ·
        <RouterLink :to="{ path: '/account/login', query: { next: route.fullPath } }">{{ t('site.login') }}</RouterLink>
      </p>

      <template v-else>
        <section class="filters" aria-label="filters">
          <label>
            <span>{{ t('library.filterKeyword') }}</span>
            <input v-model="filters.q" type="search" @keyup.enter="applyFilters" />
          </label>
          <label>
            <span>{{ t('library.filterCategory') }}</span>
            <input v-model="filters.category" type="text" @keyup.enter="applyFilters" />
          </label>
          <label>
            <span>{{ t('library.filterFormat') }}</span>
            <select v-model="filters.file_format">
              <option value="">{{ t('library.any') }}</option>
              <option value="svg">SVG</option>
              <option value="pdf">PDF</option>
              <option value="eps">EPS</option>
              <option value="dxf">DXF</option>
            </select>
          </label>
          <label>
            <span>L mm</span>
            <div class="range">
              <input v-model="filters.min_l" type="number" :placeholder="t('library.min')" />
              <input v-model="filters.max_l" type="number" :placeholder="t('library.max')" />
            </div>
          </label>
          <label>
            <span>W mm</span>
            <div class="range">
              <input v-model="filters.min_w" type="number" :placeholder="t('library.min')" />
              <input v-model="filters.max_w" type="number" :placeholder="t('library.max')" />
            </div>
          </label>
          <label>
            <span>H mm</span>
            <div class="range">
              <input v-model="filters.min_h" type="number" :placeholder="t('library.min')" />
              <input v-model="filters.max_h" type="number" :placeholder="t('library.max')" />
            </div>
          </label>
          <label>
            <span>{{ t('library.filterRights') }}</span>
            <select v-model="filters.rights_status">
              <option value="">{{ t('library.any') }}</option>
              <option value="granted">granted</option>
              <option value="pending">pending</option>
              <option value="denied">denied</option>
              <option value="expired">expired</option>
            </select>
          </label>
          <label>
            <span>{{ t('library.filterAcquisition') }}</span>
            <select v-model="filters.acquisition_status">
              <option value="">{{ t('library.any') }}</option>
              <option value="ok">ok</option>
              <option value="needs_review">needs_review</option>
              <option value="failed">failed</option>
              <option value="unprocessed">unprocessed</option>
            </select>
          </label>
          <label>
            <span>{{ t('library.filterManufacturing') }}</span>
            <select v-model="filters.manufacturing_status">
              <option value="">{{ t('library.any') }}</option>
              <option value="reference_only">reference_only</option>
              <option value="unverified">unverified</option>
              <option value="sample_ok">sample_ok</option>
              <option value="production_ok">production_ok</option>
            </select>
          </label>
          <div class="filter-actions">
            <button type="button" class="bc-btn bc-btn--primary" @click="applyFilters">{{ t('library.applyFilters') }}</button>
            <button type="button" class="bc-btn" @click="resetFilters">{{ t('library.resetFilters') }}</button>
          </div>
        </section>

        <p class="mode-note">
          {{ t('library.fixedOnlyNote') }}
          <RouterLink to="/lab">{{ t('site.lab') }}</RouterLink>
        </p>

        <p v-if="loading">{{ t('studio.loading') }}</p>
        <p v-else-if="error" class="bc-err">{{ error }}</p>
        <template v-else>
          <p class="inventory">{{ t('library.inventoryCount', { n: inventoryCount }) }}</p>
          <ul v-if="items.length" class="grid">
            <li v-for="item in items" :key="item.id">
              <RouterLink class="card" :to="`/library/dielines/${item.id}`">
                <div class="slot" aria-hidden="true">
                  <SafeSvgPreview
                    v-if="item.has_preview && item.preview_revision_id"
                    class="thumb"
                    compact
                    :revision-id="item.preview_revision_id"
                  />
                  <span v-else class="box-shape" />
                  <em class="bc-badge bc-badge--overlay" data-kind="flat">{{ t('library.fixedBadge') }}</em>
                </div>
                <div class="meta">
                  <strong>{{ displayTitle(item) }}</strong>
                  <span>{{ displayFamily(item) }} · {{ item.family_category || '—' }}</span>
                  <span>{{ formatDims(item) }} · {{ item.dimension_basis }}</span>
                  <span>{{ (item.formats || []).join(', ') || '—' }}</span>
                </div>
              </RouterLink>
            </li>
          </ul>
          <div v-else class="bc-empty">
            <p v-if="inventoryCount === 0">{{ t('library.emptyInventory') }}</p>
            <p v-else>{{ t('library.emptyFilter') }}</p>
          </div>
        </template>
      </template>
    </main>
  </AppShell>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { ApiError } from '../../api/client'
import AppShell from '../../components/layout/AppShell.vue'
import { useAuthStore } from '../../stores/auth'
import { fetchVariants, type VariantListFilters, type VariantSummary } from './api'
import SafeSvgPreview from './components/SafeSvgPreview.vue'

const { t, locale } = useI18n()
const auth = useAuthStore()
const route = useRoute()

const items = ref<VariantSummary[]>([])
const inventoryCount = ref(0)
const loading = ref(true)
const error = ref('')

const emptyFilters = (): VariantListFilters => ({
  q: '',
  category: '',
  file_format: '',
  min_l: '',
  max_l: '',
  min_w: '',
  max_w: '',
  min_h: '',
  max_h: '',
  rights_status: '',
  acquisition_status: '',
  manufacturing_status: '',
})

const filters = reactive<VariantListFilters>(emptyFilters())

function displayTitle(item: VariantSummary) {
  if (locale.value === 'ko-KR' && item.title_ko) return item.title_ko
  return item.title_zh || item.title_ko || item.id
}

function displayFamily(item: VariantSummary) {
  if (locale.value === 'ko-KR' && item.family_name_ko) return item.family_name_ko
  return item.family_name_zh || item.family_name_ko || '—'
}

function formatDims(item: VariantSummary) {
  const l = item.length_mm ?? '—'
  const w = item.width_mm ?? '—'
  const h = item.height_mm ?? '—'
  return `${l}×${w}×${h} mm`
}

async function load() {
  if (!auth.isAuthenticated) {
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  try {
    const data = await fetchVariants({ ...filters })
    items.value = data.items
    inventoryCount.value = data.inventory_count
  } catch (e: unknown) {
    error.value = e instanceof ApiError ? e.message : t('studio.loadFailed')
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  void load()
}

function resetFilters() {
  Object.assign(filters, emptyFilters())
  void load()
}

onMounted(() => {
  void load()
})
</script>

<style scoped>
.wrap {
  max-width: 1180px;
  margin: 0 auto;
  padding: clamp(24px, 4vw, 40px) clamp(16px, 3vw, 28px) 80px;
}

.filters {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
  margin: 0 0 16px;
  padding: 14px;
  border: 1px solid var(--bc-line);
  border-radius: var(--bc-radius);
  background: var(--bc-paper-elevated);
}

.filters label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--bc-ink-muted);
}

.filters input,
.filters select {
  height: 34px;
  border: 1px solid var(--bc-line);
  border-radius: 6px;
  padding: 0 8px;
  background: #fff;
  color: var(--bc-ink);
}

.range {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.filter-actions {
  display: flex;
  align-items: end;
  gap: 8px;
  grid-column: 1 / -1;
}

.mode-note {
  font-size: 13px;
  color: var(--bc-ink-muted);
  margin: 0 0 16px;
}

.inventory {
  font-size: 13px;
  color: var(--bc-ink-muted);
  margin: 0 0 12px;
}

.grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 18px;
}

.card {
  display: flex;
  flex-direction: column;
  text-decoration: none;
  color: inherit;
  border-radius: var(--bc-radius);
  overflow: hidden;
  border: 1px solid var(--bc-line);
  background: var(--bc-paper-elevated);
  transition: transform var(--bc-ease), border-color var(--bc-ease), box-shadow var(--bc-ease);
}

.card:hover {
  transform: translateY(-3px);
  border-color: var(--bc-line-strong);
  box-shadow: var(--bc-shadow);
}

.slot {
  aspect-ratio: 1;
  background: var(--bc-slot);
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
}

.thumb {
  width: 100%;
  height: 100%;
}

.box-shape {
  width: 46%;
  height: 38%;
  background: #fff;
  border: 1.5px solid var(--bc-ink);
  box-shadow: 10px 10px 0 -1px var(--bc-steel-soft), 10px 10px 0 0 var(--bc-steel);
}

.meta {
  padding: 14px 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta strong {
  font-size: 14px;
  font-weight: 600;
}

.meta span {
  font-size: 12px;
  color: var(--bc-ink-muted);
}
</style>
