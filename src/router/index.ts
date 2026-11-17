import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const rootHome = import.meta.env.VITE_ROOT_HOME === '1'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'root',
      meta: { seoKey: rootHome ? 'home' : 'lab' },
      component: rootHome
        ? () => import('../pages/HomePage.vue')
        : () => import('../legacy/LegacyLab.vue'),
    },
    {
      path: '/lab',
      name: 'lab',
      meta: { seoKey: 'lab' },
      component: () => import('../legacy/LegacyLab.vue'),
    },
    {
      path: '/home',
      name: 'home',
      meta: { seoKey: 'home' },
      component: () => import('../pages/HomePage.vue'),
    },
    {
      path: '/account/login',
      name: 'login',
      meta: { seoKey: 'account', noindex: true },
      component: () => import('../pages/AccountLoginPage.vue'),
    },
    {
      path: '/account/register',
      name: 'register',
      meta: { seoKey: 'account', noindex: true },
      component: () => import('../pages/AccountRegisterPage.vue'),
    },
    {
      path: '/account/profile',
      name: 'profile',
      meta: { seoKey: 'account', noindex: true },
      component: () => import('../pages/AccountProfilePage.vue'),
    },
    {
      path: '/account/password-reset',
      name: 'password-reset',
      meta: { seoKey: 'account', noindex: true },
      component: () => import('../pages/AccountPasswordResetPage.vue'),
    },
    {
      path: '/account/upgrade',
      name: 'upgrade',
      meta: { seoKey: 'account', noindex: true },
      component: () => import('../pages/AccountUpgradePage.vue'),
    },
    {
      path: '/products',
      name: 'products',
      meta: { seoKey: 'products' },
      component: () => import('../pages/ProductsPage.vue'),
    },
    {
      path: '/products/:slug',
      name: 'product-detail',
      meta: { seoKey: 'products' },
      component: () => import('../pages/ProductDetailPage.vue'),
    },
    {
      path: '/workbench',
      name: 'workbench-home',
      meta: { seoKey: 'workbench' },
      component: () => import('../features/workbench/WorkbenchHomePage.vue'),
    },
    {
      path: '/workbench/:slug',
      name: 'workbench',
      meta: { seoKey: 'workbench' },
      component: () => import('../features/workbench/WorkbenchPage.vue'),
    },
    {
      path: '/blog',
      name: 'blog',
      meta: { seoKey: 'blog' },
      component: () => import('../pages/BlogListPage.vue'),
    },
    {
      path: '/blog/:lang(zh|ko)/:slug',
      redirect: (to) => `/blog/${String(to.params.slug)}`,
    },
    {
      path: '/blog/:lang(zh|ko)',
      redirect: '/blog',
    },
    {
      path: '/blog/:slug',
      name: 'blog-detail',
      meta: { seoKey: 'blog' },
      component: () => import('../pages/BlogDetailPage.vue'),
    },
    {
      path: '/library/dielines',
      name: 'dieline-library',
      meta: { seoKey: 'library' },
      component: () => import('../features/dieline-library/DielineLibraryListPage.vue'),
    },
    {
      path: '/library/dielines/:id',
      name: 'dieline-library-detail',
      meta: { seoKey: 'library' },
      component: () => import('../features/dieline-library/DielineLibraryDetailPage.vue'),
    },
    {
      path: '/designs',
      name: 'designs',
      meta: { seoKey: 'designs', noindex: true },
      component: () => import('../pages/DesignsPage.vue'),
    },
    {
      path: '/designs/:id',
      name: 'design-editor',
      meta: { seoKey: 'designs', noindex: true },
      component: () => import('../pages/DesignEditorPage.vue'),
    },
    {
      path: '/render',
      name: 'render-scenes',
      meta: { seoKey: 'render', noindex: true },
      component: () => import('../pages/RenderScenesPage.vue'),
    },
    {
      path: '/render/:id',
      name: 'render-editor',
      meta: { seoKey: 'render', noindex: true },
      component: () => import('../pages/RenderEditorPage.vue'),
    },
    {
      path: '/legal/disclaimer',
      name: 'disclaimer',
      meta: { seoKey: 'disclaimer' },
      component: () => import('../pages/DisclaimerPage.vue'),
    },
    {
      path: '/cart',
      name: 'cart',
      meta: { seoKey: 'default', noindex: true },
      component: () => import('../pages/CartPage.vue'),
    },
    {
      path: '/orders',
      name: 'orders',
      meta: { seoKey: 'default', noindex: true },
      component: () => import('../pages/OrdersPage.vue'),
    },
    {
      path: '/orders/:id',
      name: 'order-detail',
      meta: { seoKey: 'default', noindex: true },
      component: () => import('../pages/OrderDetailPage.vue'),
    },
    {
      path: '/console',
      name: 'console-overview',
      meta: { requiresStaff: true, seoKey: 'console', noindex: true },
      component: () => import('../pages/console/ConsoleOverviewPage.vue'),
    },
    {
      path: '/console/users',
      name: 'console-users',
      meta: { requiresStaff: true, seoKey: 'console', noindex: true },
      component: () => import('../pages/console/ConsoleUsersPage.vue'),
    },
    {
      path: '/console/orgs',
      name: 'console-orgs',
      meta: { requiresStaff: true, seoKey: 'console', noindex: true },
      component: () => import('../pages/console/ConsoleOrgsPage.vue'),
    },
    {
      path: '/console/catalog',
      name: 'console-catalog',
      meta: { requiresStaff: true, seoKey: 'console', noindex: true },
      component: () => import('../pages/console/ConsoleCatalogPage.vue'),
    },
    {
      path: '/console/designs',
      name: 'console-designs',
      meta: { requiresStaff: true, seoKey: 'console', noindex: true },
      component: () => import('../pages/console/ConsoleDesignsPage.vue'),
    },
    {
      path: '/console/exports',
      name: 'console-exports',
      meta: { requiresStaff: true, seoKey: 'console', noindex: true },
      component: () => import('../pages/console/ConsoleExportsPage.vue'),
    },
    {
      path: '/console/orders',
      name: 'console-orders',
      meta: { requiresStaff: true, seoKey: 'console', noindex: true },
      component: () => import('../pages/console/ConsoleOrdersPage.vue'),
    },
    {
      path: '/console/quotes',
      name: 'console-quotes',
      meta: { requiresStaff: true, seoKey: 'console', noindex: true },
      component: () => import('../pages/console/ConsoleQuotesPage.vue'),
    },
    {
      path: '/console/dielines',
      name: 'console-dielines',
      meta: { requiresStaff: true, seoKey: 'console', noindex: true },
      component: () => import('../pages/console/ConsoleDielinesPage.vue'),
    },
    {
      path: '/console/assets',
      name: 'console-assets',
      meta: { requiresStaff: true, seoKey: 'console', noindex: true },
      component: () => import('../pages/console/ConsoleAssetsPage.vue'),
    },
    {
      path: '/console/ai',
      name: 'console-ai',
      meta: { requiresStaff: true, seoKey: 'console', noindex: true },
      component: () => import('../pages/console/ConsoleAiPage.vue'),
    },
    {
      path: '/console/blog',
      name: 'console-blog',
      meta: { requiresStaff: true, seoKey: 'console', noindex: true },
      component: () => import('../pages/console/ConsoleBlogPage.vue'),
    },
    {
      path: '/console/audit',
      name: 'console-audit',
      meta: { requiresStaff: true, seoKey: 'console', noindex: true },
      component: () => import('../pages/console/ConsoleAuditPage.vue'),
    },
  ],
})

router.beforeEach(async (to) => {
  if (!to.meta.requiresStaff) return true
  const auth = useAuthStore()
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
