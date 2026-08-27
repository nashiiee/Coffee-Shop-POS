import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'

const userFindMany = vi.fn()
const userFindUnique = vi.fn()
const userCreate = vi.fn()
const userUpdate = vi.fn()
const queryRaw = vi.fn()
const auditLogCreate = vi.fn()
const shopFindUnique = vi.fn()

const mockPrisma = {
  user: { findMany: userFindMany, findUnique: userFindUnique, create: userCreate, update: userUpdate },
  auditLog: { create: auditLogCreate },
  shop: { findUnique: shopFindUnique },
  $queryRaw: queryRaw,
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
  shopFindUnique.mockResolvedValue({ subscriptionStatus: 'ACTIVE' })
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
    expect(userFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { role: 'CASHIER', shopId: 'shop-1' } }))
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
    expect(userUpdate).toHaveBeenCalledWith({ where: { id: 'cashier-2', shopId: 'shop-1' }, data: { isActive: false }, select: expect.anything() })
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

  it('scopes the admin-lockout guard to the acting admin\'s own shop (regression test for the pre-multi-tenant bug: the guard used to count active admins GLOBALLY across every shop)', async () => {
    userFindUnique.mockResolvedValue({ id: 'admin-2', name: 'Other Admin', role: 'ADMIN', isActive: true })
    // Simulate shop-1 having exactly one active admin. A correctly
    // shop-scoped query returns exactly this row regardless of how many
    // active admins exist in *other* shops on the platform — a naive
    // unscoped query (`WHERE role = 'ADMIN' AND "isActive" = true` with no
    // shopId filter) would instead count admins across every shop and
    // could easily return more than 1, wrongly letting shop-1 disable its
    // only admin and lock itself out for good.
    queryRaw.mockResolvedValue([{ id: 'admin-2' }])

    const res = await request(app).patch('/api/admin/users/admin-2/disable').set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(400)
    expect(userUpdate).not.toHaveBeenCalled()

    // Assert the raw query was actually parameterized with the acting
    // admin's shopId, not just that a rejection happened to occur — this is
    // what proves the fix instead of just its symptom.
    const [sqlStrings, ...values] = queryRaw.mock.calls[0] as [readonly string[], ...unknown[]]
    expect(sqlStrings.join('')).toContain('"shopId" =')
    expect(values).toContain('shop-1')
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

  it('is a no-op — no update, no audit entry — when the user is already disabled', async () => {
    userFindUnique.mockResolvedValue({ id: 'cashier-2', name: 'Cara', email: 'cara@shop.test', role: 'CASHIER', isActive: false, createdAt: new Date() })

    const res = await request(app).patch('/api/admin/users/cashier-2/disable').set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.isActive).toBe(false)
    expect(userUpdate).not.toHaveBeenCalled()
    expect(auditLogCreate).not.toHaveBeenCalled()
  })
})

describe('GET /api/users/me', () => {
  it('rejects a token whose user has since been disabled', async () => {
    // The access token itself is still validly signed (authenticate.ts is
    // purely signature-based, no per-request DB check) — this is the one
    // path that actually re-checks isActive against the DB for an
    // already-issued access token.
    userFindUnique.mockResolvedValue({ id: 'cashier-1', name: 'Cara', email: 'cara@shop.test', role: 'CASHIER', isActive: false })
    const res = await request(app).get('/api/users/me').set('Authorization', `Bearer ${cashierToken}`)
    expect(res.status).toBe(401)
  })

  it('rejects a token for a user that no longer exists at all', async () => {
    userFindUnique.mockResolvedValue(null)
    const res = await request(app).get('/api/users/me').set('Authorization', `Bearer ${cashierToken}`)
    expect(res.status).toBe(401)
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
