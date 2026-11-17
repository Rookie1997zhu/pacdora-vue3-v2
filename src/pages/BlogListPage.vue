<template>
  <AppShell>
    <main class="page">
      <div class="masthead bc-paper-grid">
        <motion.div class="wrap masthead-inner" v-bind="enterProps()">
          <header class="hero">
            <p class="eyebrow">{{ t('site.blog') }}</p>
            <h1>{{ t('blogPublic.title') }}</h1>
            <p class="lead">{{ t('blogPublic.lead') }}</p>
          </header>

          <div v-if="!loading && !error" class="discover">
            <label class="search">
              <span class="sr-only">{{ t('blogPublic.search') }}</span>
              <input
                v-model="queryInput"
                type="search"
                :placeholder="t('blogPublic.search')"
                @keyup.enter="applySearch"
              />
            </label>
            <div class="chips" role="group" :aria-label="t('blogPublic.filterTopic')">
              <button type="button" class="chip" :class="{ on: !tag }" @click="selectTag('')">
                {{ t('site.filterAll') }}
              </button>
              <button
                v-for="item in tags"
                :key="item"
                type="button"
                class="chip"
                :class="{ on: tag === item }"
                @click="selectTag(item)"
              >
                {{ item }}
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      <div class="wrap feed">
        <p v-if="error" class="bc-err">{{ error }}</p>
        <p v-else-if="loading">{{ t('blogPublic.loading') }}</p>
        <template v-else>
          <section v-if="featured.length" class="featured" :aria-label="t('blogPublic.featured')">
            <motion.div v-for="post in featured" :key="post.slug" v-bind="enterProps(0.04)">
              <RouterLink class="featured-card" :to="`/blog/${post.slug}`">
                <div class="featured-media" aria-hidden="true">
                  <img v-if="post.cover_url" :src="post.cover_url" alt="" />
                  <span v-else class="cover-fallback" />
                </div>
                <div class="featured-body">
                  <span class="badge">{{ t('blogPublic.featured') }}</span>
                  <h2>{{ post.title }}</h2>
                  <p v-if="post.summary" class="featured-summary">{{ post.summary }}</p>
                  <div class="meta">
                    <span v-if="post.tags[0]" class="tag-chip">{{ post.tags[0] }}</span>
                    <time v-if="post.published_at">{{ formatDate(post.published_at) }}</time>
                  </div>
                  <span class="read-more">{{ t('blogPublic.readMore') }}</span>
                </div>
              </RouterLink>
            </motion.div>
          </section>

          <ul v-if="items.length" class="grid">
            <motion.li v-for="(post, i) in items" :key="post.slug" v-bind="staggerEnterProps(i)">
              <RouterLink class="card" :to="`/blog/${post.slug}`">
                <div class="slot" aria-hidden="true">
                  <img v-if="post.cover_url" class="cover" :src="post.cover_url" alt="" />
                  <span v-else class="cover-fallback" />
                </div>
                <div class="body">
                  <span v-if="post.tags[0]" class="tag-chip">{{ post.tags[0] }}</span>
                  <strong>{{ post.title }}</strong>
                  <p v-if="post.summary">{{ post.summary }}</p>
                  <time v-if="post.published_at">{{ formatDate(post.published_at) }}</time>
                </div>
              </RouterLink>
            </motion.li>
          </ul>

          <div v-if="!featured.length && !items.length" class="bc-empty">
            <EmptyLordIcon :src="emptyDocIcon" />
            <p>{{ t('blogPublic.empty') }}</p>
            <RouterLink class="bc-btn bc-btn--ghost" to="/products">{{ t('blogPublic.ctaDesign') }}</RouterLink>
          </div>

          <nav v-if="page && page.total > page.page_size" class="pager" :aria-label="t('blogPublic.title')">
            <button
              type="button"
              class="bc-btn bc-btn--ghost"
              :disabled="page.page <= 1"
              @click="goPage(page.page - 1)"
            >
              ←
            </button>
            <span>{{ page.page }} / {{ totalPages }}</span>
            <button
              type="button"
              class="bc-btn bc-btn--ghost"
              :disabled="!page.has_next"
              @click="goPage(page.page + 1)"
            >
              →
            </button>
          </nav>
        </template>
      </div>
    </main>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { motion } from 'motion-v'
import { fetchBlogPosts, type BlogCard } from '../api/blog'
import { ApiError } from '../api/client'
import type { PageMeta } from '../api/console'
import emptyDocIcon from '../assets/icons/empty-doc.json?url'
import EmptyLordIcon from '../components/motion/EmptyLordIcon.vue'
import AppShell from '../components/layout/AppShell.vue'
import { enterProps, staggerEnterProps } from '../motion'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()

const loading = ref(true)
const error = ref('')
const featured = ref<BlogCard[]>([])
const items = ref<BlogCard[]>([])
const tags = ref<string[]>([])
const page = ref<PageMeta | null>(null)
const queryInput = ref(String(route.query.q || ''))
const tag = ref(String(route.query.tag || ''))
const currentPage = ref(Number(route.query.page || 1) || 1)

const totalPages = computed(() => {
  if (!page.value) return 1
  return Math.max(1, Math.ceil(page.value.total / page.value.page_size))
})

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(locale.value === 'ko-KR' ? 'ko-KR' : 'zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso.slice(0, 10)
  }
}

function syncQuery() {
  const q: Record<string, string> = {}
  if (tag.value) q.tag = tag.value
  if (queryInput.value.trim()) q.q = queryInput.value.trim()
  if (currentPage.value > 1) q.page = String(currentPage.value)
  router.replace({ path: '/blog', query: q })
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await fetchBlogPosts({
      page: currentPage.value,
      page_size: 12,
      tag: tag.value || undefined,
      q: queryInput.value.trim() || undefined,
      locale: String(locale.value),
    })
    featured.value = data.featured || []
    items.value = data.items || []
    tags.value = data.tags || []
    page.value = data.page
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : t('blogPublic.error')
    featured.value = []
    items.value = []
  } finally {
    loading.value = false
  }
}

function selectTag(next: string) {
  tag.value = next
  currentPage.value = 1
  syncQuery()
}

function applySearch() {
  currentPage.value = 1
  syncQuery()
}

function goPage(n: number) {
  currentPage.value = Math.max(1, n)
  syncQuery()
}

watch(
  () => [route.query.tag, route.query.q, route.query.page, locale.value],
  () => {
    tag.value = String(route.query.tag || '')
    queryInput.value = String(route.query.q || '')
    currentPage.value = Number(route.query.page || 1) || 1
    load()
  },
)

onMounted(load)
</script>

<style scoped>
.page {
  background: var(--bc-paper);
}

.masthead {
  position: relative;
  border-bottom: 1px solid var(--bc-line);
  background:
    radial-gradient(ellipse 70% 80% at 12% 0%, rgba(0, 104, 104, 0.12), transparent 55%),
    radial-gradient(ellipse 50% 60% at 88% 20%, rgba(0, 104, 104, 0.06), transparent 50%),
    var(--bc-paper);
}

.wrap {
  width: min(1200px, calc(100% - 32px));
  margin: 0 auto;
}

.masthead-inner {
  padding: clamp(28px, 5vw, 48px) 0 var(--bc-space-5);
}

.hero h1 {
  margin: 0 0 12px;
  font-family: var(--bc-font-display);
  font-size: clamp(30px, 4.5vw, 44px);
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: var(--bc-ink);
}

.eyebrow {
  margin: 0 0 10px;
  color: var(--bc-steel);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.lead {
  margin: 0;
  max-width: 36rem;
  color: var(--bc-ink-muted);
  font-size: 16px;
  line-height: 1.55;
}

.discover {
  margin-top: var(--bc-space-5);
  display: grid;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--bc-line);
  border-radius: var(--bc-radius-lg);
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(8px);
}

.search input {
  width: min(360px, 100%);
  height: 40px;
  border: 1px solid var(--bc-line);
  border-radius: var(--bc-radius);
  padding: 0 12px;
  background: var(--bc-paper-elevated);
  color: var(--bc-ink);
  font: inherit;
}

.search input:focus-visible,
.chip:focus-visible,
.featured-card:focus-visible,
.card:focus-visible {
  outline: none;
  box-shadow: var(--bc-focus);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  border: 1px solid var(--bc-line);
  background: var(--bc-paper-elevated);
  color: var(--bc-ink-muted);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: var(--bc-fs-small);
  font-weight: 600;
  cursor: pointer;
  transition:
    background 180ms var(--bc-ease),
    color 180ms var(--bc-ease),
    border-color 180ms var(--bc-ease);
}

.chip:hover {
  border-color: var(--bc-steel);
  color: var(--bc-steel);
  background: var(--bc-steel-soft);
}

.chip.on {
  border-color: var(--bc-steel);
  background: var(--bc-steel);
  color: #fff;
}

.feed {
  padding: var(--bc-space-6) 0 var(--bc-space-8);
}

.featured {
  margin-bottom: var(--bc-space-5);
}

.featured-card {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  min-height: 320px;
  text-decoration: none;
  color: inherit;
  background: linear-gradient(135deg, #f3f8f8 0%, #ffffff 58%);
  border: 1px solid var(--bc-line);
  border-radius: var(--bc-radius-lg);
  overflow: hidden;
  transition: transform 220ms var(--bc-ease), box-shadow 220ms var(--bc-ease);
}

.featured-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--bc-shadow);
}

.featured-media {
  position: relative;
  min-height: 320px;
  background: var(--bc-steel-soft);
  overflow: hidden;
}

.featured-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 420ms var(--bc-ease);
}

.featured-card:hover .featured-media img,
.card:hover .cover {
  transform: scale(1.04);
}

.cover-fallback {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 30% 30%, rgba(0, 104, 104, 0.28), transparent 55%),
    linear-gradient(135deg, #d9ecec, #f8fafc);
}

.featured-body {
  padding: clamp(20px, 3vw, 36px);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.badge {
  align-self: flex-start;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--bc-steel);
}

.featured-body h2 {
  margin: 0;
  font-family: var(--bc-font-display);
  font-size: clamp(24px, 3vw, 34px);
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.featured-summary {
  margin: 0;
  color: var(--bc-ink-muted);
  line-height: 1.55;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  color: var(--bc-ink-faint);
  font-size: var(--bc-fs-small);
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  padding: 3px 9px;
  border-radius: 999px;
  background: var(--bc-steel-soft);
  color: var(--bc-steel);
  font-weight: 600;
  font-size: 11px;
}

.read-more {
  margin-top: auto;
  color: var(--bc-steel);
  font-weight: 700;
}

.grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--bc-space-4);
}

.card {
  display: grid;
  grid-template-rows: auto auto;
  height: 100%;
  text-decoration: none;
  color: inherit;
  border: 1px solid var(--bc-line);
  border-radius: var(--bc-radius-lg);
  overflow: hidden;
  background: var(--bc-paper-elevated);
  transition: transform 220ms var(--bc-ease), box-shadow 220ms var(--bc-ease);
}

.card:hover {
  transform: translateY(-3px);
  box-shadow: var(--bc-shadow-sm);
}

.slot {
  position: relative;
  aspect-ratio: 16 / 10;
  background: var(--bc-steel-soft);
  overflow: hidden;
}

.cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 420ms var(--bc-ease);
}

.card .body {
  display: grid;
  gap: 8px;
  padding: 14px 16px 16px;
  align-content: start;
}

.card strong {
  font-family: var(--bc-font-display);
  font-size: 18px;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card .body p {
  margin: 0;
  color: var(--bc-ink-muted);
  line-height: 1.45;
  font-size: 14px;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card time {
  color: var(--bc-ink-faint);
  font-size: var(--bc-fs-small);
}

.pager {
  margin-top: var(--bc-space-5);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--bc-ink-muted);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

@media (max-width: 900px) {
  .featured-card {
    grid-template-columns: 1fr;
    min-height: 0;
  }

  .featured-media {
    min-height: 0;
    aspect-ratio: 16 / 10;
  }

  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
