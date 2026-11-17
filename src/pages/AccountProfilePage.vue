<template>
  <AppShell>
    <div class="auth-page">
      <div class="auth-card">
        <h1>{{ t('auth.profileTitle') }}</h1>
        <template v-if="auth.isAuthenticated">
          <p><strong>{{ t('auth.email') }}:</strong> {{ auth.user?.email }}</p>
          <p><strong>{{ t('auth.displayName') }}:</strong> {{ auth.user?.display_name }}</p>
          <div class="quota" v-if="billing.entitlement">
            <h2>{{ t('billing.entitlementTitle') }}</h2>
            <p>
              {{ t('billing.plan') }}: <strong>{{ billing.entitlement.plan }}</strong>
              ·
              {{ t('billing.remaining') }}:
              <strong>{{ billing.entitlement.unlimited ? t('billing.unlimited') : billing.entitlement.remaining }}</strong>
            </p>
            <RouterLink class="bc-btn" to="/account/upgrade">{{ t('billing.upgradeLink') }}</RouterLink>
          </div>
          <div class="orgs">
            <h2>{{ t('auth.organizations') }}</h2>
            <ul>
              <li v-for="org in auth.organizations" :key="org.id">{{ org.name }} ({{ org.role }})</li>
            </ul>
            <p v-if="!auth.organizations.length">{{ t('auth.noOrganizations') }}</p>
          </div>
          <button class="bc-btn bc-btn--primary" type="button" @click="onLogout">{{ t('auth.logout') }}</button>
        </template>
        <template v-else>
          <p>{{ t('auth.needLogin') }}</p>
          <RouterLink class="bc-btn bc-btn--primary" to="/account/login">{{ t('auth.signIn') }}</RouterLink>
        </template>
        <p class="links">
          <RouterLink to="/lab">{{ t('site.lab') }}</RouterLink>
          ·
          <RouterLink to="/home">{{ t('site.home') }}</RouterLink>
        </p>
      </div>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import { useAuthStore } from '../stores/auth'
import { useBillingStore } from '../stores/billing'

const { t } = useI18n()
const auth = useAuthStore()
const billing = useBillingStore()
const router = useRouter()

onMounted(async () => {
  await auth.refreshMe()
  if (auth.isAuthenticated) await billing.refresh()
})

async function onLogout() {
  await auth.logout()
  await router.push('/account/login')
}
</script>

<style scoped>
.auth-page {
  display: grid;
  place-items: center;
  padding: 48px 24px 80px;
}

.auth-card {
  width: min(480px, 100%);
  background: var(--bc-paper-elevated);
  border: 1px solid var(--bc-line);
  border-radius: var(--bc-radius);
  padding: 28px;
}

.auth-card h1 {
  margin: 0 0 12px;
  font-family: var(--bc-font-display);
  font-size: 24px;
}

.auth-card h2 {
  margin: 16px 0 8px;
  font-size: 16px;
}

.quota {
  margin: 12px 0;
}

.quota .bc-btn {
  display: inline-flex;
  margin-top: 8px;
}

.links {
  margin-top: 16px;
  font-size: 13px;
}

.links a {
  color: var(--bc-steel);
}
</style>
