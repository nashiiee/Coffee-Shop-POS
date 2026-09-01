import { prisma } from '../lib/prisma.js'
import { shopDayRange, shopMonthRange, SHOP_UTC_OFFSET_MINUTES } from '../lib/shopTime.js'
import type {
  CancelledOrdersQuery,
  DateRangeQuery,
  InventoryMovementQuery,
  SalesReportQuery,
} from '../schemas/reports.schema.js'

const PERIOD_DEFAULTS: Record<'daily' | 'weekly' | 'monthly', { unit: 'day' | 'week' | 'month'; days: number }> = {
  daily: { unit: 'day', days: 30 },
  weekly: { unit: 'week', days: 84 }, // 12 weeks
  monthly: { unit: 'month', days: 365 }, // 12 months
}

function resolveSalesRange(query: SalesReportQuery): { unit: 'day' | 'week' | 'month'; dateFrom: Date; dateTo: Date } {
  if (query.period === 'custom') {
    // Guaranteed present by the schema's refine() when period === 'custom'.
    return { unit: 'day', dateFrom: query.dateFrom!, dateTo: query.dateTo! }
  }
  const { unit, days } = PERIOD_DEFAULTS[query.period]
  const now = new Date()
  const dateTo = query.dateTo ?? shopDayRange(now).end
  const dateFrom = query.dateFrom ?? new Date(dateTo.getTime() - days * 24 * 60 * 60 * 1000)
  return { unit, dateFrom, dateTo }
}

// Default range for the non-sales reports (product/category/cashier/
// payment-method/discounts): the shop-local current month, when the admin
// doesn't supply an explicit range.
function resolveDefaultRange(query: DateRangeQuery): { dateFrom: Date; dateTo: Date } {
  if (query.dateFrom && query.dateTo) return { dateFrom: query.dateFrom, dateTo: query.dateTo }
  const { start, end } = shopMonthRange(new Date())
  return { dateFrom: query.dateFrom ?? start, dateTo: query.dateTo ?? end }
}

interface SalesBucketRow {
  bucket: Date
  totalSales: bigint
  totalDiscounts: bigint
  orderCount: bigint
}

export async function getSalesReport(query: SalesReportQuery) {
  const { unit, dateFrom, dateTo } = resolveSalesRange(query)
  // date_trunc's unit is bound as a parameter (not string-interpolated),
  // so this stays injection-safe even though it's dynamic; the zod enum
  // above additionally guarantees it can only ever be 'day' | 'week' | 'month'.
  //
  // "createdAt" AT TIME ZONE 'UTC' strips tz-awareness into a plain UTC
  // wall-clock timestamp before the shop offset is added — date_trunc on a
  // timestamptz implicitly converts to the Postgres session's TimeZone
  // first (this session runs as Asia/Manila, matching the host OS), so
  // without this the manual offset below double-counted on top of that
  // implicit conversion and bucketed orders into the wrong day.
  const rows = await prisma.$queryRaw<SalesBucketRow[]>`
    SELECT date_trunc(${unit}, ("createdAt" AT TIME ZONE 'UTC') + (${SHOP_UTC_OFFSET_MINUTES} * interval '1 minute'))::date AS bucket,
           COALESCE(SUM(total), 0)::bigint AS "totalSales",
           COALESCE(SUM("discountAmount"), 0)::bigint AS "totalDiscounts",
           COUNT(*)::bigint AS "orderCount"
    FROM "Order"
    WHERE status = 'COMPLETED' AND "createdAt" >= ${dateFrom} AND "createdAt" < ${dateTo}
    GROUP BY bucket
    ORDER BY bucket
  `
  return {
    period: query.period,
    dateFrom,
    dateTo,
    buckets: rows.map((row) => ({
      date: row.bucket.toISOString().slice(0, 10),
      totalSales: Number(row.totalSales),
      totalDiscounts: Number(row.totalDiscounts),
      orderCount: Number(row.orderCount),
    })),
  }
}

interface ProductSalesRow {
  productId: string
  name: string
  revenue: bigint
  quantitySold: bigint
}

// Grouped by (productId, name-at-time-of-sale) — a product that was
// renamed mid-range legitimately produces two rows, one per name that was
// actually shown to customers, matching this app's snapshot-preserves-
// history principle rather than silently merging them under whichever name
// is current now.
export async function getProductSalesReport(query: DateRangeQuery) {
  const { dateFrom, dateTo } = resolveDefaultRange(query)
  const rows = await prisma.$queryRaw<ProductSalesRow[]>`
    SELECT oi."productId", oi."productNameSnapshot" AS name,
           SUM(oi."lineSubtotal")::bigint AS revenue,
           SUM(oi.quantity)::bigint AS "quantitySold"
    FROM "OrderItem" oi
    JOIN "Order" o ON o.id = oi."orderId"
    WHERE o.status = 'COMPLETED' AND o."createdAt" >= ${dateFrom} AND o."createdAt" < ${dateTo}
    GROUP BY oi."productId", oi."productNameSnapshot"
    ORDER BY revenue DESC
  `
  return {
    dateFrom,
    dateTo,
    products: rows.map((row) => ({
      productId: row.productId,
      name: row.name,
      revenue: Number(row.revenue),
      quantitySold: Number(row.quantitySold),
    })),
  }
}

interface CategorySalesRow {
  categoryId: string
  categoryName: string
  revenue: bigint
  quantitySold: bigint
}

export async function getCategorySalesReport(query: DateRangeQuery) {
  const { dateFrom, dateTo } = resolveDefaultRange(query)
  // Unlike product sales, there is no categoryNameSnapshot on OrderItem —
  // this joins the LIVE Category table, so a product moved to a different
  // category after being sold reports under its CURRENT category, not the
  // one it was in at sale time. Category reassignment is rare enough that
  // this is an accepted, documented tradeoff rather than adding a snapshot
  // column for it.
  const rows = await prisma.$queryRaw<CategorySalesRow[]>`
    SELECT c.id AS "categoryId", c.name AS "categoryName",
           COALESCE(SUM(oi."lineSubtotal"), 0)::bigint AS revenue,
           COALESCE(SUM(oi.quantity), 0)::bigint AS "quantitySold"
    FROM "OrderItem" oi
    JOIN "Order" o ON o.id = oi."orderId"
    JOIN "Product" p ON p.id = oi."productId"
    JOIN "Category" c ON c.id = p."categoryId"
    WHERE o.status = 'COMPLETED' AND o."createdAt" >= ${dateFrom} AND o."createdAt" < ${dateTo}
    GROUP BY c.id, c.name
    ORDER BY revenue DESC
  `
  return {
    dateFrom,
    dateTo,
    categories: rows.map((row) => ({
      categoryId: row.categoryId,
      name: row.categoryName,
      revenue: Number(row.revenue),
      quantitySold: Number(row.quantitySold),
    })),
  }
}

interface CashierSalesRow {
  cashierId: string
  cashierName: string
  revenue: bigint
  orderCount: bigint
}

export async function getCashierSalesReport(query: DateRangeQuery) {
  const { dateFrom, dateTo } = resolveDefaultRange(query)
  const rows = await prisma.$queryRaw<CashierSalesRow[]>`
    SELECT o."cashierId", u.name AS "cashierName",
           SUM(o.total)::bigint AS revenue,
           COUNT(*)::bigint AS "orderCount"
    FROM "Order" o
    JOIN "User" u ON u.id = o."cashierId"
    WHERE o.status = 'COMPLETED' AND o."createdAt" >= ${dateFrom} AND o."createdAt" < ${dateTo}
    GROUP BY o."cashierId", u.name
    ORDER BY revenue DESC
  `
  return {
    dateFrom,
    dateTo,
    cashiers: rows.map((row) => ({
      cashierId: row.cashierId,
      name: row.cashierName,
      revenue: Number(row.revenue),
      orderCount: Number(row.orderCount),
    })),
  }
}

interface PaymentMethodRow {
  method: string
  revenue: bigint
  orderCount: bigint
}

export async function getPaymentMethodReport(query: DateRangeQuery) {
  const { dateFrom, dateTo } = resolveDefaultRange(query)
  const rows = await prisma.$queryRaw<PaymentMethodRow[]>`
    SELECT p.method,
           SUM(p."amountDue")::bigint AS revenue,
           COUNT(*)::bigint AS "orderCount"
    FROM "Payment" p
    JOIN "Order" o ON o.id = p."orderId"
    WHERE o.status = 'COMPLETED' AND o."createdAt" >= ${dateFrom} AND o."createdAt" < ${dateTo}
    GROUP BY p.method
    ORDER BY revenue DESC
  `
  return {
    dateFrom,
    dateTo,
    methods: rows.map((row) => ({ method: row.method, revenue: Number(row.revenue), orderCount: Number(row.orderCount) })),
  }
}

interface DiscountUsageRow {
  name: string | null
  totalDiscounted: bigint
  timesUsed: bigint
}

export async function getDiscountsReport(query: DateRangeQuery) {
  const { dateFrom, dateTo } = resolveDefaultRange(query)
  const rows = await prisma.$queryRaw<DiscountUsageRow[]>`
    SELECT o."discountNameSnapshot" AS name,
           SUM(o."discountAmount")::bigint AS "totalDiscounted",
           COUNT(*)::bigint AS "timesUsed"
    FROM "Order" o
    WHERE o.status = 'COMPLETED' AND o."discountId" IS NOT NULL
      AND o."createdAt" >= ${dateFrom} AND o."createdAt" < ${dateTo}
    GROUP BY o."discountNameSnapshot"
    ORDER BY "totalDiscounted" DESC
  `
  return {
    dateFrom,
    dateTo,
    discounts: rows.map((row) => ({
      name: row.name ?? '(unnamed)',
      totalDiscounted: Number(row.totalDiscounted),
      timesUsed: Number(row.timesUsed),
    })),
  }
}

export async function getCancelledOrdersReport(query: CancelledOrdersQuery) {
  const { dateFrom, dateTo } = resolveDefaultRange(query)
  const where = {
    status: { in: ['CANCELLED', 'REFUNDED'] as ('CANCELLED' | 'REFUNDED')[] },
    createdAt: { gte: dateFrom, lt: dateTo },
  }
  const skip = (query.page - 1) * query.pageSize
  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: query.pageSize,
      select: {
        id: true,
        sequenceNumber: true,
        status: true,
        total: true,
        createdAt: true,
        cashier: { select: { name: true } },
      },
    }),
  ])
  return { dateFrom, dateTo, orders, total, page: query.page, pageSize: query.pageSize }
}

export async function getInventoryMovementReport(query: InventoryMovementQuery) {
  const { dateFrom, dateTo } = resolveDefaultRange(query)
  const where = {
    createdAt: { gte: dateFrom, lt: dateTo },
    ...(query.type ? { type: query.type } : {}),
  }
  const skip = (query.page - 1) * query.pageSize
  const [total, transactions, summaryRaw] = await Promise.all([
    prisma.inventoryTransaction.count({ where }),
    prisma.inventoryTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: query.pageSize,
      select: {
        id: true,
        type: true,
        quantityChange: true,
        quantityAfter: true,
        reason: true,
        createdAt: true,
        inventoryItem: { select: { product: { select: { name: true } } } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.inventoryTransaction.groupBy({
      by: ['type'],
      where,
      _sum: { quantityChange: true },
      _count: { _all: true },
    }),
  ])
  return {
    dateFrom,
    dateTo,
    total,
    page: query.page,
    pageSize: query.pageSize,
    transactions: transactions.map((t) => ({
      id: t.id,
      type: t.type,
      quantityChange: t.quantityChange,
      quantityAfter: t.quantityAfter,
      reason: t.reason,
      createdAt: t.createdAt,
      productName: t.inventoryItem.product.name,
      createdByName: t.createdBy.name,
    })),
    summaryByType: summaryRaw.map((row) => ({
      type: row.type,
      quantityDelta: row._sum.quantityChange ?? 0,
      transactionCount: row._count._all,
    })),
  }
}
