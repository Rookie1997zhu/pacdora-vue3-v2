<template>
  <ConsoleShell :title="t('console.nav.ai')">
    <section class="panel">
      <h2>{{ t('console.ai.config') }}</h2>
      <p class="hint">{{ t('console.ai.source') }}: {{ form.source }} · masked: {{ form.api_key_masked || '—' }}</p>
      <label>
        provider
        <select v-model="form.provider">
          <option value="disabled">disabled</option>
          <option value="gemini">gemini</option>
          <option value="openai">openai</option>
          <option value="test">test</option>
        </select>
      </label>
      <label>
        model
        <input v-model="form.model" />
      </label>
      <label>
        gemini_base_url
        <input v-model="form.gemini_base_url" />
      </label>
      <label>
        openai_images_url
        <input v-model="form.openai_images_url" />
      </label>
      <label>
        api_key
        <input v-model="apiKeyInput" type="password" :placeholder="t('console.ai.keyPlaceholder')" autocomplete="off" />
      </label>
      <div class="actions">
        <button type="button" @click="save">{{ t('console.ai.save') }}</button>
        <button type="button" class="ghost" @click="test">{{ t('console.ai.test') }}</button>
      </div>
      <p v-if="msg" class="msg">{{ msg }}</p>
    </section>

    <section class="panel">
      <h2>{{ t('console.ai.jobs') }}</h2>
      <button type="button" class="ghost" @click="loadJobs">{{ t('console.refresh') }}</button>
      <table>
        <thead><tr><th>op</th><th>status</th><th>provider</th><th>error</th><th>created</th></tr></thead>
        <tbody>
          <tr v-for="j in jobs" :key="j.id">
            <td>{{ j.operation }}</td>
            <td>{{ j.status }}</td>
            <td>{{ j.provider }}</td>
            <td>{{ j.error_code }}</td>
            <td>{{ j.created_at }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </ConsoleShell>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { consoleApi } from '../../api/console'
import ConsoleShell from '../../components/console/ConsoleShell.vue'

const { t } = useI18n()
const form = reactive<any>({
  provider: 'disabled',
  model: '',
  gemini_base_url: '',
  openai_images_url: '',
  api_key_masked: '',
  source: 'env',
})
const apiKeyInput = ref('')
const msg = ref('')
const jobs = ref<any[]>([])

async function loadConfig() {
  const data = await consoleApi.aiConfig()
  Object.assign(form, data)
  form.model = data.model || ''
}

async function save() {
  msg.value = ''
  const body: Record<string, unknown> = {
    provider: form.provider,
    model: form.model,
    gemini_base_url: form.gemini_base_url,
    openai_images_url: form.openai_images_url,
  }
  if (apiKeyInput.value.trim()) body.api_key = apiKeyInput.value.trim()
  const data = await consoleApi.saveAiConfig(body)
  Object.assign(form, data)
  apiKeyInput.value = ''
  msg.value = t('console.ai.saved')
}

async function test() {
  msg.value = ''
  const data = await consoleApi.testAiConfig()
  msg.value = JSON.stringify(data)
}

async function loadJobs() {
  const data = await consoleApi.aiJobs({ page_size: 30 })
  jobs.value = data.items
}

onMounted(async () => {
  await loadConfig()
  await loadJobs()
})
</script>

<style scoped>
.panel{background:#fff;border:1px solid var(--bc-line);border-radius:var(--bc-radius);padding:16px;margin-bottom:16px}
h2{margin:0 0 12px;font-size:16px}
.hint{margin:0 0 12px;font-size:12px;color:var(--bc-ink-muted)}
label{display:flex;flex-direction:column;gap:4px;font-size:12px;margin-bottom:10px}
input,select,button{font:inherit;padding:8px 10px;border-radius:var(--bc-radius-sm);border:1px solid var(--bc-line-strong)}
.actions{display:flex;gap:8px}
button{cursor:pointer;background:var(--bc-ink);color:#fff;border:0;font-weight:600}
button.ghost{background:#fff;color:var(--bc-ink);border:1px solid var(--bc-line-strong)}
.msg{margin-top:10px;font-size:13px;color:var(--bc-steel);word-break:break-all}
table{width:100%;border-collapse:collapse;font-size:13px;margin-top:10px}
th,td{border-bottom:1px solid var(--bc-line);padding:8px;text-align:left}
</style>
