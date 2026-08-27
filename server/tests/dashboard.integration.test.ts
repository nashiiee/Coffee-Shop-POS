import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'

const orderAggregate = vi.fn()
const orderCount = vi.fn()
const orderItemGroupBy = vi.fn()
const paymentGroupBy = vi.fn()
const orderFindMany = vi.fn()
const queryRaw = vi.fn()
const shopFindUnique = vi.fn()

const mockPrisma = {
  order: { aggregate: orderAggregate, count: orderCount, findMany: orderFindMany },
  orderItem: { groupBy: orderItemGroupBy },
  payment: { groupBy: paymentGroupBy },
  shop: { findUnique: shopFindUnique },
  $queryRaw: queryRaw,
}

vi.mock('../src/lib/prisma.js', () => ({ prisma: mockPrisma }))

const { createApp } = await import('../src/app.js')
const { signAccessToken } = await import('../src/lib/jwt.js')

const app = createApp()
const adminToken = signAccessToken({ sub: 'admin-1', role: 'ADMIN', shopId: 'shop-1' })
const cashierToken = signAccessToken({ sub: 'cashier-1', role: 'CASHIER', shopId: 'shop-1' })

const emptyAgg = { _sum: { total: null }, _count: { _all: 0 } }

beforeEach(() => {
  vi.clearAllMocks()
  orderAggregate.mockResolvedValue(emptyAgg)
  orderCount.mockResolvedValue(0)
  orderItemGroupBy.mockResolvedValue([])
  paymentGroupBy.mockResolvedValue([])
  orderFindMany.mockResolvedValue([])
  queryRaw.mockResolvedValue([]) // low-stock query and trend query both use $queryRaw
  shopFindUnique.mockResolvedValue({ subscriptionStatus: 'ACTIVE' })
})

describe('GET /api/admin/dashboard — authorization', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/admin/dashboard')
    expect(res.status).toBe(401)
  })

  it('rejects a cashier', async () => {
    const res = await request(app).get('/api/admin/dashboard').set('Authorization', `Bearer ${cashierToken}`)
    expect(res.status).toBe(403)
  })

  it('allows an admin', async () => {
    const res = await request(app).get('/api/admin/dashboard').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })
})

describe('GET /api/admin/dashboard — financial edge cases', () => {
  it('returns zero average order value (never NaN/Infinity) when there are no orders today', async () => {
    orderAggregate.mockResolvedValue(emptyAgg)
    const res = await request(app).get('/api/admin/dashboard').set('Authorization', `Bearer ${adminToken}`)
    expect(res.body.todaySales).toBe(0)
    expect(res.body.todayOrders).toBe(0)
    expect(res.body.averageOrderValue).toBe(0)
  })

  it('computes average order value from today\'s sum and count', async () => {
    orderAggregate.mockResolvedValueOnce({ _sum: { total: 40000 }, _count: { _all: 4 } }) // today
    orderAggregate.mockResolvedValueOnce(emptyAgg) // yesterday
    const res = await request(app).get('/api/admin/dashboard').set('Authorization', `Bearer ${adminToken}`)
    expect(res.body.todaySales).toBe(40000)
    expect(res.body.todayOrders).toBe(4)
    expect(res.body.averageOrderValue).toBe(10000)
  })

  it('reports no percent change (null) when yesterday had zero sales but today has some — avoids a misleading +Infinity%', async () => {
    orderAggregate.mockResolvedValueOnce({ _sum: { total: 5000 }, _count: { _all: 1 } }) // today
    orderAggregate.mockResolvedValueOnce(emptyAgg) // yesterday: zero
    const res = await request(app).get('/api/admin/dashboard').set('Authorization', `Bearer ${adminToken}`)
    expect(res.body.salesChangePercent).toBeNull()
  })

  it('reports 0% change when both today and yesterday had zero sales', async () => {
    orderAggregate.mockResolvedValueOnce(emptyAgg)
    orderAggregate.mockResolvedValueOnce(emptyAgg)
    const res = await request(app).get('/api/admin/dashboard').set('Authorization', `Bearer ${adminToken}`)
    expect(res.body.salesChangePercent).toBe(0)
  })

  it('computes a positive percent change correctly', async () => {
    orderAggregate.mockResolvedValueOnce({ _sum: { total: 15000 }, _count: { _all: 3 } }) // today
    orderAggregate.mockResolvedValueOnce({ _sum: { total: 10000 }, _count: { _all: 2 } }) // yesterday
    const res = await request(app).get('/api/admin/dashboard').set('Authorization', `Bearer ${adminToken}`)
    expect(res.body.salesChangePercent).toBe(50)
  })

  it('computes average-order-value percent change from today vs. yesterday averages, not raw totals', async () => {
    orderAggregate.mockResolvedValueOnce({ _sum: { total: 15000 }, _count: { _all: 3 } }) // today: avg 5000
    orderAggregate.mockResolvedValueOnce({ _sum: { total: 10000 }, _count: { _all: 2 } }) // yesterday: avg 5000
    const res = await request(app).get('/api/admin/dashboard').set('Authorization', `Bearer ${adminToken}`)
    expect(res.body.averageOrderValue).toBe(5000)
    expect(res.body.averageOrderValueChangePercent).toBe(0) // same average despite different totals/counts
  })

  it('reports null average-order-value change when yesterday had no orders', async () => {
    orderAggregate.mockResolvedValueOnce({ _sum: { total: 15000 }, _count: { _all: 3 } }) // today
    orderAggregate.mockResolvedValueOnce({ _sum: { total: null }, _count: { _all: 0 } }) // yesterday: no orders
    const res = await request(app).get('/api/admin/dashboard').set('Authorization', `Bearer ${adminToken}`)
    expect(res.body.averageOrderValueChangePercent).toBeNull()
  })
})

describe('GET /api/admin/dashboard — response shape', () => {
  it('includes every dashboard widget in a single response', async () => {
    const res = await request(app).get('/api/admin/dashboard').set('Authorization', `Bearer ${adminToken}`)
    expect(res.body).toEqual(
      expect.objectContaining({
        todaySales: expect.any(Number),
        todayOrders: expect.any(Number),
        averageOrderValue: expect.any(Number),
        cancelledOrdersToday: expect.any(Number),
        topProducts: expect.any(Array),
        paymentMethodBreakdown: expect.any(Array),
        lowStockProducts: expect.any(Array),
        recentOrders: expect.any(Array),
        salesTrend: expect.any(Array),
      }),
    )
  })

  it('computes cancelled-orders-today from the dedicated count query, independent of the sales aggregate', async () => {
    orderCount.mockResolvedValueOnce(2).mockResolvedValueOnce(5) // today=2, yesterday=5
    const res = await request(app).get('/api/admin/dashboard').set('Authorization', `Bearer ${adminToken}`)
    expect(res.body.cancelledOrdersToday).toBe(2)
    expect(res.body.cancelledOrdersChangePercent).toBe(-60)
  })

  it('fills every day in the 7-day trend, even days with zero orders', async () => {
    const res = await request(app).get('/api/admin/dashboard').set('Authorization', `Bearer ${adminToken}`)
    expect(res.body.salesTrend).toHaveLength(7)
    expect(res.body.salesTrend[0]).toEqual({ date: expect.any(String), totalSales: 0, orderCount: 0 })
  })

  it('fills every hour of today in the hourly sales breakdown, even hours with zero orders', async () => {
    const res = await request(app).get('/api/admin/dashboard').set('Authorization', `Bearer ${adminToken}`)
    expect(res.body.hourlySales).toHaveLength(24)
    expect(res.body.hourlySales[0]).toEqual({ hour: 0, totalSales: 0 })
    expect(res.body.hourlySales[23]).toEqual({ hour: 23, totalSales: 0 })
  })
})
