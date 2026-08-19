import { describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'
import { authorize } from '../src/middleware/authorize.js'
import { AppError } from '../src/lib/AppError.js'

function mockReq(user?: { id: string; role: 'ADMIN' | 'CASHIER' }): Request {
  return { user } as unknown as Request
}

describe('authorize middleware', () => {
  it('rejects a CASHIER hitting an ADMIN-only route with 403', () => {
    const next = vi.fn()
    authorize('ADMIN')(mockReq({ id: 'u1', role: 'CASHIER' }), {} as Response, next)
    expect((next.mock.calls[0]![0] as AppError).statusCode).toBe(403)
  })

  it('allows an ADMIN through an ADMIN-only route', () => {
    const next = vi.fn()
    authorize('ADMIN')(mockReq({ id: 'u1', role: 'ADMIN' }), {} as Response, next)
    expect(next).toHaveBeenCalledWith()
  })

  it('rejects when req.user is missing with 401', () => {
    const next = vi.fn()
    authorize('ADMIN', 'CASHIER')(mockReq(undefined), {} as Response, next)
    expect((next.mock.calls[0]![0] as AppError).statusCode).toBe(401)
  })
})
