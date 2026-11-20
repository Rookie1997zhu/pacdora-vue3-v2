<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWorkbenchStore } from '../../stores/workbench'
import { useKnifeStore } from '../../stores/knife'
import { workbenchMaterialOptions } from '../../manifest'
import { getMaterialProfile } from '../../../../../packages/geometry-engine/materialProfiles.js'
import { useUnit } from '../../composables/useUnit'
import DimInput from './DimInput.vue'
import ValidationCard from './ValidationCard.vue'

const { t, locale } = useI18n()
const wb = useWorkbenchStore()
const knife = useKnifeStore()
const { unit } = useUnit()

const materials = computed(() => wb.manifest ? workbenchMaterialOptions(wb.manifest) : [])
const limits = computed(() => knife.limits || {})
/**
 * Size-interpolated boxes replay the reference dieline, whose board thickness is fixed (and differs per
 * layer on rigid boxes: grey board vs wrapping paper). Show that value instead of an input that has no effect.
 */
const fixedThickness = computed(() => {
  const k = knife.displayKnife
  const v = k?.sampled ? Number(k.dimensions?.thickness) : NaN
  return Number.isFinite(v) && v > 0 ? v : null
})

function outOfRange(key: 'length' | 'width' | 'height', v: number) {
  const r = limits.value?.[key]
  if (!Array.isArray(r)) return false
  return v < r[0] || v > r[1]
}

function onSizeMode(mode: 'manufacturing' | 'inner' | 'outer') {
  const k = knife.displayKnife
  if (!k?.dimensions) {
    wb.setSizeMode(mode)
    return
  }
  const src = mode === 'manufacturing' ? k.dimensions.panel : mode === 'outer' ? k.dimensions.outer : k.dimensions.inner
  wb.setSizeMode(mode, src)
}

function onMaterial(id: string) {
  const p = getMaterialProfile(id)
  wb.setMaterial(id, p?.thickness?.default)
}

function materialLabel(p: any) {
  return locale.value?.startsWith('ko') ? p.labelKo : p.labelZh
}
</script>

<template>
  <fieldset class="tab locked-fieldset" :disabled="!!wb.manifest?.locked">
    <p v-if="wb.manifest?.locked" class="hint locked-hint">{{ t('workbench.lockedPanelHint') }}</p>
    <section class="group">
      <div class="row-head">
        <h3>{{ t('workbench.groupSizeMode') }}</h3>
      </div>
      <div class="seg">
        <button type="button" :class="{ on: wb.params.sizeMode === 'manufacturing' }" @click="onSizeMode('manufacturing')">{{ t('workbench.modeMfg') }}</button>
        <button type="button" :class="{ on: wb.params.sizeMode === 'inner' }" @click="onSizeMode('inner')">{{ t('workbench.modeInner') }}</button>
        <button type="button" :class="{ on: wb.params.sizeMode === 'outer' }" @click="onSizeMode('outer')">{{ t('workbench.modeOuter') }}</button>
      </div>
    </section>

    <section class="group">
      <div class="row-head">
        <h3>{{ t('workbench.groupOuterDims') }}</h3>
        <div class="unit-toggle" role="group" :aria-label="t('workbench.unit')">
          <button type="button" :class="{ on: unit === 'mm' }" @click="wb.setDisplayUnit('mm')">mm</button>
          <button type="button" :class="{ on: unit === 'in' }" @click="wb.setDisplayUnit('in')">in</button>
        </div>
      </div>
      <div class="grid">
        <DimInput
          :label="t('workbench.length')"
          :model-value="wb.params.lengthMm"
          :min="limits.length?.[0]"
          :max="limits.length?.[1]"
          :invalid="outOfRange('length', wb.params.lengthMm)"
          @update:model-value="wb.setDim('lengthMm', $event)"
        />
        <DimInput
          :label="t('workbench.width')"
          :model-value="wb.params.widthMm"
          :min="limits.width?.[0]"
          :max="limits.width?.[1]"
          :invalid="outOfRange('width', wb.params.widthMm)"
          @update:model-value="wb.setDim('widthMm', $event)"
        />
        <DimInput
          :label="t('workbench.height')"
          :model-value="wb.params.heightMm"
          :min="limits.height?.[0]"
          :max="limits.height?.[1]"
          :invalid="outOfRange('height', wb.params.heightMm)"
          @update:model-value="wb.setDim('heightMm', $event)"
        />
      </div>
    </section>

    <section class="group">
    <h3>{{ t('workbench.groupMaterial') }}</h3>
    <select :value="wb.params.materialId" @change="onMaterial(($event.target as HTMLSelectElement).value)">
      <option v-for="m in materials" :key="m!.id" :value="m!.id">{{ materialLabel(m) }}</option>
    </select>

    <div v-if="fixedThickness !== null" class="fixed-thickness">
      <span class="ft-label">{{ t('workbench.thickness') }}</span>
      <span class="ft-value">{{ fixedThickness }} mm</span>
      <p class="ft-note">{{ t('workbench.thicknessFixedNote') }}</p>
    </div>
    <DimInput
      v-else
      :label="t('workbench.thickness')"
      :model-value="wb.params.thicknessMm"
      :min="getMaterialProfile(wb.params.materialId)?.thickness.min"
      :max="getMaterialProfile(wb.params.materialId)?.thickness.max"
      :step="getMaterialProfile(wb.params.materialId)?.thickness.step || 0.1"
      @update:model-value="wb.setThickness($event)"
    />

    <div v-if="wb.manifest?.family === 'corrugated'" class="flute">
      <span>{{ t('workbench.fluteDir') }}</span>
      <div class="seg">
        <button type="button" :class="{ on: wb.params.fluteDirection === 'L' }" @click="wb.setFluteDirection('L')">L</button>
        <button type="button" :class="{ on: wb.params.fluteDirection === 'W' }" @click="wb.setFluteDirection('W')">W</button>
      </div>
    </div>

    <DimInput
      :label="t('workbench.bleed')"
      :model-value="wb.params.bleedInputMm"
      :min="0"
      :max="10"
      :step="0.5"
      @update:model-value="wb.setBleed($event)"
    />

    <p class="hint">{{ t('workbench.allowanceHint') }}</p>
    </section>

    <ValidationCard />
  </fieldset>
</template>

<style scoped>
.locked-fieldset{border:0;margin:0;padding:0;min-width:0}
.locked-fieldset:disabled{opacity:.6}
.locked-hint{color:var(--bc-warn);background:var(--bc-warn-bg);border:1px solid var(--bc-warn-line);border-radius:8px;padding:6px 8px;opacity:1}
.tab{display:flex;flex-direction:column;gap:12px}
.fixed-thickness{display:grid;grid-template-columns:1fr auto;gap:2px 8px;align-items:baseline}
.ft-label{color:var(--bc-ink-muted);font-size:12px}
.ft-value{font-variant-numeric:tabular-nums;font-weight:600}
.ft-note{grid-column:1/-1;margin:0;color:var(--bc-ink-muted);font-size:11px}
.group{display:flex;flex-direction:column;gap:8px;padding-bottom:10px;border-bottom:1px solid var(--bc-line)}
.group:last-of-type{border-bottom:0;padding-bottom:0}
h3{margin:4px 0 0;font-size:13px;color:var(--bc-ink)}
.row-head{display:flex;align-items:center;justify-content:space-between}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.grid > :last-child{grid-column:1/-1}
.seg{display:flex;gap:4px}
.seg button,.unit-toggle button{
  flex:1;height:30px;border:1px solid var(--bc-line-strong);border-radius:6px;background:#fff;
  font-size:12px;cursor:pointer;color:var(--bc-ink-muted)
}
.seg button.on,.unit-toggle button.on{background:var(--bc-steel-soft);border-color:var(--bc-steel);color:var(--bc-steel);font-weight:600}
.unit-toggle{display:flex;gap:2px}
select{height:32px;border:1px solid var(--bc-line-strong);border-radius:6px;padding:0 8px}
.flute{display:flex;flex-direction:column;gap:6px;font-size:12px;color:var(--bc-ink-muted)}
.hint{margin:0;font-size:11px;color:var(--bc-ink-faint)}
</style>
