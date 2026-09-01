import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { Prisma } from '@prisma/client'

function makeIdempotencyKeyConflict(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the fields: (`idempotencyKey`)', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target: ['idempotencyKey'] },
  })
}

const orderFindUnique = vi.fn()
const orderFindUniqueOrThrow = vi.fn()
const orderCreate = vi.fn()
const orderItemCreate = vi.fn()
const orderItemModifierCreateMany = vi.fn()
const paymentCreate = vi.fn()
const productFindUnique = vi.fn()
const discountFindUnique = vi.fn()
const inventoryItemUpdateMany = vi.fn()
const inventoryItemFindUniqueOrThrow = vi.fn()
const inventoryTransactionCreate = vi.fn()

const mockPrisma = {
  order: { findUnique: orderFindUnique, findUniqueOrThrow: orderFindUniqueOrThrow, create: orderCreate },
  orderItem: { create: orderItemCreate },
  orderItemModifier: { createMany: orderItemModifierCreateMany },
  payment: { create: paymentCreate },
  product: { findUnique: productFindUnique },
  discount: { findUnique: discountFindUnique },
  inventoryItem: { updateMany: inventoryItemUpdateMany, findUniqueOrThrow: inventoryItemFindUniqueOrThrow },
  inventoryTransaction: { create: inventoryTransactionCreate },
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

const category = { id: 'cat-1', name: 'Coffee' }

function makeLatte(basePrice = 40000) {
  return {
    id: 'prod-latte',
    name: 'Latte',
    isActive: true,
    basePrice,
    categoryId: category.id,
    variants: [
      { id: 'var-large', productId: 'prod-latte', name: 'Large', price: basePrice + 10000, isActive: true },
    ],
    modifiers: [
      {
        productId: 'prod-latte',
        modifierId: 'mod-shot',
        modifier: { id: 'mod-shot', name: 'Extra Shot', price: 7500, isActive: true },
      },
    ],
  }
}

let sequenceCounter = 0
function mockOrderCreate() {
  orderCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) => {
    sequenceCounter += 1
    return Promise.resolve({ id: `order-${sequenceCounter}`, sequenceNumber: sequenceCounter, ...data })
  })
}

function mockOrderItemCreate() {
  let n = 0
  orderItemCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) => {
    n += 1
    return Promise.resolve({ id: `item-${n}`, ...data })
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  orderFindUnique.mockResolvedValue(null)
  mockOrderCreate()
  mockOrderItemCreate()
  orderFindUniqueOrThrow.mockImplementation(() => Promise.resolve({ id: 'order-final', items: [], payment: {} }))
  inventoryItemUpdateMany.mockResolvedValue({ count: 1 })
  inventoryItemFindUniqueOrThrow.mockResolvedValue({ id: 'inv-1', productId: 'prod-latte', quantityOnHand: 10, reorderLevel: 2 })
  inventoryTransactionCreate.mockResolvedValue({ id: 'inv-txn-1' })
  mockPrisma.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === 'function' ? (arg as (tx: unknown) => Promise<unknown>)(mockPrisma) : Promise.all(arg as Promise<unknown>[]),
  )
})

describe('POST /api/checkout — authorization', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).post('/api/checkout').send({ items: [], amountReceived: 0, idempotencyKey: 'k1' })
    expect(res.status).toBe(401)
  })
})

describe('POST /api/checkout — successful checkout', () => {
  it('creates an order with correct server-computed totals for a variant + modifier', async () => {
    productFindUnique.mockResolvedValue(makeLatte())

    const res = await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        items: [{ productId: 'prod-latte', variantId: 'var-large', modifierIds: ['mod-shot'], quantity: 2 }],
        amountReceived: 120000,
        idempotencyKey: 'checkout-key-1',
      })

    expect(res.status).toBe(201)
    // (500.00 large + 75.00 shot) * 2 = 1150.00 -> 115000 centavos
    expect(orderCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ subtotal: 115000, discountAmount: 0, total: 115000 }) }),
    )
    expect(orderItemCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productNameSnapshot: 'Latte',
          variantNameSnapshot: 'Large',
          unitPriceSnapshot: 50000,
          quantity: 2,
        }),
      }),
    )
    expect(orderItemModifierCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: [expect.objectContaining({ modifierNameSnapshot: 'Extra Shot', priceSnapshot: 7500 })] }),
    )
    expect(paymentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ method: 'CASH', amountDue: 115000, amountReceived: 120000, changeGiven: 5000 }),
      }),
    )
  })

  it('deducts inventory for each purchased product', async () => {
    productFindUnique.mockResolvedValue(makeLatte())
    await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        items: [{ productId: 'prod-latte', variantId: 'var-large', modifierIds: [], quantity: 3 }],
        amountReceived: 200000,
        idempotencyKey: 'checkout-key-2',
      })

    expect(inventoryItemUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ productId: 'prod-latte', quantityOnHand: { gte: 3 } }),
        data: { quantityOnHand: { increment: -3 } },
      }),
    )
    expect(inventoryTransactionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'SALE', quantityChange: -3 }) }),
    )
  })

  it('computes change correctly for an overpayment', async () => {
    productFindUnique.mockResolvedValue({ ...makeLatte(), variants: [] })
    await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        items: [{ productId: 'prod-latte', modifierIds: [], quantity: 1 }],
        amountReceived: 50000,
        idempotencyKey: 'checkout-key-3',
      })
    // basePrice 40000 (no variant selected), received 50000 -> change 10000
    expect(paymentCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amountDue: 40000, amountReceived: 50000, changeGiven: 10000 }) }),
    )
  })

  it('applies a percentage discount computed server-side', async () => {
    productFindUnique.mockResolvedValue({ ...makeLatte(), variants: [] })
    discountFindUnique.mockResolvedValue({ id: 'disc-1', name: '10% Off', type: 'PERCENTAGE', value: 10, isActive: true })

    const res = await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        items: [{ productId: 'prod-latte', modifierIds: [], quantity: 1 }],
        discountId: 'disc-1',
        amountReceived: 40000,
        idempotencyKey: 'checkout-key-4',
      })

    expect(res.status).toBe(201)
    // subtotal 40000, 10% off = 4000, total 36000
    expect(orderCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ subtotal: 40000, discountAmount: 4000, total: 36000 }) }),
    )
  })

  it('applies a fixed-amount discount smaller than the subtotal', async () => {
    productFindUnique.mockResolvedValue({ ...makeLatte(), variants: [] })
    discountFindUnique.mockResolvedValue({ id: 'disc-fixed', name: '₱50 Off', type: 'FIXED', value: 5000, isActive: true, expiresAt: null })

    const res = await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        items: [{ productId: 'prod-latte', modifierIds: [], quantity: 1 }],
        discountId: 'disc-fixed',
        amountReceived: 35000,
        idempotencyKey: 'checkout-key-fixed-1',
      })

    expect(res.status).toBe(201)
    // subtotal 40000, fixed 5000 off, total 35000
    expect(orderCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ subtotal: 40000, discountAmount: 5000, total: 35000 }) }),
    )
  })
})

describe('POST /api/checkout — discount financial edge cases', () => {
  it('caps a fixed discount larger than the subtotal — total never goes negative', async () => {
    productFindUnique.mockResolvedValue({ ...makeLatte(), variants: [] })
    // subtotal will be 40000; discount nominally worth far more than that
    discountFindUnique.mockResolvedValue({
      id: 'disc-huge',
      name: 'Way Too Generous',
      type: 'FIXED',
      value: 999999,
      isActive: true,
      expiresAt: null,
    })

    const res = await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        items: [{ productId: 'prod-latte', modifierIds: [], quantity: 1 }],
        discountId: 'disc-huge',
        amountReceived: 0,
        idempotencyKey: 'checkout-key-huge-discount',
      })

    expect(res.status).toBe(201)
    // The discount amount actually recorded is capped at the subtotal
    // (40000), never the raw discount.value — and the total is exactly 0,
    // never negative.
    expect(orderCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ subtotal: 40000, discountAmount: 40000, total: 0 }) }),
    )
  })

  it('a 100% percentage discount brings the total to exactly zero, still requires zero cash', async () => {
    productFindUnique.mockResolvedValue({ ...makeLatte(), variants: [] })
    discountFindUnique.mockResolvedValue({ id: 'disc-100', name: 'Full Comp', type: 'PERCENTAGE', value: 100, isActive: true, expiresAt: null })

    const res = await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        items: [{ productId: 'prod-latte', modifierIds: [], quantity: 1 }],
        discountId: 'disc-100',
        amountReceived: 0,
        idempotencyKey: 'checkout-key-100-percent',
      })

    expect(res.status).toBe(201)
    expect(orderCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ subtotal: 40000, discountAmount: 40000, total: 0 }) }),
    )
  })

  it('a zero-value discount changes nothing about the total', async () => {
    productFindUnique.mockResolvedValue({ ...makeLatte(), variants: [] })
    discountFindUnique.mockResolvedValue({ id: 'disc-zero', name: 'Placeholder', type: 'FIXED', value: 0, isActive: true, expiresAt: null })

    const res = await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        items: [{ productId: 'prod-latte', modifierIds: [], quantity: 1 }],
        discountId: 'disc-zero',
        amountReceived: 40000,
        idempotencyKey: 'checkout-key-zero-discount',
      })

    expect(res.status).toBe(201)
    expect(orderCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ subtotal: 40000, discountAmount: 0, total: 40000 }) }),
    )
  })

  it('rejects an expired discount, even though it is still marked isActive', async () => {
    productFindUnique.mockResolvedValue({ ...makeLatte(), variants: [] })
    discountFindUnique.mockResolvedValue({
      id: 'disc-expired',
      name: 'Last Year Promo',
      type: 'PERCENTAGE',
      value: 20,
      isActive: true,
      expiresAt: new Date('2020-01-01T00:00:00.000Z'),
    })

    const res = await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        items: [{ productId: 'prod-latte', modifierIds: [], quantity: 1 }],
        discountId: 'disc-expired',
        amountReceived: 40000,
        idempotencyKey: 'checkout-key-expired',
      })

    expect(res.status).toBe(400)
    expect(orderCreate).not.toHaveBeenCalled()
  })

  it('accepts a discount whose expiry is still in the future', async () => {
    productFindUnique.mockResolvedValue({ ...makeLatte(), variants: [] })
    discountFindUnique.mockResolvedValue({
      id: 'disc-future-expiry',
      name: 'Still Valid',
      type: 'PERCENTAGE',
      value: 10,
      isActive: true,
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
    })

    const res = await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        items: [{ productId: 'prod-latte', modifierIds: [], quantity: 1 }],
        discountId: 'disc-future-expiry',
        amountReceived: 36000,
        idempotencyKey: 'checkout-key-future-expiry',
      })

    expect(res.status).toBe(201)
    expect(orderCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ discountAmount: 4000, total: 36000 }) }),
    )
  })
})

describe('POST /api/checkout — rejected requests never create records', () => {
  it('rejects insufficient cash without creating an order, payment, or inventory change', async () => {
    productFindUnique.mockResolvedValue(makeLatte())
    const res = await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        items: [{ productId: 'prod-latte', modifierIds: [], quantity: 1 }],
        amountReceived: 10000, // way under the 40000 basePrice
        idempotencyKey: 'checkout-key-5',
      })

    expect(res.status).toBe(400)
    expect(orderCreate).not.toHaveBeenCalled()
    expect(paymentCreate).not.toHaveBeenCalled()
    expect(inventoryItemUpdateMany).not.toHaveBeenCalled()
  })

  it('rejects insufficient inventory and never creates a payment', async () => {
    productFindUnique.mockResolvedValue({ ...makeLatte(), variants: [] })
    inventoryItemUpdateMany.mockResolvedValue({ count: 0 })

    const res = await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        items: [{ productId: 'prod-latte', modifierIds: [], quantity: 5 }],
        amountReceived: 500000,
        idempotencyKey: 'checkout-key-6',
      })

    expect(res.status).toBe(409)
    expect(paymentCreate).not.toHaveBeenCalled()
  })

  it('rejects a nonexistent product', async () => {
    productFindUnique.mockResolvedValue(null)
    const res = await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        items: [{ productId: 'does-not-exist', modifierIds: [], quantity: 1 }],
        amountReceived: 100000,
        idempotencyKey: 'checkout-key-7',
      })
    expect(res.status).toBe(400)
    expect(orderCreate).not.toHaveBeenCalled()
  })

  it('rejects an inactive product', async () => {
    productFindUnique.mockResolvedValue({ ...makeLatte(), isActive: false })
    const res = await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        items: [{ productId: 'prod-latte', modifierIds: [], quantity: 1 }],
        amountReceived: 100000,
        idempotencyKey: 'checkout-key-8',
      })
    expect(res.status).toBe(400)
    expect(orderCreate).not.toHaveBeenCalled()
  })

  it('requires a variant when the product has active variants', async () => {
    productFindUnique.mockResolvedValue(makeLatte())
    const res = await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        items: [{ productId: 'prod-latte', modifierIds: [], quantity: 1 }], // no variantId
        amountReceived: 100000,
        idempotencyKey: 'checkout-key-8b',
      })
    expect(res.status).toBe(400)
  })

  it('rejects a variantId that does not match any active variant on the product', async () => {
    // Distinct from the no-variantId case above: here the client supplies a
    // variantId, but it doesn't resolve to any of this product's active
    // variants (wrong product, deactivated variant, or fabricated id) — must
    // never silently fall back to basePrice.
    productFindUnique.mockResolvedValue(makeLatte())
    const res = await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        items: [{ productId: 'prod-latte', variantId: 'var-does-not-exist', modifierIds: [], quantity: 1 }],
        amountReceived: 100000,
        idempotencyKey: 'checkout-key-8c',
      })
    expect(res.status).toBe(400)
    expect(orderCreate).not.toHaveBeenCalled()
  })

  it('rejects a modifier that is not actually assigned to the product', async () => {
    productFindUnique.mockResolvedValue(makeLatte())
    const res = await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        items: [{ productId: 'prod-latte', variantId: 'var-large', modifierIds: ['mod-not-assigned'], quantity: 1 }],
        amountReceived: 100000,
        idempotencyKey: 'checkout-key-9',
      })
    expect(res.status).toBe(400)
    expect(orderCreate).not.toHaveBeenCalled()
  })

  it('rejects an inactive or nonexistent discount', async () => {
    productFindUnique.mockResolvedValue(makeLatte())
    discountFindUnique.mockResolvedValue(null)
    const res = await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        items: [{ productId: 'prod-latte', modifierIds: [], quantity: 1 }],
        discountId: 'does-not-exist',
        amountReceived: 100000,
        idempotencyKey: 'checkout-key-10',
      })
    expect(res.status).toBe(400)
    expect(orderCreate).not.toHaveBeenCalled()
  })

  it('ignores client-supplied price/total fields entirely and computes from the catalog', async () => {
    productFindUnique.mockResolvedValue({ ...makeLatte(), variants: [] })
    const res = await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        items: [{ productId: 'prod-latte', modifierIds: [], quantity: 1, unitPrice: 1, price: 1 }],
        total: 1,
        subtotal: 1,
        amountReceived: 40000,
        idempotencyKey: 'checkout-key-11',
      })
    expect(res.status).toBe(201)
    // Real basePrice (40000) was used, not the injected `1`.
    expect(orderCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ subtotal: 40000, total: 40000 }) }))
  })
})

describe('POST /api/checkout — idempotency / duplicate protection', () => {
  it('returns the existing order on a repeated request with the same idempotencyKey instead of creating a second one', async () => {
    const existingOrder = { id: 'order-existing', sequenceNumber: 1, total: 40000 }
    orderFindUnique.mockResolvedValue(existingOrder)

    const res = await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        items: [{ productId: 'prod-latte', modifierIds: [], quantity: 1 }],
        amountReceived: 40000,
        idempotencyKey: 'already-processed-key',
      })

    expect(res.status).toBe(201)
    expect(res.body.id).toBe('order-existing')
    expect(orderCreate).not.toHaveBeenCalled()
    expect(inventoryItemUpdateMany).not.toHaveBeenCalled()
  })

  it('returns the winning order — not a 500 — when a genuinely concurrent request loses the race inside the transaction', async () => {
    // Distinct from the test above: here the pre-check (findByIdempotencyKey)
    // finds nothing yet, because a truly concurrent second request is racing
    // this one — both pass the pre-check before either commits. This
    // request's own $transaction then hits the DB's unique constraint on
    // idempotencyKey because the other request won and committed first. The
    // service must recover by looking up and returning the winner's order,
    // not surface a raw 500.
    productFindUnique.mockResolvedValue({ ...makeLatte(), variants: [] })
    const winnerOrder = { id: 'order-winner', sequenceNumber: 42, total: 40000 }
    orderFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(winnerOrder)
    mockPrisma.$transaction.mockRejectedValueOnce(makeIdempotencyKeyConflict())

    const res = await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        items: [{ productId: 'prod-latte', modifierIds: [], quantity: 1 }],
        amountReceived: 40000,
        idempotencyKey: 'racing-key',
      })

    expect(res.status).toBe(201)
    expect(res.body.id).toBe('order-winner')
    expect(orderFindUnique).toHaveBeenCalledTimes(2)
  })

  it('propagates a genuinely unexpected transaction error as a 500, not as a false idempotency recovery', async () => {
    productFindUnique.mockResolvedValue({ ...makeLatte(), variants: [] })
    orderFindUnique.mockResolvedValueOnce(null)
    mockPrisma.$transaction.mockRejectedValueOnce(new Error('database connection lost'))

    const res = await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        items: [{ productId: 'prod-latte', modifierIds: [], quantity: 1 }],
        amountReceived: 40000,
        idempotencyKey: 'unrelated-failure-key',
      })

    expect(res.status).toBe(500)
  })
})

describe('POST /api/checkout — historical price preservation', () => {
  it('snapshots the price in effect at checkout time, independent of later catalog changes', async () => {
    // Order 1 at ₱120.00
    productFindUnique.mockResolvedValue({ ...makeLatte(12000), variants: [] })
    await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [{ productId: 'prod-latte', modifierIds: [], quantity: 1 }],
        amountReceived: 12000,
        idempotencyKey: 'history-key-1',
      })
    const firstSnapshot = orderItemCreate.mock.calls[0]![0].data.unitPriceSnapshot

    // Catalog price "changes" to ₱140.00 before the next checkout.
    productFindUnique.mockResolvedValue({ ...makeLatte(14000), variants: [] })
    await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [{ productId: 'prod-latte', modifierIds: [], quantity: 1 }],
        amountReceived: 14000,
        idempotencyKey: 'history-key-2',
      })
    const secondSnapshot = orderItemCreate.mock.calls[1]![0].data.unitPriceSnapshot

    expect(firstSnapshot).toBe(12000)
    expect(secondSnapshot).toBe(14000)
  })

  it('snapshots the discount name in effect at checkout time, independent of a later rename', async () => {
    productFindUnique.mockResolvedValue({ ...makeLatte(), variants: [] })

    // Order 1 applies the discount under its original name.
    discountFindUnique.mockResolvedValue({ id: 'disc-1', name: 'Loyalty 10%', type: 'PERCENTAGE', value: 10, isActive: true, expiresAt: null })
    await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        items: [{ productId: 'prod-latte', modifierIds: [], quantity: 1 }],
        discountId: 'disc-1',
        amountReceived: 36000,
        idempotencyKey: 'history-discount-key-1',
      })
    const firstDiscountSnapshot = orderCreate.mock.calls[0]![0].data.discountNameSnapshot

    // Admin renames the SAME discount row before the next checkout.
    discountFindUnique.mockResolvedValue({ id: 'disc-1', name: 'VIP Discount', type: 'PERCENTAGE', value: 10, isActive: true, expiresAt: null })
    await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        items: [{ productId: 'prod-latte', modifierIds: [], quantity: 1 }],
        discountId: 'disc-1',
        amountReceived: 36000,
        idempotencyKey: 'history-discount-key-2',
      })
    const secondDiscountSnapshot = orderCreate.mock.calls[1]![0].data.discountNameSnapshot

    expect(firstDiscountSnapshot).toBe('Loyalty 10%')
    expect(secondDiscountSnapshot).toBe('VIP Discount')
  })
})
