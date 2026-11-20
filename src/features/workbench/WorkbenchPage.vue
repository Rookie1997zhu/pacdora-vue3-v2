<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, computed, nextTick } from 'vue'
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
/** A box on a structure-spec template was only checked against the reference dieline at its own size */
const UNVERIFIED_RESIZE_RATIO = 0.1
const unverifiedResize = computed(() => {
  const m = wb.manifest
  if (!m || m.locked || m.verifiedRange || !String(m.templateId || '').startsWith('spec-')) return null
  const d = m.defaultParams
  const off = (['lengthMm', 'widthMm', 'heightMm'] as const).some((k) => {
    const base = Number(d[k]) || 0
    return base > 0 && Math.abs((Number(wb.params[k]) || 0) - base) / base > UNVERIFIED_RESIZE_RATIO
  })
  return off ? { l: d.lengthMm, w: d.widthMm, h: d.heightMm } : null
})
const exportRef = ref<InstanceType<typeof ExportCenter> | null>(null)
const mobileTab = ref<'2d' | '3d'>('2d')
const engineMismatch = ref(false)
const exportDrawerOpen = ref(false)
const isNarrow = ref(false)
let debounce: ReturnType<typeof setTimeout> | null = null
let urlTimer: ReturnType<typeof setTimeout> | null = null
let mediaQuery: MediaQueryList | null = null
let onNarrowChange: ((ev: MediaQueryListEvent) => void) | null = null

const slug = computed(() => String(route.params.slug || ''))

async function bootSlug(nextSlug: string, opts?: { savePrevious?: boolean }) {
  if (opts?.savePrevious) {
    try {
      wb.saveDraft()
    } catch {
      /* ignore draft save failures when switching */
    }
  }
  engineMismatch.value = false
  const loaded = await loadWorkbenchManifest(nextSlug)
  if (!loaded || !wb.loadManifest(nextSlug, loaded)) {
    router.replace({ name: nextSlug.startsWith('import-') ? 'workbench-home' : 'products' })
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
}

onMounted(async () => {
  mediaQuery = window.matchMedia('(max-width: 960px)')
  const syncNarrow = () => {
    isNarrow.value = mediaQuery?.matches ?? false
    if (!isNarrow.value) exportDrawerOpen.value = true
    else exportDrawerOpen.value = false
  }
  onNarrowChange = () => syncNarrow()
  syncNarrow()
  mediaQuery.addEventListener('change', onNarrowChange)

  await bootSlug(slug.value)
})

watch(slug, async (next, prev) => {
  if (!next || next === prev) return
  await bootSlug(next, { savePrevious: true })
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

function isEditableKeyTarget(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null
  if (!target) return false
  if (e.isComposing) return true
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return false
}

function onKey(e: KeyboardEvent) {
  const mod = e.ctrlKey || e.metaKey
  if (!(mod && e.key.toLowerCase() === 'z')) return
  if (isEditableKeyTarget(e)) return
  e.preventDefault()
  if (e.shiftKey) wb.redo()
  else wb.undo()
}

async function openExport() {
  exportDrawerOpen.value = true
  await nextTick()
  exportRef.value?.requestExport()
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  if (debounce) clearTimeout(debounce)
  if (urlTimer) clearTimeout(urlTimer)
  if (mediaQuery && onNarrowChange) {
    mediaQuery.removeEventListener('change', onNarrowChange)
  }
  knife.dispose()
})
</script>

<template>
  <AppShell flush>
    <div class="wb">
      <TopBar
        :save-status="saveStatus"
        :on-export="openExport"
        :locked="!!wb.manifest?.locked"
        :on-checkpoint="() => checkpoint()"
      />
      <div class="alerts" aria-live="polite">
        <p v-if="engineMismatch" class="warn engine">{{ t('workbench.engineMismatch') }}</p>
        <p v-if="geometryDrift" class="warn drift">{{ t('workbench.driftBlocked') }}</p>
        <p v-if="wb.manifest?.fidelity === 'close'" class="warn soft fidelity">{{ t('workbench.fidelityCloseNote') }}</p>
        <p v-if="wb.manifest?.locked" class="warn soft locked">{{ t('workbench.lockedNote') }}</p>
        <p v-if="unverifiedResize" class="warn unverified">{{ t('workbench.unverifiedResizeNote', unverifiedResize) }}</p>
        <p v-if="wb.manifest?.verifiedRange" class="warn soft verified">
          {{ t(wb.manifest.sampledQuality === 'improved' ? 'workbench.improvedRangeNote' : 'workbench.verifiedRangeNote', {
            l: wb.manifest.verifiedRange.length.join('–'),
            w: wb.manifest.verifiedRange.width.join('–'),
            h: wb.manifest.verifiedRange.height.join('–'),
          }) }}
        </p>
      </div>
      <div class="layout" :class="{ 'with-export': exportDrawerOpen }">
        <ParamPanel class="left" />
        <div class="center">
          <div class="mobile-tabs">
            <button type="button" :class="{ on: mobileTab === '2d' }" @click="mobileTab = '2d'">2D</button>
            <button type="button" :class="{ on: mobileTab === '3d' }" @click="mobileTab = '3d'">3D</button>
          </div>
          <div class="canvas-wrap" :class="{ hideMobile: mobileTab !== '2d' }">
            <div class="canvas-badge" aria-hidden="true">
              <span>{{ slug }}</span>
              <span v-if="wb.pieceId">· {{ wb.pieceId }}</span>
              <span>· mm</span>
            </div>
            <DielineCanvas class="canvas" />
          </div>
        </div>
        <aside class="right" :class="{ hideMobile: mobileTab !== '3d' }">
          <FoldPreview />
          <div v-if="wb.manifest?.locked" class="note">
            <p>{{ t('workbench.lockedExportNote') }}</p>
          </div>
          <div class="note">
            <p>{{ t('workbench.guestNote') }}</p>
          </div>
        </aside>
      </div>

      <div
        v-if="isNarrow && exportDrawerOpen"
        class="export-backdrop"
        @click="exportDrawerOpen = false"
      />
      <aside
        class="export-drawer"
        :class="{ open: exportDrawerOpen, narrow: isNarrow }"
        :aria-hidden="!exportDrawerOpen"
      >
        <header v-if="isNarrow" class="export-drawer-bar">
          <strong>{{ t('workbench.export') }}</strong>
          <button type="button" class="ghost" @click="exportDrawerOpen = false">{{ t('workbench.closeExport') }}</button>
        </header>
        <ExportCenter
          ref="exportRef"
          :design-id="designId"
          :revision-id="revisionId"
          :export-blocked="exportBlocked"
          :checkpoint="() => checkpoint()"
          :ensure-design="() => ensureDesign()"
          :login-with-claim="() => loginWithClaim()"
        />
      </aside>
    </div>
  </AppShell>
</template>

<style scoped>
.wb{
  display:flex;flex-direction:column;gap:12px;padding:12px clamp(8px,2vw,20px) 24px;
  min-height:calc(100vh - 64px);background:var(--bc-paper);font-family:var(--bc-font-ui);
  position:relative;
}
.alerts{display:flex;flex-direction:column;gap:6px}
.warn{margin:0;padding:8px 12px;border-radius:8px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:12px}
.warn.soft{background:var(--bc-warn-bg);border-color:var(--bc-warn-line);color:var(--bc-warn)}
.warn.engine{border-left:3px solid #c2410c}
.warn.drift{border-left:3px solid #b91c1c}
.warn.fidelity{border-left:3px solid #a16207}
.warn.locked{border-left:3px solid #0369a1}
.warn.unverified{border-left:3px solid #c2410c}
.layout{
  display:grid;grid-template-columns:260px minmax(0,1fr) 260px;gap:12px;flex:1;min-height:0
}
.layout.with-export{grid-template-columns:240px minmax(0,1fr) 220px}
.left,.right,.canvas,.canvas-wrap{min-height:0}
.center{display:flex;flex-direction:column;min-height:0}
.canvas-wrap{
  position:sticky;top:76px;flex:0 1 auto;height:calc(100vh - 190px);min-height:420px
}
.canvas-badge{
  position:absolute;z-index:2;top:8px;left:8px;padding:4px 8px;border-radius:6px;
  background:rgba(255,255,255,.92);border:1px solid var(--bc-line);font-size:11px;color:var(--bc-ink-muted);
  pointer-events:none;max-width:calc(100% - 16px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap
}
.center .canvas{height:100%;min-height:420px}
.right{display:flex;flex-direction:column;gap:12px}
.note{background:#fff;border:1px solid var(--bc-line);border-radius:12px;padding:12px;font-size:12px;color:var(--bc-ink-muted)}
.mobile-tabs{display:none}
.export-backdrop{
  position:fixed;inset:0;background:rgba(15,23,42,.35);z-index:35;
}
.export-drawer{
  background:#fff;border:1px solid var(--bc-line);border-radius:12px;padding:12px;
  display:flex;flex-direction:column;gap:8px;min-height:0;
}
.export-drawer-bar{display:flex;align-items:center;justify-content:space-between;gap:8px}
.export-drawer-bar .ghost{
  height:32px;padding:0 10px;border-radius:8px;border:1px solid var(--bc-line-strong);background:#fff;cursor:pointer;
}
@media (min-width: 961px){
  .export-drawer{
    position:fixed;top:76px;right:12px;bottom:12px;width:min(340px,34vw);
    z-index:30;overflow:auto;box-shadow:0 8px 24px rgba(15,23,42,.08);
  }
  .export-drawer:not(.open){display:none}
  .layout.with-export{margin-right:min(352px,calc(34vw + 12px))}
}
@media (max-width: 960px){
  .layout{grid-template-columns:1fr;margin-right:0}
  .canvas-wrap{position:static;height:70vh}
  .center .canvas{height:100%}
  .mobile-tabs{display:flex;gap:6px;margin-bottom:8px}
  .mobile-tabs button{flex:1;height:32px;border-radius:8px;border:1px solid var(--bc-line-strong);background:#fff}
  .mobile-tabs button.on{background:var(--bc-steel);color:#fff;border-color:var(--bc-steel)}
  .hideMobile{display:none !important}
  .export-drawer.narrow{
    position:fixed;left:0;right:0;bottom:0;top:auto;max-height:min(78vh,640px);
    z-index:40;border-radius:16px 16px 0 0;transform:translateY(110%);
    transition:transform .2s ease;overflow:auto;
  }
  .export-drawer.narrow.open{transform:translateY(0)}
}
</style>
