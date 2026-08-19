import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'

function mockRes(): Response {
  const res = {} as Response
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

describe('errorHandler middleware in production', () => {
  const originalNodeEnv = process.env.NODE_ENV

  beforeAll(() => {
    vi.resetModules()
    process.env.NODE_ENV = 'production'
  })

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv
    vi.resetModules()
  })

  it('hides internal error details from the response', async () => {
    const { errorHandler } = await import('../src/middleware/errorHandler.js')
    const res = mockRes()
    errorHandler(new Error('sensitive db connection string leaked here'), {} as Request, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(500)
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0]![0]
    expect(body.error.message).not.toContain('sensitive')
    expect(body.error.message).toBe('Internal server error')
  })
})
