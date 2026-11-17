import { computed } from 'vue'
import { useWorkbenchStore } from '../stores/workbench'

const MM_PER_IN = 25.4

export function useUnit() {
  const wb = useWorkbenchStore()
  const unit = computed(() => wb.displayUnit)

  function format(mm: number, digits?: number) {
    if (!Number.isFinite(mm)) return '—'
    if (unit.value === 'in') {
      const d = digits ?? 4
      return (mm / MM_PER_IN).toFixed(d)
    }
    const d = digits ?? 2
    return Number(mm).toFixed(d).replace(/\.?0+$/, (m) => (m.includes('.') ? m.replace(/0+$/, '').replace(/\.$/, '') : m))
  }

  function parse(text: string): number | null {
    const n = Number(String(text).replace(',', '.').trim())
    if (!Number.isFinite(n)) return null
    return unit.value === 'in' ? n * MM_PER_IN : n
  }

  function formatPair(a: number, b: number, c: number) {
    return `${format(a)} × ${format(b)} × ${format(c)} ${unit.value}`
  }

  return { unit, format, parse, formatPair, MM_PER_IN }
}
