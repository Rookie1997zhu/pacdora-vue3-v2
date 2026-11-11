<template>
  <AppShell>
    <main v-if="order.current" class="wrap">
      <header class="bc-page-header">
        <div>
          <h1>{{ order.current.order_no }}</h1>
          <p>{{ statusLabel(order.current.status) }} · {{ t('order.paymentMode') }}: {{ order.current.payment_mode }}</p>
        </div>
      </header>
      <p v-if="order.current.status === 'pending_manual'" class="banner warn">{{ t('order.pendingManual') }}</p>
      <p v-else-if="order.current.status === 'confirmed'" class="banner ok">{{ t('order.confirmed') }}</p>
      <p v-else-if="order.current.status === 'cancelled'" class="banner warn">{{ t('order.cancelled') }}</p>
      <p v-else-if="order.current.total_amount != null" class="total">
        {{ t('order.total', { amount: order.current.total_amount, currency: order.current.currency }) }}
      </p>
      <p v-else class="banner warn">{{ t('order.noPrice') }}</p>

      <h2>{{ t('order.lines') }}</h2>
      <ul class="list">
        <li v-for="line in order.current.items" :key="line.id" class="row">
          <div>
            <strong>rev {{ line.design_revision_id.slice(0, 8) }}</strong>
            <p class="meta">qty {{ line.quantity }} · {{ lineStatus(line.line_status) }}</p>
          </div>
          <div class="meta amount">
            <template v-if="order.current.status === 'pending_manual' && line.line_status === 'pending_manual'">
              <input
                v-model="amountMap[line.id]"
                type="number"
                min="0.01"
                step="0.01"
                :placeholder="t('order.lineAmount')"
              />
            </template>
            <template v-else-if="line.line_amount != null">{{ line.line_amount }}</template>
            <template v-else>{{ t('order.noPrice') }}</template>
          </div>
        </li>
      </ul>

      <p v-if="order.error" class="bc-err">{{ order.error }}</p>

      <div class="actions">
        <button
          v-if="order.current.status === 'pending_manual'"
          type="button"
          class="bc-btn bc-btn--primary"
          :disabled="order.busy"
          @click="onManualQuote"
        >
          {{ order.busy ? t('order.submitting') : t('order.manualQuote') }}
        </button>
        <button
          v-if="order.current.status === 'quoted'"
          type="button"
          class="bc-btn bc-btn--primary"
          :disabled="order.busy"
          @click="onConfirm"
        >
          {{ order.busy ? t('order.submitting') : t('order.confirm') }}
        </button>
        <button
          v-if="order.current.status === 'pending_manual' || order.current.status === 'quoted'"
          type="button"
          class="bc-btn bc-btn--ghost"
          :disabled="order.busy"
          @click="onCancel"
        >
          {{ t('order.cancel') }}
        </button>
      </div>
    </main>
    <p v-else-if="order.busy" class="pad">{{ t('studio.loading') }}</p>
    <p v-else class="pad bc-err">{{ order.error || t('studio.loadFailed') }}</p>
  </AppShell>
</template>

<script setup lang="ts">
import { onMounted, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import type { Order, OrderLineStatus } from '../api/orders'
import AppShell from '../components/layout/AppShell.vue'
import { useAuthStore } from '../stores/auth'
import { useOrderStore } from '../stores/order'

const { t } = useI18n()
const route = useRoute()
const auth = useAuthStore()
const order = useOrderStore()
const amountMap = reactive<Record<string, string>>({})

function syncAmounts() {
  for (const key of Object.keys(amountMap)) delete amountMap[key]
  for (const line of order.current?.items || []) {
    if (line.line_status === 'pending_manual') {
      amountMap[line.id] = line.line_amount || ''
    }
  }
}

watch(() => order.current, syncAmounts, { deep: true })

function statusLabel(status: Order['status']) {
  if (status === 'pending_manual') return t('order.pendingManual')
  if (status === 'quoted') return t('order.quoted')
  if (status === 'confirmed') return t('order.confirmed')
  if (status === 'cancelled') return t('order.cancelled')
  return status
}

function lineStatus(status: OrderLineStatus) {
  if (status === 'pending_manual') return t('order.pendingManual')
  return t('order.priced')
}

async function onManualQuote() {
  const lines = (order.current?.items || [])
    .filter((line) => line.line_status === 'pending_manual')
    .map((line) => ({
      id: line.id,
      line_amount: String(amountMap[line.id] || '').trim(),
    }))
  if (lines.some((line) => !line.line_amount || Number(line.line_amount) <= 0)) {
    order.error = t('order.amountRequired')
    return
  }
  await order.applyManualQuote(lines)
}

async function onConfirm() {
  await order.confirm()
}

async function onCancel() {
  await order.cancel()
}

onMounted(async () => {
  await auth.refreshMe()
  if (auth.isAuthenticated) await order.loadOne(String(route.params.id))
})
</script>

<style scoped>
.wrap {
  max-width: 880px;
  margin: 0 auto;
  padding: clamp(24px, 4vw, 40px) clamp(16px, 3vw, 28px) 80px;
}

.banner {
  margin: 0 0 16px;
  padding: 10px 12px;
  border-radius: var(--bc-radius-sm);
  font-size: 13px;
}

.banner.warn {
  color: var(--bc-warn);
  background: var(--bc-warn-bg);
  border: 1px solid var(--bc-warn-line);
}

.banner.ok {
  color: var(--bc-ok);
  background: #eef8f2;
  border: 1px solid #bfe5cd;
}

.total {
  font-size: 18px;
  font-weight: 650;
  margin: 0 0 16px;
}

h2 {
  margin: 0 0 10px;
  font-size: 15px;
}

.list {
  list-style: none;
  padding: 0;
  margin: 0 0 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  background: var(--bc-paper-elevated);
  border: 1px solid var(--bc-line);
  border-radius: var(--bc-radius);
  padding: 12px 14px;
}

.meta {
  margin: 4px 0 0;
  color: var(--bc-ink-muted);
  font-size: 13px;
}

.amount input {
  width: 120px;
  border: 1px solid var(--bc-line-strong);
  border-radius: var(--bc-radius-sm);
  padding: 8px;
}

.actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.pad {
  padding: 48px 24px;
}
</style>
