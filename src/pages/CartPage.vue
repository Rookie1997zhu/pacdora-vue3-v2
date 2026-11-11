<template>
  <AppShell>
    <main class="wrap">
      <header class="bc-page-header">
        <div>
          <h1>{{ t('cart.title') }}</h1>
          <p>{{ t('cart.lead') }}</p>
        </div>
      </header>
      <p v-if="!auth.isAuthenticated" class="bc-err">
        {{ t('auth.needLogin') }} · <RouterLink to="/account/login">{{ t('site.login') }}</RouterLink>
      </p>
      <p v-else-if="cart.busy && !cart.cart">{{ t('studio.loading') }}</p>
      <p v-else-if="cart.error" class="bc-err">{{ cart.error }}</p>
      <template v-else-if="cart.cart">
        <ul class="list">
          <li v-for="item in cart.cart.items" :key="item.id" class="row">
            <AuthThumbnail
              :asset-id="item.preview_asset_id"
              :ready="Boolean(item.thumbnail_ready)"
              :alt="t('cart.item')"
              :placeholder="t('cart.previewPlaceholder')"
            />
            <div class="body">
              <strong>{{ t('cart.item') }}</strong>
              <p class="meta">rev {{ item.design_revision_id.slice(0, 8) }} · qty {{ item.quantity }}</p>
              <p v-if="item.quote?.status === 'pending_manual'" class="hint">{{ t('cart.pendingManual') }}</p>
              <p v-else-if="item.quote?.status === 'valid'" class="meta">
                {{ t('cart.quotedLine', { amount: item.quote.total_amount, currency: item.quote.currency }) }}
              </p>
            </div>
            <div class="actions">
              <input
                v-model.number="qtyMap[item.id]"
                type="number"
                min="1"
                @change="onQty(item.id)"
              />
              <button type="button" @click="onRemove(item.id)">{{ t('cart.remove') }}</button>
            </div>
          </li>
        </ul>
        <div v-if="!cart.cart.items.length" class="bc-empty">{{ t('cart.empty') }}</div>
        <p v-if="order.error" class="bc-err">{{ order.error }}</p>
        <button
          type="button"
          class="bc-btn bc-btn--primary"
          :disabled="!cart.cart.items.length || order.busy || cart.busy"
          @click="onCheckout"
        >
          {{ order.busy ? t('order.checkingOut') : t('cart.checkout') }}
        </button>
      </template>
    </main>
  </AppShell>
</template>

<script setup lang="ts">
import { onMounted, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AuthThumbnail from '../components/AuthThumbnail.vue'
import AppShell from '../components/layout/AppShell.vue'
import { useAuthStore } from '../stores/auth'
import { useCartStore } from '../stores/cart'
import { useOrderStore } from '../stores/order'

const { t } = useI18n()
const auth = useAuthStore()
const cart = useCartStore()
const order = useOrderStore()
const router = useRouter()
const qtyMap = reactive<Record<string, number>>({})

function syncQty() {
  for (const key of Object.keys(qtyMap)) delete qtyMap[key]
  for (const item of cart.cart?.items || []) {
    qtyMap[item.id] = item.quantity
  }
}

watch(() => cart.cart, syncQty, { deep: true })

async function onQty(itemId: string) {
  const q = Math.max(1, Number(qtyMap[itemId]) || 1)
  await cart.setQuantity(itemId, q)
}

async function onRemove(itemId: string) {
  await cart.remove(itemId)
}

async function onCheckout() {
  const result = await order.checkout()
  if (result) {
    await cart.load()
    await router.push(`/orders/${result.id}`)
  }
}

onMounted(async () => {
  await auth.refreshMe()
  if (auth.isAuthenticated) await cart.load()
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
  margin: 0 0 20px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: var(--bc-paper-elevated);
  border: 1px solid var(--bc-line);
  border-radius: var(--bc-radius);
  padding: 12px 14px;
}

.body {
  flex: 1;
  min-width: 0;
}

.meta {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--bc-ink-muted);
}

.hint {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--bc-warn);
}

.actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

input {
  width: 72px;
  border: 1px solid var(--bc-line-strong);
  border-radius: var(--bc-radius-sm);
  padding: 8px;
}

.actions button {
  border: 1px solid var(--bc-line-strong);
  background: #fff;
  border-radius: var(--bc-radius-sm);
  padding: 8px 10px;
}
</style>
