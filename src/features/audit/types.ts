export interface AuditLogEntry {
  id: string
  actorId: string
  actorName: string
  action: string
  resource: string
  resourceId: string
  previousState: unknown
  newState: unknown
  createdAt: string
}

export interface AuditLogListResponse {
  logs: AuditLogEntry[]
  total: number
  page: number
  pageSize: number
}

export interface AuditLogFilters {
  action?: string
  resource?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}
