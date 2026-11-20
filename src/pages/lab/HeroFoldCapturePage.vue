<template>
  <div class="capture-root">
    <div ref="hostRef" class="host" />
    <p class="status">{{ status }}</p>
  </div>
</template>

<script setup lang="ts">
/**
 * Dev-only capture surface for homepage hero fold video.
 * Playwright drives frame stepping via window.__HERO_CAPTURE__.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { resolveEngineMaterialId } from '../../../packages/geometry-engine/materialProfiles.js'
import { buildPreviewKnifeFromSlug } from '../../components/home/buildPreviewKnife'

const SLUG = 'import-folding-100021'
const W = 960
const H = 768
const FPS = 30
const DURATION_S = 7.5
const TOTAL_FRAMES = Math.round(DURATION_S * FPS)

const hostRef = ref<HTMLElement | null>(null)
const status = ref('init')

type SceneApi = {
  setKnife: (knife: unknown, thickness: number, materialId?: string) => Promise<void>
  setProgress: (pct: number) => void
  setViewFromDir: (x: number, y: number, z: number) => void
  setControlsEnabled: (on: boolean) => void
  getCanvas: () => HTMLCanvasElement | null
  dispose: () => void
}

let scene: SceneApi | null = null
let disposed = false

declare global {
  interface Window {
    __HERO_CAPTURE__?: {
      status: string
      error?: string
      totalFrames: number
      fps: number
      width: number
      height: number
      durationS: number
      /** Apply storyboard at frame index; returns JPEG data URL. */
      renderFrame: (index: number) => Promise<string>
    }
  }
}

function setStatus(s: string, error?: string) {
  status.value = s
  if (window.__HERO_CAPTURE__) {
    window.__HERO_CAPTURE__.status = s
    if (error) window.__HERO_CAPTURE__.error = error
  }
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function lerpDir(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
}

function sampleAt(tSec: number): { progress: number; dir: [number, number, number] } {
  const top: [number, number, number] = [0.05, -1, 0.08]
  const iso: [number, number, number] = [0.8, -0.9, 1]
  if (tSec < 1.0) return { progress: 0, dir: top }
  if (tSec < 2.2) {
    const u = easeInOut((tSec - 1.0) / 1.2)
    return { progress: 0, dir: lerpDir(top, iso, u) }
  }
  if (tSec < 5.2) {
    const u = easeInOut((tSec - 2.2) / 3.0)
    return { progress: u * 100, dir: iso }
  }
  if (tSec < 6.0) return { progress: 100, dir: iso }
  const u = easeInOut((tSec - 6.0) / 1.5)
  return { progress: (1 - u) * 100, dir: lerpDir(iso, top, u) }
}

function waitFrames(n: number) {
  return new Promise<void>((resolve) => {
    let left = n
    const tick = () => {
      left -= 1
      if (left <= 0) resolve()
      else requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

async function renderFrame(index: number): Promise<string> {
  if (!scene) throw new Error('scene not ready')
  const canvas = scene.getCanvas()
  if (!canvas) throw new Error('canvas missing')
  const tSec = Math.min(DURATION_S, Math.max(0, index) / FPS)
  const sample = sampleAt(tSec)
  scene.setProgress(sample.progress)
  scene.setViewFromDir(...sample.dir)
  await waitFrames(2)
  return canvas.toDataURL('image/jpeg', 0.9)
}

async function boot() {
  setStatus('loading')
  try {
    const host = hostRef.value
    if (!host) throw new Error('host missing')
    host.style.width = `${W}px`
    host.style.height = `${H}px`

    const built = await buildPreviewKnifeFromSlug(SLUG)
    if (disposed) return

    const { createKnifeScene } = await import('../../lab/knifeScene.js')
    if (disposed) return

    scene = createKnifeScene(host, {
      materialId: resolveEngineMaterialId(built.materialId),
      background: 0xeef6f6,
    }) as SceneApi
    scene.setControlsEnabled(false)

    await scene.setKnife(built.knife, built.thicknessMm, resolveEngineMaterialId(built.materialId))
    scene.setProgress(0)
    scene.setViewFromDir(0.05, -1, 0.08)
    await waitFrames(6)

    window.__HERO_CAPTURE__ = {
      status: 'ready',
      totalFrames: TOTAL_FRAMES,
      fps: FPS,
      width: W,
      height: H,
      durationS: DURATION_S,
      renderFrame,
    }
    setStatus('ready')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    window.__HERO_CAPTURE__ = {
      status: 'error',
      error: msg,
      totalFrames: TOTAL_FRAMES,
      fps: FPS,
      width: W,
      height: H,
      durationS: DURATION_S,
      renderFrame: async () => {
        throw new Error(msg)
      },
    }
    setStatus('error', msg)
  }
}

onMounted(() => {
  void boot()
})

onBeforeUnmount(() => {
  disposed = true
  try {
    scene?.dispose()
  } catch {
    /* ignore */
  }
  scene = null
})
</script>

<style scoped>
.capture-root {
  min-height: 100vh;
  margin: 0;
  padding: 16px;
  background: #0b1f1f;
  color: #e8f2f2;
  font: 14px/1.4 system-ui, sans-serif;
}
.host {
  width: 960px;
  height: 768px;
  margin: 0 auto;
  background: #eef6f6;
  overflow: hidden;
}
.status {
  text-align: center;
  margin-top: 12px;
}
</style>
