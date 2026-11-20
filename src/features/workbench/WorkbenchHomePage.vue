<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import AppShell from '../../components/layout/AppShell.vue'
import {
  isWorkbenchEnabled,
  listWorkbenchCatalog,
  type WorkbenchCatalogItem,
  type WorkbenchCategoryFilter,
} from './manifest'

const { t } = useI18n()
const filter = ref<WorkbenchCategoryFilter>('all')
const onlyCustomizable = ref(false)

const allItems = computed(() => listWorkbenchCatalog(filter.value))
const customizableCount = computed(() => allItems.value.filter((i) => i.customizable).length)
const lockedCount = computed(() => allItems.value.filter((i) => i.locked).length)
const items = computed(() => (onlyCustomizable.value ? allItems.value.filter((i) => i.customizable) : allItems.value))
const enabled = isWorkbenchEnabled()

function dimLabel(item: WorkbenchCatalogItem) {
  if (!(item.length && item.width && item.height != null)) return ''
  return `${item.length}×${item.width}×${item.height} mm`
}
</script>

<template>
  <AppShell>
    <main class="wb-home">
      <header class="hero">
        <p class="eyebrow">PACKGRIDA</p>
        <h1>{{ t('workbench.nav') }}</h1>
        <p class="lead">{{ t('workbench.homeLead') }}</p>
      </header>

      <p v-if="!enabled" class="warn">{{ t('workbench.homeDisabled') }}</p>

      <div class="filters" role="tablist">
        <button type="button" :class="{ on: filter === 'all' }" @click="filter = 'all'">{{ t('workbench.filterAll') }}</button>
        <button type="button" :class="{ on: filter === 'folding' }" @click="filter = 'folding'">{{ t('workbench.filterFolding') }}</button>
        <button type="button" :class="{ on: filter === 'tray' }" @click="filter = 'tray'">{{ t('workbench.filterTray') }}</button>
        <button type="button" :class="{ on: filter === 'gift' }" @click="filter = 'gift'">{{ t('workbench.filterGift') }}</button>
        <button type="button" :class="{ on: filter === 'square' }" @click="filter = 'square'">{{ t('workbench.filterSquare') }}</button>
      </div>

      <p class="count">
        {{ t('workbench.homeCountCustom', { n: allItems.length, c: customizableCount, l: lockedCount }) }}
        <label class="only">
          <input v-model="onlyCustomizable" type="checkbox" />
          {{ t('workbench.homeOnlyCustomizable') }}
        </label>
      </p>

      <ul class="grid">
        <li v-for="item in items" :key="item.slug" class="card" :class="{ off: !item.customizable && !item.locked }">
          <div class="thumb" aria-hidden="true">
            <img v-if="item.coverRel" :src="'/' + item.coverRel" :alt="''" loading="lazy" />
            <span v-else class="thumb-fallback">{{ item.categoryLabel }}</span>
          </div>
          <div class="meta">
            <span class="tag">
              {{ item.categoryLabel }}
              <em v-if="item.fidelity === 'exact'" class="fid exact" :title="t('workbench.fidelityExactHint')">{{ t('workbench.fidelityExact') }}</em>
              <em v-else-if="item.fidelity === 'close'" class="fid close" :title="t('workbench.fidelityCloseHint')">{{ t('workbench.fidelityClose') }}</em>
              <em v-else-if="item.locked" class="fid locked" :title="t('workbench.homeLocked')">{{ t('workbench.fidelityLocked') }}</em>
            </span>
            <h2>{{ item.label }}</h2>
            <p v-if="dimLabel(item)" class="dims">{{ dimLabel(item) }}</p>
            <p v-if="item.locked" class="note">{{ t('workbench.homeLocked') }}</p>
            <p v-else-if="!item.customizable" class="note">{{ t('workbench.homeUnsupported') }}</p>
            <RouterLink
              v-if="item.customizable && enabled"
              class="cta"
              :to="{ name: 'workbench', params: { slug: item.slug } }"
            >
              {{ t('workbench.customizeCta') }}
            </RouterLink>
            <RouterLink
              v-else-if="item.locked && enabled"
              class="cta ghost"
              :to="{ name: 'workbench', params: { slug: item.slug } }"
            >
              {{ t('workbench.viewCta') }}
            </RouterLink>
            <span v-else-if="!enabled" class="cta disabled">{{ t('workbench.customizeCta') }}</span>
          </div>
        </li>
      </ul>
    </main>
  </AppShell>
</template>

<style scoped>
.wb-home {
  max-width: 1120px;
  margin: 0 auto;
  padding: 32px clamp(16px, 3vw, 28px) 64px;
}
.hero {
  margin-bottom: 28px;
}
.eyebrow {
  margin: 0 0 8px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--bc-muted);
  font-size: 12px;
}
.hero h1 {
  margin: 0 0 10px;
  font-family: var(--bc-font-display);
  font-size: clamp(28px, 4vw, 40px);
  font-weight: 600;
}
.lead {
  margin: 0;
  max-width: 42rem;
  color: var(--bc-muted);
  line-height: 1.55;
}
.warn {
  padding: 12px 14px;
  border: 1px solid var(--bc-line);
  background: #fff8e8;
  border-radius: 8px;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 20px 0 12px;
}
.filters button {
  border: 1px solid var(--bc-line);
  background: #fff;
  border-radius: 999px;
  padding: 8px 14px;
  cursor: pointer;
  font: inherit;
}
.filters button.on {
  border-color: var(--bc-ink);
  background: var(--bc-ink);
  color: #fff;
}
.count {
  margin: 0 0 16px;
  color: var(--bc-muted);
  font-size: 14px;
}
.grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}
.card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--bc-line);
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
}
.thumb {
  aspect-ratio: 4 / 3;
  background: linear-gradient(160deg, #f4f1ea, #e8eef5);
  display: grid;
  place-items: center;
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #fafafa;
}
.thumb-fallback {
  color: var(--bc-muted);
  font-size: 13px;
}
.meta {
  padding: 14px 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}
.tag {
  align-self: flex-start;
  font-size: 11px;
  letter-spacing: 0.04em;
  color: var(--bc-muted);
}
.meta h2 {
  margin: 0;
  font-size: 16px;
  line-height: 1.35;
  font-weight: 600;
}
.dims,
.note {
  margin: 0;
  font-size: 13px;
  color: var(--bc-muted);
}
.cta {
  margin-top: auto;
  align-self: flex-start;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--bc-ink);
  color: #fff;
  text-decoration: none;
  font-size: 14px;
}
.only {
  margin-left: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}
.card.off .thumb img {
  opacity: 0.55;
}
.fid {
  font-style: normal;
  margin-left: 6px;
  padding: 1px 7px;
  border-radius: 999px;
  border: 1px solid transparent;
}
.fid.exact {
  color: var(--bc-ok);
  background: #f1faf4;
  border-color: #bfe5cd;
}
.fid.locked {
  color: var(--bc-ink-muted);
  background: #f1f5f9;
  border-color: var(--bc-line);
}
.cta.ghost {
  background: #fff;
  color: var(--bc-ink);
  border: 1px solid var(--bc-line-strong);
}
.fid.close {
  color: var(--bc-warn);
  background: var(--bc-warn-bg);
  border-color: var(--bc-warn-line);
}
.cta.disabled {
  opacity: 0.45;
  pointer-events: none;
}
</style>
