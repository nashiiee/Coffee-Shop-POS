export interface SalesReportBucket {
  date: string
  totalSales: number
  totalDiscounts: number
  orderCount: number
}

export interface SalesReport {
  period: string
  dateFrom: string
  dateTo: string
  buckets: SalesReportBucket[]
}

export interface ProductSalesReport {
  dateFrom: string
  dateTo: string
  products: { productId: string; name: string; revenue: number; quantitySold: number }[]
}

export interface CategorySalesReport {
  dateFrom: string
  dateTo: string
  categories: { categoryId: string; name: string; revenue: number; quantitySold: number }[]
}

export interface CashierSalesReport {
  dateFrom: string
  dateTo: string
  cashiers: { cashierId: string; name: string; revenue: number; orderCount: number }[]
}

export interface PaymentMethodReport {
  dateFrom: string
  dateTo: string
  methods: { method: string; revenue: number; orderCount: number }[]
}

export interface DiscountsReport {
  dateFrom: string
  dateTo: string
  discounts: { name: string; totalDiscounted: number; timesUsed: number }[]
}

export interface CancelledOrdersReport {
  dateFrom: string
  dateTo: string
  total: number
  page: number
  pageSize: number
  orders: {
    id: string
    sequenceNumber: number
    status: string
    total: number
    createdAt: string
    cashier: { name: string }
  }[]
}

export interface InventoryMovementReport {
  dateFrom: string
  dateTo: string
  total: number
  page: number
  pageSize: number
  transactions: {
    id: string
    type: string
    quantityChange: number
    quantityAfter: number
    reason: string | null
    createdAt: string
    productName: string
    createdByName: string
  }[]
  summaryByType: { type: string; quantityDelta: number; transactionCount: number }[]
}
