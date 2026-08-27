import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'

const inventoryItemFindMany = vi.fn()
const inventoryItemFindUnique = vi.fn()
const inventoryItemFindFirst = vi.fn()
const inventoryItemFindUniqueOrThrow = vi.fn()
const inventoryItemUpdate = vi.fn()
const inventoryItemUpdateMany = vi.fn()
const inventoryTransactionFindUnique = vi.fn()
const inventoryTransactionCreate = vi.fn()
const inventoryTransactionFindMany = vi.fn()
const userFindUnique = vi.fn()
const auditLogCreate = vi.fn()
const shopFindUnique = vi.fn()

const mockPrisma = {
  inventoryItem: {
    findMany: inventoryItemFindMany,
    findUnique: inventoryItemFindUnique,
    findFirst: inventoryItemFindFirst,
    findUniqueOrThrow: inventoryItemFindUniqueOrThrow,
    update: inventoryItemUpdate,
    updateMany: inventoryItemUpdateMany,
  },
  inventoryTransaction: {
    findUnique: inventoryTransactionFindUnique,
    create: inventoryTransactionCreate,
    findMany: inventoryTransactionFindMany,
  },
  user: { findUnique: userFindUnique },
  auditLog: { create: auditLogCreate },
  shop: { findUnique: shopFindUnique },
  $transaction: vi.fn((arg: unknown) =>
    typeof arg === 'function' ? (arg as (tx: unknown) => Promise<unknown>)(mockPrisma) : Promise.all(arg as Promise<unknown>[]),
  ),
}

vi.mock('../src/lib/prisma.js', () => ({ prisma: mockPrisma }))

const { createApp } = await import('../src/app.js')
const { signAccessToken } = await import('../src/lib/jwt.js')

const app = createApp()
const adminToken = signAccessToken({ sub: 'admin-1', role: 'ADMIN', shopId: 'shop-1' })
const cashierToken = signAccessToken({ sub: 'cashier-1', role: 'CASHIER', shopId: 'shop-1' })

const product = { id: 'prod-1', name: 'Latte', isActive: true }
const baseItem = { id: 'inv-1', productId: 'prod-1', quantityOnHand: 10, reorderLevel: 5, product }

beforeEach(() => {
  vi.clearAllMocks()
  userFindUnique.mockResolvedValue({ name: 'Admin' })
  shopFindUnique.mockResolvedValue({ subscriptionStatus: 'ACTIVE' })
  mockPrisma.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === 'function' ? (arg as (tx: unknown) => Promise<unknown>)(mockPrisma) : Promise.all(arg as Promise<unknown>[]),
  )
})

describe('GET /api/inventory', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/inventory')
    expect(res.status).toBe(401)
  })

  it('allows a cashier to view inventory with computed status', async () => {
    inventoryItemFindMany.mockResolvedValue([
      { ...baseItem, quantityOnHand: 0 },
      { ...baseItem, id: 'inv-2', productId: 'prod-2', quantityOnHand: 3, reorderLevel: 5 },
      { ...baseItem, id: 'inv-3', productId: 'prod-3', quantityOnHand: 20, reorderLevel: 5 },
    ])
    const res = await request(app).get('/api/inventory').set('Authorization', `Bearer ${cashierToken}`)
    expect(res.status).toBe(200)
    expect(res.body.map((i: { status: string }) => i.status)).toEqual(['OUT_OF_STOCK', 'LOW_STOCK', 'IN_STOCK'])
  })
})

describe('GET /api/inventory/:productId', () => {
  it('404s for a product with no inventory record', async () => {
    inventoryItemFindFirst.mockResolvedValue(null)
    const res = await request(app).get('/api/inventory/no-such-product').set('Authorization', `Bearer ${cashierToken}`)
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/inventory/:productId (reorder level)', () => {
  it('allows an admin to configure the reorder level', async () => {
    inventoryItemFindFirst.mockResolvedValue(baseItem)
    inventoryItemUpdate.mockResolvedValue({ ...baseItem, reorderLevel: 8 })
    const res = await request(app)
      .patch('/api/inventory/prod-1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reorderLevel: 8 })
    expect(res.status).toBe(200)
    expect(res.body.reorderLevel).toBe(8)
    expect(inventoryItemUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { productId: 'prod-1' }, data: { reorderLevel: 8 } }),
    )
  })

  it('blocks a cashier from configuring the reorder level', async () => {
    const res = await request(app)
      .patch('/api/inventory/prod-1')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ reorderLevel: 8 })
    expect(res.status).toBe(403)
    expect(inventoryItemUpdate).not.toHaveBeenCalled()
  })
})

describe('GET /api/inventory/:productId/history', () => {
  it('allows an admin to view inventory history', async () => {
    inventoryItemFindFirst.mockResolvedValue(baseItem)
    inventoryTransactionFindMany.mockResolvedValue([
      { id: 'txn-1', type: 'STOCK_IN', quantityChange: 10, quantityAfter: 10 },
    ])
    const res = await request(app).get('/api/inventory/prod-1/history').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
  })

  it('blocks a cashier from viewing inventory history', async () => {
    const res = await request(app).get('/api/inventory/prod-1/history').set('Authorization', `Bearer ${cashierToken}`)
    expect(res.status).toBe(403)
  })
})

describe('POST /api/inventory/:productId/adjustments', () => {
  it('blocks a cashier from adjusting inventory', async () => {
    const res = await request(app)
      .post('/api/inventory/prod-1/adjustments')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ type: 'STOCK_IN', quantityChange: 10 })
    expect(res.status).toBe(403)
    expect(inventoryItemUpdateMany).not.toHaveBeenCalled()
  })

  it('rejects STOCK_IN with a non-positive quantityChange', async () => {
    const res = await request(app)
      .post('/api/inventory/prod-1/adjustments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'STOCK_IN', quantityChange: -5 })
    expect(res.status).toBe(400)
  })

  it('rejects ADJUSTMENT and WASTE without a reason', async () => {
    const res = await request(app)
      .post('/api/inventory/prod-1/adjustments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'WASTE', quantityChange: -2 })
    expect(res.status).toBe(400)
  })

  it('404s when adjusting inventory for a product with no inventory record', async () => {
    inventoryItemFindFirst.mockResolvedValue(null)
    const res = await request(app)
      .post('/api/inventory/no-such-product/adjustments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'STOCK_IN', quantityChange: 10 })
    expect(res.status).toBe(404)
  })

  it('allows an admin to record stock in and creates an audit transaction', async () => {
    inventoryItemFindFirst.mockResolvedValue(baseItem)
    inventoryItemUpdateMany.mockResolvedValue({ count: 1 })
    inventoryItemFindUniqueOrThrow.mockResolvedValue({ ...baseItem, quantityOnHand: 20 })
    inventoryTransactionCreate.mockResolvedValue({
      id: 'txn-1',
      type: 'STOCK_IN',
      quantityChange: 10,
      quantityAfter: 20,
      createdByUserId: 'admin-1',
    })

    const res = await request(app)
      .post('/api/inventory/prod-1/adjustments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'STOCK_IN', quantityChange: 10 })

    expect(res.status).toBe(201)
    expect(inventoryTransactionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'STOCK_IN',
          quantityChange: 10,
          quantityAfter: 20,
          createdByUserId: 'admin-1',
        }),
      }),
    )
  })

  it('rejects a stock-out that would push inventory negative (concurrency-safe conditional update)', async () => {
    inventoryItemFindFirst.mockResolvedValue(baseItem)
    inventoryItemUpdateMany.mockResolvedValue({ count: 0 })

    const res = await request(app)
      .post('/api/inventory/prod-1/adjustments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'STOCK_OUT', quantityChange: -999 })

    expect(res.status).toBe(409)
    expect(inventoryTransactionCreate).not.toHaveBeenCalled()
    expect(inventoryItemUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ productId: 'prod-1', quantityOnHand: { gte: 999 } }),
      }),
    )
  })

  it('does not double-apply a repeated request carrying the same idempotencyKey', async () => {
    inventoryItemFindFirst.mockResolvedValue(baseItem)
    const existingTransaction = {
      id: 'txn-existing',
      type: 'STOCK_IN',
      quantityChange: 10,
      quantityAfter: 20,
      idempotencyKey: 'order-123',
    }
    inventoryTransactionFindUnique.mockResolvedValue(existingTransaction)

    const res = await request(app)
      .post('/api/inventory/prod-1/adjustments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'STOCK_IN', quantityChange: 10, idempotencyKey: 'order-123' })

    expect(res.status).toBe(201)
    expect(res.body.transaction.id).toBe('txn-existing')
    expect(inventoryItemUpdateMany).not.toHaveBeenCalled()
    expect(inventoryTransactionCreate).not.toHaveBeenCalled()
  })

  it('returns the winning transaction when a concurrent request already committed under the same idempotencyKey', async () => {
    const { Prisma } = await import('@prisma/client')
    inventoryItemFindFirst.mockResolvedValue(baseItem)
    inventoryTransactionFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'txn-winner', idempotencyKey: 'order-123', quantityChange: 10, quantityAfter: 20 })
    inventoryItemUpdateMany.mockResolvedValue({ count: 1 })
    inventoryItemFindUniqueOrThrow.mockResolvedValue({ ...baseItem, quantityOnHand: 20 })
    inventoryTransactionCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.19.3',
        meta: { target: ['inventoryItemId', 'idempotencyKey'] },
      }),
    )

    const res = await request(app)
      .post('/api/inventory/prod-1/adjustments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'STOCK_IN', quantityChange: 10, idempotencyKey: 'order-123' })

    expect(res.status).toBe(201)
    expect(res.body.transaction.id).toBe('txn-winner')
  })
})
