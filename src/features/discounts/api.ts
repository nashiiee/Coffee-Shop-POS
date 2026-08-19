import { apiRequest } from '../../lib/apiClient'
import type { CreateDiscountPayload, Discount, UpdateDiscountPayload } from './types'

type Token = string | null

export function listDiscounts(accessToken: Token) {
  return apiRequest<Discount[]>('/api/discounts', { accessToken })
}

export function createDiscount(accessToken: Token, data: CreateDiscountPayload) {
  return apiRequest<Discount>('/api/discounts', { method: 'POST', body: data, accessToken })
}

export function updateDiscount(accessToken: Token, id: string, data: UpdateDiscountPayload) {
  return apiRequest<Discount>(`/api/discounts/${id}`, { method: 'PATCH', body: data, accessToken })
}
