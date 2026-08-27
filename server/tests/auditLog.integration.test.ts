import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'

const auditLogFindMany = vi.fn()
const auditLogCount = vi.fn()
const shopFindUnique = vi.fn()

const mockPrisma = {
  auditLog: { findMany: auditLogFindMany, count: auditLogCount },
  shop: { findUnique: shopFindUnique },
}

vi.mock('../src/lib/prisma.js', () => ({ prisma: mockPrisma }))

const { createApp } = await import('../src/app.js')
const { signAccessToken } = await import('../src/lib/jwt.js')

const app = createApp()
const adminToken = signAccessToken({ sub: 'admin-1', role: 'ADMIN', shopId: 'shop-1' })
const cashierToken = signAccessToken({ sub: 'cashier-1', role: 'CASHIER', shopId: 'shop-1' })

const sampleLog = {
  id: 'audit-1',
  actorId: 'admin-1',
  actorName: 'Admin',
  action: 'PRODUCT_CREATED',
  resource: 'Product',
  resourceId: 'prod-1',
  previousState: null,
  newState: { name: 'Latte' },
  createdAt: new Date('2026-08-19T10:00:00.000Z'),
}

beforeEach(() => {
  vi.clearAllMocks()
  auditLogFindMany.mockResolvedValue([sampleLog])
  auditLogCount.mockResolvedValue(1)
  shopFindUnique.mockResolvedValue({ subscriptionStatus: 'ACTIVE' })
})

describe('GET /api/admin/audit-logs — authorization', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/admin/audit-logs')
    expect(res.status).toBe(401)
  })

  it('rejects a cashier — audit logs are admin-only', async () => {
    const res = await request(app).get('/api/admin/audit-logs').set('Authorization', `Bearer ${cashierToken}`)
    expect(res.status).toBe(403)
  })
})

describe('GET /api/admin/audit-logs — behavior', () => {
  it('returns a paginated list of audit entries', async () => {
    const res = await request(app).get('/api/admin/audit-logs').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(1)
    expect(res.body.logs).toHaveLength(1)
    expect(res.body.logs[0].action).toBe('PRODUCT_CREATED')
  })

  it('filters by action', async () => {
    const res = await request(app)
      .get('/api/admin/audit-logs')
      .query({ action: 'USER_DISABLED' })
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(auditLogFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ action: 'USER_DISABLED' }) }))
  })

  it('treats dateTo as inclusive of the whole selected day, not exclusive at midnight', async () => {
    const res = await request(app)
      .get('/api/admin/audit-logs')
      .query({ dateFrom: '2026-08-01', dateTo: '2026-08-19' })
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    const call = auditLogFindMany.mock.calls[0]![0] as { where: { createdAt: { lt: Date } } }
    // Events at any time ON 2026-08-19 (e.g. 23:59) must be included, so the
    // upper bound must be the start of 2026-08-20, not 2026-08-19 00:00.
    expect(call.where.createdAt.lt.toISOString()).toBe('2026-08-20T00:00:00.000Z')
  })

  it('filters by resource', async () => {
    const res = await request(app)
      .get('/api/admin/audit-logs')
      .query({ resource: 'Discount' })
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(auditLogFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ resource: 'Discount' }) }))
  })

  it('rejects an invalid action filter', async () => {
    const res = await request(app)
      .get('/api/admin/audit-logs')
      .query({ action: 'NOT_A_REAL_ACTION' })
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(400)
  })

  it('rejects dateFrom after dateTo', async () => {
    const res = await request(app)
      .get('/api/admin/audit-logs')
      .query({ dateFrom: '2026-08-20', dateTo: '2026-08-01' })
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(400)
  })

  it('applies pagination params', async () => {
    const res = await request(app)
      .get('/api/admin/audit-logs')
      .query({ page: 2, pageSize: 10 })
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(auditLogFindMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10 }))
  })
})
