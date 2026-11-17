<template>
  <ConsoleShell :title="t('console.nav.orgs')">
    <div class="layout">
      <div>
        <div class="toolbar">
          <input v-model="q" :placeholder="t('console.search')" @keyup.enter="load" />
          <button type="button" @click="load">{{ t('console.refresh') }}</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>name</th>
              <th>slug</th>
              <th>members</th>
              <th>{{ t('billing.plan') }}</th>
              <th>{{ t('billing.remaining') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="o in orgs" :key="o.id" class="row" @click="select(o)">
              <td>{{ o.name }}</td>
              <td>{{ o.slug }}</td>
              <td>{{ o.member_count }}</td>
              <td>{{ o.entitlement?.plan || 'free' }}</td>
              <td>{{ remainingLabel(o.entitlement) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="selected">
        <h2>{{ selected.name }}</h2>
        <section class="entitlement">
          <h3>{{ t('billing.entitlementTitle') }}</h3>
          <label>
            {{ t('billing.plan') }}
            <select v-model="form.plan">
              <option value="free">free</option>
              <option value="annual">annual</option>
            </select>
          </label>
          <label>
            {{ t('billing.annualExpires') }}
            <input v-model="form.annual_expires_at" type="datetime-local" />
          </label>
          <label>
            {{ t('billing.freeLimit') }}
            <input v-model.number="form.free_export_limit" type="number" min="0" />
          </label>
          <label>
            {{ t('billing.exportsUsed') }}
            <input v-model.number="form.exports_used" type="number" min="0" />
          </label>
          <div class="actions">
            <button type="button" @click="saveEntitlement">{{ t('billing.saveEntitlement') }}</button>
            <button type="button" class="ghost" @click="grantAnnualYear">{{ t('billing.grantAnnual1y') }}</button>
          </div>
          <p v-if="entMsg" class="msg">{{ entMsg }}</p>
        </section>
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
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { consoleApi } from '../../api/console'
import ConsoleShell from '../../components/console/ConsoleShell.vue'

const { t } = useI18n()
const orgs = ref<any[]>([])
const members = ref<any[]>([])
const selected = ref<any>(null)
const q = ref('')
const entMsg = ref('')
const form = reactive({
  plan: 'free',
  annual_expires_at: '',
  free_export_limit: 10,
  exports_used: 0,
})

function remainingLabel(ent: any) {
  if (!ent) return '—'
  if (ent.unlimited) return t('billing.unlimited')
  return String(ent.remaining ?? '—')
}

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function applyEntitlement(ent: any) {
  form.plan = ent?.plan || 'free'
  form.annual_expires_at = toLocalInput(ent?.annual_expires_at)
  form.free_export_limit = ent?.free_export_limit ?? 10
  form.exports_used = ent?.exports_used ?? 0
}

async function load() {
  const data = await consoleApi.orgs({ q: q.value, page_size: 50 })
  orgs.value = data.items
}

async function select(o: any) {
  selected.value = o
  entMsg.value = ''
  applyEntitlement(o.entitlement)
  const data = await consoleApi.orgMembers(o.id, { page_size: 100 })
  members.value = (data as any).items || []
  try {
    const ent = await consoleApi.orgEntitlement(o.id)
    applyEntitlement(ent)
    selected.value = { ...o, entitlement: ent }
  } catch {
    /* keep list snapshot */
  }
}

async function saveEntitlement() {
  if (!selected.value) return
  entMsg.value = ''
  const body: Record<string, unknown> = {
    plan: form.plan,
    free_export_limit: form.free_export_limit,
    exports_used: form.exports_used,
    annual_expires_at: form.annual_expires_at
      ? new Date(form.annual_expires_at).toISOString()
      : null,
  }
  const ent = await consoleApi.patchOrgEntitlement(selected.value.id, body)
  applyEntitlement(ent)
  entMsg.value = t('billing.saved')
  await load()
}

async function grantAnnualYear() {
  if (!selected.value) return
  const expires = new Date()
  expires.setFullYear(expires.getFullYear() + 1)
  form.plan = 'annual'
  form.annual_expires_at = toLocalInput(expires.toISOString())
  await saveEntitlement()
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
button.ghost{background:#fff;color:var(--bc-ink);border:1px solid var(--bc-line-strong)}
table{width:100%;border-collapse:collapse;font-size:13px;background:#fff}
th,td{border-bottom:1px solid var(--bc-line);padding:8px;text-align:left}
.row{cursor:pointer}
.row:hover{background:var(--bc-steel-soft)}
h2{margin:0 0 12px;font-size:16px}
h3{margin:0 0 10px;font-size:14px}
.entitlement{display:flex;flex-direction:column;gap:8px;margin-bottom:16px;padding:12px;border:1px solid var(--bc-line);border-radius:8px;background:#fff}
.entitlement label{display:flex;flex-direction:column;gap:4px;font-size:12px}
.actions{display:flex;flex-wrap:wrap;gap:8px}
.msg{margin:0;font-size:12px;color:var(--bc-steel)}
@media (max-width:900px){.layout{grid-template-columns:1fr}}
</style>
