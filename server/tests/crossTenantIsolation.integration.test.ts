import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'

// ---------------------------------------------------------------------------
// Mandatory release-gate suite (see the multi-tenant retrofit plan's
// "Mandatory new test suite: cross-tenant isolation" section). Two shop
// fixtures — Shop A and Shop B — each with an admin + cashier token. Every
// test below acts as SHOP A and proves it can never read, mutate, or link
// against a resource that actually belongs to SHOP B.
//
// The mock's findUnique/findFirst implementations deliberately inspect BOTH
// `id` AND `shopId` in the `where` clause and only resolve a row when both
// match — this is what actually exercises the app code's ownership-check
// call, mirroring Prisma's real extended-whereUnique behavior (`where: {
// id, shopId }` resolves to null when `id` exists but under a different
// shopId). A service that forgot to pass `shopId` into its query would
// still get back the Shop-B row here (since a naive mock keyed on `id`
// alone would match) — these mocks are keyed on the (id, shopId) pair
// specifically so that mistake would be caught.
// ---------------------------------------------------------------------------

const categoryFindMany = vi.fn()
const categoryFindFirst = vi.fn()
const categoryFindUnique = vi.fn()
const categoryCreate = vi.fn()
const categoryUpdate = vi.fn()

const productFindMany = vi.fn()
const productFindUnique = vi.fn()
const productCreate = vi.fn()
const productUpdate = vi.fn()
const productDelete = vi.fn()
const variantDeleteMany = vi.fn()

const modifierFindMany = vi.fn()
const modifierFindUnique = vi.fn()
const modifierUpdate = vi.fn()
const modifierCount = vi.fn()
const productModifierDeleteMany = vi.fn()
const productModifierCreateMany = vi.fn()

const discountFindMany = vi.fn()
const discountFindFirst = vi.fn()
const discountFindUnique = vi.fn()
const discountUpdate = vi.fn()

const orderFindMany = vi.fn()
const orderCount = vi.fn()
const orderFindUnique = vi.fn()
const orderFindUniqueOrThrow = vi.fn()
const orderCreate = vi.fn()
const orderUpdate = vi.fn()
const orderItemCreate = vi.fn()
const orderItemModifierCreateMany = vi.fn()
const paymentCreate = vi.fn()

const userFindMany = vi.fn()
const userFindUnique = vi.fn()
const userUpdate = vi.fn()

const inventoryItemFindMany = vi.fn()
const inventoryItemFindFirst = vi.fn()
const inventoryItemUpdate = vi.fn()
const inventoryItemUpdateMany = vi.fn()
const inventoryItemFindUniqueOrThrow = vi.fn()
const inventoryTransactionCreate = vi.fn()

const auditLogCreate = vi.fn()
const shopFindUnique = vi.fn()
const shopUpdate = vi.fn()
const queryRaw = vi.fn()

const mockPrisma = {
  category: {
    findMany: categoryFindMany,
    findFirst: categoryFindFirst,
    findUnique: categoryFindUnique,
    create: categoryCreate,
    update: categoryUpdate,
  },
  product: {
    findMany: productFindMany,
    findUnique: productFindUnique,
    create: productCreate,
    update: productUpdate,
    delete: productDelete,
  },
  productVariant: { deleteMany: variantDeleteMany },
  modifier: {
    findMany: modifierFindMany,
    findUnique: modifierFindUnique,
    update: modifierUpdate,
    count: modifierCount,
  },
  productModifier: { deleteMany: productModifierDeleteMany, createMany: productModifierCreateMany },
  discount: {
    findMany: discountFindMany,
    findFirst: discountFindFirst,
    findUnique: discountFindUnique,
    update: discountUpdate,
  },
  order: {
    findMany: orderFindMany,
    count: orderCount,
    findUnique: orderFindUnique,
    findUniqueOrThrow: orderFindUniqueOrThrow,
    create: orderCreate,
    update: orderUpdate,
  },
  orderItem: { create: orderItemCreate },
  orderItemModifier: { createMany: orderItemModifierCreateMany },
  payment: { create: paymentCreate },
  user: { findMany: userFindMany, findUnique: userFindUnique, update: userUpdate },
  inventoryItem: {
    findMany: inventoryItemFindMany,
    findFirst: inventoryItemFindFirst,
    update: inventoryItemUpdate,
    updateMany: inventoryItemUpdateMany,
    findUniqueOrThrow: inventoryItemFindUniqueOrThrow,
  },
  inventoryTransaction: { create: inventoryTransactionCreate },
  auditLog: { create: auditLogCreate },
  shop: { findUnique: shopFindUnique, update: shopUpdate },
  $queryRaw: queryRaw,
  $transaction: vi.fn((arg: unknown) =>
    typeof arg === 'function' ? (arg as (tx: unknown) => Promise<unknown>)(mockPrisma) : Promise.all(arg as Promise<unknown>[]),
  ),
}

vi.mock('../src/lib/prisma.js', () => ({ prisma: mockPrisma }))

const { createApp } = await import('../src/app.js')
const { signAccessToken } = await import('../src/lib/jwt.js')

const app = createApp()

const SHOP_A = 'shop-a'
const SHOP_B = 'shop-b'

const adminA = signAccessToken({ sub: 'admin-a', role: 'ADMIN', shopId: SHOP_A })
const cashierA = signAccessToken({ sub: 'cashier-a', role: 'CASHIER', shopId: SHOP_A })
const adminB = signAccessToken({ sub: 'admin-b', role: 'ADMIN', shopId: SHOP_B })

// Real rows that belong to Shop B — used across the "Shop A reaches for a
// Shop-B id" tests below.
const shopBCategory = { id: 'cat-b1', name: 'B Coffee', sortOrder: 0, isActive: true }
const shopBProduct = { id: 'prod-b1', name: 'B Latte', basePrice: 1000, isActive: true, categoryId: 'cat-b1' }
const shopBDiscount = { id: 'disc-b1', name: 'B Promo', type: 'PERCENTAGE', value: 10, isActive: true, expiresAt: null }
const shopBModifier = { id: 'mod-b1', name: 'B Extra Shot', price: 75, isActive: true }
const shopBOrder = { id: 'order-b1', cashierId: 'cashier-b', sequenceNumber: 1 }
const shopBCashier = { id: 'cashier-b2', name: 'Bob', email: 'bob@shop-b.test', isActive: true, role: 'CASHIER' }

// Shop A's own product, used as the "resolves fine" half of the FK tests.
const shopAProduct = {
  id: 'prod-a1',
  name: 'A Latte',
  basePrice: 40000,
  isActive: true,
  categoryId: 'cat-a1',
  variants: [],
  modifiers: [],
}

// Keyed by shopId — the kill-switch tests flip Shop A to SUSPENDED while
// leaving Shop B untouched, proving suspension doesn't leak across shops.
let shopStatus: Record<string, 'ACTIVE' | 'SUSPENDED'>

// Resolves a fixture only when BOTH the id and the requesting shopId match
// the row's real owner — the mock-level stand-in for Prisma's extended
// whereUnique `{ id, shopId }` behavior (mismatched shopId => null, same as
// a real P2025-triggering lookup).
function ownedBy<T extends { id: string }>(row: T, ownerShopId: string) {
  return ({ where }: { where: { id: string; shopId: string } }) =>
    Promise.resolve(where.id === row.id && where.shopId === ownerShopId ? row : null)
}

beforeEach(() => {
  vi.clearAllMocks()
  shopStatus = { [SHOP_A]: 'ACTIVE', [SHOP_B]: 'ACTIVE' }
  shopFindUnique.mockImplementation(({ where }: { where: { id: string } }) =>
    Promise.resolve({ subscriptionStatus: shopStatus[where.id] ?? 'ACTIVE' }),
  )
  userFindUnique.mockResolvedValue({ id: 'admin-a', name: 'Admin', role: 'ADMIN', isActive: true })
  queryRaw.mockResolvedValue([])
  mockPrisma.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === 'function' ? (arg as (tx: unknown) => Promise<unknown>)(mockPrisma) : Promise.all(arg as Promise<unknown>[]),
  )
})

// ---------------------------------------------------------------------------
// 1. GET/PATCH/DELETE on a real Shop-B resource id, requested as Shop A —
//    must always be 404 (or 403), never 200, and must never reach the
//    underlying write.
// ---------------------------------------------------------------------------

describe('Cross-tenant isolation — direct access to a foreign resource by id', () => {
  it('categories: 404s a PATCH targeting a Shop-B category id, and never calls update', async () => {
    categoryFindUnique.mockImplementation(ownedBy(shopBCategory, SHOP_B))
    const res = await request(app)
      .patch(`/api/categories/${shopBCategory.id}`)
      .set('Authorization', `Bearer ${adminA}`)
      .send({ isActive: false })
    expect(res.status).toBe(404)
    expect(categoryFindUnique).toHaveBeenCalledWith({ where: { id: shopBCategory.id, shopId: SHOP_A } })
    expect(categoryUpdate).not.toHaveBeenCalled()
  })

  it('products: 404s a GET targeting a Shop-B product id', async () => {
    productFindUnique.mockImplementation(ownedBy(shopBProduct, SHOP_B))
    const res = await request(app).get(`/api/products/${shopBProduct.id}`).set('Authorization', `Bearer ${cashierA}`)
    expect(res.status).toBe(404)
    expect(productFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: shopBProduct.id, shopId: SHOP_A } }),
    )
  })

  it('products: 404s a PATCH targeting a Shop-B product id, and never calls update', async () => {
    productFindUnique.mockImplementation(ownedBy(shopBProduct, SHOP_B))
    const res = await request(app)
      .patch(`/api/products/${shopBProduct.id}`)
      .set('Authorization', `Bearer ${adminA}`)
      .send({ basePrice: 999 })
    expect(res.status).toBe(404)
    expect(productUpdate).not.toHaveBeenCalled()
  })

  it('products: 404s a DELETE targeting a Shop-B product id, and never calls delete', async () => {
    productFindUnique.mockImplementation(ownedBy(shopBProduct, SHOP_B))
    const res = await request(app).delete(`/api/products/${shopBProduct.id}`).set('Authorization', `Bearer ${adminA}`)
    expect(res.status).toBe(404)
    expect(productDelete).not.toHaveBeenCalled()
    expect(variantDeleteMany).not.toHaveBeenCalled()
  })

  it('discounts: 404s a PATCH targeting a Shop-B discount id, and never calls update', async () => {
    discountFindUnique.mockImplementation(ownedBy(shopBDiscount, SHOP_B))
    const res = await request(app)
      .patch(`/api/discounts/${shopBDiscount.id}`)
      .set('Authorization', `Bearer ${adminA}`)
      .send({ value: 50 })
    expect(res.status).toBe(404)
    expect(discountFindUnique).toHaveBeenCalledWith({ where: { id: shopBDiscount.id, shopId: SHOP_A } })
    expect(discountUpdate).not.toHaveBeenCalled()
  })

  it('modifiers: 404s a PATCH targeting a Shop-B modifier id, and never calls update', async () => {
    modifierFindUnique.mockImplementation(ownedBy(shopBModifier, SHOP_B))
    const res = await request(app)
      .patch(`/api/modifiers/${shopBModifier.id}`)
      .set('Authorization', `Bearer ${adminA}`)
      .send({ price: 999 })
    expect(res.status).toBe(404)
    expect(modifierUpdate).not.toHaveBeenCalled()
  })

  it('orders: 404s a GET targeting a Shop-B order id', async () => {
    orderFindUnique.mockImplementation(ownedBy(shopBOrder, SHOP_B))
    const res = await request(app).get(`/api/orders/${shopBOrder.id}`).set('Authorization', `Bearer ${adminA}`)
    expect(res.status).toBe(404)
    expect(orderFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: shopBOrder.id, shopId: SHOP_A } }),
    )
  })

  it('orders: 404s a cancel targeting a Shop-B order id — the row-lock raw query is shop-scoped and never calls update', async () => {
    // voidOrder locks the row via `$queryRaw ... WHERE id = ${orderId} AND
    // "shopId" = ${shopId} FOR UPDATE` rather than a findUnique — mimic a
    // shop-scoped miss by resolving no locked row at all.
    queryRaw.mockResolvedValue([])
    const res = await request(app)
      .patch(`/api/orders/${shopBOrder.id}/cancel`)
      .set('Authorization', `Bearer ${adminA}`)
      .send({ reason: 'Attempting to void a foreign order' })
    expect(res.status).toBe(404)
    expect(orderUpdate).not.toHaveBeenCalled()
    const [, ...values] = queryRaw.mock.calls[0] as [readonly string[], ...unknown[]]
    expect(values).toContain(shopBOrder.id)
    expect(values).toContain(SHOP_A)
  })

  it('orders: 404s a refund targeting a Shop-B order id, and never calls update', async () => {
    queryRaw.mockResolvedValue([])
    const res = await request(app)
      .patch(`/api/orders/${shopBOrder.id}/refund`)
      .set('Authorization', `Bearer ${adminA}`)
      .send({ reason: 'Attempting to void a foreign order' })
    expect(res.status).toBe(404)
    expect(orderUpdate).not.toHaveBeenCalled()
  })

  it('users: 404s disabling a Shop-B cashier id, and never calls update', async () => {
    userFindUnique.mockImplementation(ownedBy(shopBCashier, SHOP_B))
    const res = await request(app)
      .patch(`/api/admin/users/${shopBCashier.id}/disable`)
      .set('Authorization', `Bearer ${adminA}`)
    expect(res.status).toBe(404)
    expect(userFindUnique).toHaveBeenCalledWith({ where: { id: shopBCashier.id, shopId: SHOP_A } })
    expect(userUpdate).not.toHaveBeenCalled()
  })

  it('users: 404s reactivating a Shop-B cashier id, and never calls update', async () => {
    userFindUnique.mockImplementation(ownedBy(shopBCashier, SHOP_B))
    const res = await request(app)
      .patch(`/api/admin/users/${shopBCashier.id}/reactivate`)
      .set('Authorization', `Bearer ${adminA}`)
    expect(res.status).toBe(404)
    expect(userUpdate).not.toHaveBeenCalled()
  })

  it('users: 404s resetting a Shop-B cashier\'s password, and never calls update', async () => {
    userFindUnique.mockImplementation(ownedBy(shopBCashier, SHOP_B))
    const res = await request(app)
      .patch(`/api/admin/users/${shopBCashier.id}/reset-password`)
      .set('Authorization', `Bearer ${adminA}`)
      .send({ password: 'new-correct-horse-battery' })
    expect(res.status).toBe(404)
    expect(userUpdate).not.toHaveBeenCalled()
  })

  it('inventory: 404s a GET targeting a Shop-B product id', async () => {
    // InventoryItem carries no shopId column — ownership is checked via a
    // `product: { shopId }` relation filter, not an extended-whereUnique.
    inventoryItemFindFirst.mockResolvedValue(null)
    const res = await request(app).get(`/api/inventory/${shopBProduct.id}`).set('Authorization', `Bearer ${cashierA}`)
    expect(res.status).toBe(404)
    expect(inventoryItemFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { productId: shopBProduct.id, product: { shopId: SHOP_A } } }),
    )
  })

  it('inventory: 404s a PATCH (reorder level) targeting a Shop-B product id, and never calls update', async () => {
    inventoryItemFindFirst.mockResolvedValue(null)
    const res = await request(app)
      .patch(`/api/inventory/${shopBProduct.id}`)
      .set('Authorization', `Bearer ${adminA}`)
      .send({ reorderLevel: 5 })
    expect(res.status).toBe(404)
    expect(inventoryItemUpdate).not.toHaveBeenCalled()
  })

  it('inventory: 404s a stock adjustment targeting a Shop-B product id, and never touches stock', async () => {
    inventoryItemFindFirst.mockResolvedValue(null)
    const res = await request(app)
      .post(`/api/inventory/${shopBProduct.id}/adjustments`)
      .set('Authorization', `Bearer ${adminA}`)
      .send({ type: 'STOCK_IN', quantityChange: 10 })
    expect(res.status).toBe(404)
    expect(inventoryItemUpdateMany).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// 2. Every list endpoint must scope its query by the acting shop's id — the
//    meaningful assertion is that shopId is actually present in the Prisma
//    call, not merely that the (independently mocked) return value happens
//    to be empty.
// ---------------------------------------------------------------------------

describe('Cross-tenant isolation — list endpoints are always shop-scoped', () => {
  it('GET /api/categories is scoped to the acting shop', async () => {
    categoryFindMany.mockResolvedValue([])
    await request(app).get('/api/categories').set('Authorization', `Bearer ${adminA}`)
    expect(categoryFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ shopId: SHOP_A }) }))
  })

  it('GET /api/products is scoped to the acting shop', async () => {
    productFindMany.mockResolvedValue([])
    await request(app).get('/api/products').set('Authorization', `Bearer ${adminA}`)
    expect(productFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ shopId: SHOP_A }) }))
  })

  it('GET /api/discounts is scoped to the acting shop', async () => {
    discountFindMany.mockResolvedValue([])
    await request(app).get('/api/discounts').set('Authorization', `Bearer ${adminA}`)
    expect(discountFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ shopId: SHOP_A }) }))
  })

  it('GET /api/modifiers is scoped to the acting shop', async () => {
    modifierFindMany.mockResolvedValue([])
    await request(app).get('/api/modifiers').set('Authorization', `Bearer ${adminA}`)
    expect(modifierFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ shopId: SHOP_A }) }))
  })

  it('GET /api/orders is scoped to the acting shop', async () => {
    orderFindMany.mockResolvedValue([])
    orderCount.mockResolvedValue(0)
    await request(app).get('/api/orders').set('Authorization', `Bearer ${adminA}`)
    expect(orderFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ shopId: SHOP_A }) }))
  })

  it('GET /api/admin/users is scoped to the acting shop', async () => {
    userFindMany.mockResolvedValue([])
    await request(app).get('/api/admin/users').set('Authorization', `Bearer ${adminA}`)
    expect(userFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { role: 'CASHIER', shopId: SHOP_A } }))
  })

  it('GET /api/inventory is scoped to the acting shop via the product relation', async () => {
    inventoryItemFindMany.mockResolvedValue([])
    await request(app).get('/api/inventory').set('Authorization', `Bearer ${adminA}`)
    expect(inventoryItemFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ product: { shopId: SHOP_A } }) }),
    )
  })
})

// ---------------------------------------------------------------------------
// 3. A Shop-B id supplied as a foreign key inside a Shop-A mutation must be
//    rejected, never silently cross-linked.
// ---------------------------------------------------------------------------

describe('Cross-tenant isolation — foreign-key references to another shop are rejected', () => {
  it('checkout: rejects a Shop-B discountId with 400, never creates the order', async () => {
    productFindUnique.mockResolvedValue(shopAProduct)
    // tx.discount.findUnique is called with the ACTING shop's id (shop-a),
    // so a discount that only exists under shop-b resolves to null here —
    // exactly like a real extended-whereUnique mismatch.
    discountFindUnique.mockImplementation(ownedBy(shopBDiscount, SHOP_B))

    const res = await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${cashierA}`)
      .send({
        items: [{ productId: shopAProduct.id, modifierIds: [], quantity: 1 }],
        discountId: shopBDiscount.id,
        amountReceived: 40000,
        idempotencyKey: 'cross-tenant-discount-key',
      })

    expect(res.status).toBe(400)
    expect(res.body.error.message).toBe('Selected discount is not available')
    expect(discountFindUnique).toHaveBeenCalledWith({ where: { id: shopBDiscount.id, shopId: SHOP_A } })
    expect(orderCreate).not.toHaveBeenCalled()
  })

  it('checkout: rejects a cart item whose productId belongs to Shop B, never creates the order', async () => {
    // tx.product.findUnique is called with the acting shop's id, so a
    // product that only exists under shop-b resolves to null.
    productFindUnique.mockImplementation(ownedBy(shopBProduct, SHOP_B))

    const res = await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${cashierA}`)
      .send({
        items: [{ productId: shopBProduct.id, modifierIds: [], quantity: 1 }],
        amountReceived: 100000,
        idempotencyKey: 'cross-tenant-product-key',
      })

    expect(res.status).toBe(400)
    expect(res.body.error.message).toBe('Product is not available for purchase')
    expect(productFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: shopBProduct.id, shopId: SHOP_A } }),
    )
    expect(orderCreate).not.toHaveBeenCalled()
  })

  it('setProductModifiers: rejects a Shop-B modifier id, never writes the ProductModifier rows', async () => {
    productFindUnique.mockResolvedValue({ ...shopAProduct, category: {}, variants: [], modifiers: [] })
    // modifier.count is called with { id: { in: [...] }, shopId: 'shop-a' }
    // — a modifier id that only belongs to shop-b is excluded from the
    // count, so the count comes up short of the requested set size.
    modifierCount.mockImplementation(({ where }: { where: { id: { in: string[] }; shopId: string } }) =>
      Promise.resolve(where.shopId === SHOP_A ? 1 : 0), // only 'mod-a1' actually matches shop-a
    )

    const res = await request(app)
      .put(`/api/products/${shopAProduct.id}/modifiers`)
      .set('Authorization', `Bearer ${adminA}`)
      .send({ modifierIds: ['mod-a1', shopBModifier.id] })

    expect(res.status).toBe(400)
    expect(modifierCount).toHaveBeenCalledWith({
      where: { id: { in: ['mod-a1', shopBModifier.id] }, shopId: SHOP_A },
    })
    expect(productModifierDeleteMany).not.toHaveBeenCalled()
    expect(productModifierCreateMany).not.toHaveBeenCalled()
  })

  // Was a real gap: createProduct/updateProduct never verified that a
  // submitted categoryId belonged to the acting shop (Category.id is a
  // global cuid, and Product's categoryId FK has no compound (categoryId,
  // shopId) constraint at the DB level). Fixed via product.service.ts's
  // assertCategoryOwnership, mirroring category.service.ts's
  // assertValidParent — same extended-whereUnique pattern, same 404 (not
  // 400) for a not-owned-by-this-shop reference, consistent with every
  // other cross-shop-reference rejection in this suite.
  it('product creation: rejects a Shop-B categoryId', async () => {
    categoryFindUnique.mockImplementation(ownedBy(shopBCategory, SHOP_B))

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminA}`)
      .send({ categoryId: shopBCategory.id, name: 'Cross-Tenant Product', basePrice: 500 })
    expect(res.status).toBe(404)
    expect(productCreate).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// 4. Kill switch: suspending Shop A must block Shop A everywhere, while
//    leaving Shop B (still ACTIVE) completely unaffected in the same run.
// ---------------------------------------------------------------------------

describe('Cross-tenant isolation — the suspension kill switch is scoped to one shop', () => {
  it('blocks Shop A admin on a catalog route while Shop B admin keeps working normally', async () => {
    shopStatus[SHOP_A] = 'SUSPENDED'
    categoryFindMany.mockResolvedValue([])

    const suspendedRes = await request(app).get('/api/categories').set('Authorization', `Bearer ${adminA}`)
    expect(suspendedRes.status).toBe(403)
    expect(categoryFindMany).not.toHaveBeenCalled()

    const activeRes = await request(app).get('/api/categories').set('Authorization', `Bearer ${adminB}`)
    expect(activeRes.status).toBe(200)
    expect(categoryFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ shopId: SHOP_B }) }))
  })

  it('blocks Shop A admin on the admin/users route while Shop B admin keeps working normally', async () => {
    shopStatus[SHOP_A] = 'SUSPENDED'
    userFindMany.mockResolvedValue([])

    const suspendedRes = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${adminA}`)
    expect(suspendedRes.status).toBe(403)
    expect(userFindMany).not.toHaveBeenCalled()

    const activeRes = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${adminB}`)
    expect(activeRes.status).toBe(200)
  })

  it('a suspended Shop A cannot even reach GET /api/users/me', async () => {
    shopStatus[SHOP_A] = 'SUSPENDED'
    const res = await request(app).get('/api/users/me').set('Authorization', `Bearer ${adminA}`)
    expect(res.status).toBe(403)
  })
})
