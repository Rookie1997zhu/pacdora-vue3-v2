<template>
  <div class="console">
    <aside class="nav">
      <RouterLink class="brand" to="/console">BOXCRAFT Console</RouterLink>
      <nav>
        <RouterLink v-for="item in items" :key="item.to" :to="item.to">{{ t(item.label) }}</RouterLink>
      </nav>
      <RouterLink class="back" to="/home">{{ t('console.backSite') }}</RouterLink>
    </aside>
    <main class="main">
      <header class="top">
        <h1>{{ title }}</h1>
        <p class="user">{{ auth.user?.email }}</p>
      </header>
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../../stores/auth'

defineProps<{ title: string }>()
const { t } = useI18n()
const route = useRoute()
const auth = useAuthStore()

const items = [
  { to: '/console', label: 'console.nav.overview' },
  { to: '/console/users', label: 'console.nav.users' },
  { to: '/console/orgs', label: 'console.nav.orgs' },
  { to: '/console/catalog', label: 'console.nav.catalog' },
  { to: '/console/designs', label: 'console.nav.designs' },
  { to: '/console/exports', label: 'console.nav.exports' },
  { to: '/console/orders', label: 'console.nav.orders' },
  { to: '/console/quotes', label: 'console.nav.quotes' },
  { to: '/console/dielines', label: 'console.nav.dielines' },
  { to: '/console/assets', label: 'console.nav.assets' },
  { to: '/console/ai', label: 'console.nav.ai' },
  { to: '/console/audit', label: 'console.nav.audit' },
]

const _path = computed(() => route.path)
void _path
</script>

<style scoped>
.console{
  min-height:100vh;
  display:grid;
  grid-template-columns:220px minmax(0,1fr);
  background:var(--bc-paper);
  color:var(--bc-ink);
  font-family:var(--bc-font-ui);
}
.nav{
  border-right:1px solid var(--bc-line);
  background:var(--bc-paper-elevated);
  padding:16px 12px;
  display:flex;
  flex-direction:column;
  gap:12px;
}
.brand{
  font-family:var(--bc-font-display);
  font-weight:700;
  color:var(--bc-ink);
  text-decoration:none;
  padding:8px 10px;
}
nav{display:flex;flex-direction:column;gap:4px;flex:1}
nav a{
  text-decoration:none;
  color:var(--bc-ink-muted);
  padding:8px 10px;
  border-radius:var(--bc-radius-sm);
  font-size:13px;
  font-weight:600;
}
nav a.router-link-active{
  background:var(--bc-steel-soft);
  color:var(--bc-steel);
}
.back{font-size:12px;color:var(--bc-ink-muted);text-decoration:none;padding:8px 10px}
.main{padding:20px 24px;min-width:0;overflow:auto}
.top{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:16px}
h1{margin:0;font-size:22px;font-family:var(--bc-font-display)}
.user{margin:0;font-size:12px;color:var(--bc-ink-muted)}
@media (max-width:900px){
  .console{grid-template-columns:1fr}
  .nav{border-right:0;border-bottom:1px solid var(--bc-line)}
  nav{flex-direction:row;flex-wrap:wrap}
}
</style>
