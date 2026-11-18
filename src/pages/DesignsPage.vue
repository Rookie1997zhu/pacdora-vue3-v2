<template>
  <AppShell>
    <main class="wrap">
      <header class="bc-page-header">
        <div>
          <h1>{{ t('studio.myDesigns') }}</h1>
        </div>
        <div class="tabs">
          <button type="button" :class="{ on: tab === 'active' }" @click="switchTab('active')">{{ t('studio.active') }}</button>
          <button type="button" :class="{ on: tab === 'archived' }" @click="switchTab('archived')">{{ t('studio.archived') }}</button>
        </div>
      </header>
      <p v-if="!auth.isAuthenticated" class="bc-err">
        {{ t('auth.needLogin') }} · <RouterLink to="/account/login">{{ t('site.login') }}</RouterLink>
      </p>
      <p v-else-if="loading">{{ t('studio.loading') }}</p>
      <p v-else-if="error" class="bc-err">{{ error }}</p>
      <ul v-else class="list">
        <li v-for="d in items" :key="d.id" class="row">
          <AuthThumbnail
            :asset-id="d.preview_asset_id"
            :ready="Boolean(d.thumbnail_ready)"
            :design-id="d.id"
            :dieline-ready="Boolean(d.dieline_thumbnail_ready)"
            :alt="d.name"
            :placeholder="t('studio.previewPlaceholder')"
          />
          <RouterLink class="body" :to="`/designs/${d.id}`">
            <strong>{{ d.name }}</strong>
            <span>{{ d.product_slug || '—' }} · v{{ d.row_version }} · {{ formatTime(d.updated_at) }}</span>
          </RouterLink>
          <div class="actions">
            <RouterLink class="bc-btn bc-btn--primary continue-edit" :to="`/designs/${d.id}`">
              {{ t('studio.continueEdit') }}
            </RouterLink>
            <button type="button" @click="onCopy(d.id)">{{ t('studio.copy') }}</button>
            <button v-if="tab === 'active'" type="button" @click="onArchive(d.id)">{{ t('studio.archive') }}</button>
            <button v-else type="button" @click="onRestore(d.id)">{{ t('studio.restore') }}</button>
            <button type="button" class="danger" @click="onDelete(d)">{{ t('studio.delete') }}</button>
          </div>
        </li>
      </ul>
      <div v-if="auth.isAuthenticated && !loading && !error && !items.length" class="bc-empty">
        <EmptyLordIcon :src="emptyBoxIcon" />
        <p>{{ t('studio.emptyDesigns') }}</p>
        <RouterLink class="bc-btn bc-btn--primary" to="/products">{{ t('site.emptyBrowseProducts') }}</RouterLink>
      </div>
    </main>
  </AppShell>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ApiError } from '../api/client'
import { copyDesign, deleteDesign, fetchDesigns, patchDesign, type DesignListItem } from '../api/designs'
import emptyBoxIcon from '../assets/icons/empty-box.json?url'
import AuthThumbnail from '../components/AuthThumbnail.vue'
import EmptyLordIcon from '../components/motion/EmptyLordIcon.vue'
import AppShell from '../components/layout/AppShell.vue'
import { useAuthStore } from '../stores/auth'

const { t } = useI18n()
const auth = useAuthStore()
const router = useRouter()
const items = ref<DesignListItem[]>([])
const loading = ref(true)
const error = ref('')
const tab = ref<'active' | 'archived'>('active')

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

async function load() {
  if (!auth.isAuthenticated) {
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  try {
    items.value = await fetchDesigns(tab.value)
  } catch (e: unknown) {
    error.value = e instanceof ApiError ? e.message : t('studio.loadFailed')
  } finally {
    loading.value = false
  }
}

function switchTab(next: 'active' | 'archived') {
  tab.value = next
  void load()
}

async function onArchive(id: string) {
  await patchDesign(id, { status: 'archived' })
  await load()
}

async function onRestore(id: string) {
  await patchDesign(id, { status: 'active' })
  await load()
}

async function onCopy(id: string) {
  const copied = await copyDesign(id)
  await router.push(`/designs/${copied.id}`)
}

async function onDelete(d: DesignListItem) {
  if (!window.confirm(t('studio.deleteConfirmNamed', { name: d.name }))) return
  try {
    await deleteDesign(d.id)
    await load()
  } catch (e: unknown) {
    error.value = e instanceof ApiError ? e.message : t('studio.deleteFailed')
  }
}

onMounted(async () => {
  await auth.refreshMe()
  await load()
})
</script>

<style scoped>
.wrap {
  max-width: 960px;
  margin: 0 auto;
  padding: clamp(24px, 4vw, 40px) clamp(16px, 3vw, 28px) 80px;
}

.tabs {
  display: inline-flex;
  border: 1px solid var(--bc-line);
  border-radius: var(--bc-radius-sm);
  overflow: hidden;
}

.tabs button {
  border: 0;
  background: #fff;
  padding: 8px 14px;
  color: var(--bc-ink-muted);
  font-weight: 600;
}

.tabs button.on {
  background: var(--bc-ink);
  color: #fff;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}

.row {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px 14px;
  background: var(--bc-paper-elevated);
  border: 1px solid var(--bc-line);
  border-radius: var(--bc-radius);
}

.body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-decoration: none;
  color: inherit;
}

.body span {
  font-size: 13px;
  color: var(--bc-ink-muted);
}

.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
}

.actions .continue-edit {
  text-decoration: none;
  white-space: nowrap;
}

.actions button {
  border: 1px solid var(--bc-line-strong);
  background: #fff;
  border-radius: var(--bc-radius-sm);
  padding: 6px 10px;
}

.actions button.danger {
  color: var(--bc-danger, #b42318);
  border-color: color-mix(in srgb, var(--bc-danger, #b42318) 35%, var(--bc-line-strong));
}

@media (max-width: 640px) {
  .row {
    flex-wrap: wrap;
  }
  .actions {
    width: 100%;
  }
}
</style>
