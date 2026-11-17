<template>
  <AppShell flush>
    <section class="hero bc-paper-grid">
      <div ref="heroCopyEl" class="hero-copy">
        <img class="brand-logo" :src="logoUrl" alt="BOXCRAFT" width="320" height="99" />
        <h1>{{ t('site.heroTitle') }}</h1>
        <p class="lead">{{ t('site.heroLead') }}</p>
        <div class="cta">
          <RouterLink class="bc-btn bc-btn--primary" to="/products">{{ t('studio.browseProducts') }}</RouterLink>
          <RouterLink class="bc-btn bc-btn--ghost" to="/designs">{{ t('studio.myDesigns') }}</RouterLink>
        </div>
      </div>
      <motion.div class="hero-visual" :aria-label="t('site.heroVisual')" v-bind="visualEnter">
        <div class="hero-stage" aria-hidden="true">
          <img class="hero-mark" :src="logoUrl" alt="" />
          <div class="hero-panel" />
        </div>
      </motion.div>
    </section>

    <section class="features" aria-labelledby="features-heading">
      <h2 id="features-heading" class="sr-only">{{ t('site.tagline') }}</h2>
      <motion.article
        v-for="(feat, i) in features"
        :key="feat.title"
        class="feature"
        v-bind="staggerEnterProps(i)"
      >
        <h3>{{ feat.title }}</h3>
        <p>{{ feat.body }}</p>
      </motion.article>
    </section>

    <section class="closing">
      <motion.div class="closing-inner" v-bind="enterProps(0.05)">
        <h2>{{ t('site.closingTitle') }}</h2>
        <p>{{ t('site.closingLead') }}</p>
        <RouterLink class="bc-btn bc-btn--primary" to="/products">{{ t('studio.browseProducts') }}</RouterLink>
      </motion.div>
    </section>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { motion } from 'motion-v'
import logoUrl from '../assets/brand/boxcraft-logo.png'
import AppShell from '../components/layout/AppShell.vue'
import { enterProps, staggerEnterProps } from '../motion'
import { useHomeHeroGsap } from '../motion/useGsapHighlight'

const { t } = useI18n()
const heroCopyEl = ref<HTMLElement | null>(null)
useHomeHeroGsap(heroCopyEl)

const visualEnter = enterProps(0.12)

const features = computed(() => [
  { title: t('site.featureSelectTitle'), body: t('site.featureSelectBody') },
  { title: t('site.featureEditTitle'), body: t('site.featureEditBody') },
  { title: t('site.featureExportTitle'), body: t('site.featureExportBody') },
])
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
  display: grid;
  place-items: center;
}

.hero-stage {
  position: relative;
  width: min(100%, 480px);
  aspect-ratio: 5 / 4;
  border-radius: var(--bc-radius-lg);
  background:
    radial-gradient(circle at 30% 25%, rgba(0, 104, 104, 0.12), transparent 55%),
    linear-gradient(160deg, #fff 0%, #eef6f6 100%);
  box-shadow: var(--bc-shadow);
  display: grid;
  place-items: center;
  overflow: hidden;
}

.hero-mark {
  width: min(72%, 320px);
  height: auto;
  position: relative;
  z-index: 1;
}

.hero-panel {
  position: absolute;
  inset: 18% 12% 18% 42%;
  border: 1.5px dashed rgba(0, 104, 104, 0.35);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.45);
}

.features {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--bc-space-4);
  max-width: 1180px;
  margin: 0 auto;
  padding: var(--bc-space-7) clamp(16px, 4vw, 48px);
}

.feature {
  background: var(--bc-paper-elevated);
  border-radius: var(--bc-radius-lg);
  padding: var(--bc-space-5);
  box-shadow: inset 0 0 0 1px var(--bc-line);
}

.feature h3 {
  margin: 0 0 10px;
  font-family: var(--bc-font-display);
  font-size: 18px;
  font-weight: 600;
  color: var(--bc-ink);
}

.feature p {
  margin: 0;
  color: var(--bc-ink-muted);
  line-height: 1.55;
  font-size: 14px;
}

.closing {
  padding: 0 clamp(16px, 4vw, 48px) var(--bc-space-7);
}

.closing-inner {
  max-width: 1180px;
  margin: 0 auto;
  padding: var(--bc-space-6);
  border-radius: var(--bc-radius-lg);
  background: var(--bc-steel-soft);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

.closing-inner h2 {
  margin: 0;
  font-family: var(--bc-font-display);
  font-size: clamp(22px, 3vw, 28px);
  color: var(--bc-ink);
}

.closing-inner p {
  margin: 0 0 6px;
  color: var(--bc-ink-muted);
  max-width: 48ch;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 900px) {
  .hero {
    grid-template-columns: 1fr;
    min-height: auto;
    padding-bottom: 40px;
  }
  .hero-visual {
    min-height: 240px;
    order: -1;
  }
  .brand-logo {
    width: min(100%, 300px);
  }
  .features {
    grid-template-columns: 1fr;
    padding-top: var(--bc-space-5);
  }
}
</style>
