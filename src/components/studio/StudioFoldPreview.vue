<template>
  <div class="fold-preview">
    <div class="preview-toolbar">
      <div class="side-toggle" role="group" :aria-label="t('studio.previewSide')">
        <button type="button" :class="{ on: previewSide === 'outside' }" @click="previewSide = 'outside'">
          {{ t('studio.sideOutside') }}
        </button>
        <button type="button" :class="{ on: previewSide === 'inside' }" @click="previewSide = 'inside'">
          {{ t('studio.sideInside') }}
        </button>
      </div>
      <span v-if="design.document?.outbox?.enabled" class="badge">{{ t('studio.outboxEnabledBadge') }}</span>
    </div>
    <div ref="hostRef" class="viewport" />
    <div class="bar">
      <p class="hint">{{ t('studio.pickPanel3d') }}</p>
      <p class="hint">{{ t('studio.selectPanelHint') }}: {{ design.selectedPanelId || '—' }}</p>
      <label>
        {{ t('studio.foldProgress') }}
        <input v-model.number="progress" type="range" min="0" max="100" step="1" />
        <span>{{ progress }}%</span>
      </label>
      <p v-if="previewError" class="err">{{ previewError }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
// @ts-expect-error JS knife engine
import { createKnife } from '../../knife.js'
// @ts-expect-error JS scene
import { createKnifeScene } from '../../lab/knifeScene.js'
import { useDesignStore } from '../../stores/design'
import { bakeArtworkMaps } from '../../studio/artworkBake'

const { t } = useI18n()
const design = useDesignStore()
const hostRef = ref<HTMLElement | null>(null)
const progress = ref(0)
const previewError = ref('')
const previewSide = ref<'outside' | 'inside'>('outside')

type SceneApi = {
  setKnife: (knife: unknown, thickness: number, materialId?: string) => Promise<void>
  setProgress: (pct: number) => void
  setArtworkMaps: (maps: Record<string, unknown> | null, opts?: { takeOwnership?: boolean }) => void
  setSelectedPanel: (faceName: string | null) => void
  dispose: () => void
}

let scene: SceneApi | null = null
let bakeTimer: ReturnType<typeof setTimeout> | null = null
let bakeToken = 0

async function rebuildKnife() {
  if (!scene || !design.document) return
  const p = design.document.geometry.params
  try {
    const knife = createKnife({
      templateId: design.document.geometry.templateId,
      length: p.lengthMm,
      width: p.widthMm,
      height: p.heightMm,
      thickness: p.thicknessMm,
      bleed: p.bleedInputMm,
      sizeMode: p.sizeMode,
      fluteDirection: p.fluteDirection,
      materialId: p.materialId,
      params: p.advanced || {},
    })
    await scene.setKnife(knife, p.thicknessMm, p.materialId)
    scene.setProgress(progress.value)
    scene.setSelectedPanel(design.selectedPanelId)
    await refreshArtwork()
  } catch (e: unknown) {
    previewError.value = e instanceof Error ? e.message : '3d failed'
  }
}

async function refreshArtwork() {
  if (!scene || !design.document) return
  const token = ++bakeToken
  try {
    const maps = await bakeArtworkMaps(design.document, { side: previewSide.value })
    if (token !== bakeToken || !scene) {
      for (const tex of Object.values(maps)) tex.dispose()
      return
    }
    scene.setArtworkMaps(maps, { takeOwnership: true })
    scene.setSelectedPanel(design.selectedPanelId)
    previewError.value = ''
  } catch (e: unknown) {
    previewError.value = e instanceof Error ? e.message : 'bake failed'
  }
}

function scheduleBake() {
  if (bakeTimer) clearTimeout(bakeTimer)
  bakeTimer = setTimeout(() => {
    void refreshArtwork()
  }, 250)
}

onMounted(() => {
  if (!hostRef.value) return
  scene = createKnifeScene(hostRef.value, {
    materialId: design.document?.geometry.params.materialId || 'kraft',
    background: 0xeef2f3,
    onPanelSelect: (name: string) => {
      design.selectPanel(name)
    },
  }) as SceneApi
  void rebuildKnife()
})

onUnmounted(() => {
  if (bakeTimer) clearTimeout(bakeTimer)
  scene?.dispose()
  scene = null
})

watch(progress, (pct) => {
  scene?.setProgress(pct)
})

watch(
  () => design.selectedPanelId,
  (id) => {
    scene?.setSelectedPanel(id)
  },
)

watch(
  () => [
    design.document?.geometry.params.lengthMm,
    design.document?.geometry.params.widthMm,
    design.document?.geometry.params.heightMm,
    design.document?.geometry.params.thicknessMm,
    design.document?.geometry.params.materialId,
    design.document?.geometry.templateId,
  ],
  () => {
    void rebuildKnife()
  },
)

watch(
  () => design.document?.artwork.layers,
  () => scheduleBake(),
  { deep: true },
)

watch(previewSide, () => scheduleBake())

watch(
  () => design.editSide,
  (side) => {
    previewSide.value = side
  },
)
</script>

<style scoped>
.fold-preview{display:flex;flex-direction:column;gap:8px;height:100%;min-height:420px}
.preview-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.side-toggle{display:inline-flex;border:1px solid #cfd8de;border-radius:8px;overflow:hidden}
.side-toggle button{border:0;background:#fff;color:#16343c;padding:5px 10px;cursor:pointer;font-size:12px}
.side-toggle button.on{background:#0f6e68;color:#fff}
.badge{font-size:12px;color:#0f6e68;border:1px solid #9fd0cb;background:#eef8f7;border-radius:8px;padding:4px 8px}
.viewport{flex:1;min-height:360px;border-radius:12px;overflow:hidden;background:#e8eef0;cursor:pointer}
.bar{display:flex;flex-direction:column;gap:4px}
.hint{margin:0;font-size:12px;color:#637587}
label{display:flex;align-items:center;gap:10px;font-size:12px;color:#16343c}
input[type=range]{flex:1}
.err{margin:0;font-size:12px;color:#9a4339}
</style>
