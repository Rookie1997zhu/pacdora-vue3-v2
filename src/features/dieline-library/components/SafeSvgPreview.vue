<template>
  <div class="preview" :class="{ compact }">
    <div v-if="!compact" class="toggles">
      <label class="toggle">
        <input v-model="showCut" type="checkbox" :disabled="!hasCut" />
        <span>{{ t('library.layerCut') }}</span>
      </label>
      <label class="toggle">
        <input v-model="showCrease" type="checkbox" :disabled="!hasCrease" />
        <span>{{ t('library.layerCrease') }}</span>
      </label>
      <span v-if="!hasCut && !hasCrease && ready" class="hint">{{ t('library.layersUnlabeled') }}</span>
    </div>
    <div ref="host" class="host" :aria-busy="loading" />
    <p v-if="error && !compact" class="err">{{ error }}</p>
    <p v-else-if="loading && !compact" class="hint">{{ t('studio.loading') }}</p>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchRevisionPreviewBlob } from '../api'

const props = withDefaults(
  defineProps<{ revisionId: string | null; compact?: boolean }>(),
  { compact: false },
)

const { t } = useI18n()
const host = ref<HTMLElement | null>(null)
const loading = ref(false)
const ready = ref(false)
const error = ref('')
const showCut = ref(true)
const showCrease = ref(true)
const hasCut = ref(false)
const hasCrease = ref(false)

const CUT_RE = /(cut|cutting|knife|dieline)/i
const CREASE_RE = /(crease|score|fold|press)/i

let svgRoot: SVGElement | null = null

function clearHost() {
  if (host.value) host.value.innerHTML = ''
  svgRoot = null
  hasCut.value = false
  hasCrease.value = false
  ready.value = false
}

function markLayers(root: SVGElement) {
  const nodes = root.querySelectorAll('*')
  for (const node of nodes) {
    const el = node as Element
    const token = `${el.getAttribute('id') || ''} ${el.getAttribute('class') || ''} ${el.tagName}`
    if (CUT_RE.test(token)) {
      el.setAttribute('data-bc-layer', 'cut')
      hasCut.value = true
    } else if (CREASE_RE.test(token)) {
      el.setAttribute('data-bc-layer', 'crease')
      hasCrease.value = true
    }
  }
}

function applyVisibility() {
  if (!svgRoot) return
  svgRoot.querySelectorAll('[data-bc-layer="cut"]').forEach((el) => {
    ;(el as HTMLElement).style.display = showCut.value ? '' : 'none'
  })
  svgRoot.querySelectorAll('[data-bc-layer="crease"]').forEach((el) => {
    ;(el as HTMLElement).style.display = showCrease.value ? '' : 'none'
  })
}

async function loadPreview(revisionId: string) {
  loading.value = true
  error.value = ''
  clearHost()
  try {
    const blob = await fetchRevisionPreviewBlob(revisionId)
    const text = await blob.text()
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
    if (doc.querySelector('parsererror')) {
      throw new Error('invalid_svg')
    }
    const svg = doc.documentElement
    if (!svg || svg.tagName.toLowerCase() !== 'svg') {
      throw new Error('not_svg')
    }
    // Drop scripts/foreign objects if any slipped through.
    svg.querySelectorAll('script, foreignObject').forEach((n) => n.remove())
    const imported = document.importNode(svg, true) as SVGElement
    imported.setAttribute('role', 'img')
    imported.setAttribute('aria-label', t('library.preview'))
    imported.style.width = '100%'
    imported.style.height = props.compact ? '100%' : 'auto'
    imported.style.maxHeight = props.compact ? '100%' : '480px'
    imported.style.objectFit = 'contain'
    markLayers(imported)
    await nextTick()
    host.value?.appendChild(imported)
    svgRoot = imported
    ready.value = true
    applyVisibility()
  } catch {
    error.value = t('library.previewUnavailable')
  } finally {
    loading.value = false
  }
}

watch(
  () => props.revisionId,
  (id) => {
    if (!id) {
      clearHost()
      error.value = ''
      return
    }
    void loadPreview(id)
  },
  { immediate: true },
)

watch([showCut, showCrease], () => applyVisibility())

onBeforeUnmount(() => clearHost())
</script>

<style scoped>
.preview {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.preview.compact {
  gap: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.toggles {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--bc-ink);
}

.host {
  min-height: 180px;
  border: 1px solid var(--bc-line);
  border-radius: var(--bc-radius);
  background: var(--bc-slot);
  padding: 12px;
  overflow: auto;
}

.preview.compact .host {
  min-height: 0;
  height: 100%;
  border: 0;
  border-radius: 0;
  background: transparent;
  padding: 10px;
  overflow: hidden;
  display: grid;
  place-items: center;
}

.preview.compact .host :deep(svg) {
  max-width: 100%;
  max-height: 100%;
}

.hint {
  margin: 0;
  font-size: 12px;
  color: var(--bc-ink-muted);
}

.err {
  margin: 0;
  font-size: 13px;
  color: var(--bc-danger, #b42318);
}
</style>
