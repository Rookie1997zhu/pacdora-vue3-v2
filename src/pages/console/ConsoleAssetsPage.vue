<template>
  <ConsoleShell :title="t('console.nav.assets')">
    <button type="button" class="refresh" @click="load">{{ t('console.refresh') }}</button>
    <p v-if="msg" class="msg">{{ msg }}</p>
    <table>
      <thead><tr><th>file</th><th>mime</th><th>status</th><th>bytes</th><th></th></tr></thead>
      <tbody>
        <tr v-for="a in items" :key="a.id">
          <td>{{ a.filename || a.id.slice(0, 8) }}</td>
          <td>{{ a.mime }}</td>
          <td>{{ a.status }}</td>
          <td>{{ a.bytes }}</td>
          <td><button type="button" @click="regen(a)">regen thumb</button></td>
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
const msg = ref('')

async function load() {
  const data = await consoleApi.assets({ page_size: 50 })
  items.value = data.items
}

async function regen(a: any) {
  await consoleApi.regenThumb(a.id)
  msg.value = `queued ${a.id}`
}

onMounted(load)
</script>

<style scoped>
.refresh{margin-bottom:12px;font:inherit;padding:8px 10px;border:0;border-radius:var(--bc-radius-sm);background:var(--bc-ink);color:#fff;cursor:pointer}
button{font:inherit;padding:4px 8px;border:0;border-radius:var(--bc-radius-sm);background:var(--bc-ink);color:#fff;cursor:pointer}
table{width:100%;border-collapse:collapse;font-size:13px;background:#fff}
th,td{border-bottom:1px solid var(--bc-line);padding:8px;text-align:left}
.msg{color:var(--bc-steel)}
</style>
