<template>
  <AppShell>
    <main class="wrap">
      <motion.header class="bc-page-header" v-bind="enterProps()">
        <div>
          <h1>{{ t('studio.productsTitle') }}</h1>
          <p>{{ t('studio.productsLead') }}</p>
        </div>
      </motion.header>

      <motion.div v-if="!loading && !error" class="toolbar" v-bind="enterProps(0.04)">
        <label class="search">
          <span class="sr-only">{{ t('site.filterSearch') }}</span>
          <input v-model="query" type="search" :placeholder="t('site.filterSearch')" />
        </label>
        <div class="chips" role="group" :aria-label="t('studio.products')">
          <button type="button" class="chip" :class="{ on: category === '' }" @click="category = ''">
            {{ t('site.filterAll') }}
          </button>
          <button
            v-for="c in categories"
            :key="c"
            type="button"
            class="chip"
            :class="{ on: category === c }"
            @click="category = c"
          >
            {{ c }}
          </button>
        </div>
      </motion.div>

      <p v-if="error" class="bc-err">{{ error }}</p>
      <p v-else-if="loading">{{ t('studio.loading') }}</p>
      <ul v-else-if="filtered.length" :key="filterKey" class="grid">
        <motion.li v-for="(p, i) in filtered" :key="p.id" v-bind="staggerEnterProps(i)">
          <RouterLink class="card" :to="`/products/${p.slug}`">
            <div class="slot" aria-hidden="true">
              <img v-if="p.cover_rel" class="cover" :src="coverUrl(p.cover_rel)" alt="" />
              <span v-else class="box-shape" />
              <em class="bc-badge bc-badge--overlay" :data-kind="geometryBadgeKind(p.geometry_mode)">
                {{ geometryBadgeLabel(p.geometry_mode) }}
              </em>
            </div>
            <div class="meta">
              <strong>{{ locale === 'ko-KR' && p.name_ko ? p.name_ko : p.name }}</strong>
              <span class="bc-chip" :data-kind="categoryBadgeKind(p.category)">{{ p.category }}</span>
            </div>
          </RouterLink>
        </motion.li>
      </ul>
      <div v-if="!loading && !error && !filtered.length" class="bc-empty">
        <EmptyLordIcon :src="emptySearchIcon" />
        <p>{{ t('studio.loadFailed') }}</p>
        <button v-if="query || category" type="button" class="bc-btn bc-btn--ghost" @click="clearFilters">
          {{ t('library.resetFilters') }}
        </button>
      </div>
    </main>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { motion } from 'motion-v'
import {
  categoryBadgeKind,
  fetchProducts,
  geometryBadgeKind,
  type ProductSummary,
} from '../api/catalog'
import { ApiError } from '../api/client'
// @ts-expect-error JS asset helper
import { publicAssetUrl } from '../assetUrl.js'
import emptySearchIcon from '../assets/icons/empty-search.json?url'
import EmptyLordIcon from '../components/motion/EmptyLordIcon.vue'
import AppShell from '../components/layout/AppShell.vue'
import { enterProps, staggerEnterProps } from '../motion'

const { t, locale } = useI18n()
const products = ref<ProductSummary[]>([])
const loading = ref(true)
const error = ref('')
const query = ref('')
const category = ref('')

const categories = computed(() => {
  const set = new Set(products.value.map((p) => p.category).filter(Boolean))
  return [...set].sort((a, b) => a.localeCompare(b))
})

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return products.value.filter((p) => {
    if (category.value && p.category !== category.value) return false
    if (!q) return true
    const name = (locale.value === 'ko-KR' && p.name_ko ? p.name_ko : p.name) || ''
    return name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q) || (p.slug || '').toLowerCase().includes(q)
  })
})

const filterKey = computed(() => `${category.value}|${query.value.trim().toLowerCase()}`)

function coverUrl(rel: string) {
  return publicAssetUrl(rel)
}

function geometryBadgeLabel(mode: ProductSummary['geometry_mode']) {
  if (mode === 'fixed_snapshot') return t('site.sizeLockedBadge')
  if (mode === 'model_only') return t('site.modelOnlyBadge')
  return t('site.customSizeBadge')
}

function clearFilters() {
  query.value = ''
  category.value = ''
}

onMounted(async () => {
  try {
    products.value = await fetchProducts()
  } catch (e: unknown) {
    error.value = e instanceof ApiError ? e.message : t('studio.loadFailed')
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.wrap {
  max-width: 1180px;
  margin: 0 auto;
  padding: clamp(24px, 4vw, 40px) clamp(16px, 3vw, 28px) 80px;
}

.toolbar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 22px;
}

.search input {
  width: min(100%, 360px);
  border: 1px solid var(--bc-line);
  border-radius: var(--bc-radius-sm);
  padding: 10px 12px;
  background: #fff;
  transition: border-color var(--bc-ease), box-shadow var(--bc-ease);
}

.search input:focus {
  outline: none;
  border-color: var(--bc-steel);
  box-shadow: var(--bc-focus);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  border: 0;
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  background: var(--bc-paper-elevated);
  color: var(--bc-ink-muted);
  box-shadow: inset 0 0 0 1px var(--bc-line);
  transition: background var(--bc-ease), color var(--bc-ease), box-shadow var(--bc-ease);
}

.chip.on,
.chip:hover {
  color: var(--bc-steel);
  background: var(--bc-steel-soft);
  box-shadow: inset 0 0 0 1px var(--bc-steel);
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
  border: 0;
  background: var(--bc-paper-elevated);
  box-shadow: inset 0 0 0 1px var(--bc-line);
  transition: transform var(--bc-ease), box-shadow var(--bc-ease);
  height: 100%;
}

.card:hover {
  transform: translateY(-3px);
  box-shadow: var(--bc-shadow), inset 0 0 0 1px var(--bc-line-strong);
}

@media (prefers-reduced-motion: reduce) {
  .card:hover {
    transform: none;
  }
}

.slot {
  aspect-ratio: 1;
  background: var(--bc-slot);
  position: relative;
  display: grid;
  place-items: center;
}

.box-shape {
  width: 46%;
  height: 38%;
  background: #fff;
  border: 1.5px solid var(--bc-ink);
  box-shadow: 10px 10px 0 -1px var(--bc-steel-soft), 10px 10px 0 0 var(--bc-steel);
}

.cover {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 12px;
  display: block;
}

.meta {
  padding: 14px 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.meta strong {
  font-size: var(--bc-fs-body);
  font-weight: 600;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
