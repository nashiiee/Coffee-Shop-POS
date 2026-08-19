import { apiRequest } from '../../lib/apiClient'
import type { OrderRecord } from '../checkout/types'
import type { CashierOption, ListOrdersResponse, OrderFilters } from './types'

type Token = string | null

function buildQueryString(filters: OrderFilters): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') {
      params.set(key, String(value))
    }
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}

export function listOrders(accessToken: Token, filters: OrderFilters) {
  return apiRequest<ListOrdersResponse>(`/api/orders${buildQueryString(filters)}`, { accessToken })
}

export function getOrder(accessToken: Token, id: string) {
  return apiRequest<OrderRecord>(`/api/orders/${id}`, { accessToken })
}

export function listCashiers(accessToken: Token) {
  return apiRequest<CashierOption[]>('/api/orders/cashiers', { accessToken })
}
