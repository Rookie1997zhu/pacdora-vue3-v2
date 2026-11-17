<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useKnifeStore } from '../../stores/knife'
import { useWorkbenchStore } from '../../stores/workbench'
import { stageIndexAt } from '../../../../foldStages.js'
import { resolveEngineMaterialId } from '../../../../../packages/geometry-engine/materialProfiles.js'

const { t } = useI18n()
const knifeStore = useKnifeStore()
const wb = useWorkbenchStore()
const host = ref<HTMLElement | null>(null)
const progress = ref(100)
const webglOk = ref(true)
const stageLabel = ref('')
let scene: any = null
let rebuildTimer: ReturnType<typeof setTimeout> | null = null
let ready = false
let lastFrameKey = ''

async function init() {
  await nextTick()
  if (!host.value) return
  try {
    const { createKnifeScene } = await import(
      /* @vite-ignore */ '../../../../lab/knifeScene.js'
    )
    const mid = resolveEngineMaterialId(wb.params.materialId)
    scene = createKnifeScene(host.value, {
      materialId: mid,
      onPanelSelect: (name: string) => wb.setHover({ face: name || null }),
    })
    ready = true
    await applyKnife(true)
    scene.setProgress(progress.value)
  } catch (err) {
    console.warn('FoldPreview WebGL unavailable', err)
    webglOk.value = false
  }
}

async function applyKnife(immediate = false) {
  if (!scene || !ready) return
  const run = async () => {
    const k = knifeStore.displayKnife
    if (!k) return
    const t0 = performance.now()
    const mid = resolveEngineMaterialId(wb.params.materialId)
    const thickness = k.dimensions?.thickness ?? wb.params.thicknessMm
    await scene.setKnife(k, thickness, mid)
    scene.setProgress(progress.value)
    // Replayed reference dielines sit at sheet coordinates, not around the origin: re-frame on a new box
    const frameKey = `${String(k.template || '')}#${String(k.piece || '')}`
    if (frameKey !== lastFrameKey) {
      lastFrameKey = frameKey
      requestAnimationFrame(() => scene?.resetView?.())
    }
    performance.mark('wb-3d-rebuild')
    ;(window as any).__wb3dMs = performance.now() - t0
  }
  if (immediate) return run()
  if (rebuildTimer) clearTimeout(rebuildTimer)
  rebuildTimer = setTimeout(run, 120)
}

watch(() => knifeStore.displayKnife, () => applyKnife(false))
watch(() => wb.params.materialId, () => applyKnife(true))
watch(progress, (p) => {
  scene?.setProgress(p)
  // Boxes with a fold recipe animate by the recipe's own steps
  const k = knifeStore.displayKnife
  const stages = (k?.fold3d?.stages?.length ? k.fold3d.stages : k?.foldStages) || []
  const idx = stageIndexAt(p / 100, stages.length || 1)
  // stageIndexAt returns { now, total }
  stageLabel.value = idx.total ? `${idx.now} / ${idx.total}` : ''
})

function onVis() {
  // knifeScene has no pause API; dispose on hidden is too heavy — leave as-is
}

onMounted(() => {
  // Defer Three.js until after first paint
  requestAnimationFrame(() => init())
  document.addEventListener('visibilitychange', onVis)
})
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVis)
  if (rebuildTimer) clearTimeout(rebuildTimer)
  try { scene?.dispose?.() } catch { /* ignore */ }
  scene = null
})
</script>

<template>
  <section class="preview">
    <header>
      <span>{{ t('workbench.preview3d') }}</span>
      <button type="button" @click="scene?.resetView?.()">{{ t('workbench.resetView') }}</button>
    </header>
    <div v-if="!webglOk" class="fallback">{{ t('workbench.webglUnavailable') }}</div>
    <div v-show="webglOk" ref="host" class="host" />
    <div class="slider">
      <span>{{ t('workbench.unfolded') }}</span>
      <input v-model.number="progress" type="range" min="0" max="100" step="1" />
      <span>{{ t('workbench.closed') }}</span>
      <em v-if="stageLabel">{{ stageLabel }}</em>
    </div>
  </section>
</template>

<style scoped>
.preview{
  display:flex;flex-direction:column;background:#eef1f4;border:1px solid var(--bc-line);
  border-radius:12px;overflow:hidden;min-height:240px
}
header{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;font-size:12px;color:var(--bc-ink-muted)}
header button{border:1px solid var(--bc-line-strong);background:#fff;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:12px}
.host{flex:1;min-height:180px}
.fallback{flex:1;display:grid;place-items:center;padding:16px;font-size:13px;color:var(--bc-ink-muted);text-align:center}
.slider{display:flex;align-items:center;gap:8px;padding:8px 12px;background:#fff;border-top:1px solid var(--bc-line);font-size:11px;color:var(--bc-ink-muted)}
.slider input{flex:1}
.slider em{font-style:normal;min-width:48px;text-align:right}
</style>
