import { createRouter, createWebHistory } from 'vue-router'

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
  ],
})

export default router
