import { apiRequest } from '../../lib/apiClient'
import type { DashboardData } from './types'

type Token = string | null

export function getDashboard(accessToken: Token) {
  return apiRequest<DashboardData>('/api/admin/dashboard', { accessToken })
}
