<template>
  <AppShell>
    <main class="wrap">
      <header class="bc-page-header">
        <div>
          <p class="back">
            <RouterLink to="/library/dielines">← {{ t('library.title') }}</RouterLink>
          </p>
          <h1>{{ title }}</h1>
          <p>{{ t('library.detailLead') }}</p>
        </div>
      </header>

      <p v-if="!auth.isAuthenticated" class="bc-err">
        {{ t('auth.needLogin') }} ·
        <RouterLink :to="{ path: '/account/login', query: { next: route.fullPath } }">{{ t('site.login') }}</RouterLink>
      </p>
      <p v-else-if="loading">{{ t('studio.loading') }}</p>
      <p v-else-if="error" class="bc-err">{{ error }}</p>

      <template v-else-if="variant">
        <section class="panel">
          <h2>{{ t('library.specs') }}</h2>
          <dl class="specs">
            <div>
              <dt>{{ t('library.family') }}</dt>
              <dd>{{ familyName }} · {{ variant.family_category || '—' }}</dd>
            </div>
            <div>
              <dt>{{ t('library.dimensions') }}</dt>
              <dd>{{ formatDims(variant) }}</dd>
            </div>
            <div>
              <dt>{{ t('library.dimensionBasis') }}</dt>
              <dd>{{ variant.dimension_basis }}</dd>
            </div>
            <div>
              <dt>{{ t('studio.material') }}</dt>
              <dd>{{ variant.material_name || '—' }}</dd>
            </div>
            <div>
              <dt>{{ t('library.thickness') }}</dt>
              <dd>{{ variant.thickness_mm ? `${variant.thickness_mm} mm` : '—' }}</dd>
            </div>
            <div>
              <dt>{{ t('library.geometryMode') }}</dt>
              <dd>{{ t('library.fixedBadge') }}</dd>
            </div>
          </dl>
          <p class="hint">{{ t('library.noStretchHint') }}</p>
        </section>

        <section class="panel">
          <h2>{{ t('library.preview') }}</h2>
          <SafeSvgPreview :revision-id="previewRevisionId" />
        </section>

        <section class="panel">
          <h2>{{ t('library.parts') }}</h2>
          <p class="hint">{{ t('library.partsEmpty') }}</p>
        </section>

        <section class="panel">
          <h2>{{ t('library.downloads') }}</h2>
          <ul class="downloads">
            <li v-for="rev in downloadRows" :key="rev.id">
              <span class="fmt">{{ rev.format.toUpperCase() }}</span>
              <span class="meta">r{{ rev.revision_no }} · {{ shortSha(rev.sha256) }}</span>
              <button
                type="button"
                class="bc-btn bc-btn--primary"
                :disabled="!canDownloadRevision(rev) || downloadingId === rev.id"
                @click="onDownload(rev)"
              >
                {{ canDownloadRevision(rev) ? t('library.download') : t('library.downloadDenied') }}
              </button>
            </li>
          </ul>
          <p v-if="!downloadRows.length" class="hint">{{ t('library.noFormats') }}</p>
          <p v-if="downloadError" class="bc-err">{{ downloadError }}</p>
        </section>

        <section class="panel">
          <h2>{{ t('library.usageHints') }}</h2>
          <ul class="hints">
            <li>{{ manufacturingHint }}</li>
            <li v-for="line in grantHints" :key="line">{{ line }}</li>
          </ul>
        </section>

        <section class="panel">
          <h2>{{ t('library.revisions') }}</h2>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{{ t('library.filterFormat') }}</th>
                  <th>SHA</th>
                  <th>{{ t('library.filterAcquisition') }}</th>
                  <th>{{ t('library.filterRights') }}</th>
                  <th>{{ t('library.filterManufacturing') }}</th>
                  <th>{{ t('library.publication') }}</th>
                  <th>{{ t('library.capturedAt') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="rev in variant.revisions" :key="rev.id">
                  <td>{{ rev.revision_no }}</td>
                  <td>{{ rev.format }}</td>
                  <td><code>{{ shortSha(rev.sha256) }}</code></td>
                  <td>{{ rev.acquisition_status }}</td>
                  <td>{{ rev.rights_status }}</td>
                  <td>{{ rev.manufacturing_status }}</td>
                  <td>{{ rev.publication_status }}</td>
                  <td>{{ formatTime(rev.captured_at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
    </main>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { ApiError } from '../../api/client'
import AppShell from '../../components/layout/AppShell.vue'
import { useAuthStore } from '../../stores/auth'
import {
  canDownloadRevision,
  downloadRevision,
  fetchVariant,
  type RevisionSummary,
  type VariantDetail,
} from './api'
import SafeSvgPreview from './components/SafeSvgPreview.vue'

const { t, locale } = useI18n()
const auth = useAuthStore()
const route = useRoute()

const variant = ref<VariantDetail | null>(null)
const loading = ref(true)
const error = ref('')
const downloadError = ref('')
const downloadingId = ref('')

const title = computed(() => {
  const v = variant.value
  if (!v) return t('library.title')
  if (locale.value === 'ko-KR' && v.title_ko) return v.title_ko
  return v.title_zh || v.title_ko || v.id
})

const familyName = computed(() => {
  const v = variant.value
  if (!v) return '—'
  if (locale.value === 'ko-KR' && v.family_name_ko) return v.family_name_ko
  return v.family_name_zh || v.family_name_ko || '—'
})

const previewRevisionId = computed(() => {
  const current = variant.value?.current_revision
  if (current?.has_preview) return current.id
  const withPreview = variant.value?.revisions.find((r) => r.has_preview)
  return withPreview?.id || null
})

const downloadRows = computed(() => {
  const revs = variant.value?.revisions || []
  const byFormat = new Map<string, RevisionSummary>()
  for (const rev of revs) {
    if (!byFormat.has(rev.format)) byFormat.set(rev.format, rev)
  }
  return [...byFormat.values()]
})

const manufacturingHint = computed(() => {
  const status = variant.value?.current_revision?.manufacturing_status || 'reference_only'
  if (status === 'production_ok') return t('library.mfgProduction')
  if (status === 'sample_ok') return t('library.mfgSample')
  if (status === 'unverified') return t('library.mfgUnverified')
  return t('library.mfgReference')
})

const grantHints = computed(() => {
  const grant = variant.value?.current_revision?.usage_grant
  if (!grant) return [t('library.grantMissing')]
  const lines: string[] = []
  if (grant.can_use_internally) lines.push(t('library.grantInternal'))
  if (grant.can_redistribute_files) lines.push(t('library.grantRedistribute'))
  if (grant.can_use_commercially) lines.push(t('library.grantCommercial'))
  if (grant.can_show_public_preview) lines.push(t('library.grantPreview'))
  if (grant.attribution) lines.push(`${t('library.attribution')}: ${grant.attribution}`)
  if (!lines.length) lines.push(t('library.grantLimited'))
  return lines
})

function formatDims(v: VariantDetail) {
  return `${v.length_mm ?? '—'}×${v.width_mm ?? '—'}×${v.height_mm ?? '—'} mm`
}

function shortSha(sha: string) {
  return sha ? `${sha.slice(0, 10)}…` : '—'
}

function formatTime(iso: string | null) {
  if (!iso) return '—'
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
    const id = String(route.params.id || '')
    variant.value = await fetchVariant(id)
  } catch (e: unknown) {
    error.value = e instanceof ApiError ? e.message : t('studio.loadFailed')
  } finally {
    loading.value = false
  }
}

async function onDownload(rev: RevisionSummary) {
  downloadError.value = ''
  downloadingId.value = rev.id
  try {
    await downloadRevision(rev.id, rev.original_filename || undefined)
  } catch {
    downloadError.value = t('library.downloadFailed')
  } finally {
    downloadingId.value = ''
  }
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
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.back {
  margin: 0 0 6px;
  font-size: 13px;
}

.back a {
  color: var(--bc-ink-muted);
  text-decoration: none;
}

.panel {
  border: 1px solid var(--bc-line);
  border-radius: var(--bc-radius);
  background: var(--bc-paper-elevated);
  padding: 16px 18px 18px;
}

.panel h2 {
  margin: 0 0 12px;
  font-size: 16px;
}

.specs {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  margin: 0;
}

.specs dt {
  font-size: 12px;
  color: var(--bc-ink-muted);
}

.specs dd {
  margin: 2px 0 0;
  font-size: 14px;
}

.hint {
  margin: 10px 0 0;
  font-size: 13px;
  color: var(--bc-ink-muted);
}

.downloads,
.hints {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.downloads li {
  display: grid;
  grid-template-columns: 72px 1fr auto;
  gap: 10px;
  align-items: center;
}

.fmt {
  font-weight: 700;
  font-size: 13px;
}

.meta {
  font-size: 12px;
  color: var(--bc-ink-muted);
}

.table-wrap {
  overflow: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

th,
td {
  text-align: left;
  padding: 8px 6px;
  border-bottom: 1px solid var(--bc-line);
  white-space: nowrap;
}

th {
  color: var(--bc-ink-muted);
  font-weight: 600;
}

code {
  font-family: var(--bc-font-mono, ui-monospace, monospace);
}
</style>
