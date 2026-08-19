import { apiRequest } from '../../lib/apiClient'
import type { CheckoutRequest, Discount, OrderRecord } from './types'

type Token = string | null

export function listDiscounts(accessToken: Token) {
  return apiRequest<Discount[]>('/api/discounts?activeOnly=true', { accessToken })
}

export function checkout(accessToken: Token, payload: CheckoutRequest) {
  return apiRequest<OrderRecord>('/api/checkout', { method: 'POST', body: payload, accessToken })
}
