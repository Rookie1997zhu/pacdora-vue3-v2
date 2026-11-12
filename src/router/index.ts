import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const rootHome = import.meta.env.VITE_ROOT_HOME === '1'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'root',
      component: rootHome
        ? () => import('../pages/HomePage.vue')
        : () => import('../legacy/LegacyLab.vue'),
    },
    {
      path: '/lab',
      name: 'lab',
      component: () => import('../legacy/LegacyLab.vue'),
    },
    {
      path: '/home',
      name: 'home',
      component: () => import('../pages/HomePage.vue'),
    },
    {
      path: '/account/login',
      name: 'login',
      component: () => import('../pages/AccountLoginPage.vue'),
    },
    {
      path: '/account/register',
      name: 'register',
      component: () => import('../pages/AccountRegisterPage.vue'),
    },
    {
      path: '/account/profile',
      name: 'profile',
      component: () => import('../pages/AccountProfilePage.vue'),
    },
    {
      path: '/account/password-reset',
      name: 'password-reset',
      component: () => import('../pages/AccountPasswordResetPage.vue'),
    },
    {
      path: '/products',
      name: 'products',
      component: () => import('../pages/ProductsPage.vue'),
    },
    {
      path: '/products/:slug',
      name: 'product-detail',
      component: () => import('../pages/ProductDetailPage.vue'),
    },
    {
      path: '/library/dielines',
      name: 'dieline-library',
      component: () => import('../features/dieline-library/DielineLibraryListPage.vue'),
    },
    {
      path: '/library/dielines/:id',
      name: 'dieline-library-detail',
      component: () => import('../features/dieline-library/DielineLibraryDetailPage.vue'),
    },
    {
      path: '/designs',
      name: 'designs',
      component: () => import('../pages/DesignsPage.vue'),
    },
    {
      path: '/designs/:id',
      name: 'design-editor',
      component: () => import('../pages/DesignEditorPage.vue'),
    },
    {
      path: '/cart',
      name: 'cart',
      component: () => import('../pages/CartPage.vue'),
    },
    {
      path: '/orders',
      name: 'orders',
      component: () => import('../pages/OrdersPage.vue'),
    },
    {
      path: '/orders/:id',
      name: 'order-detail',
      component: () => import('../pages/OrderDetailPage.vue'),
    },
    {
      path: '/console',
      name: 'console-overview',
      meta: { requiresStaff: true },
      component: () => import('../pages/console/ConsoleOverviewPage.vue'),
    },
    {
      path: '/console/users',
      name: 'console-users',
      meta: { requiresStaff: true },
      component: () => import('../pages/console/ConsoleUsersPage.vue'),
    },
    {
      path: '/console/orgs',
      name: 'console-orgs',
      meta: { requiresStaff: true },
      component: () => import('../pages/console/ConsoleOrgsPage.vue'),
    },
    {
      path: '/console/catalog',
      name: 'console-catalog',
      meta: { requiresStaff: true },
      component: () => import('../pages/console/ConsoleCatalogPage.vue'),
    },
    {
      path: '/console/designs',
      name: 'console-designs',
      meta: { requiresStaff: true },
      component: () => import('../pages/console/ConsoleDesignsPage.vue'),
    },
    {
      path: '/console/exports',
      name: 'console-exports',
      meta: { requiresStaff: true },
      component: () => import('../pages/console/ConsoleExportsPage.vue'),
    },
    {
      path: '/console/orders',
      name: 'console-orders',
      meta: { requiresStaff: true },
      component: () => import('../pages/console/ConsoleOrdersPage.vue'),
    },
    {
      path: '/console/quotes',
      name: 'console-quotes',
      meta: { requiresStaff: true },
      component: () => import('../pages/console/ConsoleQuotesPage.vue'),
    },
    {
      path: '/console/dielines',
      name: 'console-dielines',
      meta: { requiresStaff: true },
      component: () => import('../pages/console/ConsoleDielinesPage.vue'),
    },
    {
      path: '/console/assets',
      name: 'console-assets',
      meta: { requiresStaff: true },
      component: () => import('../pages/console/ConsoleAssetsPage.vue'),
    },
    {
      path: '/console/ai',
      name: 'console-ai',
      meta: { requiresStaff: true },
      component: () => import('../pages/console/ConsoleAiPage.vue'),
    },
    {
      path: '/console/audit',
      name: 'console-audit',
      meta: { requiresStaff: true },
      component: () => import('../pages/console/ConsoleAuditPage.vue'),
    },
  ],
})

router.beforeEach(async (to) => {
  if (!to.meta.requiresStaff) return true
  const auth = useAuthStore()
  // Always refresh for console so staff flag is not stale after role changes.
  await auth.refreshMe()
  if (!auth.user) {
    return { path: '/account/login', query: { next: to.fullPath, needStaff: '1' } }
  }
  if (!auth.user.is_staff) {
    return { path: '/account/login', query: { next: to.fullPath, needStaff: '1' } }
  }
  return true
})

export default router
