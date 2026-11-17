<template>
  <div class="thumb" :aria-label="alt">
    <img v-if="url" :src="url" :alt="alt" />
    <span v-else class="ph">{{ placeholder }}</span>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { API_BASE } from '../api/client'
import { fetchAssetThumbnailObjectUrl } from '../api/designs'

const props = defineProps<{
  assetId?: string | null
  ready?: boolean
  /** Fallback when no image layer thumbnail: design dieline SVG endpoint */
  designId?: string | null
  dielineReady?: boolean
  alt?: string
  placeholder?: string
}>()

const url = ref<string | null>(null)
let objectUrl: string | null = null

function revoke() {
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl)
    objectUrl = null
  }
  url.value = null
}

async function fetchDielineObjectUrl(designId: string): Promise<string | null> {
  const res = await fetch(`${API_BASE}/designs/${designId}/dieline-thumbnail/`, {
    credentials: 'include',
    headers: { Accept: 'image/svg+xml,image/*,*/*' },
  })
  if (!res.ok) return null
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

async function load() {
  revoke()
  if (props.assetId && props.ready) {
    const next = await fetchAssetThumbnailObjectUrl(props.assetId)
    if (next) {
      objectUrl = next
      url.value = next
      return
    }
  }
  if (props.designId && props.dielineReady) {
    const next = await fetchDielineObjectUrl(props.designId)
    if (next) {
      objectUrl = next
      url.value = next
    }
  }
}

watch(
  () => [props.assetId, props.ready, props.designId, props.dielineReady] as const,
  () => {
    void load()
  },
  { immediate: true },
)

onBeforeUnmount(revoke)
</script>

<style scoped>
.thumb{
  width:64px;height:64px;flex:0 0 64px;border-radius:10px;overflow:hidden;
  background:#e8eef0;border:1px solid #d5e0e4;display:grid;place-items:center;
}
.thumb img{width:100%;height:100%;object-fit:cover;display:block}
.ph{font-size:11px;color:#8a9aa3;text-align:center;padding:4px;line-height:1.2}
</style>
