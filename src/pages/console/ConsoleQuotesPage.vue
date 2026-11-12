<template>
  <ConsoleShell :title="t('console.nav.quotes')">
    <button type="button" class="refresh" @click="load">{{ t('console.refresh') }}</button>
    <table>
      <thead><tr><th>id</th><th>status</th><th>design</th><th>total</th><th>created</th></tr></thead>
      <tbody>
        <tr v-for="q in items" :key="q.id">
          <td class="mono">{{ q.id.slice(0, 8) }}</td>
          <td>{{ q.status }}</td>
          <td class="mono">{{ q.design_id?.slice(0, 8) }}</td>
          <td>{{ q.total_amount }} {{ q.currency }}</td>
          <td>{{ q.created_at }}</td>
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

async function load() {
  const data = await consoleApi.quotes({ page_size: 50 })
  items.value = data.items
}

onMounted(load)
</script>

<style scoped>
.refresh{margin-bottom:12px;font:inherit;padding:8px 10px;border:0;border-radius:var(--bc-radius-sm);background:var(--bc-ink);color:#fff;cursor:pointer}
table{width:100%;border-collapse:collapse;font-size:13px;background:#fff}
th,td{border-bottom:1px solid var(--bc-line);padding:8px;text-align:left}
.mono{font-family:ui-monospace,monospace}
</style>
