import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'

const orderFindMany = vi.fn()
const orderCount = vi.fn()
const orderFindUnique = vi.fn()
const orderFindUniqueOrThrow = vi.fn()
const orderUpdate = vi.fn()
const userFindMany = vi.fn()
const userFindUnique = vi.fn()
const queryRaw = vi.fn()
const inventoryItemUpdateMany = vi.fn()
const inventoryItemFindUniqueOrThrow = vi.fn()
const inventoryTransactionCreate = vi.fn()
const auditLogCreate = vi.fn()

const mockPrisma = {
  order: {
    findMany: orderFindMany,
    count: orderCount,
    findUnique: orderFindUnique,
    findUniqueOrThrow: orderFindUniqueOrThrow,
    update: orderUpdate,
  },
  user: { findMany: userFindMany, findUnique: userFindUnique },
  inventoryItem: { updateMany: inventoryItemUpdateMany, findUniqueOrThrow: inventoryItemFindUniqueOrThrow },
  inventoryTransaction: { create: inventoryTransactionCreate },
  auditLog: { create: auditLogCreate },
  $queryRaw: queryRaw,
  $transaction: vi.fn((arg: unknown) =>
    typeof arg === 'function' ? (arg as (tx: unknown) => Promise<unknown>)(mockPrisma) : Promise.all(arg as Promise<unknown>[]),
  ),
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
  userFindUnique.mockResolvedValue({ name: 'Admin' })
  inventoryItemUpdateMany.mockResolvedValue({ count: 1 })
  inventoryItemFindUniqueOrThrow.mockResolvedValue({ id: 'inv-1', productId: 'prod-1', quantityOnHand: 10, reorderLevel: 2 })
  inventoryTransactionCreate.mockResolvedValue({ id: 'inv-txn-1' })
  auditLogCreate.mockResolvedValue({ id: 'audit-1' })
  mockPrisma.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === 'function' ? (arg as (tx: unknown) => Promise<unknown>)(mockPrisma) : Promise.all(arg as Promise<unknown>[]),
  )
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

describe('GET /api/orders — sorting', () => {
  it('defaults to newest first when sortBy is omitted', async () => {
    await request(app).get('/api/orders').set('Authorization', `Bearer ${adminToken}`)
    expect(orderFindMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { createdAt: 'desc' } }))
  })

  it('sorts oldest first', async () => {
    await request(app).get('/api/orders?sortBy=oldest').set('Authorization', `Bearer ${adminToken}`)
    expect(orderFindMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { createdAt: 'asc' } }))
  })

  it('sorts by highest total first', async () => {
    await request(app).get('/api/orders?sortBy=highest').set('Authorization', `Bearer ${adminToken}`)
    expect(orderFindMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { total: 'desc' } }))
  })

  it('sorts by lowest total first', async () => {
    await request(app).get('/api/orders?sortBy=lowest').set('Authorization', `Bearer ${adminToken}`)
    expect(orderFindMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { total: 'asc' } }))
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

function mockCompletedOrder(overrides: Partial<{ sequenceNumber: number; items: { productId: string; quantity: number }[] }> = {}) {
  queryRaw.mockResolvedValue([{ id: 'order-1', status: 'COMPLETED' }])
  orderFindUniqueOrThrow.mockResolvedValue({
    id: 'order-1',
    sequenceNumber: overrides.sequenceNumber ?? 7,
    items: overrides.items ?? [{ productId: 'prod-1', quantity: 2 }],
  })
  orderUpdate.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: 'order-1', status: data.status, voidedAt: data.voidedAt, voidedById: data.voidedById, voidReason: data.voidReason }),
  )
}

describe('PATCH /api/orders/:id/cancel', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).patch('/api/orders/order-1/cancel').send({ reason: 'Wrong order' })
    expect(res.status).toBe(401)
  })

  it('rejects a cashier — cancellation is admin-only', async () => {
    const res = await request(app)
      .patch('/api/orders/order-1/cancel')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ reason: 'Wrong order' })
    expect(res.status).toBe(403)
    expect(orderUpdate).not.toHaveBeenCalled()
  })

  it('rejects an empty or too-short reason', async () => {
    const res = await request(app)
      .patch('/api/orders/order-1/cancel')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'no' })
    expect(res.status).toBe(400)
    expect(orderUpdate).not.toHaveBeenCalled()
  })

  it('404s for a nonexistent order', async () => {
    queryRaw.mockResolvedValue([])
    const res = await request(app)
      .patch('/api/orders/does-not-exist/cancel')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Wrong order' })
    expect(res.status).toBe(404)
  })

  it('rejects cancelling an order that is already cancelled or refunded', async () => {
    queryRaw.mockResolvedValue([{ id: 'order-1', status: 'REFUNDED' }])
    const res = await request(app)
      .patch('/api/orders/order-1/cancel')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Wrong order' })
    expect(res.status).toBe(409)
    expect(orderUpdate).not.toHaveBeenCalled()
  })

  it('cancels a completed order, restocks inventory, and records an audit entry', async () => {
    mockCompletedOrder({ items: [{ productId: 'prod-1', quantity: 2 }] })

    const res = await request(app)
      .patch('/api/orders/order-1/cancel')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Customer changed their mind before pickup' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('CANCELLED')

    expect(inventoryItemUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ productId: 'prod-1' }),
        data: { quantityOnHand: { increment: 2 } },
      }),
    )
    expect(inventoryTransactionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'STOCK_IN', quantityChange: 2 }) }),
    )

    expect(orderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-1' },
        data: expect.objectContaining({
          status: 'CANCELLED',
          voidedById: 'admin-1',
          voidReason: 'Customer changed their mind before pickup',
        }),
      }),
    )

    expect(auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'ORDER_CANCELLED',
          resource: 'Order',
          resourceId: 'order-1',
        }),
      }),
    )
  })

  it('restocks every line item for a multi-item order', async () => {
    mockCompletedOrder({
      items: [
        { productId: 'prod-1', quantity: 2 },
        { productId: 'prod-2', quantity: 1 },
      ],
    })

    await request(app)
      .patch('/api/orders/order-1/cancel')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Duplicate order placed by mistake' })

    expect(inventoryItemUpdateMany).toHaveBeenCalledTimes(2)
    expect(inventoryItemUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ productId: 'prod-1' }), data: { quantityOnHand: { increment: 2 } } }),
    )
    expect(inventoryItemUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ productId: 'prod-2' }), data: { quantityOnHand: { increment: 1 } } }),
    )
  })
})

describe('PATCH /api/orders/:id/refund', () => {
  it('rejects a cashier — refunding is admin-only', async () => {
    const res = await request(app)
      .patch('/api/orders/order-1/refund')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ reason: 'Customer returned the item' })
    expect(res.status).toBe(403)
  })

  it('refunds a completed order, restocks inventory, and records an ORDER_REFUNDED audit entry', async () => {
    mockCompletedOrder({ items: [{ productId: 'prod-1', quantity: 1 }] })

    const res = await request(app)
      .patch('/api/orders/order-1/refund')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Customer returned the item, cold brew was flat' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('REFUNDED')
    expect(orderUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'REFUNDED' }) }))
    expect(auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'ORDER_REFUNDED', resourceId: 'order-1' }) }),
    )
  })

  it('rejects refunding an order that is already cancelled or refunded', async () => {
    queryRaw.mockResolvedValue([{ id: 'order-1', status: 'CANCELLED' }])
    const res = await request(app)
      .patch('/api/orders/order-1/refund')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Customer returned the item' })
    expect(res.status).toBe(409)
    expect(orderUpdate).not.toHaveBeenCalled()
  })
})
