<template>
  <footer class="site-footer">
    <div class="footer-inner">
      <div class="brand-block">
        <RouterLink class="brand" to="/home" aria-label="BOXCRAFT">
          <img class="logo" :src="logoUrl" alt="BOXCRAFT" width="140" height="44" />
        </RouterLink>
        <p class="tagline">{{ t('site.tagline') }}</p>
      </div>
      <nav class="cols" :aria-label="t('site.footerNav')">
        <div class="col">
          <h2>{{ t('site.footerExplore') }}</h2>
          <RouterLink to="/products">{{ t('studio.products') }}</RouterLink>
          <RouterLink to="/library/dielines">{{ t('library.nav') }}</RouterLink>
          <RouterLink to="/designs">{{ t('studio.myDesigns') }}</RouterLink>
          <RouterLink to="/cart">{{ t('cart.title') }}</RouterLink>
        </div>
        <div class="col">
          <h2>{{ t('site.footerMore') }}</h2>
          <RouterLink to="/blog">{{ t('site.blog') }}</RouterLink>
          <RouterLink to="/lab">{{ t('site.lab') }}</RouterLink>
          <RouterLink to="/account/profile">{{ t('site.account') }}</RouterLink>
          <RouterLink to="/legal/disclaimer">{{ t('legal.navLink') }}</RouterLink>
        </div>
      </nav>
      <div class="cta-block">
        <p>{{ t('site.footerCtaLead') }}</p>
        <RouterLink class="bc-btn bc-btn--primary" to="/products">{{ t('studio.browseProducts') }}</RouterLink>
      </div>
    </div>
    <p class="legal">
      {{ t('site.footerLegal') }}
      ·
      <RouterLink class="legal-link" to="/legal/disclaimer">{{ t('legal.navLink') }}</RouterLink>
    </p>
  </footer>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import logoUrl from '../../assets/brand/boxcraft-logo.png'

const { t } = useI18n()
</script>

<style scoped>
.site-footer {
  margin-top: auto;
  border-top: 1px solid var(--bc-line);
  background: var(--bc-paper-elevated);
  padding: var(--bc-space-6) clamp(16px, 3vw, 32px) var(--bc-space-5);
}

.footer-inner {
  max-width: 1180px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1.4fr) minmax(0, 0.9fr);
  gap: var(--bc-space-6);
  align-items: start;
}

.brand {
  display: inline-flex;
  text-decoration: none;
}

.logo {
  height: 36px;
  width: auto;
}

.tagline {
  margin: 10px 0 0;
  font-size: var(--bc-fs-small);
  color: var(--bc-ink-muted);
  max-width: 22ch;
  line-height: 1.4;
}

.cols {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--bc-space-5);
}

.col {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.col h2 {
  margin: 0 0 4px;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--bc-ink-muted);
  font-weight: 600;
}

.col a {
  color: var(--bc-ink);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  width: fit-content;
}

.col a:hover {
  color: var(--bc-steel);
}

.cta-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-start;
  padding: 16px;
  border-radius: var(--bc-radius);
  background: var(--bc-steel-soft);
}

.cta-block p {
  margin: 0;
  font-size: 14px;
  color: var(--bc-ink);
  line-height: 1.45;
}

.legal {
  max-width: 1180px;
  margin: var(--bc-space-5) auto 0;
  padding-top: var(--bc-space-4);
  border-top: 1px solid var(--bc-line);
  font-size: 12px;
  color: var(--bc-ink-faint);
}

.legal-link {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.legal-link:hover {
  color: var(--bc-steel);
}

@media (max-width: 900px) {
  .footer-inner {
    grid-template-columns: 1fr;
    gap: var(--bc-space-5);
  }
}
</style>
