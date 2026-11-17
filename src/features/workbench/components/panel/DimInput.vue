<script setup lang="ts">
import { ref, watch } from 'vue'
import { useUnit } from '../../composables/useUnit'

const props = defineProps<{
  label: string
  modelValue: number
  min?: number
  max?: number
  step?: number
  invalid?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [number] }>()

const { format, parse, unit } = useUnit()
const text = ref(format(props.modelValue))
watch(() => [props.modelValue, unit.value], () => {
  text.value = format(props.modelValue)
})

function commit() {
  const v = parse(text.value)
  if (v == null) {
    text.value = format(props.modelValue)
    return
  }
  emit('update:modelValue', Math.round(v * 1000) / 1000)
}

function nudge(dir: number, e: KeyboardEvent | MouseEvent) {
  const step = (e.shiftKey ? 5 : (props.step ?? 0.5)) * (unit.value === 'in' ? 25.4 : 1) * (dir)
  // For inch display, step in inch then convert — but store mm
  const delta = unit.value === 'in'
    ? (e.shiftKey ? 0.25 : 0.05) * 25.4 * dir
    : (e.shiftKey ? 5 : (props.step ?? 0.5)) * dir
  void step
  emit('update:modelValue', Math.round((props.modelValue + delta) * 1000) / 1000)
}
</script>

<template>
  <label class="dim" :class="{ invalid }">
    <span class="dim-label">{{ label }}</span>
    <div class="dim-row">
      <button type="button" class="nudge" @click="nudge(-1, $event)" aria-label="-">−</button>
      <input
        v-model="text"
        type="text"
        inputmode="decimal"
        @keydown.enter.prevent="commit"
        @blur="commit"
        @keydown.up.prevent="nudge(1, $event)"
        @keydown.down.prevent="nudge(-1, $event)"
      />
      <button type="button" class="nudge" @click="nudge(1, $event)" aria-label="+">+</button>
    </div>
    <span v-if="min != null && max != null" class="range">{{ format(min) }}–{{ format(max) }} {{ unit }}</span>
  </label>
</template>

<style scoped>
.dim{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--bc-ink-muted)}
.dim-label{font-weight:600;color:var(--bc-ink)}
.dim-row{display:flex;align-items:center;gap:4px}
.dim-row input{
  flex:1;height:32px;border:1px solid var(--bc-line-strong);border-radius:6px;
  padding:0 8px;font:inherit;color:var(--bc-ink);background:#fff;
}
.dim.invalid input{border-color:var(--bc-danger);background:#fdf1ef}
.nudge{
  width:28px;height:32px;border:1px solid var(--bc-line-strong);border-radius:6px;
  background:#fff;cursor:pointer;color:var(--bc-ink);
}
.range{font-size:11px}
</style>
