<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import AppShell from '../../components/layout/AppShell.vue'
import { useWorkbenchStore } from './stores/workbench'
import { useKnifeStore } from './stores/knife'
import { useAutosave } from './composables/useAutosave'
import { loadWorkbenchManifest } from './manifest'
import TopBar from './components/TopBar.vue'
import ParamPanel from './components/panel/ParamPanel.vue'
import DielineCanvas from './components/canvas/DielineCanvas.vue'
import FoldPreview from './components/preview/FoldPreview.vue'
import ExportCenter from './components/export/ExportCenter.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const wb = useWorkbenchStore()
const knife = useKnifeStore()
const autosave = useAutosave()
const {
  status: saveStatus,
  designId,
  revisionId,
  exportBlocked,
  geometryDrift,
  checkpoint,
  ensureDesign,
  loginWithClaim,
} = autosave
const exportRef = ref<InstanceType<typeof ExportCenter> | null>(null)
const mobileTab = ref<'2d' | '3d'>('2d')
const engineMismatch = ref(false)
let debounce: ReturnType<typeof setTimeout> | null = null
let urlTimer: ReturnType<typeof setTimeout> | null = null

const slug = computed(() => String(route.params.slug || ''))

onMounted(async () => {
  const loaded = await loadWorkbenchManifest(slug.value)
  if (!loaded || !wb.loadManifest(slug.value, loaded)) {
    // Imported boxes that are not offered for customization go back to the workbench list
    router.replace({ name: slug.value.startsWith('import-') ? 'workbench-home' : 'products' })
    return
  }
  if (loaded.engineMismatch) engineMismatch.value = true
  const hasQuery = [...new URLSearchParams(route.query as Record<string, string>)].some(([k]) =>
    ['l', 'w', 'h', 't', 'm', 'sm', 'p', 'b', 'fd'].includes(k),
  )
  if (hasQuery) {
    wb.loadFromUrl(new URLSearchParams(route.query as Record<string, string>).toString())
  } else {
    wb.loadDraft()
  }
  performance.mark('wb-open')
  await knife.recompute()
})

const { params } = storeToRefs(wb)
// Switching piece (lid / base / insert…) redraws immediately; it is not part of the size params
watch(() => wb.pieceId, () => { void knife.recompute() })
watch(
  params,
  () => {
    if (debounce) clearTimeout(debounce)
    const t0 = performance.now()
    debounce = setTimeout(async () => {
      await knife.recompute()
      ;(window as any).__wbEngineMs = knife.computeMs
      ;(window as any).__wbParamTo2dMs = performance.now() - t0
    }, 150)
    if (urlTimer) clearTimeout(urlTimer)
    urlTimer = setTimeout(() => {
      const q = wb.toQueryString()
      const query = Object.fromEntries(new URLSearchParams(q.startsWith('?') ? q.slice(1) : q))
      if (designId.value) query.design = designId.value
      const next = `${route.path}?${new URLSearchParams(query as Record<string, string>).toString()}`
      if (route.fullPath !== next) {
        router.replace({ path: route.path, query })
      }
      wb.saveDraft()
    }, 200)
  },
  { deep: true },
)

function onKey(e: KeyboardEvent) {
  const mod = e.ctrlKey || e.metaKey
  if (mod && e.key.toLowerCase() === 'z') {
    e.preventDefault()
    if (e.shiftKey) wb.redo()
    else wb.undo()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  if (debounce) clearTimeout(debounce)
  if (urlTimer) clearTimeout(urlTimer)
  knife.dispose()
})
</script>

<template>
  <AppShell flush>
    <div class="wb">
      <TopBar
        :save-status="saveStatus"
        :on-export="wb.manifest?.locked ? undefined : () => exportRef?.requestExport()"
        :locked="!!wb.manifest?.locked"
        :on-checkpoint="() => checkpoint()"
      />
      <p v-if="engineMismatch" class="warn">{{ t('workbench.engineMismatch') }}</p>
      <p v-if="geometryDrift" class="warn">{{ t('workbench.driftBlocked') }}</p>
      <p v-if="wb.manifest?.fidelity === 'close'" class="warn soft">{{ t('workbench.fidelityCloseNote') }}</p>
      <p v-if="wb.manifest?.locked" class="warn soft">{{ t('workbench.lockedNote') }}</p>
      <div class="layout">
        <ParamPanel class="left" />
        <div class="center">
          <div class="mobile-tabs">
            <button type="button" :class="{ on: mobileTab === '2d' }" @click="mobileTab = '2d'">2D</button>
            <button type="button" :class="{ on: mobileTab === '3d' }" @click="mobileTab = '3d'">3D</button>
          </div>
          <DielineCanvas class="canvas" :class="{ hideMobile: mobileTab !== '2d' }" />
        </div>
        <aside class="right" :class="{ hideMobile: mobileTab !== '3d' }">
          <FoldPreview />
          <div v-if="wb.manifest?.locked" class="note">
            <p>{{ t('workbench.lockedExportNote') }}</p>
          </div>
          <ExportCenter
            v-else
            ref="exportRef"
            :design-id="designId"
            :revision-id="revisionId"
            :export-blocked="exportBlocked"
            :checkpoint="() => checkpoint()"
            :ensure-design="() => ensureDesign()"
            :login-with-claim="() => loginWithClaim()"
          />
          <div class="note">
            <p>{{ t('workbench.guestNote') }}</p>
          </div>
        </aside>
      </div>
    </div>
  </AppShell>
</template>

<style scoped>
.wb{
  display:flex;flex-direction:column;gap:12px;padding:12px clamp(8px,2vw,20px) 24px;
  min-height:calc(100vh - 64px);background:var(--bc-paper);font-family:var(--bc-font-ui)
}
.warn{margin:0;padding:8px 12px;border-radius:8px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:12px}
.warn.soft{background:var(--bc-warn-bg);border-color:var(--bc-warn-line);color:var(--bc-warn)}
.layout{
  display:grid;grid-template-columns:300px minmax(0,1fr) 300px;gap:12px;flex:1;min-height:0
}
.left,.right,.canvas{min-height:0}
.center{display:flex;flex-direction:column;min-height:0}
/* Fill the column but never grow past the viewport when the side panel is long; stay in view while it scrolls */
.center .canvas{flex:0 1 auto;height:calc(100vh - 190px);min-height:420px;position:sticky;top:76px}
.right{display:flex;flex-direction:column;gap:12px}
.note{background:#fff;border:1px solid var(--bc-line);border-radius:12px;padding:12px;font-size:12px;color:var(--bc-ink-muted)}
.mobile-tabs{display:none}
@media (max-width: 960px){
  .layout{grid-template-columns:1fr}
  .center .canvas{position:static;height:70vh}
  .mobile-tabs{display:flex;gap:6px;margin-bottom:8px}
  .mobile-tabs button{flex:1;height:32px;border-radius:8px;border:1px solid var(--bc-line-strong);background:#fff}
  .mobile-tabs button.on{background:var(--bc-steel);color:#fff;border-color:var(--bc-steel)}
  .hideMobile{display:none !important}
}
</style>
