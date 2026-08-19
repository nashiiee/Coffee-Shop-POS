export interface TopProduct {
  productId: string
  name: string
  quantitySold: number
  revenue: number
}

export interface PaymentBreakdownEntry {
  method: string
  total: number
  count: number
}

export interface LowStockProduct {
  productId: string
  name: string
  quantityOnHand: number
  reorderLevel: number
}

export interface RecentOrder {
  id: string
  sequenceNumber: number
  total: number
  createdAt: string
  cashierName: string
  paymentMethod: string | null
  itemCount: number
}

export interface SalesTrendPoint {
  date: string
  totalSales: number
  orderCount: number
}

export interface HourlySalesPoint {
  hour: number
  totalSales: number
}

export interface DashboardData {
  todaySales: number
  todayOrders: number
  averageOrderValue: number
  salesChangePercent: number | null
  ordersChangePercent: number | null
  averageOrderValueChangePercent: number | null
  cancelledOrdersToday: number
  cancelledOrdersChangePercent: number | null
  topProducts: TopProduct[]
  paymentMethodBreakdown: PaymentBreakdownEntry[]
  lowStockProducts: LowStockProduct[]
  recentOrders: RecentOrder[]
  salesTrend: SalesTrendPoint[]
  hourlySales: HourlySalesPoint[]
}
