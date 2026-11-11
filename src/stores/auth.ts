import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiRequest, clearCsrfCache, ensureCsrf } from '../api/client'

export type AuthUser = {
  id: string
  email: string
  display_name: string
  is_staff: boolean
}

export type Organization = {
  id: string
  name: string
  slug: string
  role: string
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const organizations = ref<Organization[]>([])
  const loaded = ref(false)
  const error = ref('')

  const isAuthenticated = computed(() => !!user.value)

  async function refreshMe() {
    error.value = ''
    try {
      await ensureCsrf()
      const me = await apiRequest<{ user: AuthUser; organizations: Organization[] }>('/me/')
      user.value = me.data.user
      organizations.value = me.data.organizations || []
    } catch (e: unknown) {
      user.value = null
      organizations.value = []
      if (e && typeof e === 'object' && 'status' in e && (e as { status: number }).status === 401) {
        return
      }
      error.value = e instanceof Error ? e.message : 'me_failed'
    } finally {
      loaded.value = true
    }
  }

  async function login(email: string, password: string) {
    const res = await apiRequest<{ user: AuthUser }>('/auth/login/', {
      method: 'POST',
      json: { email, password },
    })
    user.value = res.data.user
    await refreshMe()
    return res
  }

  async function register(email: string, password: string, displayName: string) {
    const res = await apiRequest<{ user: AuthUser }>('/auth/register/', {
      method: 'POST',
      json: { email, password, display_name: displayName },
    })
    user.value = res.data.user
    await refreshMe()
    return res
  }

  async function logout() {
    await apiRequest('/auth/logout/', { method: 'POST', json: {} })
    user.value = null
    organizations.value = []
    clearCsrfCache()
  }

  return { user, organizations, loaded, error, isAuthenticated, refreshMe, login, register, logout }
})
