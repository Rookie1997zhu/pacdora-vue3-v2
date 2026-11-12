<template>
  <AppShell>
    <main class="wrap">
      <header class="bc-page-header">
        <div>
          <h1>{{ t('studio.productsTitle') }}</h1>
          <p>{{ t('studio.productsLead') }}</p>
        </div>
      </header>
      <p v-if="error" class="bc-err">{{ error }}</p>
      <p v-else-if="loading">{{ t('studio.loading') }}</p>
      <ul v-else class="grid">
        <li v-for="p in products" :key="p.id">
          <RouterLink class="card" :to="`/products/${p.slug}`">
            <div class="slot" aria-hidden="true">
              <img v-if="p.cover_rel" class="cover" :src="coverUrl(p.cover_rel)" alt="" />
              <span v-else class="box-shape" />
              <em class="badge">
                {{ p.geometry_mode === 'fixed_snapshot' ? t('site.sizeLockedBadge') : t('site.customSizeBadge') }}
              </em>
            </div>
            <div class="meta">
              <strong>{{ locale === 'ko-KR' && p.name_ko ? p.name_ko : p.name }}</strong>
              <span>{{ p.category }} · {{ p.geometry_mode }}</span>
            </div>
          </RouterLink>
        </li>
      </ul>
      <div v-if="!loading && !error && !products.length" class="bc-empty">{{ t('studio.loadFailed') }}</div>
    </main>
  </AppShell>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchProducts, type ProductSummary } from '../api/catalog'
import { ApiError } from '../api/client'
// @ts-expect-error JS asset helper
import { publicAssetUrl } from '../assetUrl.js'
import AppShell from '../components/layout/AppShell.vue'

const { t, locale } = useI18n()
const products = ref<ProductSummary[]>([])
const loading = ref(true)
const error = ref('')

function coverUrl(rel: string) {
  return publicAssetUrl(rel)
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

.badge {
  position: absolute;
  left: 10px;
  top: 10px;
  font-style: normal;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--bc-line);
  color: var(--bc-ink);
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
