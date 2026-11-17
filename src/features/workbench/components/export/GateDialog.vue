<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const props = defineProps<{
  kind: 'login' | 'quota' | 'validation' | null
  detail?: string
}>()
const emit = defineEmits<{ close: []; login: []; upgrade: [] }>()
const { t } = useI18n()
const router = useRouter()

function onUpgrade() {
  emit('upgrade')
  router.push({ name: 'upgrade' })
}
</script>

<template>
  <div v-if="kind" class="mask" role="dialog" aria-modal="true" @click.self="emit('close')">
    <div class="dlg">
      <h3 v-if="kind === 'login'">{{ t('workbench.gateLoginTitle') }}</h3>
      <h3 v-else-if="kind === 'quota'">{{ t('workbench.gateQuotaTitle') }}</h3>
      <h3 v-else>{{ t('workbench.gateValidationTitle') }}</h3>
      <p>{{ detail || (kind === 'login' ? t('workbench.gateLoginBody') : kind === 'quota' ? t('workbench.gateQuotaBody') : t('workbench.gateValidationBody')) }}</p>
      <div class="actions">
        <button type="button" class="ghost" @click="emit('close')">{{ t('workbench.close') }}</button>
        <button v-if="kind === 'login'" type="button" class="primary" @click="emit('login')">{{ t('site.login') }}</button>
        <button v-else-if="kind === 'quota'" type="button" class="primary" @click="onUpgrade">{{ t('workbench.upgrade') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mask{position:fixed;inset:0;background:rgba(15,23,42,.35);display:grid;place-items:center;z-index:40;padding:16px}
.dlg{width:min(420px,100%);background:#fff;border-radius:14px;border:1px solid var(--bc-line);padding:18px;box-shadow:0 12px 40px rgba(0,0,0,.12)}
h3{margin:0 0 8px;font-size:16px;color:var(--bc-ink)}
p{margin:0;font-size:13px;color:var(--bc-ink-muted);line-height:1.5}
.actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}
button{height:34px;padding:0 14px;border-radius:8px;border:1px solid var(--bc-line-strong);background:#fff;cursor:pointer;font-size:13px}
button.primary{background:var(--bc-steel);color:#fff;border-color:var(--bc-steel)}
button.ghost{color:var(--bc-ink-muted)}
</style>
