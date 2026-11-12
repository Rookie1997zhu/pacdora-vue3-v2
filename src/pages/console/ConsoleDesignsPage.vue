<template>
  <ConsoleShell :title="t('console.nav.designs')">
    <div class="toolbar">
      <input v-model="q" :placeholder="t('console.search')" @keyup.enter="load" />
      <button type="button" @click="load">{{ t('console.refresh') }}</button>
    </div>
    <table>
      <thead>
        <tr><th>name</th><th>org</th><th>owner</th><th>status</th><th>updated</th><th></th></tr>
      </thead>
      <tbody>
        <tr v-for="d in items" :key="d.id">
          <td>{{ d.name }}</td>
          <td>{{ d.organization_name }}</td>
          <td>{{ d.owner_email }}</td>
          <td>{{ d.status }}</td>
          <td>{{ d.updated_at }}</td>
          <td><RouterLink :to="`/designs/${d.id}`">open</RouterLink></td>
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
const q = ref('')

async function load() {
  const data = await consoleApi.designs({ q: q.value, page_size: 50 })
  items.value = data.items
}

onMounted(load)
</script>

<style scoped>
.toolbar{display:flex;gap:8px;margin-bottom:12px}
input,button{font:inherit;padding:8px 10px;border-radius:var(--bc-radius-sm)}
button{cursor:pointer;background:var(--bc-ink);color:#fff;border:0}
table{width:100%;border-collapse:collapse;font-size:13px;background:#fff}
th,td{border-bottom:1px solid var(--bc-line);padding:8px;text-align:left}
a{color:var(--bc-steel)}
</style>
