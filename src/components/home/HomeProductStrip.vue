<template>
  <section class="strip" aria-labelledby="home-products-heading">
    <header class="head">
      <div>
        <h2 id="home-products-heading">{{ t('site.sectionProductsTitle') }}</h2>
        <p>{{ t('site.sectionProductsLead') }}</p>
      </div>
      <RouterLink class="bc-btn bc-btn--ghost" to="/products">{{ t('studio.browseProducts') }}</RouterLink>
    </header>
    <p v-if="loading" class="muted">{{ t('studio.loading') }}</p>
    <p v-else-if="error" class="muted">{{ error }}</p>
    <ul v-else-if="items.length" class="grid">
      <li v-for="p in items" :key="p.id">
        <RouterLink class="card" :to="`/products/${p.slug}`">
          <div class="slot" aria-hidden="true">
            <img v-if="p.cover_rel" class="cover" :src="coverUrl(p.cover_rel)" alt="" loading="lazy" />
            <span v-else class="box-shape" />
            <em class="bc-badge bc-badge--overlay" :data-kind="geometryBadgeKind(p.geometry_mode)">
              {{ geometryBadgeLabel(p.geometry_mode) }}
            </em>
          </div>
          <strong>{{ displayName(p) }}</strong>
        </RouterLink>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import {
  geometryBadgeKind,
  type ProductSummary,
} from '../../api/catalog'
// @ts-expect-error JS asset helper
import { publicAssetUrl } from '../../assetUrl.js'

defineProps<{
  items: ProductSummary[]
  loading: boolean
  error: string
}>()

const { t, locale } = useI18n()

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
</script>

<style scoped>
.strip {
  max-width: 1180px;
  margin: 0 auto;
  padding: var(--bc-space-7) clamp(16px, 4vw, 48px);
}
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}
.head h2 {
  margin: 0 0 8px;
  font-family: var(--bc-font-display);
  font-size: clamp(22px, 3vw, 30px);
}
.head p,
.muted {
  margin: 0;
  color: var(--bc-ink-muted);
  font-size: 14px;
  line-height: 1.5;
  max-width: 52ch;
}
.grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  text-decoration: none;
  color: inherit;
}
.slot {
  position: relative;
  aspect-ratio: 5 / 4;
  border-radius: var(--bc-radius);
  background: var(--bc-paper-elevated);
  border: 1px solid var(--bc-line);
  overflow: hidden;
  display: grid;
  place-items: center;
}
.cover {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #fff;
}
.box-shape {
  width: 42%;
  aspect-ratio: 1;
  border: 1.5px dashed rgba(0, 104, 104, 0.35);
  border-radius: 6px;
}
.card strong {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
}
@media (max-width: 900px) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 520px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
