<template>
  <ConsoleShell :title="t('console.nav.dielines')">
    <h2>{{ t('console.dielines.revisions') }}</h2>
    <div class="toolbar">
      <select v-model="pub" @change="loadRevisions">
        <option value="">all</option>
        <option value="draft">draft</option>
        <option value="review">review</option>
        <option value="published">published</option>
        <option value="revoked">revoked</option>
      </select>
      <button type="button" @click="loadRevisions">{{ t('console.refresh') }}</button>
    </div>
    <table>
      <thead><tr><th>rev</th><th>pub</th><th>rights</th><th></th></tr></thead>
      <tbody>
        <tr v-for="r in revisions" :key="r.id">
          <td class="mono">{{ r.id.slice(0, 8) }} #{{ r.revision_no }}</td>
          <td>{{ r.publication_status }}</td>
          <td>{{ r.rights_status }}</td>
          <td class="actions">
            <button type="button" @click="publish(r, 'publish')">publish</button>
            <button type="button" @click="publish(r, 'revoke')">revoke</button>
            <button type="button" @click="grant(r)">grant</button>
          </td>
        </tr>
      </tbody>
    </table>

    <h2>{{ t('console.dielines.acquisition') }}</h2>
    <button type="button" class="refresh" @click="loadJobs">{{ t('console.refresh') }}</button>
    <table>
      <thead><tr><th>id</th><th>status</th><th>error</th><th></th></tr></thead>
      <tbody>
        <tr v-for="j in jobs" :key="j.id">
          <td class="mono">{{ j.id.slice(0, 8) }}</td>
          <td>{{ j.status }}</td>
          <td>{{ j.error_message }}</td>
          <td><button type="button" @click="retryJob(j)">retry</button></td>
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
const revisions = ref<any[]>([])
const jobs = ref<any[]>([])
const pub = ref('')

async function loadRevisions() {
  const data = await consoleApi.dielineRevisions({ publication_status: pub.value, page_size: 50 })
  revisions.value = data.items
}

async function loadJobs() {
  const data = await consoleApi.acquisitionJobs({ page_size: 50 })
  jobs.value = data.items
}

async function publish(r: any, action: string) {
  await consoleApi.publishRevision(r.id, action)
  await loadRevisions()
}

async function grant(r: any) {
  await consoleApi.grantRevision(r.id, {
    can_store: true,
    can_use_internally: true,
    can_show_public_preview: true,
  })
  await loadRevisions()
}

async function retryJob(j: any) {
  await consoleApi.retryAcquisition(j.id)
  await loadJobs()
}

onMounted(async () => {
  await loadRevisions()
  await loadJobs()
})
</script>

<style scoped>
h2{margin:18px 0 8px;font-size:14px;color:var(--bc-ink-muted);text-transform:uppercase}
.toolbar,.refresh{display:flex;gap:8px;margin-bottom:12px}
button,select{font:inherit;padding:8px 10px;border-radius:var(--bc-radius-sm)}
button{cursor:pointer;background:var(--bc-ink);color:#fff;border:0}
table{width:100%;border-collapse:collapse;font-size:13px;background:#fff;margin-bottom:16px}
th,td{border-bottom:1px solid var(--bc-line);padding:8px;text-align:left}
.actions{display:flex;gap:6px;flex-wrap:wrap}
.actions button{padding:4px 8px;font-size:12px}
.mono{font-family:ui-monospace,monospace}
</style>
