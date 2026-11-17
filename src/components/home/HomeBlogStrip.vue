<template>
  <section class="strip" aria-labelledby="home-blog-heading">
    <header class="head">
      <div>
        <h2 id="home-blog-heading">{{ t('site.sectionBlogTitle') }}</h2>
        <p>{{ t('site.sectionBlogLead') }}</p>
      </div>
      <RouterLink class="bc-btn bc-btn--ghost" to="/blog">{{ t('site.sectionBlogCta') }}</RouterLink>
    </header>
    <p v-if="loading" class="muted">{{ t('studio.loading') }}</p>
    <ul v-else-if="items.length" class="grid">
      <li v-for="post in items" :key="post.slug">
        <RouterLink class="card" :to="`/blog/${post.slug}`">
          <div v-if="post.cover_url" class="cover-wrap" aria-hidden="true">
            <img :src="post.cover_url" alt="" loading="lazy" />
          </div>
          <strong>{{ post.title }}</strong>
          <span v-if="post.summary">{{ post.summary }}</span>
        </RouterLink>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { BlogCard } from '../../api/blog'

defineProps<{
  items: BlogCard[]
  loading: boolean
}>()

const { t } = useI18n()
</script>

<style scoped>
.strip {
  max-width: 1180px;
  margin: 0 auto;
  padding: var(--bc-space-6) clamp(16px, 4vw, 48px);
}
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}
.head h2 {
  margin: 0 0 8px;
  font-family: var(--bc-font-display);
  font-size: clamp(22px, 3vw, 28px);
}
.head p,
.muted {
  margin: 0;
  color: var(--bc-ink-muted);
  font-size: 14px;
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
  gap: 8px;
  text-decoration: none;
  color: inherit;
  padding: 14px;
  border-radius: var(--bc-radius);
  border: 1px solid var(--bc-line);
  background: var(--bc-paper-elevated);
  min-height: 100%;
}
.cover-wrap {
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  overflow: hidden;
  background: #eef6f6;
}
.cover-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.card strong {
  font-size: 15px;
  line-height: 1.35;
}
.card span {
  font-size: 13px;
  color: var(--bc-ink-muted);
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
@media (max-width: 900px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
