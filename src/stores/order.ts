import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ApiError } from '../api/client'
import {
  cancelOrder,
  checkoutOrder,
  confirmOrder,
  fetchOrder,
  fetchOrders,
  manualQuoteOrder,
  type Order,
} from '../api/orders'

export const useOrderStore = defineStore('order', () => {
  const items = ref<Order[]>([])
  const current = ref<Order | null>(null)
  const busy = ref(false)
  const error = ref('')

  function reset() {
    items.value = []
    current.value = null
    busy.value = false
    error.value = ''
  }

  async function loadList() {
    error.value = ''
    busy.value = true
    try {
      items.value = await fetchOrders()
      return items.value
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'load failed'
      return []
    } finally {
      busy.value = false
    }
  }

  async function loadOne(id: string) {
    error.value = ''
    busy.value = true
    try {
      current.value = await fetchOrder(id)
      return current.value
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'load failed'
      return null
    } finally {
      busy.value = false
    }
  }

  async function checkout() {
    error.value = ''
    busy.value = true
    try {
      current.value = await checkoutOrder(crypto.randomUUID())
      return current.value
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'checkout failed'
      return null
    } finally {
      busy.value = false
    }
  }

  async function applyManualQuote(lines: Array<{ id: string; line_amount: string }>) {
    if (!current.value) return null
    error.value = ''
    busy.value = true
    try {
      current.value = await manualQuoteOrder(current.value.id, {
        expected_row_version: current.value.row_version,
        lines,
      })
      return current.value
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'manual quote failed'
      return null
    } finally {
      busy.value = false
    }
  }

  async function confirm() {
    if (!current.value) return null
    error.value = ''
    busy.value = true
    try {
      current.value = await confirmOrder(current.value.id, current.value.row_version)
      return current.value
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'confirm failed'
      return null
    } finally {
      busy.value = false
    }
  }

  async function cancel() {
    if (!current.value) return null
    error.value = ''
    busy.value = true
    try {
      current.value = await cancelOrder(current.value.id, current.value.row_version)
      return current.value
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'cancel failed'
      return null
    } finally {
      busy.value = false
    }
  }

  return {
    items,
    current,
    busy,
    error,
    reset,
    loadList,
    loadOne,
    checkout,
    applyManualQuote,
    confirm,
    cancel,
  }
})
