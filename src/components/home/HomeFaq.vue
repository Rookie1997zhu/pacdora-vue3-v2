<template>
  <section class="faq" aria-labelledby="home-faq-heading">
    <h2 id="home-faq-heading">{{ t('site.sectionFaqTitle') }}</h2>
    <div class="list">
      <details v-for="item in items" :key="item.q">
        <summary>{{ item.q }}</summary>
        <p>{{ item.a }}</p>
      </details>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const items = computed(() => [
  { q: t('site.faqSizeTitle'), a: t('site.faqSizeBody') },
  { q: t('site.faqLockedTitle'), a: t('site.faqLockedBody') },
  { q: t('site.faqFilesTitle'), a: t('site.faqFilesBody') },
  { q: t('site.faqMobileTitle'), a: t('site.faqMobileBody') },
  { q: t('site.faqBillingTitle'), a: t('site.faqBillingBody') },
])
</script>

<style scoped>
.faq {
  max-width: 840px;
  margin: 0 auto;
  padding: var(--bc-space-6) clamp(16px, 4vw, 48px) var(--bc-space-7);
}
h2 {
  margin: 0 0 18px;
  font-family: var(--bc-font-display);
  font-size: clamp(22px, 3vw, 28px);
}
.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
details {
  border: 1px solid var(--bc-line);
  border-radius: 10px;
  background: var(--bc-paper-elevated);
  padding: 4px 14px 4px;
}
summary {
  cursor: pointer;
  font-weight: 600;
  padding: 12px 0;
  list-style: none;
}
summary::-webkit-details-marker {
  display: none;
}
details p {
  margin: 0 0 14px;
  color: var(--bc-ink-muted);
  font-size: 14px;
  line-height: 1.55;
}
</style>
