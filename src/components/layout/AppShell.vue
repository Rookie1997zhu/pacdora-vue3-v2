<template>
  <div class="shell" :class="{ 'shell--flush': flush }">
    <header class="shell-header">
      <RouterLink class="shell-brand" to="/home" :aria-label="brandName">
        <img class="shell-logo" :src="logoUrl" :alt="brandName" width="160" height="50" />
        <small class="shell-tagline">{{ t('site.tagline') }}</small>
      </RouterLink>

      <nav class="shell-nav shell-nav--desktop" :aria-label="t('site.primaryNav')">
        <RouterLink to="/products">{{ t('site.navCatalog') }}</RouterLink>
        <div class="shell-dd" :class="{ open: toolsOpen }" @keydown.escape="toolsOpen = false">
          <button
            type="button"
            class="shell-dd-btn"
            :aria-expanded="toolsOpen"
            aria-haspopup="true"
            @click="toggleTools"
          >
            {{ t('site.navDesignTools') }}
            <span class="caret" aria-hidden="true">▾</span>
          </button>
          <div v-if="toolsOpen" class="shell-dd-panel" role="menu">
            <RouterLink v-if="workbenchOn" role="menuitem" to="/workbench" @click="closeMenus">{{
              t('site.navWorkbench')
            }}</RouterLink>
            <RouterLink role="menuitem" to="/designs" @click="closeMenus">{{ t('site.navStudio') }}</RouterLink>
            <RouterLink role="menuitem" to="/render" @click="closeMenus">{{ t('site.navRender') }}</RouterLink>
          </div>
        </div>
        <RouterLink to="/library/dielines">{{ t('library.nav') }}</RouterLink>
        <RouterLink to="/blog">{{ t('site.navKnowledge') }}</RouterLink>
      </nav>

      <div class="shell-actions">
        <div class="shell-lang" role="group" :aria-label="t('lang.zh') + ' / ' + t('lang.ko')">
          <button type="button" :class="{ on: locale === 'zh-CN' }" @click="setLocale('zh-CN')">{{ t('lang.zh') }}</button>
          <button type="button" :class="{ on: locale === 'ko-KR' }" @click="setLocale('ko-KR')">{{ t('lang.ko') }}</button>
        </div>

        <RouterLink
          v-if="auth.isAuthenticated"
          class="shell-quota"
          to="/account/upgrade"
          :title="t('billing.remaining')"
        >
          {{ t('billing.exportsShort') }}
          {{ billing.entitlement?.unlimited ? t('billing.unlimited') : (billing.entitlement?.remaining ?? '—') }}
        </RouterLink>

        <div v-if="auth.isAuthenticated" class="shell-dd shell-dd--account" :class="{ open: accountOpen }">
          <button
            type="button"
            class="shell-dd-btn shell-account-btn"
            :aria-expanded="accountOpen"
            aria-haspopup="true"
            @click="toggleAccount"
          >
            {{ t('site.account') }}
            <span class="caret" aria-hidden="true">▾</span>
          </button>
          <div v-if="accountOpen" class="shell-dd-panel shell-dd-panel--right" role="menu">
            <RouterLink role="menuitem" to="/account/profile" @click="closeMenus">{{ t('site.accountProfile') }}</RouterLink>
            <RouterLink role="menuitem" to="/account/upgrade" @click="closeMenus">{{ t('billing.upgradeLink') }}</RouterLink>
            <RouterLink role="menuitem" to="/cart" @click="closeMenus">{{ t('cart.title') }}</RouterLink>
            <RouterLink role="menuitem" to="/orders" @click="closeMenus">{{ t('site.navOrders') }}</RouterLink>
            <button type="button" role="menuitem" class="shell-dd-action" @click="onLogout">{{ t('site.logout') }}</button>
          </div>
        </div>
        <RouterLink v-else class="shell-account" to="/account/login">{{ t('site.login') }}</RouterLink>

        <RouterLink class="bc-btn bc-btn--primary shell-cta desktop-only" to="/products">{{
          t('studio.browseProducts')
        }}</RouterLink>

        <button
          type="button"
          class="shell-menu-btn"
          :aria-expanded="menuOpen"
          :aria-controls="'shell-mobile-drawer'"
          @click="toggleMenu"
        >
          {{ menuOpen ? t('site.closeMenu') : t('site.openMenu') }}
        </button>
      </div>
    </header>

    <div
      v-if="menuOpen"
      class="shell-backdrop"
      @click="closeMenus"
    />
    <aside
      id="shell-mobile-drawer"
      class="shell-drawer"
      :class="{ open: menuOpen }"
      :aria-hidden="!menuOpen"
    >
      <nav class="shell-drawer-nav" :aria-label="t('site.primaryNav')">
        <RouterLink to="/products" @click="closeMenus">{{ t('site.navCatalog') }}</RouterLink>
        <p class="shell-drawer-label">{{ t('site.navDesignTools') }}</p>
        <RouterLink v-if="workbenchOn" to="/workbench" @click="closeMenus">{{ t('site.navWorkbench') }}</RouterLink>
        <RouterLink to="/designs" @click="closeMenus">{{ t('site.navStudio') }}</RouterLink>
        <RouterLink to="/render" @click="closeMenus">{{ t('site.navRender') }}</RouterLink>
        <RouterLink to="/library/dielines" @click="closeMenus">{{ t('library.nav') }}</RouterLink>
        <RouterLink to="/blog" @click="closeMenus">{{ t('site.navKnowledge') }}</RouterLink>
        <RouterLink to="/cart" @click="closeMenus">{{ t('cart.title') }}</RouterLink>
        <RouterLink to="/orders" @click="closeMenus">{{ t('site.navOrders') }}</RouterLink>
        <template v-if="auth.isAuthenticated">
          <RouterLink to="/account/upgrade" @click="closeMenus">
            {{ t('billing.exportsShort') }}
            ·
            {{ billing.entitlement?.unlimited ? t('billing.unlimited') : (billing.entitlement?.remaining ?? '—') }}
          </RouterLink>
          <RouterLink to="/account/profile" @click="closeMenus">{{ t('site.accountProfile') }}</RouterLink>
          <button type="button" class="shell-drawer-action" @click="onLogout">{{ t('site.logout') }}</button>
        </template>
        <RouterLink v-else to="/account/login" @click="closeMenus">{{ t('site.login') }}</RouterLink>
        <RouterLink class="bc-btn bc-btn--primary shell-drawer-cta" to="/products" @click="closeMenus">{{
          t('studio.browseProducts')
        }}</RouterLink>
      </nav>
    </aside>

    <div class="shell-body">
      <slot />
    </div>
    <SiteFooter />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { setLocale } from '../../i18n/index.js'
import { useBrandLogo } from '../../brand/logo'
import { useAuthStore } from '../../stores/auth'
import { useBillingStore } from '../../stores/billing'
import { isWorkbenchEnabled } from '../../features/workbench/manifest'
import SiteFooter from './SiteFooter.vue'

defineProps<{ flush?: boolean }>()

const { t, locale } = useI18n()
const { logoUrl, brandName } = useBrandLogo()
const router = useRouter()
const auth = useAuthStore()
const billing = useBillingStore()
const workbenchOn = isWorkbenchEnabled()

const toolsOpen = ref(false)
const accountOpen = ref(false)
const menuOpen = ref(false)

function closeMenus() {
  toolsOpen.value = false
  accountOpen.value = false
  menuOpen.value = false
}

function toggleTools() {
  accountOpen.value = false
  toolsOpen.value = !toolsOpen.value
}

function toggleAccount() {
  toolsOpen.value = false
  accountOpen.value = !accountOpen.value
}

function toggleMenu() {
  toolsOpen.value = false
  accountOpen.value = false
  menuOpen.value = !menuOpen.value
}

async function onLogout() {
  closeMenus()
  try {
    await auth.logout()
  } catch {
    /* still leave session UI */
  }
  await router.push('/home')
}

function onDocClick(ev: MouseEvent) {
  const target = ev.target as Node | null
  if (!target) return
  const el = (ev.target as HTMLElement | null)?.closest?.('.shell-dd, .shell-menu-btn, .shell-drawer')
  if (!el) closeMenus()
}

function onKey(ev: KeyboardEvent) {
  if (ev.key === 'Escape') closeMenus()
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKey)
  void billing.refresh().catch(() => undefined)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKey)
})
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

@media (prefers-reduced-motion: reduce) {
  .shell-header {
    animation: none;
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
  height: 40px;
  width: auto;
  max-width: min(200px, 42vw);
  object-fit: contain;
  object-position: left center;
}

.shell-tagline {
  font-size: 11px;
  color: var(--bc-ink-muted);
  max-width: 12rem;
  line-height: 1.25;
}

.shell-nav--desktop {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
  flex: 1;
  min-width: 0;
}

.shell-nav--desktop > a,
.shell-dd-btn {
  text-decoration: none;
  color: var(--bc-ink-muted);
  padding: 8px 12px;
  border-radius: var(--bc-radius-sm);
  white-space: nowrap;
  font-size: 13px;
  font-weight: 500;
  background: transparent;
  border: 0;
  cursor: pointer;
  font: inherit;
  transition: color var(--bc-ease), background var(--bc-ease);
}

.shell-nav--desktop > a:hover,
.shell-nav--desktop > a.router-link-active,
.shell-dd.open > .shell-dd-btn {
  color: var(--bc-steel);
  background: var(--bc-steel-soft);
}

.shell-dd {
  position: relative;
}

.shell-dd-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.caret {
  font-size: 10px;
  opacity: 0.7;
}

.shell-dd-panel {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 200px;
  padding: 8px;
  background: #fff;
  border: 1px solid var(--bc-line);
  border-radius: 10px;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.1);
  display: flex;
  flex-direction: column;
  gap: 2px;
  z-index: 50;
}

.shell-dd-panel--right {
  left: auto;
  right: 0;
}

.shell-dd-panel a,
.shell-dd-action {
  text-align: left;
  text-decoration: none;
  color: var(--bc-ink);
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  border: 0;
  background: transparent;
  cursor: pointer;
  font: inherit;
}

.shell-dd-panel a:hover,
.shell-dd-action:hover {
  background: var(--bc-steel-soft);
  color: var(--bc-steel);
}

.shell-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  margin-left: auto;
}

.shell-lang {
  display: inline-flex;
  border: 1px solid var(--bc-line);
  border-radius: var(--bc-radius-sm);
  overflow: hidden;
  background: var(--bc-paper-elevated);
}

.shell-lang button {
  border: 0;
  background: transparent;
  color: var(--bc-ink-muted);
  padding: 6px 9px;
  font-size: 12px;
  font-weight: 600;
  transition: background var(--bc-ease), color var(--bc-ease);
}

.shell-lang button.on {
  background: var(--bc-steel);
  color: #fff;
}

.shell-account,
.shell-quota,
.shell-account-btn {
  text-decoration: none;
  color: var(--bc-ink);
  font-size: 13px;
  font-weight: 600;
  padding: 6px 4px;
}

.shell-quota {
  color: var(--bc-ink-muted);
  white-space: nowrap;
}

.shell-cta {
  min-height: 36px;
  padding: 0 14px;
  font-size: 13px;
  border-radius: var(--bc-radius-sm);
}

.shell-menu-btn {
  display: none;
  border: 1px solid var(--bc-line-strong);
  background: #fff;
  border-radius: 8px;
  min-height: 34px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.shell-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  z-index: 45;
}

.shell-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(320px, 92vw);
  background: #fff;
  z-index: 46;
  transform: translateX(105%);
  transition: transform 0.2s ease;
  padding: 72px 18px 24px;
  overflow: auto;
  border-left: 1px solid var(--bc-line);
}

.shell-drawer.open {
  transform: translateX(0);
}

.shell-drawer-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.shell-drawer-nav a,
.shell-drawer-action {
  text-decoration: none;
  color: var(--bc-ink);
  padding: 12px 10px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
  font: inherit;
}

.shell-drawer-nav a:hover,
.shell-drawer-action:hover {
  background: var(--bc-steel-soft);
  color: var(--bc-steel);
}

.shell-drawer-label {
  margin: 12px 10px 4px;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--bc-ink-muted);
  font-weight: 600;
}

.shell-drawer-cta {
  margin-top: 16px;
  justify-content: center;
  text-align: center;
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
  .shell-nav--desktop,
  .desktop-only,
  .shell-dd--account {
    display: none;
  }
  .shell-menu-btn {
    display: inline-flex;
    align-items: center;
  }
  .shell-header {
    height: auto;
    min-height: var(--bc-header-h);
    padding: 10px 14px;
  }
  .shell-cta {
    min-height: 32px;
    padding: 0 12px;
    font-size: 12px;
  }
}

@media (max-width: 520px) {
  .shell-lang button {
    padding: 5px 7px;
    font-size: 11px;
  }
}
</style>
