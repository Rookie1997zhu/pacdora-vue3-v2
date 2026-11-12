<template>
  <ConsoleShell :title="t('console.nav.orders')">
    <div class="toolbar">
      <select v-model="status" @change="load">
        <option value="">all</option>
        <option value="pending_manual">pending_manual</option>
        <option value="quoted">quoted</option>
        <option value="confirmed">confirmed</option>
        <option value="cancelled">cancelled</option>
      </select>
      <button type="button" @click="load">{{ t('console.refresh') }}</button>
    </div>
    <p v-if="msg" class="msg">{{ msg }}</p>
    <table>
      <thead>
        <tr><th>id</th><th>org</th><th>status</th><th>total</th><th>row</th><th></th></tr>
      </thead>
      <tbody>
        <tr v-for="o in items" :key="o.id">
          <td class="mono">{{ o.id.slice(0, 8) }}</td>
          <td>{{ o.organization_name }}</td>
          <td>{{ o.status }}</td>
          <td>{{ o.total_amount }} {{ o.currency }}</td>
          <td>{{ o.row_version }}</td>
          <td class="actions">
            <button type="button" @click="confirm(o)">confirm</button>
            <button type="button" @click="cancel(o)">cancel</button>
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
const status = ref('pending_manual')
const msg = ref('')

async function load() {
  const data = await consoleApi.orders({ status: status.value, page_size: 50 })
  items.value = data.items
}

async function confirm(o: any) {
  msg.value = ''
  try {
    await consoleApi.orderConfirm(o.id, { expected_row_version: o.row_version })
    msg.value = 'confirmed'
    await load()
  } catch (e: unknown) {
    msg.value = e instanceof Error ? e.message : 'failed'
  }
}

async function cancel(o: any) {
  msg.value = ''
  try {
    await consoleApi.orderCancel(o.id, { expected_row_version: o.row_version })
    msg.value = 'cancelled'
    await load()
  } catch (e: unknown) {
    msg.value = e instanceof Error ? e.message : 'failed'
  }
}

onMounted(load)
</script>

<style scoped>
.toolbar{display:flex;gap:8px;margin-bottom:12px}
button,select{font:inherit;padding:8px 10px;border-radius:var(--bc-radius-sm)}
button{cursor:pointer;background:var(--bc-ink);color:#fff;border:0}
table{width:100%;border-collapse:collapse;font-size:13px;background:#fff}
th,td{border-bottom:1px solid var(--bc-line);padding:8px;text-align:left}
.actions{display:flex;gap:6px}
.actions button{padding:4px 8px;font-size:12px}
.mono{font-family:ui-monospace,monospace}
.msg{color:var(--bc-steel)}
</style>
