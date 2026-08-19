import { apiRequest } from '../../lib/apiClient'
import type { AuditLogFilters, AuditLogListResponse } from './types'

type Token = string | null

function toQuery(params: object): string {
  const usp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') usp.set(key, String(value))
  }
  const query = usp.toString()
  return query ? `?${query}` : ''
}

export function listAuditLogs(accessToken: Token, filters: AuditLogFilters) {
  return apiRequest<AuditLogListResponse>(`/api/admin/audit-logs${toQuery(filters)}`, { accessToken })
}
