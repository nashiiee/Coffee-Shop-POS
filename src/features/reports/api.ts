import { apiRequest } from '../../lib/apiClient'
import type {
  CancelledOrdersReport,
  CashierSalesReport,
  CategorySalesReport,
  DiscountsReport,
  InventoryMovementReport,
  PaymentMethodReport,
  ProductSalesReport,
  SalesReport,
} from './types'

type Token = string | null

function toQuery(params: object): string {
  const usp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') usp.set(key, String(value))
  }
  const query = usp.toString()
  return query ? `?${query}` : ''
}

export interface DateRangeParams {
  dateFrom?: string
  dateTo?: string
}

export function getSalesReport(accessToken: Token, params: DateRangeParams & { period: string }) {
  return apiRequest<SalesReport>(`/api/admin/reports/sales${toQuery(params)}`, { accessToken })
}

export function getProductSalesReport(accessToken: Token, params: DateRangeParams) {
  return apiRequest<ProductSalesReport>(`/api/admin/reports/products${toQuery(params)}`, { accessToken })
}

export function getCategorySalesReport(accessToken: Token, params: DateRangeParams) {
  return apiRequest<CategorySalesReport>(`/api/admin/reports/categories${toQuery(params)}`, { accessToken })
}

export function getCashierSalesReport(accessToken: Token, params: DateRangeParams) {
  return apiRequest<CashierSalesReport>(`/api/admin/reports/cashiers${toQuery(params)}`, { accessToken })
}

export function getPaymentMethodReport(accessToken: Token, params: DateRangeParams) {
  return apiRequest<PaymentMethodReport>(`/api/admin/reports/payment-methods${toQuery(params)}`, { accessToken })
}

export function getDiscountsReport(accessToken: Token, params: DateRangeParams) {
  return apiRequest<DiscountsReport>(`/api/admin/reports/discounts${toQuery(params)}`, { accessToken })
}

export function getCancelledOrdersReport(accessToken: Token, params: DateRangeParams & { page?: number; pageSize?: number }) {
  return apiRequest<CancelledOrdersReport>(`/api/admin/reports/cancelled-orders${toQuery(params)}`, { accessToken })
}

export function getInventoryMovementReport(
  accessToken: Token,
  params: DateRangeParams & { type?: string; page?: number; pageSize?: number },
) {
  return apiRequest<InventoryMovementReport>(`/api/admin/reports/inventory-movement${toQuery(params)}`, { accessToken })
}
