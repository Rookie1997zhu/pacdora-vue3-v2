<template>
  <AppShell>
    <article class="page">
      <header class="head">
        <p class="eyebrow">{{ t('legal.eyebrow') }}</p>
        <h1>{{ t('legal.disclaimerTitle') }}</h1>
        <p class="lead">{{ t('legal.disclaimerLead') }}</p>
        <p class="updated">{{ t('legal.updated') }}</p>
      </header>

      <section v-for="sec in sections" :key="sec.id" class="sec">
        <h2>{{ t(sec.titleKey) }}</h2>
        <p v-for="(bodyKey, i) in sec.bodyKeys" :key="i">{{ t(bodyKey) }}</p>
      </section>

      <p class="note">{{ t('legal.counselNote') }}</p>
    </article>
  </AppShell>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppShell from '../components/layout/AppShell.vue'

const { t } = useI18n()

const sections = [
  {
    id: 'scope',
    titleKey: 'legal.secScopeTitle',
    bodyKeys: ['legal.secScopeBody1', 'legal.secScopeBody2'],
  },
  {
    id: 'export',
    titleKey: 'legal.secExportTitle',
    bodyKeys: ['legal.secExportBody1', 'legal.secExportBody2'],
  },
  {
    id: 'mfg',
    titleKey: 'legal.secMfgTitle',
    bodyKeys: ['legal.secMfgBody1', 'legal.secMfgBody2'],
  },
  {
    id: 'third',
    titleKey: 'legal.secThirdTitle',
    bodyKeys: ['legal.secThirdBody1'],
  },
  {
    id: 'ai',
    titleKey: 'legal.secAiTitle',
    bodyKeys: ['legal.secAiBody1'],
  },
  {
    id: 'liability',
    titleKey: 'legal.secLiabilityTitle',
    bodyKeys: ['legal.secLiabilityBody1'],
  },
]
</script>

<style scoped>
.page {
  max-width: 720px;
  margin: 0 auto;
  padding: clamp(24px, 4vw, 48px) clamp(16px, 3vw, 28px) 64px;
}

.head {
  margin-bottom: 28px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--bc-line);
}

.eyebrow {
  margin: 0 0 8px;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--bc-ink-muted);
}

h1 {
  margin: 0 0 12px;
  font-size: clamp(1.5rem, 2.4vw, 1.85rem);
  line-height: 1.25;
  font-weight: 700;
  color: var(--bc-ink);
}

.lead {
  margin: 0 0 10px;
  font-size: 15px;
  line-height: 1.6;
  color: var(--bc-ink-muted);
}

.updated {
  margin: 0;
  font-size: 12px;
  color: var(--bc-ink-muted);
}

.sec {
  margin: 0 0 22px;
}

.sec h2 {
  margin: 0 0 8px;
  font-size: 1.05rem;
  font-weight: 650;
  color: var(--bc-ink);
}

.sec p {
  margin: 0 0 8px;
  font-size: 14px;
  line-height: 1.65;
  color: var(--bc-ink-muted);
}

.note {
  margin: 28px 0 0;
  padding-top: 16px;
  border-top: 1px solid var(--bc-line);
  font-size: 12px;
  line-height: 1.55;
  color: var(--bc-ink-muted);
}
</style>
