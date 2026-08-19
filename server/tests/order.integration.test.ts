import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'

const orderFindMany = vi.fn()
const orderCount = vi.fn()
const orderFindUnique = vi.fn()
const userFindMany = vi.fn()

const mockPrisma = {
  order: { findMany: orderFindMany, count: orderCount, findUnique: orderFindUnique },
  user: { findMany: userFindMany },
}

vi.mock('../src/lib/prisma.js', () => ({ prisma: mockPrisma }))

const { createApp } = await import('../src/app.js')
const { signAccessToken } = await import('../src/lib/jwt.js')

const app = createApp()
const adminToken = signAccessToken({ sub: 'admin-1', role: 'ADMIN' })
const cashierToken = signAccessToken({ sub: 'cashier-1', role: 'CASHIER' })

beforeEach(() => {
  vi.clearAllMocks()
  orderFindMany.mockResolvedValue([])
  orderCount.mockResolvedValue(0)
  userFindMany.mockResolvedValue([])
})

describe('GET /api/orders — authorization and scoping', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/orders')
    expect(res.status).toBe(401)
  })

  it('scopes a cashier to only their own orders, ignoring any cashierId they supply', async () => {
    const res = await request(app)
      .get('/api/orders?cashierId=someone-elses-id')
      .set('Authorization', `Bearer ${cashierToken}`)
    expect(res.status).toBe(200)
    expect(orderFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ cashierId: 'cashier-1' }) }),
    )
  })

  it('allows an admin to filter by a specific cashierId', async () => {
    const res = await request(app)
      .get('/api/orders?cashierId=cashier-2')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(orderFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ cashierId: 'cashier-2' }) }),
    )
  })

  it('lets an admin see all orders with no cashier filter', async () => {
    const res = await request(app).get('/api/orders').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(orderFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.not.objectContaining({ cashierId: expect.anything() }) }),
    )
  })
})

describe('GET /api/orders — filters', () => {
  it('filters by status, payment method, and date range', async () => {
    await request(app)
      .get('/api/orders?status=REFUNDED&paymentMethod=CASH&dateFrom=2026-01-01&dateTo=2026-01-31')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(orderFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'REFUNDED',
          payment: { method: 'CASH' },
          createdAt: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
        }),
      }),
    )
  })

  it('searches by numeric order number', async () => {
    await request(app).get('/api/orders?search=42').set('Authorization', `Bearer ${adminToken}`)
    expect(orderFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ sequenceNumber: 42 }) }))
  })

  it('falls back to matching the cashier name for a non-numeric search', async () => {
    await request(app).get('/api/orders?search=Cara').set('Authorization', `Bearer ${adminToken}`)
    expect(orderFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ cashier: { name: { contains: 'Cara', mode: 'insensitive' } } }) }),
    )
  })

  it('rejects an invalid status value', async () => {
    const res = await request(app).get('/api/orders?status=NOT_A_STATUS').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(400)
  })

  it('applies pagination', async () => {
    await request(app).get('/api/orders?page=2&pageSize=10').set('Authorization', `Bearer ${adminToken}`)
    expect(orderFindMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10 }))
  })
})

describe('GET /api/orders/:id — receipt detail access control', () => {
  const orderOwnedByCashier1 = { id: 'order-1', cashierId: 'cashier-1', sequenceNumber: 1 }
  const orderOwnedByAnother = { id: 'order-2', cashierId: 'cashier-2', sequenceNumber: 2 }

  it('allows a cashier to view their own order', async () => {
    orderFindUnique.mockResolvedValue(orderOwnedByCashier1)
    const res = await request(app).get('/api/orders/order-1').set('Authorization', `Bearer ${cashierToken}`)
    expect(res.status).toBe(200)
  })

  it('blocks a cashier from viewing another cashier\'s order', async () => {
    orderFindUnique.mockResolvedValue(orderOwnedByAnother)
    const res = await request(app).get('/api/orders/order-2').set('Authorization', `Bearer ${cashierToken}`)
    expect(res.status).toBe(403)
  })

  it('allows an admin to view any order', async () => {
    orderFindUnique.mockResolvedValue(orderOwnedByAnother)
    const res = await request(app).get('/api/orders/order-2').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })

  it('404s for a nonexistent order', async () => {
    orderFindUnique.mockResolvedValue(null)
    const res = await request(app).get('/api/orders/does-not-exist').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(404)
  })
})

describe('GET /api/orders/cashiers', () => {
  it('rejects a cashier — this filter data is admin-only', async () => {
    const res = await request(app).get('/api/orders/cashiers').set('Authorization', `Bearer ${cashierToken}`)
    expect(res.status).toBe(403)
  })

  it('lets an admin list cashiers for the filter dropdown', async () => {
    userFindMany.mockResolvedValue([
      { id: 'cashier-1', name: 'Alice' },
      { id: 'cashier-2', name: 'Bob' },
    ])
    const res = await request(app).get('/api/orders/cashiers').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual([
      { id: 'cashier-1', name: 'Alice' },
      { id: 'cashier-2', name: 'Bob' },
    ])
    expect(userFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { role: 'CASHIER' } }))
  })
})

describe('GET /api/orders/:id — historical pricing', () => {
  it('returns the stored snapshot prices verbatim, never re-derived from live catalog data', async () => {
    // Two orders for the SAME product, placed when its price was different
    // each time — the receipt must reflect what was charged at the time,
    // not whatever the product costs now.
    const orderAtOldPrice = {
      id: 'order-old',
      cashierId: 'cashier-1',
      sequenceNumber: 10,
      items: [{ id: 'item-1', productNameSnapshot: 'Latte', unitPriceSnapshot: 12000, quantity: 1 }],
    }
    orderFindUnique.mockResolvedValueOnce(orderAtOldPrice)
    const res1 = await request(app).get('/api/orders/order-old').set('Authorization', `Bearer ${cashierToken}`)
    expect(res1.body.items[0].unitPriceSnapshot).toBe(12000)

    const orderAtNewPrice = {
      id: 'order-new',
      cashierId: 'cashier-1',
      sequenceNumber: 11,
      items: [{ id: 'item-2', productNameSnapshot: 'Latte', unitPriceSnapshot: 14000, quantity: 1 }],
    }
    orderFindUnique.mockResolvedValueOnce(orderAtNewPrice)
    const res2 = await request(app).get('/api/orders/order-new').set('Authorization', `Bearer ${cashierToken}`)
    expect(res2.body.items[0].unitPriceSnapshot).toBe(14000)

    // The first order's snapshot is untouched by the second order/price change.
    expect(res1.body.items[0].unitPriceSnapshot).toBe(12000)

    // Never joins back to the live product table for pricing.
    expect(orderFindUnique).not.toHaveBeenCalledWith(expect.objectContaining({ include: expect.objectContaining({ product: true }) }))
  })
})
