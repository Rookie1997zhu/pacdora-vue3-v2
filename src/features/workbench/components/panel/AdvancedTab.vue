<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWorkbenchStore } from '../../stores/workbench'
import { useKnifeStore } from '../../stores/knife'
import { templateForManifest } from '../../manifest'
import { useUnit } from '../../composables/useUnit'

const { t, locale } = useI18n()
const wb = useWorkbenchStore()
const knife = useKnifeStore()
const { format } = useUnit()

const defs = computed(() => {
  if (!wb.manifest) return []
  const tpl = templateForManifest(wb.manifest)
  return tpl?.paramDefs || []
})

const groups = computed(() => {
  const map = new Map<string, any[]>()
  for (const d of defs.value) {
    const g = d.group || 'other'
    if (!map.has(g)) map.set(g, [])
    map.get(g)!.push(d)
  }
  return [...map.entries()]
})

const paramState = computed(() => knife.displayKnife?.paramState || {})

function labelOf(d: any) {
  return locale.value?.startsWith('ko') ? (d.labelKo || d.label) : d.label
}

function valueOf(code: string) {
  if (wb.params.advanced[code] != null) return wb.params.advanced[code]
  return paramState.value[code]?.value
}

/** Changed by the user: differs from this box's starting value (or set where the box has none) */
function isManual(code: string) {
  const cur = wb.params.advanced[code]
  if (cur == null) return false
  const preset = wb.manifest?.defaultParams.advanced?.[code]
  if (preset == null) return true
  return Math.abs(cur - preset) > 1e-6
}

function onInput(code: string, raw: string) {
  const n = Number(raw)
  if (!Number.isFinite(n)) return
  wb.setAdvanced(code, n)
}

function focusParam(code: string, affects?: string[]) {
  wb.setHover({ param: code, face: affects?.[0] || null })
}
</script>

<template>
  <div class="tab">
    <div v-if="!defs.length" class="empty">{{ t('workbench.noAdvanced') }}</div>
    <template v-else>
      <div class="toolbar">
        <button type="button" class="link" @click="wb.resetAdvanced()">{{ t('workbench.resetAll') }}</button>
      </div>
      <details v-for="[group, items] in groups" :key="group" open class="group">
        <summary>{{ group }}</summary>
        <div v-for="d in items" :key="d.code" class="field" @focusin="focusParam(d.code, d.affects)">
          <div class="head">
            <label :for="'p-'+d.code">{{ labelOf(d) }} <code>{{ d.code }}</code></label>
            <button v-if="isManual(d.code)" type="button" class="link" @click="wb.setAdvanced(d.code, null)">{{ t('workbench.restoreAuto') }}</button>
          </div>
          <input
            :id="'p-'+d.code"
            type="number"
            :step="d.step || 0.5"
            :value="valueOf(d.code)"
            @change="onInput(d.code, ($event.target as HTMLInputElement).value)"
          />
          <div class="meta">
            <span v-if="paramState[d.code]">
              {{ t('workbench.auto') }} {{ format(paramState[d.code].auto) }}
              · {{ paramState[d.code].min }}–{{ paramState[d.code].max }}
            </span>
            <span v-if="isManual(d.code)" class="manual">{{ t('workbench.manual') }}</span>
          </div>
        </div>
      </details>
    </template>
  </div>
</template>

<style scoped>
.tab{display:flex;flex-direction:column;gap:10px}
.empty{font-size:13px;color:var(--bc-ink-muted);padding:12px 0}
.toolbar{display:flex;justify-content:flex-end}
.group{border:1px solid var(--bc-line);border-radius:8px;padding:8px 10px;background:#fff}
.group summary{cursor:pointer;font-weight:600;font-size:13px}
.field{margin-top:10px;display:flex;flex-direction:column;gap:4px}
.head{display:flex;justify-content:space-between;align-items:center;font-size:12px}
.head code{font-size:10px;color:var(--bc-ink-faint);margin-left:4px}
input{height:32px;border:1px solid var(--bc-line-strong);border-radius:6px;padding:0 8px}
.meta{font-size:11px;color:var(--bc-ink-muted);display:flex;gap:8px}
.manual{color:var(--bc-steel);font-weight:600}
.link{border:0;background:none;color:var(--bc-steel);cursor:pointer;font-size:12px}
</style>
