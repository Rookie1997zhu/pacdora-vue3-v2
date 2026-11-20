<template>
  <AppShell>
    <main class="wrap">
      <motion.header class="bc-page-header" v-bind="enterProps()">
        <div>
          <h1>{{ t('studio.productsTitle') }}</h1>
          <p>{{ t('studio.productsLead') }}</p>
        </div>
      </motion.header>

      <motion.div v-if="!error" class="toolbar" v-bind="enterProps(0.04)">
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

      <div v-if="error" class="bc-empty">
        <EmptyLordIcon :src="emptySearchIcon" />
        <p class="bc-err">{{ error }}</p>
        <button type="button" class="bc-btn bc-btn--ghost" @click="reload">{{ t('studio.retryLoad') }}</button>
      </div>
      <p v-else-if="loading && !products.length">{{ t('studio.loading') }}</p>
      <template v-else>
        <ul v-if="products.length" class="grid" :aria-busy="loading">
          <motion.li v-for="(p, i) in products" :key="p.id" v-bind="staggerEnterProps(Math.min(i, 11))">
            <RouterLink class="card" :to="detailTo(p.slug)">
              <div class="slot" aria-hidden="true">
                <img v-if="p.cover_rel" class="cover" :src="coverUrl(p.cover_rel)" alt="" />
                <span v-else class="box-shape" />
                <em class="bc-badge bc-badge--overlay" :data-kind="geometryBadgeKind(p.geometry_mode)">
                  {{ geometryBadgeLabel(p.geometry_mode) }}
                </em>
              </div>
              <div class="meta">
                <strong :title="displayName(p)">{{ displayName(p) }}</strong>
                <div class="tags">
                  <span class="bc-chip" :data-kind="categoryBadgeKind(p.category)">{{ p.category }}</span>
                  <span class="bc-chip" :data-kind="geometryBadgeKind(p.geometry_mode)">{{
                    geometryBadgeLabel(p.geometry_mode)
                  }}</span>
                </div>
              </div>
            </RouterLink>
          </motion.li>
        </ul>
        <div v-else-if="!loading && !total" class="bc-empty">
          <EmptyLordIcon :src="emptySearchIcon" />
          <p>{{ t('studio.productsEmpty') }}</p>
        </div>
        <div v-else-if="!loading" class="bc-empty">
          <EmptyLordIcon :src="emptySearchIcon" />
          <p>{{ t('studio.productsNoMatch') }}</p>
          <button v-if="query || category" type="button" class="bc-btn bc-btn--ghost" @click="clearFilters">
            {{ t('library.resetFilters') }}
          </button>
        </div>

        <nav v-if="total > pageSize" class="pager" :aria-label="t('studio.productsTitle')">
          <button type="button" class="bc-btn bc-btn--ghost" :disabled="page <= 1 || loading" @click="goPage(page - 1)">
            ←
          </button>
          <span>{{ page }} / {{ totalPages }}</span>
          <button
            type="button"
            class="bc-btn bc-btn--ghost"
            :disabled="!hasNext || loading"
            @click="goPage(page + 1)"
          >
            →
          </button>
        </nav>
      </template>
    </main>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
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
const route = useRoute()
const router = useRouter()
const products = ref<ProductSummary[]>([])
const categories = ref<string[]>([])
const loading = ref(true)
const error = ref('')
const page = ref(1)
const pageSize = ref(24)
const total = ref(0)
const hasNext = ref(false)
const query = ref(String(route.query.q || ''))
const category = ref(String(route.query.cat || ''))
let syncingFromRoute = false
let searchTimer: ReturnType<typeof setTimeout> | null = null
let requestSeq = 0

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

function coverUrl(rel: string) {
  return publicAssetUrl(rel)
}

function displayName(p: ProductSummary) {
  return locale.value === 'ko-KR' && p.name_ko ? p.name_ko : p.name
}

function geometryBadgeLabel(mode: ProductSummary['geometry_mode']) {
  if (mode === 'fixed_snapshot') return t('site.sizeLockedBadge')
  if (mode === 'model_only') return t('site.modelOnlyBadge')
  return t('site.customSizeBadge')
}

function detailTo(slug: string) {
  const q: Record<string, string> = {}
  if (query.value.trim()) q.q = query.value.trim()
  if (category.value) q.cat = category.value
  return { path: `/products/${slug}`, query: q }
}

function clearFilters() {
  query.value = ''
  category.value = ''
  page.value = 1
}

function pushFilterQuery() {
  if (syncingFromRoute) return
  const next: Record<string, string> = {}
  if (query.value.trim()) next.q = query.value.trim()
  if (category.value) next.cat = category.value
  if (page.value > 1) next.page = String(page.value)
  const curQ = String(route.query.q || '')
  const curCat = String(route.query.cat || '')
  const curPage = String(route.query.page || '')
  if (curQ === (next.q || '') && curCat === (next.cat || '') && curPage === (next.page || '')) return
  void router.replace({ path: '/products', query: next })
}

async function reload() {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const data = await fetchProducts({
      page: page.value,
      page_size: pageSize.value,
      category: category.value || undefined,
      q: query.value.trim() || undefined,
    })
    if (seq !== requestSeq) return
    products.value = data.items
    page.value = data.page
    pageSize.value = data.page_size
    total.value = data.total
    hasNext.value = data.has_next
    if (data.categories?.length) {
      categories.value = [...data.categories].sort((a, b) => a.localeCompare(b))
    }
  } catch (e: unknown) {
    if (seq !== requestSeq) return
    error.value = e instanceof ApiError ? e.message : t('studio.loadFailed')
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

function goPage(next: number) {
  if (next < 1 || (next > page.value && !hasNext.value)) return
  page.value = next
  pushFilterQuery()
  void reload()
}

function scheduleReload(resetPage: boolean) {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    if (resetPage) page.value = 1
    pushFilterQuery()
    void reload()
  }, 250)
}

watch(query, () => {
  if (syncingFromRoute) return
  scheduleReload(true)
})

watch(category, () => {
  if (syncingFromRoute) return
  page.value = 1
  pushFilterQuery()
  void reload()
})

watch(
  () => [route.query.q, route.query.cat, route.query.page] as const,
  ([q, cat, p]) => {
    const nextQ = String(q || '')
    const nextCat = String(cat || '')
    const nextPage = Math.max(1, Number(p) || 1)
    const changed = nextQ !== query.value || nextCat !== category.value || nextPage !== page.value
    if (!changed) return
    syncingFromRoute = true
    query.value = nextQ
    category.value = nextCat
    page.value = nextPage
    syncingFromRoute = false
    void reload()
  },
)

onMounted(() => {
  const initialPage = Math.max(1, Number(route.query.page) || 1)
  page.value = initialPage
  void reload()
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
  flex-wrap: nowrap;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
  -webkit-overflow-scrolling: touch;
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
  white-space: nowrap;
  flex: 0 0 auto;
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
  aspect-ratio: 4 / 3;
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
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.35;
  min-height: 2.7em;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 28px;
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
