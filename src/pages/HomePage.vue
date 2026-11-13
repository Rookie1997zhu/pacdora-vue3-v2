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
  max-width: 580px;
  animation: copy-in 640ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.brand-logo {
  display: block;
  width: min(100%, 400px);
  height: auto;
  margin: 0 0 22px;
}

h1 {
  margin: 0 0 16px;
  font-family: var(--bc-font-display);
  font-size: clamp(28px, 4.2vw, 48px);
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1.18;
  color: var(--bc-ink);
}

.lead {
  margin: 0 0 30px;
  max-width: 40ch;
  font-size: 17px;
  line-height: 1.55;
  color: var(--bc-ink-muted);
}

.cta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.hero-visual {
  position: relative;
  min-height: min(56vh, 520px);
  border-radius: 0;
  display: grid;
  place-items: center;
  animation: float-in 760ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes copy-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes float-in {
  from {
    opacity: 0;
    transform: translateY(22px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes crease-pulse {
  0%,
  100% {
    opacity: 0.55;
  }
  50% {
    opacity: 1;
  }
}

.dieline {
  position: relative;
  width: min(100%, 520px);
  aspect-ratio: 5 / 4;
  filter: drop-shadow(0 22px 48px rgba(36, 88, 212, 0.12));
}

.panel {
  position: absolute;
  background: #fff;
  border: 1.75px solid var(--bc-ink);
}

.panel.a {
  inset: 16% 26% 16% 10%;
  background: linear-gradient(145deg, #fff 0%, #eef2f8 100%);
}

.panel.b {
  inset: 16% 6% 40% 56%;
  background: #f7f8fa;
  border-style: dashed;
  border-color: var(--bc-ink-muted);
}

.panel.c {
  inset: 56% 6% 16% 56%;
  background: var(--bc-steel-soft);
  border-color: var(--bc-steel);
  border-width: 2px;
}

.crease {
  position: absolute;
  left: 56%;
  top: 16%;
  bottom: 16%;
  width: 0;
  border-left: 2px dashed var(--bc-steel);
  animation: crease-pulse 3.2s ease-in-out infinite;
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
  .dieline {
    width: min(100%, 360px);
  }
  .brand-logo {
    width: min(100%, 300px);
  }
}
</style>
