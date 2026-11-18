<template>
  <AppShell>
    <main class="wrap">
      <header class="bc-page-header">
        <div>
          <h1>{{ t('order.title') }}</h1>
        </div>
      </header>
      <p v-if="!auth.isAuthenticated" class="bc-err">
        {{ t('auth.needLogin') }} · <RouterLink to="/account/login">{{ t('site.login') }}</RouterLink>
      </p>
      <p v-else-if="order.busy && !order.items.length">{{ t('studio.loading') }}</p>
      <p v-else-if="order.error" class="bc-err">{{ order.error }}</p>
      <ul v-else class="list">
        <li v-for="o in order.items" :key="o.id" class="row">
          <RouterLink :to="`/orders/${o.id}`">
            <strong>{{ o.order_no }}</strong>
            <span class="meta">{{ amountLabel(o) }}</span>
            <span class="status-chip" :data-tone="statusTone(o.status)">{{ statusLabel(o.status) }}</span>
          </RouterLink>
        </li>
      </ul>
      <div v-if="auth.isAuthenticated && !order.busy && !order.error && !order.items.length" class="bc-empty">
        <EmptyLordIcon :src="emptyDocIcon" />
        <p>{{ t('order.empty') }}</p>
        <RouterLink class="bc-btn bc-btn--primary" to="/cart">{{ t('cart.title') }}</RouterLink>
        <RouterLink class="bc-btn" to="/products">{{ t('site.emptyBrowseProducts') }}</RouterLink>
      </div>
    </main>
  </AppShell>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Order } from '../api/orders'
import emptyDocIcon from '../assets/icons/empty-doc.json?url'
import EmptyLordIcon from '../components/motion/EmptyLordIcon.vue'
import AppShell from '../components/layout/AppShell.vue'
import { useAuthStore } from '../stores/auth'
import { useOrderStore } from '../stores/order'

const { t } = useI18n()
const auth = useAuthStore()
const order = useOrderStore()

function statusLabel(status: Order['status']) {
  if (status === 'pending_manual') return t('order.pendingManual')
  if (status === 'quoted') return t('order.quoted')
  if (status === 'confirmed') return t('order.confirmed')
  if (status === 'cancelled') return t('order.cancelled')
  return status
}

function statusTone(status: Order['status']) {
  if (status === 'confirmed') return 'ready'
  if (status === 'quoted') return 'busy'
  if (status === 'cancelled') return 'failed'
  return 'pending'
}

function amountLabel(o: Order) {
  if (o.total_amount == null) return t('order.noPrice')
  return `${o.total_amount} ${o.currency}`
}

onMounted(async () => {
  await auth.refreshMe()
  if (auth.isAuthenticated) await order.loadList()
})
</script>

<style scoped>
.wrap {
  max-width: 880px;
  margin: 0 auto;
  padding: clamp(24px, 4vw, 40px) clamp(16px, 3vw, 28px) 80px;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.row {
  background: var(--bc-paper-elevated);
  border: 1px solid var(--bc-line);
  border-radius: var(--bc-radius);
  padding: 12px 14px;
}

.row a {
  color: inherit;
  text-decoration: none;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.meta {
  color: var(--bc-ink-muted);
  font-size: 13px;
}

.status-chip {
  display: inline-flex;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 12px;
  border: 1px solid var(--bc-line);
  background: #f4f6f8;
  color: var(--bc-ink-muted);
}

.status-chip[data-tone='ready'] {
  background: #e8f5ee;
  border-color: #b7dfc8;
  color: #1f6b45;
}

.status-chip[data-tone='busy'] {
  background: #eef3ff;
  border-color: #c5d4f5;
  color: #3557a0;
}

.status-chip[data-tone='pending'] {
  background: #fff6e8;
  border-color: #efd2a3;
  color: #8a5a12;
}

.status-chip[data-tone='failed'] {
  background: #fdeceb;
  border-color: #f0c2bc;
  color: #9b2c20;
}

.bc-empty {
  display: grid;
  justify-items: center;
  gap: 10px;
  text-align: center;
}
</style>
