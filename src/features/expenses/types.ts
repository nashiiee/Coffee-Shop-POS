export interface Expense {
  id: string
  description: string
  category: string
  amount: number
  incurredAt: string
  note: string | null
  createdBy: { name: string }
  createdAt: string
  updatedAt: string
}

export interface CreateExpensePayload {
  description: string
  category: string
  amount: number
  incurredAt: string
  note?: string
}

export interface UpdateExpensePayload {
  description?: string
  category?: string
  amount?: number
  incurredAt?: string
  note?: string | null
}

export interface ExpenseFilters {
  dateFrom?: string
  dateTo?: string
  category?: string
}
