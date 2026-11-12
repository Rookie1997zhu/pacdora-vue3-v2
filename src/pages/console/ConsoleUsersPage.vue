<template>
  <ConsoleShell :title="t('console.nav.users')">
    <div class="toolbar">
      <input v-model="q" :placeholder="t('console.search')" @keyup.enter="load" />
      <button type="button" @click="load">{{ t('console.refresh') }}</button>
    </div>
    <p v-if="error" class="err">{{ error }}</p>
    <table>
      <thead>
        <tr>
          <th>{{ t('console.users.email') }}</th>
          <th>{{ t('console.users.name') }}</th>
          <th>staff</th>
          <th>active</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="u in items" :key="u.id">
          <td>{{ u.email }}</td>
          <td>{{ u.display_name }}</td>
          <td>{{ u.is_staff ? 'Y' : 'N' }}</td>
          <td>{{ u.is_active ? 'Y' : 'N' }}</td>
          <td class="actions">
            <button type="button" @click="toggle(u, 'is_staff')">staff</button>
            <button type="button" @click="toggle(u, 'is_active')">active</button>
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
const q = ref('')
const error = ref('')

async function load() {
  error.value = ''
  try {
    const data = await consoleApi.users({ q: q.value, page_size: 50 })
    items.value = data.items
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'failed'
  }
}

async function toggle(u: any, field: 'is_staff' | 'is_active') {
  await consoleApi.patchUser(u.id, { [field]: !u[field] })
  await load()
}

onMounted(load)
</script>

<style scoped>
.toolbar{display:flex;gap:8px;margin-bottom:12px}
input,button{font:inherit;padding:8px 10px;border-radius:var(--bc-radius-sm);border:1px solid var(--bc-line-strong);background:#fff}
button{cursor:pointer;background:var(--bc-ink);color:#fff;border:0;font-weight:600}
table{width:100%;border-collapse:collapse;font-size:13px;background:var(--bc-paper-elevated)}
th,td{border-bottom:1px solid var(--bc-line);padding:10px;text-align:left}
.actions{display:flex;gap:6px}
.actions button{padding:4px 8px;font-size:12px}
.err{color:var(--bc-danger)}
</style>
