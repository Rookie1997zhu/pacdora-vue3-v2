import { ref, onMounted, onBeforeUnmount, type Ref } from 'vue'

type Bounds = { minX: number; minY: number; maxX: number; maxY: number }
type FitInsets = { top?: number; right?: number; bottom?: number; left?: number }

/**
 * @param elRef  receives pointer / wheel events
 * @param sizeRef element whose box is the drawing area (defaults to elRef)
 */
export function useViewport(
  elRef: Ref<HTMLElement | null>,
  sizeRef?: Ref<HTMLElement | SVGElement | null>,
) {
  const scale = ref(1)
  const tx = ref(0)
  const ty = ref(0)
  let dragging = false
  let lastX = 0
  let lastY = 0
  let spaceDown = false
  /** true once the user zoomed / panned by hand; auto-fit stops until fit() is called again */
  const userMoved = ref(false)
  let resizeObserver: ResizeObserver | null = null
  let onResize: (() => void) | null = null

  function areaSize() {
    const el = (sizeRef?.value || elRef.value) as Element | null
    if (!el) return { w: 0, h: 0 }
    const r = el.getBoundingClientRect()
    return { w: r.width, h: r.height }
  }

  /** Fit bounds into the drawing area. Returns false when the area has no size yet. */
  function fit(bounds: Bounds, pad = 0.08, insets: FitInsets = {}): boolean {
    if (!bounds) return false
    const { w, h } = areaSize()
    if (w < 8 || h < 8) return false
    const il = insets.left || 0
    const ir = insets.right || 0
    const it = insets.top || 0
    const ib = insets.bottom || 0
    const aw = Math.max(8, w - il - ir)
    const ah = Math.max(8, h - it - ib)
    const bw = Math.max(1, bounds.maxX - bounds.minX)
    const bh = Math.max(1, bounds.maxY - bounds.minY)
    const s = Math.min(aw / bw, ah / bh) * (1 - pad * 2)
    scale.value = s
    tx.value = il + (aw - bw * s) / 2 - bounds.minX * s
    ty.value = it + (ah - bh * s) / 2 - bounds.minY * s
    userMoved.value = false
    return true
  }

  /** Call back whenever the drawing area changes size (and once when it first has a size). */
  function watchResize(cb: () => void) {
    onResize = cb
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault()
    const el = elRef.value
    if (!el) return
    const rect = el.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
    const next = Math.min(40, Math.max(0.05, scale.value * factor))
    const k = next / scale.value
    tx.value = mx - (mx - tx.value) * k
    ty.value = my - (my - ty.value) * k
    scale.value = next
    userMoved.value = true
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button === 1 || spaceDown || e.button === 0 && (e as any).altKey) {
      dragging = true
      lastX = e.clientX
      lastY = e.clientY
      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    }
  }
  function onPointerMove(e: PointerEvent) {
    if (!dragging) return
    tx.value += e.clientX - lastX
    ty.value += e.clientY - lastY
    userMoved.value = true
    lastX = e.clientX
    lastY = e.clientY
  }
  function onPointerUp() {
    dragging = false
  }

  function onKey(e: KeyboardEvent) {
    if (e.code === 'Space') spaceDown = e.type === 'keydown'
    const target = e.target as HTMLElement | null
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
    if (e.type !== 'keydown') return
    if (e.key === '+' || e.key === '=') { scale.value = Math.min(40, scale.value * 1.1); userMoved.value = true }
    if (e.key === '-' || e.key === '_') { scale.value = Math.max(0.05, scale.value / 1.1); userMoved.value = true }
    if (e.key === '0') {/* fit handled by parent */}
  }

  onMounted(() => {
    const el = elRef.value
    el?.addEventListener('wheel', onWheel, { passive: false })
    el?.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    const sizeEl = (sizeRef?.value || el) as Element | null
    if (sizeEl && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => onResize?.())
      resizeObserver.observe(sizeEl)
    }
  })
  onBeforeUnmount(() => {
    const el = elRef.value
    el?.removeEventListener('wheel', onWheel)
    el?.removeEventListener('pointerdown', onPointerDown)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('keydown', onKey)
    window.removeEventListener('keyup', onKey)
    resizeObserver?.disconnect()
    resizeObserver = null
  })

  return { scale, tx, ty, fit, userMoved, watchResize }
}
