<template>
  <ConsoleShell :title="t('console.nav.orgs')">
    <div class="layout">
      <div>
        <div class="toolbar">
          <input v-model="q" :placeholder="t('console.search')" @keyup.enter="load" />
          <button type="button" @click="load">{{ t('console.refresh') }}</button>
        </div>
        <table>
          <thead><tr><th>name</th><th>slug</th><th>members</th></tr></thead>
          <tbody>
            <tr v-for="o in orgs" :key="o.id" class="row" @click="select(o)">
              <td>{{ o.name }}</td><td>{{ o.slug }}</td><td>{{ o.member_count }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="selected">
        <h2>{{ selected.name }}</h2>
        <table>
          <thead><tr><th>email</th><th>role</th><th>active</th><th></th></tr></thead>
          <tbody>
            <tr v-for="m in members" :key="m.id">
              <td>{{ m.email }}</td>
              <td>
                <select :value="m.role" @change="onRole(m, ($event.target as HTMLSelectElement).value)">
                  <option value="owner">owner</option>
                  <option value="admin">admin</option>
                  <option value="member">member</option>
                </select>
              </td>
              <td>{{ m.is_active ? 'Y' : 'N' }}</td>
              <td><button type="button" @click="onActive(m)">toggle</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </ConsoleShell>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { consoleApi } from '../../api/console'
import ConsoleShell from '../../components/console/ConsoleShell.vue'

const { t } = useI18n()
const orgs = ref<any[]>([])
const members = ref<any[]>([])
const selected = ref<any>(null)
const q = ref('')

async function load() {
  const data = await consoleApi.orgs({ q: q.value, page_size: 50 })
  orgs.value = data.items
}

async function select(o: any) {
  selected.value = o
  const data = await consoleApi.orgMembers(o.id, { page_size: 100 })
  members.value = (data as any).items || []
}

async function onRole(m: any, role: string) {
  await consoleApi.patchOrgMember(selected.value.id, { membership_id: m.id, role })
  await select(selected.value)
}

async function onActive(m: any) {
  await consoleApi.patchOrgMember(selected.value.id, { membership_id: m.id, is_active: !m.is_active })
  await select(selected.value)
}

onMounted(load)
</script>

<style scoped>
.layout{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.toolbar{display:flex;gap:8px;margin-bottom:12px}
input,button,select{font:inherit;padding:8px 10px;border-radius:var(--bc-radius-sm);border:1px solid var(--bc-line-strong)}
button{cursor:pointer;background:var(--bc-ink);color:#fff;border:0}
table{width:100%;border-collapse:collapse;font-size:13px;background:#fff}
th,td{border-bottom:1px solid var(--bc-line);padding:8px;text-align:left}
.row{cursor:pointer}
.row:hover{background:var(--bc-steel-soft)}
h2{margin:0 0 12px;font-size:16px}
@media (max-width:900px){.layout{grid-template-columns:1fr}}
</style>
