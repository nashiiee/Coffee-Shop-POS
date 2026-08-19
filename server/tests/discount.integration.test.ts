import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { Prisma } from '@prisma/client'

function makeP2002(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the fields: (`name`)', {
    code: 'P2002',
    clientVersion: 'test',
  })
}

const discountFindMany = vi.fn()
const discountFindFirst = vi.fn()
const discountFindUnique = vi.fn()
const discountCreate = vi.fn()
const discountUpdate = vi.fn()
const userFindUnique = vi.fn()
const auditLogCreate = vi.fn()

const mockPrisma = {
  discount: {
    findMany: discountFindMany,
    findFirst: discountFindFirst,
    findUnique: discountFindUnique,
    create: discountCreate,
    update: discountUpdate,
  },
  user: { findUnique: userFindUnique },
  auditLog: { create: auditLogCreate },
}

vi.mock('../src/lib/prisma.js', () => ({ prisma: mockPrisma }))

const { createApp } = await import('../src/app.js')
const { signAccessToken } = await import('../src/lib/jwt.js')

const app = createApp()
const adminToken = signAccessToken({ sub: 'admin-1', role: 'ADMIN' })
const cashierToken = signAccessToken({ sub: 'cashier-1', role: 'CASHIER' })

const tenPercentOff = {
  id: 'disc-1',
  name: '10% Off',
  type: 'PERCENTAGE',
  value: 10,
  isActive: true,
  expiresAt: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  discountFindFirst.mockResolvedValue(null) // name is available by default
  userFindUnique.mockResolvedValue({ name: 'Admin' })
})

describe('GET /api/discounts', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/discounts')
    expect(res.status).toBe(401)
  })

  it('allows both ADMIN and CASHIER to list discounts', async () => {
    discountFindMany.mockResolvedValue([tenPercentOff])
    const adminRes = await request(app).get('/api/discounts').set('Authorization', `Bearer ${adminToken}`)
    const cashierRes = await request(app).get('/api/discounts').set('Authorization', `Bearer ${cashierToken}`)
    expect(adminRes.status).toBe(200)
    expect(cashierRes.status).toBe(200)
  })

  it('excludes inactive AND expired discounts when activeOnly=true', async () => {
    discountFindMany.mockResolvedValue([tenPercentOff])
    await request(app).get('/api/discounts?activeOnly=true').set('Authorization', `Bearer ${cashierToken}`)
    expect(discountFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gte: expect.any(Date) } }],
        }),
      }),
    )
  })

  it('forces the active/valid filter for a cashier even when activeOnly is omitted from the query', async () => {
    discountFindMany.mockResolvedValue([tenPercentOff])
    await request(app).get('/api/discounts').set('Authorization', `Bearer ${cashierToken}`)
    expect(discountFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: true }) }),
    )
  })

  it('lets an admin see the full unfiltered catalog when activeOnly is omitted', async () => {
    discountFindMany.mockResolvedValue([tenPercentOff])
    await request(app).get('/api/discounts').set('Authorization', `Bearer ${adminToken}`)
    expect(discountFindMany).toHaveBeenCalledWith(expect.not.objectContaining({ where: expect.anything() }))
  })
})

describe('POST /api/discounts — ADMIN create', () => {
  it('rejects a cashier attempting to create a discount', async () => {
    const res = await request(app)
      .post('/api/discounts')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ name: '10% Off', type: 'PERCENTAGE', value: 10 })
    expect(res.status).toBe(403)
    expect(discountCreate).not.toHaveBeenCalled()
  })

  it('creates a percentage discount', async () => {
    discountCreate.mockResolvedValue(tenPercentOff)
    const res = await request(app)
      .post('/api/discounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '10% Off', type: 'PERCENTAGE', value: 10 })
    expect(res.status).toBe(201)
    expect(discountCreate).toHaveBeenCalledWith({ data: { name: '10% Off', type: 'PERCENTAGE', value: 10 } })
  })

  it('creates a fixed-amount discount', async () => {
    const fixedDiscount = { id: 'disc-2', name: '₱50 Off', type: 'FIXED', value: 5000, isActive: true, expiresAt: null }
    discountCreate.mockResolvedValue(fixedDiscount)
    const res = await request(app)
      .post('/api/discounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '₱50 Off', type: 'FIXED', value: 5000 })
    expect(res.status).toBe(201)
  })

  it('creates a discount with an expiry date', async () => {
    discountCreate.mockResolvedValue(tenPercentOff)
    const res = await request(app)
      .post('/api/discounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Holiday Promo', type: 'PERCENTAGE', value: 15, expiresAt: '2026-12-31T00:00:00.000Z' })
    expect(res.status).toBe(201)
    expect(discountCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ expiresAt: new Date('2026-12-31T00:00:00.000Z') }) }),
    )
  })

  it('rejects an explicit null expiresAt on create, rather than silently coercing it to epoch', async () => {
    const res = await request(app)
      .post('/api/discounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Bad Expiry', type: 'PERCENTAGE', value: 10, expiresAt: null })
    expect(res.status).toBe(400)
    expect(discountCreate).not.toHaveBeenCalled()
  })

  it('rejects a percentage discount value over 100', async () => {
    const res = await request(app)
      .post('/api/discounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Too Much', type: 'PERCENTAGE', value: 150 })
    expect(res.status).toBe(400)
    expect(discountCreate).not.toHaveBeenCalled()
  })

  it('rejects a negative discount value', async () => {
    const res = await request(app)
      .post('/api/discounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Negative', type: 'FIXED', value: -100 })
    expect(res.status).toBe(400)
    expect(discountCreate).not.toHaveBeenCalled()
  })

  it('rejects a non-integer discount value', async () => {
    const res = await request(app)
      .post('/api/discounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Fractional', type: 'FIXED', value: 10.5 })
    expect(res.status).toBe(400)
  })

  it('rejects a duplicate active discount name', async () => {
    discountFindFirst.mockResolvedValue(tenPercentOff)
    const res = await request(app)
      .post('/api/discounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '10% Off', type: 'PERCENTAGE', value: 20 })
    expect(res.status).toBe(409)
    expect(discountCreate).not.toHaveBeenCalled()
  })

  it('returns 409 (not a raw 500) when a concurrent request wins the same-name race past the app-level check', async () => {
    // assertNameAvailable passed (no matching row found yet), but by the
    // time this request's own create() runs, a concurrent request has
    // already committed a discount with the same name — the DB's partial
    // unique index rejects it.
    discountFindFirst.mockResolvedValue(null)
    discountCreate.mockRejectedValue(makeP2002())
    const res = await request(app)
      .post('/api/discounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Racing Promo', type: 'PERCENTAGE', value: 20 })
    expect(res.status).toBe(409)
  })
})

describe('PATCH /api/discounts/:id — ADMIN edit and activate/deactivate', () => {
  it('rejects a cashier attempting to edit a discount', async () => {
    const res = await request(app)
      .patch('/api/discounts/disc-1')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ value: 20 })
    expect(res.status).toBe(403)
    expect(discountUpdate).not.toHaveBeenCalled()
  })

  it('edits a discount value', async () => {
    discountFindUnique.mockResolvedValue(tenPercentOff)
    discountUpdate.mockResolvedValue({ ...tenPercentOff, value: 20 })
    const res = await request(app)
      .patch('/api/discounts/disc-1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: 20 })
    expect(res.status).toBe(200)
    expect(discountUpdate).toHaveBeenCalledWith({ where: { id: 'disc-1' }, data: { value: 20 } })
  })

  it('deactivates a discount', async () => {
    discountFindUnique.mockResolvedValue(tenPercentOff)
    discountUpdate.mockResolvedValue({ ...tenPercentOff, isActive: false })
    const res = await request(app)
      .patch('/api/discounts/disc-1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false })
    expect(res.status).toBe(200)
    expect(discountUpdate).toHaveBeenCalledWith({ where: { id: 'disc-1' }, data: { isActive: false } })
  })

  it('reactivates a discount', async () => {
    discountFindUnique.mockResolvedValue({ ...tenPercentOff, isActive: false })
    discountUpdate.mockResolvedValue(tenPercentOff)
    const res = await request(app)
      .patch('/api/discounts/disc-1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: true })
    expect(res.status).toBe(200)
  })

  it('rejects reactivating a discount whose name now collides with a different active discount', async () => {
    // This isActive-only patch never touches `name`, so assertNameAvailable
    // never runs for it — the DB's partial unique index is the only thing
    // that catches this collision.
    discountFindUnique.mockResolvedValue({ ...tenPercentOff, id: 'disc-old', isActive: false })
    discountUpdate.mockRejectedValue(makeP2002())
    const res = await request(app)
      .patch('/api/discounts/disc-old')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: true })
    expect(res.status).toBe(409)
  })

  it('rejects raising a percentage discount value above 100 via a value-only patch', async () => {
    discountFindUnique.mockResolvedValue(tenPercentOff) // existing type: PERCENTAGE
    const res = await request(app)
      .patch('/api/discounts/disc-1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: 500 })
    expect(res.status).toBe(400)
    expect(discountUpdate).not.toHaveBeenCalled()
  })

  it('404s when editing a discount that does not exist', async () => {
    discountFindUnique.mockResolvedValue(null)
    const res = await request(app)
      .patch('/api/discounts/does-not-exist')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: 20 })
    expect(res.status).toBe(404)
  })

  it('clears an expiry date by explicitly patching it to null', async () => {
    discountFindUnique.mockResolvedValue({ ...tenPercentOff, expiresAt: new Date('2026-01-01') })
    discountUpdate.mockResolvedValue({ ...tenPercentOff, expiresAt: null })
    const res = await request(app)
      .patch('/api/discounts/disc-1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ expiresAt: null })
    expect(res.status).toBe(200)
    expect(discountUpdate).toHaveBeenCalledWith({ where: { id: 'disc-1' }, data: { expiresAt: null } })
  })

  it('rejects an empty patch body', async () => {
    const res = await request(app).patch('/api/discounts/disc-1').set('Authorization', `Bearer ${adminToken}`).send({})
    expect(res.status).toBe(400)
  })
})
