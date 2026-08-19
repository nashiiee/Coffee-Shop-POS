import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiRequest, ApiError } from './apiClient'

function mockFetchOnce(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      status,
      ok: status >= 200 && status < 300,
      json: () => Promise.resolve(body),
    }),
  )
}

describe('apiRequest', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the parsed payload on success', async () => {
    mockFetchOnce(200, { user: { id: '1' } })
    const result = await apiRequest<{ user: { id: string } }>('/api/auth/login')
    expect(result.user.id).toBe('1')
  })

  it('throws ApiError with the server-provided code and message on failure', async () => {
    mockFetchOnce(401, { error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' } })
    await expect(apiRequest('/api/auth/login')).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Invalid email or password',
    })
  })

  it('falls back to a generic error when the failure response has no body', async () => {
    mockFetchOnce(500, null)
    const error = await apiRequest('/api/auth/login').catch((err: unknown) => err)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).code).toBe('UNKNOWN_ERROR')
  })
})
