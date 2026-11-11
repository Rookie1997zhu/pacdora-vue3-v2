<template>
  <AppShell flush>
    <section class="hero bc-paper-grid">
      <div class="hero-copy">
        <img class="brand-logo" :src="logoUrl" alt="BOXCRAFT" width="320" height="99" />
        <h1>{{ t('site.heroTitle') }}</h1>
        <p class="lead">{{ t('site.heroLead') }}</p>
        <div class="cta">
          <RouterLink class="bc-btn bc-btn--primary" to="/products">{{ t('studio.browseProducts') }}</RouterLink>
          <RouterLink class="bc-btn bc-btn--ghost" to="/designs">{{ t('studio.myDesigns') }}</RouterLink>
        </div>
      </div>
      <div class="hero-visual" :aria-label="t('site.heroVisual')">
        <div class="dieline" aria-hidden="true">
          <span class="panel a" />
          <span class="panel b" />
          <span class="panel c" />
          <span class="crease" />
        </div>
      </div>
    </section>
  </AppShell>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import logoUrl from '../assets/brand/boxcraft-logo.png'
import AppShell from '../components/layout/AppShell.vue'

const { t } = useI18n()
</script>

<style scoped>
.hero {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
  gap: clamp(24px, 4vw, 56px);
  align-items: center;
  min-height: calc(100vh - var(--bc-header-h));
  padding: clamp(32px, 6vw, 72px) clamp(16px, 4vw, 48px);
  overflow: hidden;
}

.hero-copy {
  max-width: 560px;
}

.brand-logo {
  display: block;
  width: min(100%, 360px);
  height: auto;
  margin: 0 0 18px;
}

h1 {
  margin: 0 0 14px;
  font-family: var(--bc-font-display);
  font-size: clamp(22px, 3vw, 34px);
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.25;
  color: var(--bc-ink);
}

.lead {
  margin: 0 0 28px;
  max-width: 42ch;
  font-size: 16px;
  color: var(--bc-ink-muted);
}

.cta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.hero-visual {
  position: relative;
  min-height: min(52vh, 480px);
  border-radius: 0;
  display: grid;
  place-items: center;
  animation: float-in 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes float-in {
  from {
    opacity: 0;
    transform: translateY(18px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.dieline {
  position: relative;
  width: min(100%, 440px);
  aspect-ratio: 5 / 4;
  filter: drop-shadow(0 18px 40px rgba(17, 24, 39, 0.08));
}

.panel {
  position: absolute;
  background: #fff;
  border: 1.5px solid var(--bc-ink);
}

.panel.a {
  inset: 18% 28% 18% 12%;
  background: linear-gradient(145deg, #fff 0%, #f0f3f5 100%);
}

.panel.b {
  inset: 18% 8% 42% 58%;
  background: #f7f8fa;
  border-style: dashed;
}

.panel.c {
  inset: 58% 8% 18% 58%;
  background: var(--bc-steel-soft);
  border-color: var(--bc-steel);
}

.crease {
  position: absolute;
  left: 58%;
  top: 18%;
  bottom: 18%;
  width: 0;
  border-left: 1.5px dashed var(--bc-steel);
}

@media (max-width: 900px) {
  .hero {
    grid-template-columns: 1fr;
    min-height: auto;
    padding-bottom: 48px;
  }
  .hero-visual {
    min-height: 280px;
    order: -1;
  }
}
</style>
