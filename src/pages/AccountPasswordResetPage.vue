<template>
  <AppShell>
    <div class="auth-page">
      <form class="auth-card" @submit.prevent="onSubmit">
        <h1>{{ t('auth.resetTitle') }}</h1>
        <p class="hint">{{ t('auth.resetHint') }}</p>
        <label>{{ t('auth.email') }}<input v-model="email" type="email" required /></label>
        <p v-if="message" class="ok">{{ message }}</p>
        <p v-if="error" class="bc-err">{{ error }}</p>
        <button class="bc-btn bc-btn--primary" type="submit" :disabled="busy">{{ t('auth.resetSubmit') }}</button>
        <p class="links">
          <RouterLink to="/account/login">{{ t('auth.signIn') }}</RouterLink>
        </p>
      </form>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { apiRequest, ApiError } from '../api/client'
import AppShell from '../components/layout/AppShell.vue'

const { t } = useI18n()
const email = ref('')
const message = ref('')
const error = ref('')
const busy = ref(false)

async function onSubmit() {
  busy.value = true
  error.value = ''
  message.value = ''
  try {
    const res = await apiRequest<{ delivery: string }>('/auth/password-reset/', {
      method: 'POST',
      json: { email: email.value.trim() },
    })
    message.value = res.message || t('auth.resetAccepted')
    if (res.data?.delivery === 'blocked') {
      message.value = `${message.value} (${t('auth.resetBlocked')})`
    }
  } catch (e: unknown) {
    error.value = e instanceof ApiError ? e.message : t('auth.resetFailed')
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
  margin: 0 0 4px;
  font-family: var(--bc-font-display);
  font-size: 24px;
}

.hint {
  margin: 0;
  color: var(--bc-ink-muted);
  font-size: 13px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
}

input {
  border: 1px solid var(--bc-line-strong);
  border-radius: var(--bc-radius-sm);
  padding: 10px 12px;
  background: #fff;
}

.ok {
  color: var(--bc-steel);
  margin: 0;
  font-size: 13px;
}

.links a {
  color: var(--bc-steel);
  font-size: 13px;
}
</style>
