import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'

const queryRaw = vi.fn()
const orderCount = vi.fn()
const orderFindMany = vi.fn()
const inventoryTransactionCount = vi.fn()
const inventoryTransactionFindMany = vi.fn()
const inventoryTransactionGroupBy = vi.fn()

const mockPrisma = {
  $queryRaw: queryRaw,
  order: { count: orderCount, findMany: orderFindMany },
  inventoryTransaction: {
    count: inventoryTransactionCount,
    findMany: inventoryTransactionFindMany,
    groupBy: inventoryTransactionGroupBy,
  },
}

vi.mock('../src/lib/prisma.js', () => ({ prisma: mockPrisma }))

const { createApp } = await import('../src/app.js')
const { signAccessToken } = await import('../src/lib/jwt.js')

const app = createApp()
const adminToken = signAccessToken({ sub: 'admin-1', role: 'ADMIN' })
const cashierToken = signAccessToken({ sub: 'cashier-1', role: 'CASHIER' })

beforeEach(() => {
  vi.clearAllMocks()
  queryRaw.mockResolvedValue([])
  orderCount.mockResolvedValue(0)
  orderFindMany.mockResolvedValue([])
  inventoryTransactionCount.mockResolvedValue(0)
  inventoryTransactionFindMany.mockResolvedValue([])
  inventoryTransactionGroupBy.mockResolvedValue([])
})

const REPORT_ROUTES = [
  '/api/admin/reports/sales',
  '/api/admin/reports/products',
  '/api/admin/reports/categories',
  '/api/admin/reports/cashiers',
  '/api/admin/reports/payment-methods',
  '/api/admin/reports/discounts',
  '/api/admin/reports/cancelled-orders',
  '/api/admin/reports/inventory-movement',
]

describe('Admin reports — authorization (cashiers must not access admin reports)', () => {
  for (const route of REPORT_ROUTES) {
    it(`rejects an unauthenticated request to ${route}`, async () => {
      const res = await request(app).get(route)
      expect(res.status).toBe(401)
    })

    it(`rejects a cashier on ${route}`, async () => {
      const res = await request(app).get(route).set('Authorization', `Bearer ${cashierToken}`)
      expect(res.status).toBe(403)
    })

    it(`allows an admin on ${route}`, async () => {
      const res = await request(app).get(route).set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
    })
  }
})

describe('GET /api/admin/reports/sales', () => {
  it('defaults to the daily period with a 30-day window', async () => {
    await request(app).get('/api/admin/reports/sales').set('Authorization', `Bearer ${adminToken}`)
    expect(queryRaw).toHaveBeenCalled()
  })

  it('rejects period=custom without dateFrom/dateTo', async () => {
    const res = await request(app).get('/api/admin/reports/sales?period=custom').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(400)
  })

  it('accepts period=custom with an explicit range', async () => {
    const res = await request(app)
      .get('/api/admin/reports/sales?period=custom&dateFrom=2026-01-01&dateTo=2026-01-31')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })

  it('rejects an invalid period value', async () => {
    const res = await request(app).get('/api/admin/reports/sales?period=yearly').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(400)
  })

  it('rejects a reversed date range (dateFrom after dateTo)', async () => {
    const res = await request(app)
      .get('/api/admin/reports/sales?period=custom&dateFrom=2026-02-01&dateTo=2026-01-01')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(400)
  })

  it('returns bucketed totals from the raw aggregation query', async () => {
    queryRaw.mockResolvedValue([
      { bucket: new Date('2026-01-15'), totalSales: 40000n, totalDiscounts: 4000n, orderCount: 3n },
    ])
    const res = await request(app).get('/api/admin/reports/sales').set('Authorization', `Bearer ${adminToken}`)
    expect(res.body.buckets).toEqual([{ date: '2026-01-15', totalSales: 40000, totalDiscounts: 4000, orderCount: 3 }])
  })
})

describe('GET /api/admin/reports/cancelled-orders', () => {
  it('paginates results', async () => {
    orderCount.mockResolvedValue(45)
    await request(app).get('/api/admin/reports/cancelled-orders?page=2&pageSize=10').set('Authorization', `Bearer ${adminToken}`)
    expect(orderFindMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10 }))
  })

  it('only queries CANCELLED and REFUNDED orders', async () => {
    await request(app).get('/api/admin/reports/cancelled-orders').set('Authorization', `Bearer ${adminToken}`)
    expect(orderFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: { in: ['CANCELLED', 'REFUNDED'] } }) }),
    )
  })

  it('rejects a pageSize over the cap', async () => {
    const res = await request(app).get('/api/admin/reports/cancelled-orders?pageSize=500').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(400)
  })
})

describe('GET /api/admin/reports/inventory-movement', () => {
  it('paginates and returns a per-type summary alongside the transaction list', async () => {
    inventoryTransactionCount.mockResolvedValue(3)
    inventoryTransactionGroupBy.mockResolvedValue([{ type: 'SALE', _sum: { quantityChange: -12 }, _count: { _all: 5 } }])
    const res = await request(app).get('/api/admin/reports/inventory-movement').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.summaryByType).toEqual([{ type: 'SALE', quantityDelta: -12, transactionCount: 5 }])
  })

  it('filters by transaction type when provided', async () => {
    await request(app).get('/api/admin/reports/inventory-movement?type=WASTE').set('Authorization', `Bearer ${adminToken}`)
    expect(inventoryTransactionFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ type: 'WASTE' }) }))
  })

  it('rejects an invalid transaction type', async () => {
    const res = await request(app).get('/api/admin/reports/inventory-movement?type=NOT_A_TYPE').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(400)
  })
})

describe('GET /api/admin/reports/discounts', () => {
  it('returns discount usage totals from the raw aggregation query', async () => {
    queryRaw.mockResolvedValue([{ name: '10% Off', totalDiscounted: 4000n, timesUsed: 2n }])
    const res = await request(app).get('/api/admin/reports/discounts').set('Authorization', `Bearer ${adminToken}`)
    expect(res.body.discounts).toEqual([{ name: '10% Off', totalDiscounted: 4000, timesUsed: 2 }])
  })
})
