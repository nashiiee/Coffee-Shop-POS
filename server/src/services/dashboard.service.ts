import type { OrderStatus } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { shopDayRange, SHOP_UTC_OFFSET_MINUTES } from '../lib/shopTime.js'

const TOP_PRODUCTS_WINDOW_DAYS = 30
const TOP_PRODUCTS_LIMIT = 5
const RECENT_ORDERS_LIMIT = 10
const TREND_DAYS = 7
const LOW_STOCK_LIMIT = 10

interface TrendRow {
  bucket: Date
  totalSales: bigint | number
  orderCount: bigint | number
}

interface HourRow {
  hour: number
  totalSales: bigint | number
}

interface LowStockRow {
  id: string
  name: string
  quantityOnHand: number
  reorderLevel: number
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null // "no prior baseline" rather than a misleading +Infinity%
  return ((current - previous) / previous) * 100
}

export async function getDashboard(now: Date = new Date()) {
  const { start: todayStart, end: todayEnd } = shopDayRange(now)
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)
  const productsWindowStart = new Date(todayEnd.getTime() - TOP_PRODUCTS_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const trendStart = new Date(todayEnd.getTime() - TREND_DAYS * 24 * 60 * 60 * 1000)

  const cancelledStatuses: OrderStatus[] = ['CANCELLED', 'REFUNDED']

  const [
    todayAgg,
    yesterdayAgg,
    todayCancelledCount,
    yesterdayCancelledCount,
    topProductsRaw,
    paymentBreakdown,
    lowStock,
    recentOrders,
    trendRows,
    hourRows,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: { status: 'COMPLETED', createdAt: { gte: todayStart, lt: todayEnd } },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.order.aggregate({
      where: { status: 'COMPLETED', createdAt: { gte: yesterdayStart, lt: todayStart } },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.order.count({
      where: { status: { in: cancelledStatuses }, createdAt: { gte: todayStart, lt: todayEnd } },
    }),
    prisma.order.count({
      where: { status: { in: cancelledStatuses }, createdAt: { gte: yesterdayStart, lt: todayStart } },
    }),
    prisma.orderItem.groupBy({
      by: ['productId', 'productNameSnapshot'],
      where: {
        order: { status: 'COMPLETED', createdAt: { gte: productsWindowStart, lt: todayEnd } },
      },
      _sum: { lineSubtotal: true, quantity: true },
      orderBy: { _sum: { lineSubtotal: 'desc' } },
      take: TOP_PRODUCTS_LIMIT,
    }),
    prisma.payment.groupBy({
      by: ['method'],
      where: {
        order: { status: 'COMPLETED', createdAt: { gte: todayStart, lt: todayEnd } },
      },
      _sum: { amountDue: true },
      _count: { _all: true },
    }),
    // Cross-column comparison (quantityOnHand <= reorderLevel) isn't
    // expressible in Prisma's fluent where-clause, so this is raw SQL
    // rather than fetching every InventoryItem and filtering in JS.
    prisma.$queryRaw<LowStockRow[]>`
      SELECT p.id, p.name, ii."quantityOnHand", ii."reorderLevel"
      FROM "InventoryItem" ii
      JOIN "Product" p ON p.id = ii."productId"
      WHERE p."isActive" = true AND ii."quantityOnHand" <= ii."reorderLevel"
      ORDER BY (ii."reorderLevel" - ii."quantityOnHand") DESC
      LIMIT ${LOW_STOCK_LIMIT}
    `,
    prisma.order.findMany({
      where: { status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      take: RECENT_ORDERS_LIMIT,
      select: {
        id: true,
        sequenceNumber: true,
        total: true,
        createdAt: true,
        cashier: { select: { name: true } },
        payment: { select: { method: true } },
        _count: { select: { items: true } },
      },
    }),
    // Daily bucketing is a GROUP BY date_trunc(...) — not something Prisma's
    // groupBy can express (it only groups by actual columns), so this one
    // query is raw SQL rather than fetching every order row in the window
    // and bucketing in JS. SHOP_UTC_OFFSET_MINUTES is bound as a parameter,
    // not string-interpolated, so this stays injection-safe.
    //
    // "createdAt" AT TIME ZONE 'UTC' first strips tz-awareness into a plain
    // UTC wall-clock timestamp — required because date_trunc/EXTRACT on a
    // timestamptz implicitly convert to the Postgres session's TimeZone
    // setting before reading fields. This session runs with TimeZone =
    // Asia/Manila (matching the host OS), so without this the manual +8h
    // shift below got applied on top of an implicit +8h session conversion,
    // double-counting the offset and bucketing everything ~8h into the
    // future/wrong day.
    prisma.$queryRaw<TrendRow[]>`
      SELECT date_trunc('day', ("createdAt" AT TIME ZONE 'UTC') + (${SHOP_UTC_OFFSET_MINUTES} * interval '1 minute'))::date AS bucket,
             COALESCE(SUM(total), 0)::bigint AS "totalSales",
             COUNT(*)::bigint AS "orderCount"
      FROM "Order"
      WHERE status = 'COMPLETED' AND "createdAt" >= ${trendStart} AND "createdAt" < ${todayEnd}
      GROUP BY bucket
      ORDER BY bucket
    `,
    // Today's Sales Overview chart is hour-of-day, not calendar-day, so this
    // is a separate bucket-by-hour query scoped to just today's window. See
    // the AT TIME ZONE 'UTC' note above — same session-timezone pitfall.
    prisma.$queryRaw<HourRow[]>`
      SELECT EXTRACT(HOUR FROM ("createdAt" AT TIME ZONE 'UTC') + (${SHOP_UTC_OFFSET_MINUTES} * interval '1 minute'))::int AS hour,
             COALESCE(SUM(total), 0)::bigint AS "totalSales"
      FROM "Order"
      WHERE status = 'COMPLETED' AND "createdAt" >= ${todayStart} AND "createdAt" < ${todayEnd}
      GROUP BY hour
      ORDER BY hour
    `,
  ])

  const todaySales = todayAgg._sum.total ?? 0
  const todayOrders = todayAgg._count._all
  const yesterdaySales = yesterdayAgg._sum.total ?? 0
  const yesterdayOrders = yesterdayAgg._count._all

  const trendByDate = new Map(
    trendRows.map((row) => [
      row.bucket.toISOString().slice(0, 10),
      { totalSales: Number(row.totalSales), orderCount: Number(row.orderCount) },
    ]),
  )
  const salesTrend = Array.from({ length: TREND_DAYS }, (_, i) => {
    // trendStart/i-step are shop-local midnight UTC instants (see shopTime.ts);
    // shifting by the shop offset before slicing mirrors the SQL side's
    // `createdAt + offset` so both derive the same shop-local calendar date.
    const date = new Date(trendStart.getTime() + i * 24 * 60 * 60 * 1000 + SHOP_UTC_OFFSET_MINUTES * 60_000)
    const key = date.toISOString().slice(0, 10)
    const bucket = trendByDate.get(key)
    return { date: key, totalSales: bucket?.totalSales ?? 0, orderCount: bucket?.orderCount ?? 0 }
  })

  const averageOrderValue = todayOrders > 0 ? Math.round(todaySales / todayOrders) : 0
  const yesterdayAverageOrderValue = yesterdayOrders > 0 ? Math.round(yesterdaySales / yesterdayOrders) : 0

  return {
    todaySales,
    todayOrders,
    averageOrderValue,
    salesChangePercent: percentChange(todaySales, yesterdaySales),
    ordersChangePercent: percentChange(todayOrders, yesterdayOrders),
    averageOrderValueChangePercent: percentChange(averageOrderValue, yesterdayAverageOrderValue),
    cancelledOrdersToday: todayCancelledCount,
    cancelledOrdersChangePercent: percentChange(todayCancelledCount, yesterdayCancelledCount),
    topProducts: topProductsRaw.map((row) => ({
      productId: row.productId,
      name: row.productNameSnapshot,
      quantitySold: row._sum.quantity ?? 0,
      revenue: row._sum.lineSubtotal ?? 0,
    })),
    paymentMethodBreakdown: paymentBreakdown.map((row) => ({
      method: row.method,
      total: row._sum.amountDue ?? 0,
      count: row._count._all,
    })),
    lowStockProducts: lowStock.map((row) => ({
      productId: row.id,
      name: row.name,
      quantityOnHand: row.quantityOnHand,
      reorderLevel: row.reorderLevel,
    })),
    recentOrders: recentOrders.map((order) => ({
      id: order.id,
      sequenceNumber: order.sequenceNumber,
      total: order.total,
      createdAt: order.createdAt,
      cashierName: order.cashier.name,
      paymentMethod: order.payment?.method ?? null,
      itemCount: order._count.items,
    })),
    salesTrend,
    hourlySales: (() => {
      const byHour = new Map(hourRows.map((row) => [row.hour, Number(row.totalSales)]))
      return Array.from({ length: 24 }, (_, hour) => ({ hour, totalSales: byHour.get(hour) ?? 0 }))
    })(),
  }
}
