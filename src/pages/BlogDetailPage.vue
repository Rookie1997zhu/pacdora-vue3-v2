<template>
  <AppShell>
    <main class="page">
      <div class="wrap">
        <p v-if="loading">{{ t('blogPublic.loading') }}</p>
        <div v-else-if="error" class="bc-empty">
          <p class="bc-err">{{ error }}</p>
          <RouterLink class="bc-btn bc-btn--ghost" to="/blog">{{ t('blogPublic.backList') }}</RouterLink>
        </div>
      </div>

      <article v-if="!loading && !error && post" class="article">
        <motion.div class="wrap" v-bind="enterProps()">
          <nav class="crumb" :aria-label="t('blogPublic.breadcrumb')">
            <RouterLink to="/blog">{{ t('blogPublic.breadcrumb') }}</RouterLink>
            <span aria-hidden="true">/</span>
            <span>{{ post.title }}</span>
          </nav>
        </motion.div>

        <motion.div class="cover-band wrap" aria-hidden="true" v-bind="enterProps(0.04)">
          <div class="cover-frame">
            <img v-if="post.cover_url" :src="post.cover_url" alt="" />
            <span v-else class="cover-fallback" />
          </div>
        </motion.div>

        <motion.header class="title-block wrap" v-bind="enterProps(0.08)">
          <span v-if="post.tags[0]" class="tag-chip">{{ post.tags[0] }}</span>
          <h1>{{ post.title }}</h1>
          <p v-if="post.summary" class="summary">{{ post.summary }}</p>
          <div class="meta">
            <span v-if="post.author_name">{{ post.author_name }}</span>
            <time v-if="post.published_at">{{ t('blogPublic.published') }} {{ formatDate(post.published_at) }}</time>
          </div>
          <p v-if="post.fallback" class="fallback">{{ t('blogPublic.fallbackNote') }}</p>
        </motion.header>

        <div class="body-wrap">
          <div ref="bodyEl" class="body" v-html="post.body_html" />
        </div>

        <section v-if="post.related?.length" class="related wrap">
          <h2>{{ t('blogPublic.related') }}</h2>
          <ul>
            <motion.li
              v-for="(item, i) in post.related"
              :key="item.slug"
              v-bind="staggerEnterProps(i)"
            >
              <RouterLink class="related-card" :to="`/blog/${item.slug}`">
                <div class="related-media" aria-hidden="true">
                  <img v-if="item.cover_url" :src="item.cover_url" alt="" />
                  <span v-else class="cover-fallback" />
                </div>
                <div class="related-copy">
                  <strong>{{ item.title }}</strong>
                  <span v-if="item.summary">{{ item.summary }}</span>
                </div>
              </RouterLink>
            </motion.li>
          </ul>
        </section>

        <div class="foot wrap">
          <RouterLink class="bc-btn bc-btn--ghost" to="/blog">{{ t('blogPublic.backList') }}</RouterLink>
          <RouterLink class="bc-btn bc-btn--primary" to="/products">{{ t('blogPublic.ctaDesign') }}</RouterLink>
        </div>
      </article>
    </main>
  </AppShell>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { motion } from 'motion-v'
import { fetchBlogPost, type BlogDetail } from '../api/blog'
import { ApiError } from '../api/client'
import AppShell from '../components/layout/AppShell.vue'
import { enterProps, staggerEnterProps } from '../motion'
import { useBlogBodyHeadingGsap } from '../motion/useGsapHighlight'
import { applyPageSeo } from '../seo/routeMeta'

const { t, locale } = useI18n()
const route = useRoute()

const loading = ref(true)
const error = ref('')
const post = ref<BlogDetail | null>(null)
const bodyEl = ref<HTMLElement | null>(null)
useBlogBodyHeadingGsap(bodyEl)

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

function applyPostSeo(data: BlogDetail) {
  applyPageSeo({
    title: `${data.meta_title || data.title} · PACKGRIDA`,
    description: data.meta_description || data.summary || data.title,
    path: `/blog/${data.slug}`,
    ogType: 'article',
    ogImage: data.cover_url || undefined,
  })
}

async function load() {
  const slug = String(route.params.slug || '')
  if (!slug) {
    error.value = t('blogPublic.notFound')
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  post.value = null
  try {
    const data = await fetchBlogPost(slug, String(locale.value))
    post.value = data
    applyPostSeo(data)
    await nextTick()
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      error.value = t('blogPublic.notFound')
    } else {
      error.value = e instanceof ApiError ? e.message : t('blogPublic.error')
    }
  } finally {
    loading.value = false
  }
}

watch(() => [route.params.slug, locale.value], load)
onMounted(load)
</script>

<style scoped>
.page {
  background:
    radial-gradient(ellipse 60% 40% at 50% 0%, rgba(0, 104, 104, 0.07), transparent 60%),
    var(--bc-paper);
  padding-bottom: var(--bc-space-8);
}

.wrap {
  width: min(1120px, calc(100% - 32px));
  margin: 0 auto;
}

.article {
  padding-top: var(--bc-space-5);
}

.crumb {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: var(--bc-space-4);
  color: var(--bc-ink-faint);
  font-size: var(--bc-fs-small);
}

.crumb a {
  color: var(--bc-steel);
  text-decoration: none;
}

.crumb a:focus-visible,
.related-card:focus-visible {
  outline: none;
  box-shadow: var(--bc-focus);
  border-radius: 4px;
}

.cover-band {
  margin-bottom: var(--bc-space-5);
}

.cover-frame {
  position: relative;
  height: min(42vw, 360px);
  min-height: 200px;
  border-radius: var(--bc-radius-lg);
  overflow: hidden;
  border: 1px solid var(--bc-line);
  background: var(--bc-steel-soft);
}

.cover-frame img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.cover-fallback {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 70% 30%, rgba(0, 104, 104, 0.28), transparent 55%),
    linear-gradient(135deg, #d9ecec, #f8fafc);
}

.title-block {
  max-width: 720px;
  margin-bottom: var(--bc-space-5);
  display: grid;
  gap: 12px;
}

.title-block h1 {
  margin: 0;
  font-family: var(--bc-font-display);
  font-size: clamp(28px, 4vw, 42px);
  line-height: 1.18;
  letter-spacing: -0.02em;
}

.tag-chip {
  justify-self: start;
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--bc-steel-soft);
  color: var(--bc-steel);
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 0.02em;
}

.summary {
  margin: 0;
  color: var(--bc-ink-muted);
  font-size: 17px;
  line-height: 1.6;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  color: var(--bc-ink-faint);
  font-size: var(--bc-fs-small);
}

.fallback {
  margin: 0;
  color: var(--bc-warn);
  font-size: var(--bc-fs-small);
}

.body-wrap {
  width: min(68ch, calc(100% - 32px));
  margin: 0 auto;
}

.body {
  color: var(--bc-ink);
  font-size: 17.5px;
  line-height: 1.8;
}

.body :deep(h2),
.body :deep(h3),
.body :deep(h4) {
  font-family: var(--bc-font-display);
  margin: 1.7em 0 0.55em;
  line-height: 1.3;
  letter-spacing: -0.01em;
}

.body :deep(p) {
  margin: 0 0 1.15em;
}

.body :deep(p:first-child) {
  font-size: 1.05em;
  color: var(--bc-ink);
}

.body :deep(a) {
  color: var(--bc-steel);
}

.body :deep(ul),
.body :deep(ol) {
  padding-left: 1.25em;
  margin: 0 0 1.15em;
}

.body :deep(li + li) {
  margin-top: 0.35em;
}

.body :deep(img) {
  max-width: 100%;
  border-radius: var(--bc-radius);
}

.body :deep(blockquote) {
  margin: 0 0 1.15em;
  padding: 10px 16px;
  border-left: 3px solid var(--bc-steel);
  background: var(--bc-steel-soft);
  color: var(--bc-ink-muted);
}

.related {
  margin-top: var(--bc-space-7);
  padding-top: var(--bc-space-5);
  border-top: 1px solid var(--bc-line);
}

.related h2 {
  margin: 0 0 var(--bc-space-4);
  font-family: var(--bc-font-display);
  font-size: 22px;
  letter-spacing: -0.01em;
}

.related ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.related-card {
  display: grid;
  grid-template-rows: auto 1fr;
  height: 100%;
  text-decoration: none;
  color: inherit;
  border: 1px solid var(--bc-line);
  border-radius: var(--bc-radius-lg);
  overflow: hidden;
  background: var(--bc-paper-elevated);
  transition: transform 220ms var(--bc-ease), box-shadow 220ms var(--bc-ease);
}

.related-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--bc-shadow-sm);
}

.related-media {
  position: relative;
  aspect-ratio: 16 / 10;
  background: var(--bc-steel-soft);
  overflow: hidden;
}

.related-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 420ms var(--bc-ease);
}

.related-card:hover .related-media img {
  transform: scale(1.04);
}

.related-copy {
  display: grid;
  gap: 6px;
  padding: 12px 14px 14px;
}

.related-copy strong {
  font-family: var(--bc-font-display);
  font-size: 15px;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.related-copy span {
  color: var(--bc-ink-muted);
  font-size: var(--bc-fs-small);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.foot {
  margin-top: var(--bc-space-6);
  padding-top: var(--bc-space-4);
  border-top: 1px solid var(--bc-line);
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

@media (max-width: 900px) {
  .related ul {
    grid-template-columns: 1fr;
  }

  .cover-frame {
    height: min(48vw, 280px);
  }
}
</style>
