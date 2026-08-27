import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'

const productFindUnique = vi.fn()
const orderItemCount = vi.fn()
const productVariantDeleteMany = vi.fn()
const inventoryTransactionDeleteMany = vi.fn()
const inventoryItemDeleteMany = vi.fn()
const productDelete = vi.fn()
const shopFindUnique = vi.fn()

const txClient = {
  productVariant: { deleteMany: productVariantDeleteMany },
  inventoryTransaction: { deleteMany: inventoryTransactionDeleteMany },
  inventoryItem: { deleteMany: inventoryItemDeleteMany },
  product: { delete: productDelete },
}

const mockPrisma = {
  product: { findUnique: productFindUnique },
  orderItem: { count: orderItemCount },
  shop: { findUnique: shopFindUnique },
  $transaction: vi.fn(async (callback: (tx: typeof txClient) => unknown) => callback(txClient)),
}

vi.mock('../src/lib/prisma.js', () => ({ prisma: mockPrisma }))

const { createApp } = await import('../src/app.js')
const { signAccessToken } = await import('../src/lib/jwt.js')

const app = createApp()
const adminToken = signAccessToken({ sub: 'admin-1', role: 'ADMIN', shopId: 'shop-1' })
const cashierToken = signAccessToken({ sub: 'cashier-1', role: 'CASHIER', shopId: 'shop-1' })

const existingProduct = { id: 'prod-1', name: 'Typo Latte', isActive: true }

beforeEach(() => {
  vi.clearAllMocks()
  productFindUnique.mockResolvedValue(existingProduct)
  orderItemCount.mockResolvedValue(0)
  shopFindUnique.mockResolvedValue({ subscriptionStatus: 'ACTIVE' })
})

describe('DELETE /api/products/:id — authorization', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).delete('/api/products/prod-1')
    expect(res.status).toBe(401)
  })

  it('rejects a cashier', async () => {
    const res = await request(app).delete('/api/products/prod-1').set('Authorization', `Bearer ${cashierToken}`)
    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/products/:id — behavior', () => {
  it('returns 404 when the product does not exist', async () => {
    productFindUnique.mockResolvedValue(null)
    const res = await request(app).delete('/api/products/missing').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(404)
  })

  it('blocks deletion with a 409 when the product has order history', async () => {
    orderItemCount.mockResolvedValue(3)
    const res = await request(app).delete('/api/products/prod-1').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(409)
    expect(productDelete).not.toHaveBeenCalled()
  })

  it('deletes the product and its variants/inventory when there is no order history', async () => {
    const res = await request(app).delete('/api/products/prod-1').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(204)
    expect(productVariantDeleteMany).toHaveBeenCalledWith({ where: { productId: 'prod-1' } })
    expect(inventoryTransactionDeleteMany).toHaveBeenCalledWith({ where: { inventoryItem: { productId: 'prod-1' } } })
    expect(inventoryItemDeleteMany).toHaveBeenCalledWith({ where: { productId: 'prod-1' } })
    expect(productDelete).toHaveBeenCalledWith({ where: { id: 'prod-1', shopId: 'shop-1' } })
  })
})
