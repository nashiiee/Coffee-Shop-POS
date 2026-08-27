import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const productFindUnique = vi.fn()
const productUpdate = vi.fn()
const shopFindUnique = vi.fn()

const mockPrisma = {
  product: { findUnique: productFindUnique, update: productUpdate },
  shop: { findUnique: shopFindUnique },
}

vi.mock('../src/lib/prisma.js', () => ({ prisma: mockPrisma }))

const { createApp } = await import('../src/app.js')
const { signAccessToken } = await import('../src/lib/jwt.js')
const { PRODUCT_UPLOADS_DIR } = await import('../src/services/productImage.service.js')

const app = createApp()
const adminToken = signAccessToken({ sub: 'admin-1', role: 'ADMIN', shopId: 'shop-1' })
const cashierToken = signAccessToken({ sub: 'cashier-1', role: 'CASHIER', shopId: 'shop-1' })

const existingProduct = { id: 'prod-1', name: 'Latte', imageUrl: null }
const tinyJpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])

beforeEach(() => {
  vi.clearAllMocks()
  productFindUnique.mockResolvedValue(existingProduct)
  productUpdate.mockResolvedValue({ ...existingProduct })
  shopFindUnique.mockResolvedValue({ subscriptionStatus: 'ACTIVE' })
})

afterEach(async () => {
  // The service writes real files (memory-storage multer buffer -> disk),
  // so clean up anything this test run created.
  const entries = await fs.readdir(PRODUCT_UPLOADS_DIR).catch(() => [] as string[])
  await Promise.all(
    entries.filter((name) => name.startsWith('prod-1-')).map((name) => fs.unlink(path.join(PRODUCT_UPLOADS_DIR, name))),
  )
})

describe('POST /api/products/:id/image — authorization', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).post('/api/products/prod-1/image').attach('image', tinyJpegBuffer, 'photo.jpg')
    expect(res.status).toBe(401)
  })

  it('rejects a cashier', async () => {
    const res = await request(app)
      .post('/api/products/prod-1/image')
      .set('Authorization', `Bearer ${cashierToken}`)
      .attach('image', tinyJpegBuffer, 'photo.jpg')
    expect(res.status).toBe(403)
  })
})

describe('POST /api/products/:id/image — behavior', () => {
  it('returns 400 when no file is attached', async () => {
    const res = await request(app).post('/api/products/prod-1/image').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(400)
  })

  it('returns 400 for a disallowed file type', async () => {
    const res = await request(app)
      .post('/api/products/prod-1/image')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('image', Buffer.from('not an image'), 'notes.txt')
    expect(res.status).toBe(400)
    expect(productUpdate).not.toHaveBeenCalled()
  })

  it('returns 404 when the product does not exist', async () => {
    productFindUnique.mockResolvedValue(null)
    const res = await request(app)
      .post('/api/products/missing/image')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('image', tinyJpegBuffer, 'photo.jpg')
    expect(res.status).toBe(404)
  })

  it('saves the image and updates the product with a /uploads/products/ URL', async () => {
    const res = await request(app)
      .post('/api/products/prod-1/image')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('image', tinyJpegBuffer, 'photo.jpg')

    expect(res.status).toBe(200)
    expect(res.body.imageUrl).toMatch(/^\/uploads\/products\/prod-1-\d+\.jpg$/)
    expect(productUpdate).toHaveBeenCalledWith({ where: { id: 'prod-1' }, data: { imageUrl: res.body.imageUrl } })

    const written = await fs.readFile(path.join(PRODUCT_UPLOADS_DIR, path.basename(res.body.imageUrl)))
    expect(written).toEqual(tinyJpegBuffer)
  })

  it('deletes the previous image file when replacing an existing one', async () => {
    // Seed a real "previous" file on disk so we can prove it gets cleaned up
    // — the fixture in every other test has imageUrl: null, which never
    // exercises this path at all.
    await fs.mkdir(PRODUCT_UPLOADS_DIR, { recursive: true })
    const previousFilename = 'prod-1-1000000000000.jpg'
    await fs.writeFile(path.join(PRODUCT_UPLOADS_DIR, previousFilename), Buffer.from('old photo'))
    productFindUnique.mockResolvedValue({ ...existingProduct, imageUrl: `/uploads/products/${previousFilename}` })

    const res = await request(app)
      .post('/api/products/prod-1/image')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('image', tinyJpegBuffer, 'new-photo.jpg')

    expect(res.status).toBe(200)
    expect(res.body.imageUrl).not.toBe(`/uploads/products/${previousFilename}`)

    await expect(fs.readFile(path.join(PRODUCT_UPLOADS_DIR, previousFilename))).rejects.toThrow()
  })
})
