import { apiRequest } from '../../lib/apiClient'
import type { LoginRequest, LoginResponse } from './types'

export function login(credentials: LoginRequest): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/api/auth/login', { method: 'POST', body: credentials })
}

export function refresh(): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/api/auth/refresh', { method: 'POST' })
}

export function logout(): Promise<void> {
  return apiRequest('/api/auth/logout', { method: 'POST' })
}
