<template>
  <AppShell>
    <div class="auth-page">
      <form class="auth-card" @submit.prevent="onSubmit">
        <h1>{{ t('auth.loginTitle') }}</h1>
        <p v-if="needStaff" class="hint">{{ t('auth.staffRequired') }}</p>
        <p v-if="currentNonStaff" class="hint">
          {{ t('auth.signedInAs', { email: auth.user?.email || '' }) }}
          <button type="button" class="linkish" @click="onLogout">{{ t('auth.switchAccount') }}</button>
        </p>
        <label>{{ t('auth.email') }}<input v-model="email" type="email" required autocomplete="username" /></label>
        <label>{{ t('auth.password') }}<input v-model="password" type="password" required autocomplete="current-password" /></label>
        <p v-if="error" class="bc-err">{{ error }}</p>
        <button class="bc-btn bc-btn--primary" type="submit" :disabled="busy">{{ t('auth.signIn') }}</button>
        <p class="links">
          <RouterLink to="/account/register">{{ t('auth.createAccount') }}</RouterLink>
          ·
          <RouterLink to="/account/password-reset">{{ t('auth.forgotPassword') }}</RouterLink>
        </p>
      </form>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { ApiError } from '../api/client'
import AppShell from '../components/layout/AppShell.vue'

const { t } = useI18n()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const email = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

const needStaff = computed(() => route.query.needStaff === '1')
const currentNonStaff = computed(() => !!auth.user && !auth.user.is_staff)

onMounted(async () => {
  if (!auth.loaded) await auth.refreshMe()
  if (auth.user?.is_staff && needStaff.value) {
    const next = typeof route.query.next === 'string' && route.query.next.startsWith('/')
      ? route.query.next
      : '/console'
    await router.replace(next)
  }
})

async function onLogout() {
  try {
    await auth.logout()
  } catch {
    /* ignore */
  }
}

async function onSubmit() {
  busy.value = true
  error.value = ''
  try {
    await auth.login(email.value.trim(), password.value)
    const next = typeof route.query.next === 'string' && route.query.next.startsWith('/')
      ? route.query.next
      : '/account/profile'
    if (needStaff.value && !auth.user?.is_staff) {
      error.value = t('auth.staffRequired')
      return
    }
    await router.push(next)
  } catch (e: unknown) {
    error.value = e instanceof ApiError ? e.message : t('auth.loginFailed')
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.auth-page {
  display: grid;
  place-items: center;
  padding: 48px 24px 80px;
}

.auth-card {
  width: min(420px, 100%);
  background: var(--bc-paper-elevated);
  border: 1px solid var(--bc-line);
  border-radius: var(--bc-radius);
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.auth-card h1 {
  margin: 0 0 8px;
  font-family: var(--bc-font-display);
  font-size: 24px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--bc-ink-muted);
}

input {
  border: 1px solid var(--bc-line-strong);
  border-radius: var(--bc-radius-sm);
  padding: 10px 12px;
  background: #fff;
  color: var(--bc-ink);
}

.links {
  font-size: 13px;
  color: var(--bc-ink-muted);
}

.links a {
  color: var(--bc-steel);
}

.hint {
  margin: 0;
  font-size: 13px;
  color: var(--bc-ink-muted);
  line-height: 1.45;
}

.linkish {
  border: 0;
  background: none;
  padding: 0;
  color: var(--bc-steel);
  cursor: pointer;
  text-decoration: underline;
}
</style>
