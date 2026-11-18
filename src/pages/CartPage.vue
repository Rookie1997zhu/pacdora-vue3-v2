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
              :alt="itemLabel(item)"
              :placeholder="t('cart.previewPlaceholder')"
            />
            <div class="body">
              <strong>{{ itemLabel(item) }}</strong>
              <p class="meta">
                <span v-if="item.product_slug">{{ item.product_slug }} · </span>
                rev {{ item.design_revision_id.slice(0, 8) }} · qty {{ item.quantity }}
              </p>
              <span
                v-if="item.quote?.status === 'pending_manual'"
                class="status-chip"
                data-tone="pending"
              >{{ t('cart.pendingManual') }}</span>
              <span
                v-else-if="item.quote?.status === 'valid'"
                class="status-chip"
                data-tone="ready"
              >{{ t('cart.quotedLine', { amount: item.quote.total_amount, currency: item.quote.currency }) }}</span>
              <span v-else class="status-chip" data-tone="idle">{{ t('cart.awaitingQuote') }}</span>
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
        <div v-if="!cart.cart.items.length" class="bc-empty">
          <EmptyLordIcon :src="emptyBoxIcon" />
          <p>{{ t('cart.empty') }}</p>
          <RouterLink class="bc-btn bc-btn--primary" to="/products">{{ t('site.emptyBrowseProducts') }}</RouterLink>
        </div>
        <div v-else class="summary">
          <p v-if="quotedTotal" class="summary-total">
            {{ t('cart.quotedTotal', { amount: quotedTotal.amount, currency: quotedTotal.currency, n: quotedTotal.count }) }}
          </p>
          <p v-else class="summary-pending">{{ t('cart.noQuotedTotal') }}</p>
        </div>
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
import { computed, onMounted, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import type { CartItem } from '../api/cart'
import emptyBoxIcon from '../assets/icons/empty-box.json?url'
import AuthThumbnail from '../components/AuthThumbnail.vue'
import EmptyLordIcon from '../components/motion/EmptyLordIcon.vue'
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

function itemLabel(item: CartItem) {
  return item.design_name || t('cart.item')
}

const quotedTotal = computed(() => {
  const items = cart.cart?.items || []
  const valid = items.filter((i) => i.quote?.status === 'valid' && i.quote.total_amount != null)
  if (!valid.length) return null
  const currency = valid[0].quote!.currency || 'KRW'
  let sum = 0
  for (const i of valid) {
    const n = Number(i.quote!.total_amount)
    if (!Number.isFinite(n)) return null
    sum += n
  }
  return { amount: sum.toFixed(2), currency, count: valid.length }
})

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
  margin: 0 0 16px;
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

.status-chip {
  display: inline-flex;
  margin-top: 6px;
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

.status-chip[data-tone='pending'] {
  background: #fff6e8;
  border-color: #efd2a3;
  color: #8a5a12;
}

.summary {
  margin: 0 0 14px;
  padding: 12px 14px;
  border-radius: var(--bc-radius);
  background: var(--bc-paper-elevated);
  border: 1px solid var(--bc-line);
}

.summary-total {
  margin: 0;
  font-weight: 600;
}

.summary-pending {
  margin: 0;
  color: var(--bc-ink-muted);
  font-size: 14px;
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
