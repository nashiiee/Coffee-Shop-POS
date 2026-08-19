import { describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'
import { errorHandler } from '../src/middleware/errorHandler.js'
import { AppError } from '../src/lib/AppError.js'

function mockRes(): Response {
  const res = {} as Response
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

describe('errorHandler middleware', () => {
  it('maps an AppError to its status code and body', () => {
    const res = mockRes()
    errorHandler(AppError.forbidden('nope'), {} as Request, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'FORBIDDEN', message: 'nope' } })
  })

  it('maps an unknown error to 500 and includes the message outside production', () => {
    const res = mockRes()
    errorHandler(new Error('boom'), {} as Request, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(500)
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0]![0]
    expect(body.error.code).toBe('INTERNAL_ERROR')
    expect(body.error.message).toBe('boom')
  })
})
