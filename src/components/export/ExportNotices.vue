<script setup lang="ts">
/**
 * What the export did to the artwork: layers left out, text converted to curves, where the inside
 * print went. The geometry service reports these as plain English lines in
 * `preflight.artwork_warnings`; they are matched here and shown in the user's language. A line that
 * matches nothing is shown as it is rather than hidden.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ preflight?: Record<string, unknown> | null }>()
const { t } = useI18n()

type Rule = { test: RegExp; key: string; named: boolean; info?: boolean }
const RULES: Rule[] = [
  { test: /inside artwork is on its own sheet/i, key: 'insideSheet', named: false, info: true },
  { test: /text converted to curves/i, key: 'curves', named: true, info: true },
  { test: /cannot draw/i, key: 'noGlyph', named: true },
  { test: /image file missing/i, key: 'imageMissing', named: true },
  { test: /image could not be embedded/i, key: 'imageEmbed', named: true },
  { test: /image left out \(export size limit\)/i, key: 'imageBudget', named: true },
  { test: /image could not be read/i, key: 'imageRead', named: true },
  { test: /not found or not ready/i, key: 'imageNotReady', named: false },
  { test: /panel .* not found/i, key: 'panelMissing', named: true },
  { test: /empty size/i, key: 'emptySize', named: true },
]

const notices = computed(() => {
  const raw = props.preflight?.artwork_warnings
  const lines = Array.isArray(raw) ? raw.map((x) => String(x)) : []
  const seen = new Set<string>()
  const out: Array<{ text: string; info: boolean }> = []
  for (const line of lines) {
    const rule = RULES.find((r) => r.test.test(line))
    const i = line.indexOf(': ')
    const name = i > 0 ? line.slice(0, i) : ''
    const text = rule ? t(`exportNotice.${rule.key}`, { name: rule.named ? name : '' }) : line
    if (seen.has(text)) continue
    seen.add(text)
    out.push({ text, info: !!rule?.info })
  }
  return out
})
</script>

<template>
  <div v-if="notices.length" class="export-notices" role="status">
    <p class="en-title">{{ t('exportNotice.title') }}</p>
    <ul>
      <li v-for="(n, i) in notices" :key="i" :class="{ info: n.info }">{{ n.text }}</li>
    </ul>
  </div>
</template>

<style scoped>
.export-notices{margin:8px 0 0;padding:8px 10px;border:1px solid var(--bc-warn-line,#fed7aa);border-radius:8px;background:var(--bc-warn-bg,#fff7ed);font-size:12px;line-height:1.5}
.en-title{margin:0 0 4px;font-weight:600;color:var(--bc-warn,#9a3412)}
ul{margin:0;padding-left:16px}
li{color:var(--bc-warn,#9a3412)}
li.info{color:var(--bc-ink-muted,#475467)}
</style>
