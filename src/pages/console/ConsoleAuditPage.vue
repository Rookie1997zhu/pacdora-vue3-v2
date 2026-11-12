<template>
  <ConsoleShell :title="t('console.nav.audit')">
    <div class="toolbar">
      <input v-model="action" :placeholder="t('console.audit.action')" @keyup.enter="load" />
      <button type="button" @click="load">{{ t('console.refresh') }}</button>
    </div>
    <table>
      <thead><tr><th>time</th><th>actor</th><th>action</th><th>target</th><th>meta</th></tr></thead>
      <tbody>
        <tr v-for="a in items" :key="a.id">
          <td>{{ a.created_at }}</td>
          <td>{{ a.actor_email }}</td>
          <td>{{ a.action }}</td>
          <td>{{ a.target_type }} {{ a.target_id }}</td>
          <td class="meta">{{ JSON.stringify(a.meta) }}</td>
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
const action = ref('')

async function load() {
  const data = await consoleApi.audit({ action: action.value, page_size: 50 })
  items.value = data.items
}

onMounted(load)
</script>

<style scoped>
.toolbar{display:flex;gap:8px;margin-bottom:12px}
input,button{font:inherit;padding:8px 10px;border-radius:var(--bc-radius-sm)}
button{cursor:pointer;background:var(--bc-ink);color:#fff;border:0}
table{width:100%;border-collapse:collapse;font-size:13px;background:#fff}
th,td{border-bottom:1px solid var(--bc-line);padding:8px;text-align:left;vertical-align:top}
.meta{max-width:320px;word-break:break-all;color:var(--bc-ink-muted)}
</style>
