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
            <span>{{ statusLabel(o.status) }} · {{ amountLabel(o) }}</span>
          </RouterLink>
        </li>
      </ul>
      <div v-if="auth.isAuthenticated && !order.busy && !order.error && !order.items.length" class="bc-empty">
        {{ t('order.empty') }}
      </div>
    </main>
  </AppShell>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Order } from '../api/orders'
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
  flex-direction: column;
  gap: 4px;
}

.row span {
  color: var(--bc-ink-muted);
  font-size: 13px;
}
</style>
