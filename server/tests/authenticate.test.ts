import { describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'
import { authenticate } from '../src/middleware/authenticate.js'
import { signAccessToken } from '../src/lib/jwt.js'
import { AppError } from '../src/lib/AppError.js'

function mockReq(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request
}

describe('authenticate middleware', () => {
  it('calls next with 401 when the Authorization header is missing', () => {
    const next = vi.fn()
    authenticate(mockReq(), {} as Response, next)
    expect(next).toHaveBeenCalledWith(expect.any(AppError))
    expect((next.mock.calls[0]![0] as AppError).statusCode).toBe(401)
  })

  it('calls next with 401 for an invalid token', () => {
    const next = vi.fn()
    authenticate(mockReq({ authorization: 'Bearer not-a-real-token' }), {} as Response, next)
    expect((next.mock.calls[0]![0] as AppError).statusCode).toBe(401)
  })

  it('attaches req.user and calls next() for a valid token', () => {
    const token = signAccessToken({ sub: 'user-1', role: 'CASHIER' })
    const req = mockReq({ authorization: `Bearer ${token}` })
    const next = vi.fn()
    authenticate(req, {} as Response, next)
    expect(req.user).toEqual({ id: 'user-1', role: 'CASHIER' })
    expect(next).toHaveBeenCalledWith()
  })
})
