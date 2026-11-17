<template>
  <ConsoleShell :title="t('blogCms.title')">
    <div class="layout">
      <aside class="list-pane">
        <div class="toolbar">
          <input v-model="q" :placeholder="t('blogCms.search')" @keyup.enter="load" />
          <select v-model="status" @change="load">
            <option value="">{{ t('blogCms.statusAll') }}</option>
            <option value="draft">{{ t('blogCms.statusDraft') }}</option>
            <option value="published">{{ t('blogCms.statusPublished') }}</option>
          </select>
          <button type="button" @click="load">{{ t('console.refresh') }}</button>
          <button type="button" @click="onCreate">{{ t('blogCms.newPost') }}</button>
        </div>
        <p v-if="loading" class="muted">{{ t('blogCms.loading') }}</p>
        <p v-else-if="!posts.length" class="muted">{{ t('blogCms.empty') }}</p>
        <ul v-else class="posts">
          <li
            v-for="p in posts"
            :key="p.id"
            :class="{ on: selectedId === p.id }"
            @click="select(p.id)"
          >
            <strong>{{ p.slug }}</strong>
            <span>{{ p.status }}</span>
          </li>
        </ul>
      </aside>

      <section v-if="editing" class="editor">
        <div class="row">
          <label>
            {{ t('blogCms.slug') }}
            <input v-model="form.slug" />
          </label>
          <label>
            {{ t('blogCms.tags') }}
            <input v-model="tagsText" />
          </label>
          <label>
            {{ t('blogCms.coverUrl') }}
            <input v-model="form.cover_url" />
          </label>
        </div>
        <div class="tabs">
          <button type="button" :class="{ on: localeTab === 'zh-CN' }" @click="localeTab = 'zh-CN'">
            {{ t('blogCms.localeZh') }}
          </button>
          <button type="button" :class="{ on: localeTab === 'ko-KR' }" @click="localeTab = 'ko-KR'">
            {{ t('blogCms.localeKo') }}
          </button>
        </div>
        <label>
          {{ t('blogCms.postTitle') }}
          <input v-model="form.translations[localeTab].title" />
        </label>
        <label>
          {{ t('blogCms.excerpt') }}
          <textarea v-model="form.translations[localeTab].excerpt" rows="2" />
        </label>
        <label>
          {{ t('blogCms.metaDescription') }}
          <input v-model="form.translations[localeTab].meta_description" />
        </label>
        <label>
          {{ t('blogCms.body') }}
          <textarea v-model="form.translations[localeTab].body_markdown" rows="12" />
        </label>
        <div class="actions">
          <button type="button" :disabled="busy" @click="onSave">{{ t('blogCms.save') }}</button>
          <button type="button" :disabled="busy || !selectedId" @click="onPreview">
            {{ t('blogCms.preview') }}
          </button>
          <button type="button" :disabled="busy || !selectedId" @click="onPublish">
            {{ t('blogCms.publish') }}
          </button>
          <button type="button" class="ghost" :disabled="busy || !selectedId" @click="onUnpublish">
            {{ t('blogCms.unpublish') }}
          </button>
          <button type="button" class="danger" :disabled="busy || !selectedId" @click="onDelete">
            {{ t('blogCms.delete') }}
          </button>
        </div>
        <p v-if="msg" class="msg">{{ msg }}</p>
        <p v-if="err" class="err">{{ err }}</p>
        <div v-if="previewHtml" class="preview">
          <h3>{{ previewTitle }}</h3>
          <div class="preview-body" v-html="previewHtml" />
        </div>
      </section>
      <section v-else class="editor muted">{{ t('blogCms.selectHint') }}</section>
    </div>
  </ConsoleShell>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { consoleApi } from '../../api/console'
import ConsoleShell from '../../components/console/ConsoleShell.vue'

type Tr = { title: string; excerpt: string; body_markdown: string; meta_description: string }

const { t } = useI18n()
const posts = ref<any[]>([])
const selectedId = ref('')
const editing = ref(false)
const loading = ref(false)
const busy = ref(false)
const q = ref('')
const status = ref('')
const localeTab = ref<'zh-CN' | 'ko-KR'>('zh-CN')
const msg = ref('')
const err = ref('')
const previewHtml = ref('')
const previewTitle = ref('')
const tagsText = ref('')

function emptyTr(): Tr {
  return { title: '', excerpt: '', body_markdown: '', meta_description: '' }
}

const form = reactive({
  slug: '',
  cover_url: '',
  translations: {
    'zh-CN': emptyTr(),
    'ko-KR': emptyTr(),
  } as Record<'zh-CN' | 'ko-KR', Tr>,
})

async function load() {
  loading.value = true
  err.value = ''
  try {
    const data = await consoleApi.blogPosts({
      q: q.value,
      status: status.value || undefined,
      page_size: 50,
    })
    posts.value = data.items
  } catch (e: any) {
    err.value = e?.message || t('blogCms.error')
  } finally {
    loading.value = false
  }
}

function applyPost(p: any) {
  selectedId.value = p.id
  editing.value = true
  const zh = p.translations?.['zh-CN'] || {}
  const ko = p.translations?.['ko-KR'] || {}
  form.slug = p.slug
  form.cover_url = p.cover_url || ''
  form.translations = {
    'zh-CN': {
      title: zh.title || '',
      excerpt: zh.excerpt || '',
      body_markdown: zh.body_markdown || '',
      meta_description: zh.meta_description || '',
    },
    'ko-KR': {
      title: ko.title || '',
      excerpt: ko.excerpt || '',
      body_markdown: ko.body_markdown || '',
      meta_description: ko.meta_description || '',
    },
  }
  tagsText.value = (p.tags || []).join(', ')
  previewHtml.value = ''
}

async function select(id: string) {
  err.value = ''
  msg.value = ''
  try {
    const p = await consoleApi.blogPost(id)
    applyPost(p)
  } catch (e: any) {
    err.value = e?.message || t('blogCms.error')
  }
}

function onCreate() {
  selectedId.value = ''
  editing.value = true
  form.slug = `post-${Date.now().toString(36)}`
  form.cover_url = ''
  form.translations = { 'zh-CN': emptyTr(), 'ko-KR': emptyTr() }
  tagsText.value = ''
  previewHtml.value = ''
  msg.value = ''
  err.value = ''
}

function payload() {
  const tags = tagsText.value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return {
    slug: form.slug,
    cover_url: form.cover_url,
    tags,
    translations: form.translations,
  }
}

async function onSave() {
  busy.value = true
  msg.value = ''
  err.value = ''
  try {
    const body = payload()
    const p = selectedId.value
      ? await consoleApi.patchBlogPost(selectedId.value, body)
      : await consoleApi.createBlogPost(body)
    applyPost(p)
    msg.value = t('blogCms.saved')
    await load()
  } catch (e: any) {
    err.value = e?.message || t('blogCms.error')
  } finally {
    busy.value = false
  }
}

async function onPublish() {
  if (!selectedId.value) return
  busy.value = true
  try {
    await onSave()
    if (!selectedId.value) return
    const p = await consoleApi.publishBlogPost(selectedId.value)
    applyPost(p)
    msg.value = t('blogCms.published')
    await load()
  } catch (e: any) {
    err.value = e?.message || t('blogCms.error')
  } finally {
    busy.value = false
  }
}

async function onUnpublish() {
  if (!selectedId.value) return
  busy.value = true
  try {
    const p = await consoleApi.unpublishBlogPost(selectedId.value)
    applyPost(p)
    msg.value = t('blogCms.unpublished')
    await load()
  } catch (e: any) {
    err.value = e?.message || t('blogCms.error')
  } finally {
    busy.value = false
  }
}

async function onDelete() {
  if (!selectedId.value) return
  busy.value = true
  try {
    await consoleApi.deleteBlogPost(selectedId.value)
    selectedId.value = ''
    editing.value = false
    msg.value = t('blogCms.deleted')
    await load()
  } catch (e: any) {
    err.value = e?.message || t('blogCms.error')
  } finally {
    busy.value = false
  }
}

async function onPreview() {
  if (!selectedId.value) return
  try {
    await onSave()
    if (!selectedId.value) return
    const data = (await consoleApi.previewBlogPost(selectedId.value, localeTab.value)) as any
    previewTitle.value = data.title || ''
    previewHtml.value = data.body_html || ''
  } catch (e: any) {
    err.value = e?.message || t('blogCms.error')
  }
}

onMounted(load)
</script>

<style scoped>
.layout{display:grid;grid-template-columns:280px 1fr;gap:16px;min-height:70vh}
.list-pane,.editor{background:#fff;border:1px solid var(--bc-line);border-radius:10px;padding:12px}
.toolbar{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
input,textarea,select,button{font:inherit;padding:8px 10px;border-radius:6px;border:1px solid var(--bc-line-strong)}
button{cursor:pointer;background:var(--bc-ink);color:#fff;border:0}
button.ghost{background:#fff;color:var(--bc-ink);border:1px solid var(--bc-line-strong)}
button.danger{background:#9a4339}
button:disabled{opacity:.45;cursor:not-allowed}
.posts{list-style:none;margin:0;padding:0}
.posts li{display:flex;justify-content:space-between;gap:8px;padding:8px;border-radius:6px;cursor:pointer;font-size:13px}
.posts li:hover,.posts li.on{background:var(--bc-steel-soft)}
.row{display:grid;gap:8px;margin-bottom:10px}
.tabs{display:flex;gap:6px;margin-bottom:10px}
.tabs button{background:#fff;color:var(--bc-ink);border:1px solid var(--bc-line-strong)}
.tabs button.on{background:var(--bc-ink);color:#fff}
label{display:flex;flex-direction:column;gap:4px;font-size:12px;margin-bottom:8px}
.actions{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}
.muted{color:var(--bc-ink-muted);font-size:13px}
.msg{color:#1f8a4c;font-size:13px}
.err{color:#9a4339;font-size:13px}
.preview{margin-top:16px;border-top:1px solid var(--bc-line);padding-top:12px}
.preview-body{font-size:14px;line-height:1.6}
@media (max-width:900px){.layout{grid-template-columns:1fr}}
</style>
