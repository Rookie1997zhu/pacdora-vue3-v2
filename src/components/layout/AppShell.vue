<template>
  <div class="shell" :class="{ 'shell--flush': flush }">
    <header class="shell-header">
      <RouterLink class="shell-brand" to="/home" aria-label="BOXCRAFT">
        <img class="shell-logo" :src="logoUrl" alt="BOXCRAFT" width="160" height="50" />
        <small class="shell-tagline">{{ t('site.tagline') }}</small>
      </RouterLink>
      <nav class="shell-nav" :aria-label="t('site.home')">
        <RouterLink to="/home">{{ t('site.home') }}</RouterLink>
        <RouterLink to="/products">{{ t('studio.products') }}</RouterLink>
        <RouterLink to="/library/dielines">{{ t('library.nav') }}</RouterLink>
        <RouterLink to="/designs">{{ t('studio.myDesigns') }}</RouterLink>
        <RouterLink to="/cart">{{ t('cart.title') }}</RouterLink>
        <RouterLink to="/lab">{{ t('site.lab') }}</RouterLink>
      </nav>
      <div class="shell-actions">
        <div class="shell-lang" role="group" :aria-label="t('lang.zh') + ' / ' + t('lang.ko')">
          <button type="button" :class="{ on: locale === 'zh-CN' }" @click="setLocale('zh-CN')">{{ t('lang.zh') }}</button>
          <button type="button" :class="{ on: locale === 'ko-KR' }" @click="setLocale('ko-KR')">{{ t('lang.ko') }}</button>
        </div>
        <RouterLink v-if="!auth.isAuthenticated" class="shell-account" to="/account/login">{{ t('site.login') }}</RouterLink>
        <RouterLink v-else class="shell-account" to="/account/profile">{{ t('site.account') }}</RouterLink>
        <RouterLink class="bc-btn bc-btn--primary shell-cta" to="/products">{{ t('studio.browseProducts') }}</RouterLink>
      </div>
    </header>
    <div class="shell-body">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import logoUrl from '../../assets/brand/boxcraft-logo.png'
import { setLocale } from '../../i18n/index.js'
import { useAuthStore } from '../../stores/auth'

defineProps<{ flush?: boolean }>()

const { t, locale } = useI18n()
const auth = useAuthStore()
</script>

<style scoped>
.shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bc-paper);
  color: var(--bc-ink);
  font-family: var(--bc-font-ui);
}

.shell-header {
  position: sticky;
  top: 0;
  z-index: 40;
  height: var(--bc-header-h);
  display: flex;
  align-items: center;
  gap: var(--bc-space-4);
  padding: 0 clamp(16px, 3vw, 32px);
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--bc-line);
  animation: shell-in 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes shell-in {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.shell-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: inherit;
  flex-shrink: 0;
}

.shell-logo {
  display: block;
  height: 36px;
  width: auto;
}

.shell-tagline {
  font-size: 11px;
  color: var(--bc-ink-muted);
  max-width: 12rem;
  line-height: 1.25;
}

.shell-nav {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
}

.shell-nav a {
  text-decoration: none;
  color: var(--bc-ink-muted);
  padding: 8px 10px;
  border-radius: var(--bc-radius-sm);
  white-space: nowrap;
  font-size: 13px;
  font-weight: 500;
  transition: color var(--bc-ease), background var(--bc-ease);
}

.shell-nav a:hover,
.shell-nav a.router-link-active {
  color: var(--bc-ink);
  background: var(--bc-steel-soft);
}

.shell-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.shell-lang {
  display: inline-flex;
  border: 1px solid var(--bc-line);
  border-radius: var(--bc-radius-sm);
  overflow: hidden;
}

.shell-lang button {
  border: 0;
  background: transparent;
  color: var(--bc-ink-muted);
  padding: 6px 9px;
  font-size: 12px;
  font-weight: 600;
}

.shell-lang button.on {
  background: var(--bc-ink);
  color: #fff;
}

.shell-account {
  text-decoration: none;
  color: var(--bc-ink);
  font-size: 13px;
  font-weight: 600;
  padding: 6px 4px;
}

.shell-cta {
  min-height: 36px;
  padding: 0 14px;
  font-size: 13px;
  border-radius: 999px;
}

.shell-body {
  flex: 1;
  min-width: 0;
}

.shell--flush .shell-body {
  display: flex;
  flex-direction: column;
}

@media (max-width: 1100px) {
  .shell-tagline {
    display: none;
  }
}

@media (max-width: 900px) {
  .shell-header {
    height: auto;
    min-height: var(--bc-header-h);
    flex-wrap: wrap;
    padding: 10px 14px;
    row-gap: 8px;
  }
  .shell-nav {
    order: 3;
    flex: 1 1 100%;
    margin-left: 0;
    padding-top: 4px;
    border-top: 1px solid var(--bc-line);
  }
  .shell-cta {
    min-height: 32px;
    padding: 0 12px;
    font-size: 12px;
  }
}

@media (max-width: 520px) {
  .shell-account {
    display: none;
  }
  .shell-lang button {
    padding: 5px 7px;
    font-size: 11px;
  }
  .shell-cta {
    min-height: 30px;
    padding: 0 10px;
    font-size: 12px;
  }
  .shell-nav a {
    padding: 6px 8px;
    font-size: 12px;
  }
}
</style>
