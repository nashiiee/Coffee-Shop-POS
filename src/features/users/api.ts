import { apiRequest } from '../../lib/apiClient'
import type { Cashier } from './types'

type Token = string | null

export function listCashiers(accessToken: Token) {
  return apiRequest<Cashier[]>('/api/admin/users', { accessToken })
}

export function createCashier(accessToken: Token, data: { name: string; email: string; password: string }) {
  return apiRequest<Cashier>('/api/admin/users', { method: 'POST', body: data, accessToken })
}

export function disableUser(accessToken: Token, id: string) {
  return apiRequest<Cashier>(`/api/admin/users/${id}/disable`, { method: 'PATCH', accessToken })
}

export function reactivateUser(accessToken: Token, id: string) {
  return apiRequest<Cashier>(`/api/admin/users/${id}/reactivate`, { method: 'PATCH', accessToken })
}

export function resetPassword(accessToken: Token, id: string, password: string) {
  return apiRequest<void>(`/api/admin/users/${id}/reset-password`, { method: 'PATCH', body: { password }, accessToken })
}
