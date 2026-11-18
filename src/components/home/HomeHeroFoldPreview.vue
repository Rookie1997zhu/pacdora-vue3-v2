<template>
  <div class="hero-fold">
    <div v-if="loading" class="status overlay">{{ t('site.hero3dLoading') }}</div>
    <div v-else-if="errorText" class="status err">{{ errorText }}</div>
    <template v-if="!errorText">
      <div ref="hostRef" class="host" :class="{ dim: loading }" />
      <div v-if="!loading" class="bar">
        <button type="button" class="bc-btn bc-btn--ghost bar-btn" @click="resetView">
          {{ t('workbench.resetView') }}
        </button>
        <label class="fold">
          <span>{{ t('workbench.unfolded') }}</span>
          <input v-model.number="progress" type="range" min="0" max="100" step="1" />
          <span>{{ t('workbench.closed') }}</span>
        </label>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveEngineMaterialId } from '../../../packages/geometry-engine/materialProfiles.js'
import { buildPreviewKnifeFromSlug } from './buildPreviewKnife'

const props = defineProps<{
  slug: string
}>()

const emit = defineEmits<{
  failed: [reason: string]
  ready: []
}>()

const { t } = useI18n()
const hostRef = ref<HTMLElement | null>(null)
const loading = ref(true)
const errorText = ref('')
const progress = ref(100)

type SceneApi = {
  setKnife: (knife: unknown, thickness: number, materialId?: string) => Promise<void>
  setProgress: (pct: number) => void
  resetView?: () => void
  dispose: () => void
}

let scene: SceneApi | null = null
let disposed = false

function fail(reason: string) {
  errorText.value = reason || t('site.hero3dUnavailable')
  loading.value = false
  emit('failed', errorText.value)
}

async function init() {
  loading.value = true
  errorText.value = ''
  try {
    const built = await buildPreviewKnifeFromSlug(props.slug)
    if (disposed) return

    await nextTick()
    if (disposed || !hostRef.value) {
      fail(t('site.hero3dUnavailable'))
      return
    }

    const { createKnifeScene } = await import(
      /* webpackChunkName: "home-knife-scene" */ '../../lab/knifeScene.js'
    )
    if (disposed || !hostRef.value) return

    scene = createKnifeScene(hostRef.value, {
      materialId: resolveEngineMaterialId(built.materialId),
    }) as SceneApi

    const mid = resolveEngineMaterialId(built.materialId)
    await scene.setKnife(built.knife, built.thicknessMm, mid)
    if (disposed) {
      scene.dispose()
      scene = null
      return
    }
    scene.setProgress(progress.value)
    requestAnimationFrame(() => scene?.resetView?.())
    loading.value = false
    emit('ready')
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : t('site.hero3dUnavailable')
    fail(msg)
    try {
      scene?.dispose?.()
    } catch {
      /* ignore */
    }
    scene = null
  }
}

function resetView() {
  scene?.resetView?.()
}

watch(progress, (p) => {
  scene?.setProgress(p)
})

onMounted(() => {
  void init()
})

onBeforeUnmount(() => {
  disposed = true
  try {
    scene?.dispose?.()
  } catch {
    /* ignore */
  }
  scene = null
})
</script>

<style scoped>
.hero-fold {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 280px;
  background: #eef1f4;
  border-radius: inherit;
  overflow: hidden;
}
.status {
  flex: 1;
  display: grid;
  place-items: center;
  padding: 24px;
  font-size: 14px;
  color: var(--bc-ink-muted);
  text-align: center;
}
.status.overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  background: rgba(238, 241, 244, 0.92);
}
.status.err {
  color: var(--bc-danger, #b42318);
}
.host {
  flex: 1;
  min-height: 240px;
}
.host.dim {
  opacity: 0.35;
}
.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: #fff;
  border-top: 1px solid var(--bc-line);
}
.bar-btn {
  padding: 4px 10px;
  font-size: 12px;
}
.fold {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 160px;
  font-size: 11px;
  color: var(--bc-ink-muted);
}
.fold input {
  flex: 1;
}
</style>
