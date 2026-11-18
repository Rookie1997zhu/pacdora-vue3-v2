<template>
  <AppShell>
    <div class="page">
      <div class="card">
        <h1>{{ t('billing.upgradeTitle') }}</h1>
        <p class="lead">{{ t('billing.upgradeLead') }}</p>
        <p class="note">{{ t('billing.noPaymentNote') }}</p>

        <div v-if="billing.entitlement" class="quota">
          <p>
            {{ t('billing.currentPlan') }}:
            <strong>{{ planLabel(billing.entitlement.plan) }}</strong>
            <span v-if="!isKnownPlan(billing.entitlement.plan)" class="tech">{{
              t('billing.planUnknownDetail', { code: billing.entitlement.plan })
            }}</span>
          </p>
          <p>
            {{ t('billing.remaining') }}:
            <strong>{{ billing.entitlement.unlimited ? t('billing.unlimited') : billing.entitlement.remaining }}</strong>
          </p>
        </div>

        <div class="plans">
          <button
            type="button"
            class="plan"
            :class="{ on: plan === 'pay_per_use' }"
            @click="plan = 'pay_per_use'"
          >
            <strong>{{ t('billing.planPayPerUse') }}</strong>
            <span>{{ t('billing.pricePayPerUse') }}</span>
          </button>
          <button type="button" class="plan" :class="{ on: plan === 'annual' }" @click="plan = 'annual'">
            <strong>{{ t('billing.planAnnual') }}</strong>
            <span>{{ t('billing.priceAnnual') }}</span>
          </button>
        </div>

        <label>
          {{ t('billing.contact') }}
          <input v-model="contact" type="text" autocomplete="email" />
        </label>
        <label>
          {{ t('billing.note') }}
          <textarea v-model="note" rows="3" />
        </label>

        <button class="bc-btn bc-btn--primary" type="button" :disabled="busy" @click="onSubmit">
          {{ t('billing.submitIntent') }}
        </button>
        <p v-if="success" class="ok" role="status">{{ t('billing.intentSubmitted') }}</p>
        <p v-if="success" class="note">{{ t('billing.noPaymentNote') }}</p>
        <p v-if="error" class="err">{{ error }}</p>

        <p class="links">
          <RouterLink to="/account/profile">{{ t('auth.profileTitle') }}</RouterLink>
          ·
          <RouterLink to="/lab">{{ t('site.lab') }}</RouterLink>
        </p>
      </div>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import { ApiError } from '../api/client'
import { useAuthStore } from '../stores/auth'
import { useBillingStore } from '../stores/billing'

const { t } = useI18n()
const auth = useAuthStore()
const billing = useBillingStore()
const router = useRouter()

const plan = ref<'pay_per_use' | 'annual'>('annual')
const contact = ref('')
const note = ref('')
const busy = ref(false)
const success = ref(false)
const error = ref('')

function isKnownPlan(code: string) {
  return code === 'free' || code === 'annual' || code === 'pay_per_use'
}

function planLabel(code: string) {
  if (code === 'free') return t('billing.planFree')
  if (code === 'annual') return t('billing.planAnnual')
  if (code === 'pay_per_use') return t('billing.planPayPerUse')
  return code
}

onMounted(async () => {
  await auth.refreshMe()
  if (!auth.isAuthenticated) {
    await router.replace({ path: '/account/login', query: { next: '/account/upgrade' } })
    return
  }
  contact.value = auth.user?.email || ''
  await billing.refresh()
})

async function onSubmit() {
  busy.value = true
  success.value = false
  error.value = ''
  try {
    await billing.submitIntent(plan.value, note.value, contact.value)
    success.value = true
  } catch (e: unknown) {
    error.value = e instanceof ApiError ? e.message : t('billing.intentFailed')
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.page{display:grid;place-items:center;padding:48px 24px 80px}
.card{width:min(560px,100%);background:var(--bc-paper-elevated);border:1px solid var(--bc-line);border-radius:var(--bc-radius);padding:28px}
h1{margin:0 0 8px;font-family:var(--bc-font-display);font-size:24px}
.lead,.note{margin:0 0 10px;color:var(--bc-ink-muted);font-size:14px}
.note{background:var(--bc-steel-soft);padding:10px 12px;border-radius:8px}
.quota{margin:14px 0;font-size:14px}
.tech{display:block;margin-top:4px;font-size:12px;color:var(--bc-ink-muted);font-weight:400}
.plans{display:grid;gap:8px;margin:16px 0}
.plan{display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:12px;border:1px solid var(--bc-line-strong);border-radius:8px;background:#fff;cursor:pointer;font:inherit;text-align:left}
.plan.on{border-color:var(--bc-ink);box-shadow:inset 0 0 0 1px var(--bc-ink)}
label{display:flex;flex-direction:column;gap:6px;margin-bottom:12px;font-size:13px}
input,textarea{font:inherit;padding:10px 12px;border:1px solid var(--bc-line-strong);border-radius:8px}
.ok{color:#1f8a4c;font-size:13px}
.err{color:#9a4339;font-size:13px}
.links{margin-top:16px;font-size:13px}
.links a{color:var(--bc-steel)}
</style>
