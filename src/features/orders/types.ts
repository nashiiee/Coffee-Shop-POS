export interface OrderListItem {
  id: string
  sequenceNumber: number
  status: string
  subtotal: number
  discountAmount: number
  total: number
  createdAt: string
  cashier: { id: string; name: string }
  payment: { method: string } | null
  _count: { items: number }
}

export interface ListOrdersResponse {
  orders: OrderListItem[]
  total: number
  page: number
  pageSize: number
}

export interface OrderFilters {
  search?: string
  dateFrom?: string
  dateTo?: string
  cashierId?: string
  paymentMethod?: string
  status?: string
  sortBy?: string
  page?: number
  pageSize?: number
}

export interface CashierOption {
  id: string
  name: string
}
