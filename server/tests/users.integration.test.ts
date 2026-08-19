import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'

const userFindMany = vi.fn()
const userFindUnique = vi.fn()
const userCreate = vi.fn()
const userUpdate = vi.fn()
const queryRaw = vi.fn()
const auditLogCreate = vi.fn()

const mockPrisma = {
  user: { findMany: userFindMany, findUnique: userFindUnique, create: userCreate, update: userUpdate },
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

const cashierDTO = {
  id: 'cashier-2',
  name: 'Cara',
  email: 'cara@shop.test',
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
}

beforeEach(() => {
  vi.clearAllMocks()
  userFindUnique.mockResolvedValue({ id: 'admin-1', name: 'Admin', role: 'ADMIN' })
})

describe('GET /api/admin/users — authorization', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/admin/users')
    expect(res.status).toBe(401)
  })

  it('rejects a cashier', async () => {
    const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${cashierToken}`)
    expect(res.status).toBe(403)
  })
})

describe('GET /api/admin/users — behavior', () => {
  it('lists cashier accounts only', async () => {
    userFindMany.mockResolvedValue([cashierDTO])
    const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual([{ ...cashierDTO, createdAt: cashierDTO.createdAt.toISOString() }])
    expect(userFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { role: 'CASHIER' } }))
  })
})

describe('POST /api/admin/users — create cashier', () => {
  it('creates a cashier and records a USER_CREATED audit entry', async () => {
    userCreate.mockResolvedValue(cashierDTO)
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Cara', email: 'cara@shop.test', password: 'correct-horse-battery' })

    expect(res.status).toBe(201)
    expect(res.body.email).toBe('cara@shop.test')
    expect(res.body.passwordHash).toBeUndefined()
    expect(auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actorId: 'admin-1', action: 'USER_CREATED', resourceId: cashierDTO.id }),
      }),
    )
  })

  it('rejects a cashier trying to create another cashier', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ name: 'Cara', email: 'cara@shop.test', password: 'correct-horse-battery' })
    expect(res.status).toBe(403)
  })

  it('validates the request body', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '', email: 'not-an-email', password: 'short' })
    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/admin/users/:id/disable', () => {
  it('disables a cashier and records a USER_DISABLED audit entry', async () => {
    userFindUnique.mockResolvedValue({ id: 'cashier-2', name: 'Cara', role: 'CASHIER', isActive: true })
    userUpdate.mockResolvedValue({ ...cashierDTO, isActive: false })

    const res = await request(app).patch('/api/admin/users/cashier-2/disable').set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.isActive).toBe(false)
    expect(userUpdate).toHaveBeenCalledWith({ where: { id: 'cashier-2' }, data: { isActive: false }, select: expect.anything() })
    expect(auditLogCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'USER_DISABLED' }) }))
  })

  it('refuses to let an admin disable their own account', async () => {
    const res = await request(app).patch('/api/admin/users/admin-1/disable').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(400)
    expect(userUpdate).not.toHaveBeenCalled()
  })

  it('refuses to disable the only active admin account', async () => {
    userFindUnique.mockResolvedValue({ id: 'admin-2', name: 'Other Admin', role: 'ADMIN', isActive: true })
    queryRaw.mockResolvedValue([{ id: 'admin-2' }])

    const res = await request(app).patch('/api/admin/users/admin-2/disable').set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(400)
    expect(userUpdate).not.toHaveBeenCalled()
  })

  it('allows disabling an admin when another active admin still exists', async () => {
    userFindUnique.mockResolvedValue({ id: 'admin-2', name: 'Other Admin', role: 'ADMIN', isActive: true })
    queryRaw.mockResolvedValue([{ id: 'admin-1' }, { id: 'admin-2' }])
    userUpdate.mockResolvedValue({ id: 'admin-2', name: 'Other Admin', email: 'x@x.com', isActive: false, createdAt: new Date() })

    const res = await request(app).patch('/api/admin/users/admin-2/disable').set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
  })

  it('returns 404 for a nonexistent user', async () => {
    userFindUnique.mockResolvedValue(null)
    const res = await request(app).patch('/api/admin/users/missing/disable').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/admin/users/:id/reactivate', () => {
  it('reactivates a disabled cashier', async () => {
    userFindUnique.mockResolvedValue({ id: 'cashier-2', name: 'Cara', role: 'CASHIER', isActive: false })
    userUpdate.mockResolvedValue({ ...cashierDTO, isActive: true })

    const res = await request(app).patch('/api/admin/users/cashier-2/reactivate').set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.isActive).toBe(true)
    expect(auditLogCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'USER_REACTIVATED' }) }))
  })

  it('is a no-op — no update, no audit entry — when the user is already active', async () => {
    userFindUnique.mockResolvedValue({ id: 'cashier-2', name: 'Cara', email: 'cara@shop.test', role: 'CASHIER', isActive: true, createdAt: new Date() })

    const res = await request(app).patch('/api/admin/users/cashier-2/reactivate').set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.isActive).toBe(true)
    expect(userUpdate).not.toHaveBeenCalled()
    expect(auditLogCreate).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/admin/users/:id/reset-password', () => {
  it('resets the password and records an audit entry without leaking the password', async () => {
    userFindUnique.mockResolvedValue({ id: 'cashier-2', name: 'Cara', role: 'CASHIER', isActive: true })
    userUpdate.mockResolvedValue({ id: 'cashier-2' })

    const res = await request(app)
      .patch('/api/admin/users/cashier-2/reset-password')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: 'new-correct-horse-battery' })

    expect(res.status).toBe(204)
    const auditCall = auditLogCreate.mock.calls.find((call) => call[0].data.action === 'USER_PASSWORD_RESET')
    expect(auditCall).toBeDefined()
    expect(JSON.stringify(auditCall![0])).not.toContain('new-correct-horse-battery')
  })

  it('rejects a password shorter than the minimum length', async () => {
    const res = await request(app)
      .patch('/api/admin/users/cashier-2/reset-password')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: 'short' })
    expect(res.status).toBe(400)
  })
})
