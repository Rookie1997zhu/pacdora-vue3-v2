import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  addCartItem,
  fetchCart,
  removeCartItem,
  updateCartItem,
  type Cart,
} from '../api/cart'
import { ApiError } from '../api/client'

export const useCartStore = defineStore('cart', () => {
  const cart = ref<Cart | null>(null)
  const busy = ref(false)
  const error = ref('')
  const errorCode = ref('')

  const itemCount = computed(() => cart.value?.items.length || 0)

  function reset() {
    cart.value = null
    busy.value = false
    error.value = ''
    errorCode.value = ''
  }

  async function load() {
    error.value = ''
    errorCode.value = ''
    busy.value = true
    try {
      cart.value = await fetchCart()
      return cart.value
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        errorCode.value = e.code
        error.value = e.message
      } else {
        error.value = e instanceof Error ? e.message : 'cart failed'
      }
      return null
    } finally {
      busy.value = false
    }
  }

  async function add(payload: { design_revision_id: string; quantity: number; quote_id?: string }) {
    error.value = ''
    errorCode.value = ''
    busy.value = true
    try {
      const data = await addCartItem(payload)
      cart.value = data.cart
      return data.item
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        errorCode.value = e.code
        error.value = e.message
      } else {
        error.value = e instanceof Error ? e.message : 'add failed'
      }
      return null
    } finally {
      busy.value = false
    }
  }

  async function setQuantity(itemId: string, quantity: number) {
    error.value = ''
    busy.value = true
    try {
      const data = await updateCartItem(itemId, quantity)
      cart.value = data.cart
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'update failed'
    } finally {
      busy.value = false
    }
  }

  async function remove(itemId: string) {
    error.value = ''
    busy.value = true
    try {
      cart.value = await removeCartItem(itemId)
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'remove failed'
    } finally {
      busy.value = false
    }
  }

  return { cart, busy, error, errorCode, itemCount, reset, load, add, setQuantity, remove }
})
