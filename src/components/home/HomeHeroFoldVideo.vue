<template>
  <div class="hero-video" @pointerdown="onUserGesture">
    <img
      v-if="showPosterOnly"
      class="poster"
      :src="posterUrl"
      :alt="altText"
      width="640"
      height="512"
      @error="onPosterError"
    />
    <video
      v-show="!showPosterOnly"
      ref="videoRef"
      class="clip"
      :poster="posterUrl"
      muted
      autoplay
      playsinline
      loop
      preload="auto"
      :aria-label="altText"
      @loadeddata="onMediaReady"
      @canplay="onMediaReady"
      @playing="onPlaying"
    >
      <!-- MP4 first: H.264 is reliable on Windows; WebM/VP9 can freeze on some GPUs. -->
      <source :src="mp4Url" type="video/mp4" />
      <source :src="webmUrl" type="video/webm" />
    </video>
    <button
      v-if="!showPosterOnly && needsGesture"
      type="button"
      class="play-cta bc-btn bc-btn--primary"
      @click.stop="onUserGesture"
    >
      {{ t('site.heroPlayFold') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { prefersStaticHeroMedia } from '../../motion/mediaPrefs'
// @ts-expect-error JS asset helper
import { publicAssetUrl } from '../../assetUrl.js'

const props = defineProps<{
  alt?: string
}>()

const emit = defineEmits<{
  failed: []
  ready: []
}>()

const { t } = useI18n()
const videoRef = ref<HTMLVideoElement | null>(null)
const staticMode = ref(false)
const videoBroken = ref(false)
const readyOnce = ref(false)
const needsGesture = ref(false)
let failTimer: ReturnType<typeof setTimeout> | null = null
let tickTimer: ReturnType<typeof setInterval> | null = null
let lastTime = 0
let frozenTicks = 0

const altText = computed(() => props.alt || t('site.heroVisual'))
const ASSET_VER = '20261119c'
const mp4Url = `${publicAssetUrl('hero/fold-loop.mp4')}?v=${ASSET_VER}`
const webmUrl = `${publicAssetUrl('hero/fold-loop.webm')}?v=${ASSET_VER}`
const posterUrl = `${publicAssetUrl('hero/fold-poster.jpg')}?v=${ASSET_VER}`

const showPosterOnly = computed(() => staticMode.value || videoBroken.value)

function onPosterError() {
  emit('failed')
}

function markReady() {
  if (readyOnce.value) return
  readyOnce.value = true
  if (failTimer) {
    clearTimeout(failTimer)
    failTimer = null
  }
  emit('ready')
}

function onPlaying() {
  needsGesture.value = false
  frozenTicks = 0
  markReady()
}

function onMediaReady() {
  markReady()
  void tryPlay(false)
}

function forceMute(el: HTMLVideoElement) {
  el.defaultMuted = true
  el.muted = true
  el.volume = 0
  el.setAttribute('muted', '')
}

/** Never call el.load() here — it aborts buffering and freezes readyState at 0. */
async function tryPlay(fromGesture: boolean) {
  const el = videoRef.value
  if (!el || staticMode.value || videoBroken.value) return false
  forceMute(el)
  try {
    await el.play()
    needsGesture.value = false
    return !el.paused
  } catch {
    if (!fromGesture) needsGesture.value = true
    return false
  }
}

async function onUserGesture() {
  needsGesture.value = false
  await tryPlay(true)
}

function markFailed() {
  if (readyOnce.value) return
  videoBroken.value = true
  emit('failed')
}

function onVisibility() {
  if (document.visibilityState === 'visible') void tryPlay(false)
}

function startTicker() {
  stopTicker()
  lastTime = 0
  frozenTicks = 0
  tickTimer = window.setInterval(() => {
    const el = videoRef.value
    if (!el || showPosterOnly.value) return
    if (el.paused) {
      void tryPlay(false)
      return
    }
    const t = el.currentTime || 0
    if (el.readyState >= 2 && Math.abs(t - lastTime) < 0.04) {
      frozenTicks += 1
      // Playing but frames not advancing → ask user gesture (avoid load() thrash).
      if (frozenTicks >= 6) needsGesture.value = true
    } else {
      frozenTicks = 0
      needsGesture.value = false
    }
    lastTime = t
  }, 500)
}

function stopTicker() {
  if (tickTimer) {
    clearInterval(tickTimer)
    tickTimer = null
  }
}

function teardown() {
  stopTicker()
  if (failTimer) {
    clearTimeout(failTimer)
    failTimer = null
  }
  document.removeEventListener('visibilitychange', onVisibility)
  const el = videoRef.value
  if (!el) return
  try {
    el.pause()
  } catch {
    /* ignore */
  }
}

onMounted(async () => {
  staticMode.value = prefersStaticHeroMedia()
  if (staticMode.value) {
    emit('ready')
    return
  }
  document.addEventListener('visibilitychange', onVisibility)
  await nextTick()
  const el = videoRef.value
  if (!el) {
    markFailed()
    return
  }
  forceMute(el)
  failTimer = setTimeout(() => {
    if (!readyOnce.value && (el.readyState || 0) < 2) markFailed()
  }, 12000)
  startTicker()
  void tryPlay(false)
})

onBeforeUnmount(() => {
  teardown()
})
</script>

<style scoped>
.hero-video {
  position: relative;
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  background: #fff;
}

.clip,
.poster {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.play-cta {
  position: absolute;
  z-index: 2;
  left: 50%;
  bottom: 56px;
  transform: translateX(-50%);
  box-shadow: var(--bc-shadow);
}
</style>
