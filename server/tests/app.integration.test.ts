import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'

const findUnique = vi.fn()
const shopFindUnique = vi.fn()

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => findUnique(...args) },
    shop: { findUnique: (...args: unknown[]) => shopFindUnique(...args) },
  },
}))

const { createApp } = await import('../src/app.js')
const { hashPassword } = await import('../src/lib/password.js')
const { signAccessToken, signRefreshToken } = await import('../src/lib/jwt.js')

const app = createApp()

const ADMIN_PASSWORD = 'admin-password-123'
const CASHIER_PASSWORD = 'cashier-password-123'

let adminUser: Record<string, unknown>
let cashierUser: Record<string, unknown>

const shopFixture = { id: 'shop-1', subscriptionStatus: 'ACTIVE' as const }

beforeEach(async () => {
  findUnique.mockReset()
  shopFindUnique.mockReset()
  shopFindUnique.mockResolvedValue(shopFixture)
  adminUser = {
    id: 'admin-1',
    shopId: shopFixture.id,
    shop: shopFixture,
    name: 'Ada Admin',
    email: 'admin@coffeeshop.test',
    role: 'ADMIN',
    isActive: true,
    passwordHash: await hashPassword(ADMIN_PASSWORD),
  }
  cashierUser = {
    id: 'cashier-1',
    shopId: shopFixture.id,
    shop: shopFixture,
    name: 'Cara Cashier',
    email: 'cashier@coffeeshop.test',
    role: 'CASHIER',
    isActive: true,
    passwordHash: await hashPassword(CASHIER_PASSWORD),
  }
  findUnique.mockImplementation(({ where }: { where: { email?: string; id?: string } }) => {
    if (where.email === adminUser.email || where.id === adminUser.id) return Promise.resolve(adminUser)
    if (where.email === cashierUser.email || where.id === cashierUser.id) return Promise.resolve(cashierUser)
    return Promise.resolve(null)
  })
})

describe('POST /api/auth/login', () => {
  it('logs in a valid admin', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: adminUser.email, password: ADMIN_PASSWORD })
    expect(res.status).toBe(200)
    expect(res.body.user.role).toBe('ADMIN')
    expect(res.body.accessToken).toBeTruthy()
    expect(res.headers['set-cookie']?.[0]).toMatch(/refreshToken=/)
  })

  it('logs in a valid cashier', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: cashierUser.email, password: CASHIER_PASSWORD })
    expect(res.status).toBe(200)
    expect(res.body.user.role).toBe('CASHIER')
  })

  it('rejects an invalid password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: adminUser.email, password: 'totally-wrong' })
    expect(res.status).toBe(401)
  })

  it('rejects a nonexistent account', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@coffeeshop.test', password: 'whatever' })
    expect(res.status).toBe(401)
  })
})

describe('POST /api/auth/refresh', () => {
  it('issues a new access token and rotates the refresh cookie for a valid refresh cookie', async () => {
    const refreshToken = signRefreshToken({ sub: adminUser.id as string })
    const res = await request(app).post('/api/auth/refresh').set('Cookie', [`refreshToken=${refreshToken}`])
    expect(res.status).toBe(200)
    expect(res.body.user.role).toBe('ADMIN')
    expect(res.body.accessToken).toBeTruthy()
    expect(res.headers['set-cookie']?.[0]).toMatch(/refreshToken=/)
  })

  it('rejects a request with no refresh cookie at all', async () => {
    const res = await request(app).post('/api/auth/refresh')
    expect(res.status).toBe(401)
  })

  it('rejects a garbage/invalid refresh cookie', async () => {
    const res = await request(app).post('/api/auth/refresh').set('Cookie', ['refreshToken=not-a-real-token'])
    expect(res.status).toBe(401)
  })

  it('rejects a structurally valid refresh token for a user who has since been disabled', async () => {
    // Mirrors the AuthProvider's proactive renewal flow: a cashier disabled
    // mid-shift must not be able to silently stay signed in past their next
    // scheduled token refresh, even though the refresh token itself hasn't
    // expired yet (7-day TTL).
    const refreshToken = signRefreshToken({ sub: cashierUser.id as string })
    cashierUser.isActive = false
    const res = await request(app).post('/api/auth/refresh').set('Cookie', [`refreshToken=${refreshToken}`])
    expect(res.status).toBe(401)
  })
})

describe('POST /api/auth/logout', () => {
  it('clears the refresh cookie', async () => {
    const res = await request(app).post('/api/auth/logout')
    expect(res.status).toBe(204)
    expect(res.headers['set-cookie']?.[0]).toMatch(/refreshToken=;/)
  })
})

describe('RBAC on protected routes', () => {
  it('rejects an unauthenticated request to an admin route', async () => {
    const res = await request(app).get('/api/admin/overview')
    expect(res.status).toBe(401)
  })

  it('rejects a cashier hitting an admin-only route', async () => {
    const token = signAccessToken({ sub: 'cashier-1', role: 'CASHIER', shopId: 'shop-1' })
    const res = await request(app).get('/api/admin/overview').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
  })

  it('allows an admin to access an admin-only route', async () => {
    const token = signAccessToken({ sub: 'admin-1', role: 'ADMIN', shopId: 'shop-1' })
    const res = await request(app).get('/api/admin/overview').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })

  it('allows a cashier to access the shared POS route', async () => {
    const token = signAccessToken({ sub: 'cashier-1', role: 'CASHIER', shopId: 'shop-1' })
    const res = await request(app).get('/api/pos/session').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })

  it('allows an admin to access the shared POS route too', async () => {
    const token = signAccessToken({ sub: 'admin-1', role: 'ADMIN', shopId: 'shop-1' })
    const res = await request(app).get('/api/pos/session').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })

  it('returns the caller\'s own profile from /api/users/me', async () => {
    const token = signAccessToken({ sub: 'cashier-1', role: 'CASHIER', shopId: 'shop-1' })
    const res = await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.email).toBe(cashierUser.email)
    expect(res.body.passwordHash).toBeUndefined()
  })
})
