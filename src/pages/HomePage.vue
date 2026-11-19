<template>
  <AppShell flush>
    <section class="hero bc-paper-grid">
      <div ref="heroCopyEl" class="hero-copy">
        <img class="brand-logo" :src="logoUrl" alt="BOXCRAFT" width="320" height="99" />
        <h1>{{ t('site.heroTitle') }}</h1>
        <p class="lead">{{ t('site.heroLead') }}</p>
        <p class="note">{{ t('site.heroCapabilityNote') }}</p>
        <div class="cta">
          <RouterLink class="bc-btn bc-btn--primary" to="/products">{{ t('studio.browseProducts') }}</RouterLink>
          <a class="bc-btn bc-btn--ghost" href="#how-it-works">{{ t('site.heroCtaSecondary') }}</a>
        </div>
      </div>
      <motion.div class="hero-visual" :aria-label="t('site.heroVisual')" v-bind="visualEnter">
        <div class="hero-stage">
          <HomeHeroFoldPreview
            v-if="previewOn && heroPreviewSlug"
            :slug="heroPreviewSlug"
            @failed="onPreviewFailed"
            @ready="previewFailed = false"
          />
          <template v-else>
            <img
              v-if="heroCover && !coverBroken"
              class="hero-cover"
              :src="heroCover"
              :alt="heroAlt"
              width="640"
              height="512"
              @error="coverBroken = true"
            />
            <div v-else class="hero-fallback" role="img" :aria-label="heroAlt || t('site.heroCoverFailed')">
              <div class="hero-panel" />
              <p class="hero-fallback-label">{{ heroAlt || t('site.heroCoverFailed') }}</p>
            </div>
            <button
              v-if="heroPreviewSlug && !previewFailed"
              type="button"
              class="bc-btn bc-btn--primary hero-3d-cta"
              @click="previewOn = true"
            >
              {{ t('site.heroView3d') }}
            </button>
          </template>
          <button
            v-if="previewOn"
            type="button"
            class="bc-btn bc-btn--ghost hero-3d-close"
            @click="closePreview"
          >
            {{ t('site.heroClose3d') }}
          </button>
        </div>
        <p v-if="previewFailed" class="hero-3d-note">{{ t('site.hero3dUnavailable') }}</p>
      </motion.div>
    </section>

    <HomeProductStrip :items="featuredProducts" :loading="productsLoading" :error="productsError" />

    <section id="how-it-works" class="how" aria-labelledby="how-heading">
      <header>
        <h2 id="how-heading">{{ t('site.sectionHowTitle') }}</h2>
        <p>{{ t('site.sectionHowLead') }}</p>
      </header>
      <ol>
        <li v-for="(step, i) in howSteps" :key="step.title">
          <span class="num">{{ i + 1 }}</span>
          <div>
            <h3>{{ step.title }}</h3>
            <p>{{ step.body }}</p>
          </div>
        </li>
      </ol>
    </section>

    <section class="split" aria-labelledby="workspace-heading">
      <div class="split-copy">
        <h2 id="workspace-heading">{{ t('site.sectionWorkspaceTitle') }}</h2>
        <p>{{ t('site.sectionWorkspaceLead') }}</p>
      </div>
      <div class="split-media" aria-hidden="true">
        <img v-if="workspaceCover" :src="workspaceCover" alt="" loading="lazy" />
      </div>
    </section>

    <section class="split split--alt" aria-labelledby="render-heading">
      <div class="split-copy">
        <h2 id="render-heading">{{ t('site.sectionRenderTitle') }}</h2>
        <p>{{ t('site.sectionRenderLead') }}</p>
        <RouterLink class="bc-btn bc-btn--primary" to="/render">{{ t('site.sectionRenderCta') }}</RouterLink>
      </div>
      <div class="split-media" aria-hidden="true">
        <img v-if="renderCover" :src="renderCover" alt="" loading="lazy" />
      </div>
    </section>

    <section class="band" aria-labelledby="outbox-heading">
      <div class="band-inner">
        <h2 id="outbox-heading">{{ t('site.sectionOutboxTitle') }}</h2>
        <p>{{ t('site.sectionOutboxLead') }}</p>
        <RouterLink class="bc-btn bc-btn--ghost" to="/designs">{{ t('site.sectionOutboxCta') }}</RouterLink>
      </div>
    </section>

    <HomeBlogStrip :items="blogPosts" :loading="blogLoading" />

    <HomeFaq />

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
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { motion } from 'motion-v'
import logoUrl from '../assets/brand/boxcraft-logo.png'
import AppShell from '../components/layout/AppShell.vue'
import HomeProductStrip from '../components/home/HomeProductStrip.vue'
import HomeBlogStrip from '../components/home/HomeBlogStrip.vue'
import HomeFaq from '../components/home/HomeFaq.vue'
import { enterProps } from '../motion'
import { useHomeHeroGsap } from '../motion/useGsapHighlight'
import { fetchProducts, type ProductSummary } from '../api/catalog'
import { fetchBlogPosts, type BlogCard } from '../api/blog'
// @ts-expect-error JS asset helper
import { publicAssetUrl } from '../assetUrl.js'

/** Lazy so homepage first paint never pulls Three / knifeScene. */
const HomeHeroFoldPreview = defineAsyncComponent(() => import('../components/home/HomeHeroFoldPreview.vue'))

const { t, locale } = useI18n()
const heroCopyEl = ref<HTMLElement | null>(null)
useHomeHeroGsap(heroCopyEl)

const visualEnter = enterProps(0.12)

const products = ref<ProductSummary[]>([])
const productsLoading = ref(true)
const productsError = ref('')
const blogPosts = ref<BlogCard[]>([])
const blogLoading = ref(true)

const previewOn = ref(false)
const previewFailed = ref(false)
const coverBroken = ref(false)

const featuredProducts = computed(() => {
  const withCover = products.value.filter((p) => p.cover_rel)
  const pool = withCover.length ? withCover : products.value
  return pool.slice(0, 6)
})

/** Prefer a product that can feed workbench geometry (not model_only). */
const heroProduct = computed(() => {
  const pool = featuredProducts.value
  return (
    pool.find((p) => p.geometry_mode !== 'model_only' && p.cover_rel) ||
    pool.find((p) => p.geometry_mode !== 'model_only') ||
    pool[0] ||
    null
  )
})
const heroPreviewSlug = computed(() => {
  const p = heroProduct.value
  if (!p || p.geometry_mode === 'model_only') return ''
  return p.slug || ''
})
const heroCover = computed(() => (heroProduct.value?.cover_rel ? publicAssetUrl(heroProduct.value.cover_rel) : ''))
const heroAlt = computed(() => {
  const p = heroProduct.value
  if (!p) return t('site.heroVisual')
  return locale.value === 'ko-KR' && p.name_ko ? p.name_ko : p.name
})

function closePreview() {
  previewOn.value = false
}

function onPreviewFailed() {
  previewOn.value = false
  previewFailed.value = true
}

watch(heroCover, () => {
  coverBroken.value = false
})
const workspaceCover = computed(() =>
  featuredProducts.value[1]?.cover_rel
    ? publicAssetUrl(featuredProducts.value[1].cover_rel)
    : heroCover.value,
)
const renderCover = computed(() =>
  featuredProducts.value[2]?.cover_rel
    ? publicAssetUrl(featuredProducts.value[2].cover_rel)
    : heroCover.value,
)

const howSteps = computed(() => [
  { title: t('site.howStep1Title'), body: t('site.howStep1Body') },
  { title: t('site.howStep2Title'), body: t('site.howStep2Body') },
  { title: t('site.howStep3Title'), body: t('site.howStep3Body') },
  { title: t('site.howStep4Title'), body: t('site.howStep4Body') },
])

onMounted(async () => {
  const [prodRes, blogRes] = await Promise.allSettled([
    fetchProducts({ page_size: 12 }),
    fetchBlogPosts({ page_size: 3, locale: locale.value }),
  ])
  if (prodRes.status === 'fulfilled') {
    products.value = prodRes.value.items
  } else {
    productsError.value = prodRes.reason instanceof Error ? prodRes.reason.message : t('studio.loadFailed')
  }
  productsLoading.value = false

  if (blogRes.status === 'fulfilled') {
    const data = blogRes.value
    const featured = data.featured?.length ? data.featured : []
    const items = data.items || []
    const merged = [...featured, ...items]
    const seen = new Set<string>()
    blogPosts.value = merged
      .filter((p) => {
        if (seen.has(p.slug)) return false
        seen.add(p.slug)
        return true
      })
      .slice(0, 3)
  }
  blogLoading.value = false
})
</script>

<style scoped>
.hero {
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
  order: 1;
}

.brand-logo {
  display: block;
  width: min(100%, 360px);
  height: auto;
  margin: 0 0 22px;
}

h1 {
  margin: 0 0 16px;
  font-family: var(--bc-font-display);
  font-size: clamp(28px, 4.2vw, 46px);
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1.18;
  color: var(--bc-ink);
}

.lead {
  margin: 0 0 12px;
  max-width: 42ch;
  font-size: 17px;
  line-height: 1.55;
  color: var(--bc-ink-muted);
}

.note {
  margin: 0 0 24px;
  max-width: 46ch;
  font-size: 13px;
  line-height: 1.5;
  color: var(--bc-ink-faint);
}

.cta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.hero-visual {
  position: relative;
  min-height: min(52vh, 480px);
  display: grid;
  place-items: center;
  order: 2;
}

.hero-stage {
  position: relative;
  width: min(100%, 520px);
  aspect-ratio: 5 / 4;
  border-radius: var(--bc-radius-lg);
  background:
    radial-gradient(circle at 30% 25%, rgba(0, 104, 104, 0.1), transparent 55%),
    linear-gradient(160deg, #fff 0%, #eef6f6 100%);
  box-shadow: var(--bc-shadow);
  overflow: hidden;
  display: grid;
  place-items: center;
}

.hero-cover {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #fff;
}

.hero-fallback {
  width: 100%;
  height: 100%;
  position: relative;
  display: grid;
  place-items: center;
}

.hero-panel {
  position: absolute;
  inset: 18% 12% 18% 42%;
  border: 1.5px dashed rgba(0, 104, 104, 0.35);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.45);
}

.hero-fallback-label {
  position: relative;
  z-index: 1;
  margin: 0;
  padding: 0 16px;
  font-size: 13px;
  color: var(--bc-ink-muted);
  text-align: center;
}

.hero-3d-cta,
.hero-3d-close {
  position: absolute;
  z-index: 3;
  box-shadow: var(--bc-shadow);
}

.hero-3d-cta {
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
}

.hero-3d-close {
  top: 12px;
  right: 12px;
  padding: 6px 12px;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.92);
}

.hero-3d-note {
  margin: 10px 0 0;
  font-size: 13px;
  color: var(--bc-ink-muted);
  text-align: center;
  max-width: 42ch;
}

.how {
  max-width: 1180px;
  margin: 0 auto;
  padding: 0 clamp(16px, 4vw, 48px) var(--bc-space-7);
}

.how header {
  margin-bottom: 20px;
}

.how h2,
.split h2,
.band h2,
.closing-inner h2 {
  margin: 0 0 8px;
  font-family: var(--bc-font-display);
  font-size: clamp(22px, 3vw, 30px);
}

.how p,
.split p,
.band p {
  margin: 0;
  color: var(--bc-ink-muted);
  line-height: 1.55;
  font-size: 14px;
  max-width: 56ch;
}

.how ol {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.how li {
  display: flex;
  gap: 12px;
  padding: 16px;
  border-radius: var(--bc-radius);
  border: 1px solid var(--bc-line);
  background: var(--bc-paper-elevated);
}

.how .num {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: var(--bc-steel);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
}

.how h3 {
  margin: 0 0 6px;
  font-size: 15px;
}

.split {
  max-width: 1180px;
  margin: 0 auto var(--bc-space-6);
  padding: 0 clamp(16px, 4vw, 48px);
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 28px;
  align-items: center;
}

.split--alt .split-copy {
  order: 2;
}

.split--alt .split-media {
  order: 1;
}

.split-copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
}

.split-media {
  aspect-ratio: 5 / 4;
  border-radius: var(--bc-radius-lg);
  border: 1px solid var(--bc-line);
  background: #fff;
  overflow: hidden;
}

.split-media img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.band {
  padding: 0 clamp(16px, 4vw, 48px) var(--bc-space-6);
}

.band-inner {
  max-width: 1180px;
  margin: 0 auto;
  padding: var(--bc-space-5);
  border-radius: var(--bc-radius-lg);
  border: 1px solid var(--bc-line);
  background: var(--bc-paper-elevated);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
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

.closing-inner p {
  margin: 0 0 6px;
  color: var(--bc-ink-muted);
  max-width: 48ch;
}

@media (max-width: 900px) {
  .hero {
    grid-template-columns: 1fr;
    min-height: auto;
    padding-bottom: 36px;
  }
  .hero-copy {
    order: 1;
  }
  .hero-visual {
    order: 2;
    min-height: 220px;
  }
  .brand-logo {
    width: min(100%, 280px);
  }
  .how ol,
  .split {
    grid-template-columns: 1fr;
  }
  .split--alt .split-copy,
  .split--alt .split-media {
    order: unset;
  }
}
</style>
