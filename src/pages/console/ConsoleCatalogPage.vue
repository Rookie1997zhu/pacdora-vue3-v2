<template>
  <ConsoleShell :title="t('console.nav.catalog')">
    <div class="toolbar">
      <select v-model="status" @change="load">
        <option value="">all</option>
        <option value="draft">draft</option>
        <option value="published">published</option>
        <option value="archived">archived</option>
      </select>
      <button type="button" @click="load">{{ t('console.refresh') }}</button>
    </div>
    <table>
      <thead><tr><th>slug</th><th>name</th><th>status</th><th>sort</th><th></th></tr></thead>
      <tbody>
        <tr v-for="p in items" :key="p.id">
          <td>{{ p.slug }}</td>
          <td>{{ p.name }}</td>
          <td>{{ p.status }}</td>
          <td>{{ p.sort_order }}</td>
          <td class="actions">
            <button type="button" @click="setStatus(p, 'published')">publish</button>
            <button type="button" @click="setStatus(p, 'archived')">archive</button>
            <button type="button" @click="setStatus(p, 'draft')">draft</button>
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
const status = ref('')

async function load() {
  const data = await consoleApi.products({ status: status.value, page_size: 100 })
  items.value = data.items
}

async function setStatus(p: any, next: string) {
  await consoleApi.patchProduct(p.id, { status: next })
  await load()
}

onMounted(load)
</script>

<style scoped>
.toolbar{display:flex;gap:8px;margin-bottom:12px}
button,select{font:inherit;padding:8px 10px;border-radius:var(--bc-radius-sm)}
button{cursor:pointer;background:var(--bc-ink);color:#fff;border:0}
table{width:100%;border-collapse:collapse;font-size:13px;background:#fff}
th,td{border-bottom:1px solid var(--bc-line);padding:8px;text-align:left}
.actions{display:flex;gap:6px;flex-wrap:wrap}
.actions button{padding:4px 8px;font-size:12px}
</style>
