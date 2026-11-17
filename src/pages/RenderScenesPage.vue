<template>
  <AppShell>
    <main class="wrap">
      <header class="bc-page-header">
        <div>
          <h1>{{ t('render.title') }}</h1>
          <p class="lead">{{ t('render.lead') }}</p>
        </div>
        <button type="button" class="bc-btn bc-btn--primary" :disabled="!auth.isAuthenticated || creating" @click="onCreate">
          {{ creating ? t('render.creating') : t('render.create') }}
        </button>
      </header>

      <p v-if="!auth.isAuthenticated" class="bc-err">
        {{ t('auth.needLogin') }} · <RouterLink to="/account/login">{{ t('site.login') }}</RouterLink>
      </p>
      <p v-else-if="loading">{{ t('render.loading') }}</p>
      <p v-else-if="error" class="bc-err">{{ error }}</p>
      <ul v-else class="list">
        <li v-for="s in items" :key="s.id" class="row">
          <AuthThumbnail
            :asset-id="s.cover_asset_id"
            :ready="Boolean(s.cover_asset_id)"
            :alt="s.name"
            :placeholder="t('render.coverPlaceholder')"
          />
          <RouterLink class="body" :to="`/render/${s.id}`">
            <strong>{{ s.name }}</strong>
            <span>{{ t('render.modelCount', { n: s.model_count }) }} · v{{ s.row_version }} · {{ formatTime(s.updated_at) }}</span>
          </RouterLink>
          <div class="actions">
            <RouterLink class="bc-btn bc-btn--primary continue-edit" :to="`/render/${s.id}`">
              {{ t('render.continueEdit') }}
            </RouterLink>
            <button type="button" @click="onCopy(s.id)">{{ t('render.copy') }}</button>
            <button type="button" class="danger" @click="onDelete(s.id)">{{ t('render.delete') }}</button>
          </div>
        </li>
      </ul>
      <div v-if="auth.isAuthenticated && !loading && !error && !items.length" class="bc-empty">
        <p>{{ t('render.empty') }}</p>
        <button type="button" class="bc-btn bc-btn--primary" @click="onCreate">{{ t('render.create') }}</button>
      </div>
    </main>
  </AppShell>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ApiError } from '../api/client'
import {
  renderSceneCopy,
  renderSceneCreate,
  renderSceneDelete,
  renderSceneList,
  type RenderSceneListItem,
} from '../api/renderScenes'
import AuthThumbnail from '../components/AuthThumbnail.vue'
import AppShell from '../components/layout/AppShell.vue'
import { useAuthStore } from '../stores/auth'

const { t } = useI18n()
const auth = useAuthStore()
const router = useRouter()
const items = ref<RenderSceneListItem[]>([])
const loading = ref(true)
const creating = ref(false)
const error = ref('')

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
    items.value = await renderSceneList()
  } catch (e: unknown) {
    error.value = e instanceof ApiError ? e.message : t('render.loadFailed')
  } finally {
    loading.value = false
  }
}

async function onCreate() {
  creating.value = true
  error.value = ''
  try {
    const scene = await renderSceneCreate({ name: t('render.untitled') })
    await router.push(`/render/${scene.id}`)
  } catch (e: unknown) {
    error.value = e instanceof ApiError ? e.message : t('render.createFailed')
  } finally {
    creating.value = false
  }
}

async function onCopy(id: string) {
  try {
    const copied = await renderSceneCopy(id)
    await router.push(`/render/${copied.id}`)
  } catch (e: unknown) {
    error.value = e instanceof ApiError ? e.message : t('render.copyFailed')
  }
}

async function onDelete(id: string) {
  if (!window.confirm(t('render.deleteConfirm'))) return
  try {
    await renderSceneDelete(id)
    await load()
  } catch (e: unknown) {
    error.value = e instanceof ApiError ? e.message : t('render.deleteFailed')
  }
}

onMounted(async () => {
  await auth.refreshMe()
  await load()
})
</script>

<style scoped>
.wrap {
  width: min(1100px, 100%);
  margin: 0 auto;
  padding: 28px 20px 64px;
}
.lead {
  margin: 6px 0 0;
  color: var(--bc-muted);
  font-size: 0.95rem;
}
.list {
  list-style: none;
  margin: 20px 0 0;
  padding: 0;
  display: grid;
  gap: 12px;
}
.row {
  display: grid;
  grid-template-columns: 72px 1fr auto;
  gap: 14px;
  align-items: center;
  padding: 12px;
  border: 1px solid var(--bc-line);
  background: #fff;
}
.body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: inherit;
  text-decoration: none;
}
.body span {
  color: var(--bc-muted);
  font-size: 0.85rem;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
}
.actions .continue-edit {
  text-decoration: none;
  white-space: nowrap;
}
.actions button {
  border: 1px solid var(--bc-line);
  background: #fff;
  padding: 6px 10px;
  cursor: pointer;
}
.actions .danger {
  color: #a11;
}
@media (max-width: 720px) {
  .row {
    grid-template-columns: 56px 1fr;
  }
  .actions {
    grid-column: 1 / -1;
  }
}
</style>
