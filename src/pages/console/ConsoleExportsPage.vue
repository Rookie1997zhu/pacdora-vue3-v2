<template>
  <ConsoleShell :title="t('console.nav.exports')">
    <div class="toolbar">
      <select v-model="status" @change="load">
        <option value="">all</option>
        <option value="failed">failed</option>
        <option value="queued">queued</option>
        <option value="running">running</option>
        <option value="succeeded">succeeded</option>
        <option value="cancelled">cancelled</option>
      </select>
      <button type="button" @click="load">{{ t('console.refresh') }}</button>
    </div>
    <p v-if="msg" class="msg">{{ msg }}</p>
    <table>
      <thead>
        <tr><th>format</th><th>status</th><th>design</th><th>error</th><th>created</th><th></th></tr>
      </thead>
      <tbody>
        <tr v-for="j in items" :key="j.id">
          <td>{{ j.format }}</td>
          <td>{{ j.status }}</td>
          <td>{{ j.design_name }}</td>
          <td class="err">{{ j.error_code }} {{ j.error_message }}</td>
          <td>{{ j.created_at }}</td>
          <td class="actions">
            <button type="button" @click="retry(j)">retry</button>
            <button type="button" @click="cancel(j)">cancel</button>
          </td>
        </tr>
      </tbody>
    </table>
  </ConsoleShell>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { consoleApi } from '../../api/console'
import ConsoleShell from '../../components/console/ConsoleShell.vue'

const { t } = useI18n()
const items = ref<any[]>([])
const status = ref('failed')
const msg = ref('')

async function load() {
  const data = await consoleApi.exports({ status: status.value, page_size: 50 })
  items.value = data.items
}

async function retry(j: any) {
  msg.value = ''
  try {
    await consoleApi.retryExport(j.id)
    msg.value = `retried ${j.id}`
    await load()
  } catch (e: unknown) {
    msg.value = e instanceof Error ? e.message : 'retry failed'
  }
}

async function cancel(j: any) {
  await consoleApi.cancelExport(j.id)
  await load()
}

onMounted(load)
</script>

<style scoped>
.toolbar{display:flex;gap:8px;margin-bottom:12px}
button,select{font:inherit;padding:8px 10px;border-radius:var(--bc-radius-sm)}
button{cursor:pointer;background:var(--bc-ink);color:#fff;border:0}
table{width:100%;border-collapse:collapse;font-size:13px;background:#fff}
th,td{border-bottom:1px solid var(--bc-line);padding:8px;text-align:left;vertical-align:top}
.actions{display:flex;gap:6px}
.actions button{padding:4px 8px;font-size:12px}
.err{color:var(--bc-danger);max-width:280px}
.msg{color:var(--bc-steel)}
</style>
