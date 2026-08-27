import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { Prisma } from '@prisma/client'

function makeP2002(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the fields: (`name`)', {
    code: 'P2002',
    clientVersion: 'test',
  })
}

const categoryFindMany = vi.fn()
const categoryFindFirst = vi.fn()
const categoryFindUnique = vi.fn()
const categoryCreate = vi.fn()
const categoryUpdate = vi.fn()
const productFindMany = vi.fn()
const productFindUnique = vi.fn()
const productCreate = vi.fn()
const productUpdate = vi.fn()
const variantCreate = vi.fn()
const variantUpdate = vi.fn()
const variantFindUnique = vi.fn()
const variantFindFirst = vi.fn()
const modifierFindMany = vi.fn()
const modifierFindFirst = vi.fn()
const modifierFindUnique = vi.fn()
const modifierCreate = vi.fn()
const modifierUpdate = vi.fn()
const modifierCount = vi.fn()
const productModifierDeleteMany = vi.fn()
const productModifierCreateMany = vi.fn()
const userFindUnique = vi.fn()
const auditLogCreate = vi.fn()
const shopFindUnique = vi.fn()

const mockPrisma = {
  shop: { findUnique: shopFindUnique },
  category: {
    findMany: categoryFindMany,
    findFirst: categoryFindFirst,
    findUnique: categoryFindUnique,
    create: categoryCreate,
    update: categoryUpdate,
  },
  product: { findMany: productFindMany, findUnique: productFindUnique, create: productCreate, update: productUpdate },
  productVariant: {
    create: variantCreate,
    update: variantUpdate,
    findUnique: variantFindUnique,
    findFirst: variantFindFirst,
  },
  modifier: {
    findMany: modifierFindMany,
    findFirst: modifierFindFirst,
    findUnique: modifierFindUnique,
    create: modifierCreate,
    update: modifierUpdate,
    count: modifierCount,
  },
  productModifier: { deleteMany: productModifierDeleteMany, createMany: productModifierCreateMany },
  user: { findUnique: userFindUnique },
  auditLog: { create: auditLogCreate },
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

beforeEach(() => {
  vi.clearAllMocks()
  // No name collision by default; individual tests override when testing that path.
  categoryFindFirst.mockResolvedValue(null)
  modifierFindFirst.mockResolvedValue(null)
  variantFindFirst.mockResolvedValue(null)
  categoryFindUnique.mockResolvedValue({ id: 'cat-1', name: 'Coffee', sortOrder: 0, isActive: true })
  modifierFindUnique.mockResolvedValue({ id: 'mod-1', name: 'Extra Shot', price: 75, isActive: true })
  userFindUnique.mockResolvedValue({ name: 'Admin' })
  shopFindUnique.mockResolvedValue({ subscriptionStatus: 'ACTIVE' })
  mockPrisma.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === 'function' ? (arg as (tx: unknown) => Promise<unknown>)(mockPrisma) : Promise.all(arg as Promise<unknown>[]),
  )
})

describe('Categories API', () => {
  it('allows a cashier to list categories', async () => {
    categoryFindMany.mockResolvedValue([{ id: 'cat-1', name: 'Coffee', sortOrder: 0, isActive: true }])
    const res = await request(app).get('/api/categories').set('Authorization', `Bearer ${cashierToken}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
  })

  it('forces the active-only filter for a cashier even when activeOnly is omitted from the query', async () => {
    // The POS screen calls GET /api/categories with no query params at all —
    // without server-side role enforcement, a cashier would see every
    // deactivated category too (mirrors listDiscounts's cashier override).
    categoryFindMany.mockResolvedValue([])
    await request(app).get('/api/categories').set('Authorization', `Bearer ${cashierToken}`)
    expect(categoryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: true }) }),
    )
  })

  it('lets an admin see the full unfiltered category list when activeOnly is omitted', async () => {
    categoryFindMany.mockResolvedValue([])
    await request(app).get('/api/categories').set('Authorization', `Bearer ${adminToken}`)
    expect(categoryFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { shopId: 'shop-1' } }))
  })

  it('allows an admin to create a category', async () => {
    categoryCreate.mockResolvedValue({ id: 'cat-1', name: 'Coffee', sortOrder: 0, isActive: true })
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Coffee' })
    expect(res.status).toBe(201)
    expect(res.body.name).toBe('Coffee')
    expect(categoryCreate).toHaveBeenCalledWith({
      data: { name: 'Coffee', sortOrder: 0, parentId: null, shopId: 'shop-1' },
    })
  })

  it('blocks a cashier from creating a category', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ name: 'Coffee' })
    expect(res.status).toBe(403)
    expect(categoryCreate).not.toHaveBeenCalled()
  })

  it('rejects category creation with a missing name', async () => {
    const res = await request(app).post('/api/categories').set('Authorization', `Bearer ${adminToken}`).send({})
    expect(res.status).toBe(400)
  })

  it('rejects creating a category whose name collides with an active one', async () => {
    categoryFindFirst.mockResolvedValue({ id: 'cat-existing', name: 'Coffee', sortOrder: 0, isActive: true })
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Coffee' })
    expect(res.status).toBe(409)
    expect(categoryCreate).not.toHaveBeenCalled()
  })

  it('returns 409 (not a raw 500) when a concurrent request wins the same-name race past the app-level check', async () => {
    // categoryFindFirst passed (no matching row found yet), but by the time
    // this request's own create() runs, a concurrent request has already
    // committed a category with the same name — the DB's partial unique
    // index rejects it.
    categoryFindFirst.mockResolvedValue(null)
    categoryCreate.mockRejectedValue(makeP2002())
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Racing Category' })
    expect(res.status).toBe(409)
  })

  it('rejects reactivating a category whose name now collides with a different active category', async () => {
    // An isActive-only patch never touches `name`, so assertNameAvailable
    // never runs for it — the DB's partial unique index is the only thing
    // that catches this collision.
    categoryFindUnique.mockResolvedValue({ id: 'cat-old', name: 'Coffee', sortOrder: 0, isActive: false })
    categoryUpdate.mockRejectedValue(makeP2002())
    const res = await request(app)
      .patch('/api/categories/cat-old')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: true })
    expect(res.status).toBe(409)
  })

  it('allows an admin to deactivate a category', async () => {
    categoryUpdate.mockResolvedValue({ id: 'cat-1', name: 'Coffee', sortOrder: 0, isActive: false })
    const res = await request(app)
      .patch('/api/categories/cat-1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false })
    expect(res.status).toBe(200)
    expect(res.body.isActive).toBe(false)
    expect(categoryUpdate).toHaveBeenCalledWith({ where: { id: 'cat-1', shopId: 'shop-1' }, data: { isActive: false } })
  })

  it('blocks a cashier from updating a category', async () => {
    const res = await request(app)
      .patch('/api/categories/cat-1')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ isActive: false })
    expect(res.status).toBe(403)
    expect(categoryUpdate).not.toHaveBeenCalled()
  })
})

describe('Products API', () => {
  const fullProduct = {
    id: 'prod-1',
    categoryId: 'cat-1',
    name: 'Latte',
    description: null,
    basePrice: 450,
    isActive: true,
    category: { id: 'cat-1', name: 'Coffee' },
    variants: [],
    modifiers: [],
  }

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/products')
    expect(res.status).toBe(401)
  })

  it('allows a cashier to list products', async () => {
    productFindMany.mockResolvedValue([fullProduct])
    const res = await request(app).get('/api/products').set('Authorization', `Bearer ${cashierToken}`)
    expect(res.status).toBe(200)
    expect(res.body[0].name).toBe('Latte')
  })

  it('forces the active-only filter for a cashier even when activeOnly is omitted from the query', async () => {
    // The POS screen calls GET /api/products with no query params at all —
    // without server-side role enforcement, a cashier would see every
    // deactivated product too (mirrors listDiscounts's cashier override).
    productFindMany.mockResolvedValue([])
    await request(app).get('/api/products').set('Authorization', `Bearer ${cashierToken}`)
    expect(productFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: true }) }),
    )
  })

  it('lets an admin see the full unfiltered product list when activeOnly is omitted', async () => {
    productFindMany.mockResolvedValue([])
    await request(app).get('/api/products').set('Authorization', `Bearer ${adminToken}`)
    expect(productFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { shopId: 'shop-1' } }))
  })

  it('allows an admin to create a product', async () => {
    productCreate.mockResolvedValue({ id: 'prod-1' })
    productFindUnique.mockResolvedValue(fullProduct)
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ categoryId: 'cat-1', name: 'Latte', basePrice: 450 })
    expect(res.status).toBe(201)
    expect(res.body.name).toBe('Latte')
    expect(productCreate).toHaveBeenCalledWith({
      data: { categoryId: 'cat-1', name: 'Latte', basePrice: 450, shopId: 'shop-1', inventory: { create: {} } },
    })
  })

  it('blocks a cashier from creating a product', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ categoryId: 'cat-1', name: 'Latte', basePrice: 450 })
    expect(res.status).toBe(403)
    expect(productCreate).not.toHaveBeenCalled()
  })

  it('rejects a negative base price', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ categoryId: 'cat-1', name: 'Latte', basePrice: -100 })
    expect(res.status).toBe(400)
  })

  it('allows an admin to update a product price and deactivate it', async () => {
    productUpdate.mockResolvedValue({ id: 'prod-1' })
    productFindUnique.mockResolvedValue({ ...fullProduct, basePrice: 500, isActive: false })
    const res = await request(app)
      .patch('/api/products/prod-1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ basePrice: 500, isActive: false })
    expect(res.status).toBe(200)
    expect(res.body.basePrice).toBe(500)
    expect(res.body.isActive).toBe(false)
    expect(productUpdate).toHaveBeenCalledWith({
      where: { id: 'prod-1', shopId: 'shop-1' },
      data: { basePrice: 500, isActive: false },
    })
  })

  it('blocks a cashier from updating a product', async () => {
    const res = await request(app)
      .patch('/api/products/prod-1')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ basePrice: 999 })
    expect(res.status).toBe(403)
    expect(productUpdate).not.toHaveBeenCalled()
  })
})

describe('Product variants API', () => {
  it('allows an admin to add a variant to a product', async () => {
    variantCreate.mockResolvedValue({ id: 'var-1', productId: 'prod-1', name: 'Large', price: 550, isActive: true })
    productFindUnique.mockResolvedValue({ id: 'prod-1' })
    const res = await request(app)
      .post('/api/products/prod-1/variants')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Large', price: 550 })
    expect(res.status).toBe(201)
    expect(res.body.name).toBe('Large')
    expect(variantCreate).toHaveBeenCalledWith({ data: { name: 'Large', price: 550, productId: 'prod-1' } })
  })

  it('blocks a cashier from adding a variant', async () => {
    const res = await request(app)
      .post('/api/products/prod-1/variants')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ name: 'Large', price: 550 })
    expect(res.status).toBe(403)
    expect(variantCreate).not.toHaveBeenCalled()
  })

  it('404s when adding a variant to a product that does not exist', async () => {
    productFindUnique.mockResolvedValue(null)
    const res = await request(app)
      .post('/api/products/does-not-exist/variants')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Large', price: 550 })
    expect(res.status).toBe(404)
  })

  it('rejects adding a variant whose name collides with an active one on the same product', async () => {
    productFindUnique.mockResolvedValue({ id: 'prod-1' })
    variantFindFirst.mockResolvedValue({ id: 'var-existing', productId: 'prod-1', name: 'Large', isActive: true })
    const res = await request(app)
      .post('/api/products/prod-1/variants')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Large', price: 550 })
    expect(res.status).toBe(409)
    expect(variantCreate).not.toHaveBeenCalled()
  })

  it('returns 409 (not a raw 500) when a concurrent request wins the same-name race past the app-level check', async () => {
    productFindUnique.mockResolvedValue({ id: 'prod-1' })
    variantFindFirst.mockResolvedValue(null)
    variantCreate.mockRejectedValue(makeP2002())
    const res = await request(app)
      .post('/api/products/prod-1/variants')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Racing Size', price: 550 })
    expect(res.status).toBe(409)
  })

  it('rejects reactivating a variant whose name now collides with a different active variant on the same product', async () => {
    variantFindUnique.mockResolvedValue({ id: 'var-old', productId: 'prod-1', name: 'Large', isActive: false })
    variantUpdate.mockRejectedValue(makeP2002())
    const res = await request(app)
      .patch('/api/products/prod-1/variants/var-old')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: true })
    expect(res.status).toBe(409)
  })

  it('allows an admin to update a variant', async () => {
    variantFindUnique.mockResolvedValue({ id: 'var-1', productId: 'prod-1', name: 'Large', price: 550, isActive: true })
    variantUpdate.mockResolvedValue({ id: 'var-1', productId: 'prod-1', name: 'Large', price: 600, isActive: true })
    const res = await request(app)
      .patch('/api/products/prod-1/variants/var-1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price: 600 })
    expect(res.status).toBe(200)
    expect(res.body.price).toBe(600)
    expect(variantUpdate).toHaveBeenCalledWith({ where: { id: 'var-1' }, data: { price: 600 } })
  })

  it('blocks a cashier from updating a variant', async () => {
    const res = await request(app)
      .patch('/api/products/prod-1/variants/var-1')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ price: 600 })
    expect(res.status).toBe(403)
    expect(variantUpdate).not.toHaveBeenCalled()
  })
})

describe('Modifiers API', () => {
  it('allows a cashier to list modifiers', async () => {
    modifierFindMany.mockResolvedValue([{ id: 'mod-1', name: 'Extra Shot', price: 75, isActive: true }])
    const res = await request(app).get('/api/modifiers').set('Authorization', `Bearer ${cashierToken}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
  })

  it('forces the active-only filter for a cashier even when activeOnly is omitted from the query', async () => {
    // The POS screen's ProductPicker calls GET /api/modifiers with no query
    // params at all — without server-side role enforcement, a cashier would
    // see every deactivated modifier too (mirrors listDiscounts's cashier
    // override).
    modifierFindMany.mockResolvedValue([])
    await request(app).get('/api/modifiers').set('Authorization', `Bearer ${cashierToken}`)
    expect(modifierFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: true }) }),
    )
  })

  it('lets an admin see the full unfiltered modifier list when activeOnly is omitted', async () => {
    modifierFindMany.mockResolvedValue([])
    await request(app).get('/api/modifiers').set('Authorization', `Bearer ${adminToken}`)
    expect(modifierFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { shopId: 'shop-1' } }))
  })

  it('allows an admin to create a modifier', async () => {
    modifierCreate.mockResolvedValue({ id: 'mod-1', name: 'Extra Shot', price: 75, isActive: true })
    const res = await request(app)
      .post('/api/modifiers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Extra Shot', price: 75 })
    expect(res.status).toBe(201)
    expect(modifierCreate).toHaveBeenCalledWith({ data: { name: 'Extra Shot', price: 75, shopId: 'shop-1' } })
  })

  it('blocks a cashier from creating a modifier', async () => {
    const res = await request(app)
      .post('/api/modifiers')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ name: 'Extra Shot', price: 75 })
    expect(res.status).toBe(403)
    expect(modifierCreate).not.toHaveBeenCalled()
  })

  it('rejects creating a modifier whose name collides with an active one', async () => {
    modifierFindFirst.mockResolvedValue({ id: 'mod-existing', name: 'Extra Shot', price: 75, isActive: true })
    const res = await request(app)
      .post('/api/modifiers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Extra Shot', price: 75 })
    expect(res.status).toBe(409)
    expect(modifierCreate).not.toHaveBeenCalled()
  })

  it('returns 409 (not a raw 500) when a concurrent request wins the same-name race past the app-level check', async () => {
    modifierFindFirst.mockResolvedValue(null)
    modifierCreate.mockRejectedValue(makeP2002())
    const res = await request(app)
      .post('/api/modifiers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Racing Modifier', price: 75 })
    expect(res.status).toBe(409)
  })

  it('rejects reactivating a modifier whose name now collides with a different active modifier', async () => {
    modifierFindUnique.mockResolvedValue({ id: 'mod-old', name: 'Extra Shot', price: 75, isActive: false })
    modifierUpdate.mockRejectedValue(makeP2002())
    const res = await request(app)
      .patch('/api/modifiers/mod-old')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: true })
    expect(res.status).toBe(409)
  })

  it('allows an admin to update a modifier', async () => {
    modifierUpdate.mockResolvedValue({ id: 'mod-1', name: 'Extra Shot', price: 100, isActive: true })
    const res = await request(app)
      .patch('/api/modifiers/mod-1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price: 100 })
    expect(res.status).toBe(200)
    expect(res.body.price).toBe(100)
    expect(modifierUpdate).toHaveBeenCalledWith({ where: { id: 'mod-1', shopId: 'shop-1' }, data: { price: 100 } })
  })

  it('blocks a cashier from updating a modifier', async () => {
    const res = await request(app)
      .patch('/api/modifiers/mod-1')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ price: 100 })
    expect(res.status).toBe(403)
    expect(modifierUpdate).not.toHaveBeenCalled()
  })

  it('allows an admin to assign modifiers to a product', async () => {
    productFindUnique.mockResolvedValue({ id: 'prod-1', category: {}, variants: [], modifiers: [] })
    modifierCount.mockResolvedValue(2)
    const res = await request(app)
      .put('/api/products/prod-1/modifiers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ modifierIds: ['mod-1', 'mod-2'] })
    expect(res.status).toBe(200)
    expect(productModifierDeleteMany).toHaveBeenCalledWith({ where: { productId: 'prod-1' } })
    expect(productModifierCreateMany).toHaveBeenCalledWith({
      data: [
        { productId: 'prod-1', modifierId: 'mod-1' },
        { productId: 'prod-1', modifierId: 'mod-2' },
      ],
    })
  })

  it('blocks a cashier from assigning modifiers to a product', async () => {
    const res = await request(app)
      .put('/api/products/prod-1/modifiers')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ modifierIds: ['mod-1'] })
    expect(res.status).toBe(403)
    expect(productModifierDeleteMany).not.toHaveBeenCalled()
  })

  it('rejects assigning a modifier id that does not exist', async () => {
    productFindUnique.mockResolvedValue({ id: 'prod-1' })
    modifierCount.mockResolvedValue(1)
    const res = await request(app)
      .put('/api/products/prod-1/modifiers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ modifierIds: ['mod-1', 'does-not-exist'] })
    expect(res.status).toBe(400)
  })
})
