import { apiRequest } from '../../lib/apiClient'
import type { CreateExpensePayload, Expense, ExpenseFilters, UpdateExpensePayload } from './types'

type Token = string | null

function toQuery(params: ExpenseFilters): string {
  const usp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') usp.set(key, String(value))
  }
  const query = usp.toString()
  return query ? `?${query}` : ''
}

export function listExpenses(accessToken: Token, filters: ExpenseFilters = {}) {
  return apiRequest<Expense[]>(`/api/expenses${toQuery(filters)}`, { accessToken })
}

export function createExpense(accessToken: Token, data: CreateExpensePayload) {
  return apiRequest<Expense>('/api/expenses', { method: 'POST', body: data, accessToken })
}

export function updateExpense(accessToken: Token, id: string, data: UpdateExpensePayload) {
  return apiRequest<Expense>(`/api/expenses/${id}`, { method: 'PATCH', body: data, accessToken })
}

export function deleteExpense(accessToken: Token, id: string) {
  return apiRequest<void>(`/api/expenses/${id}`, { method: 'DELETE', accessToken })
}
