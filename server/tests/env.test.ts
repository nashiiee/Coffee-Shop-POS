import { afterEach, describe, expect, it, vi } from 'vitest'


describe('env validation', () => {
  afterEach(() => {
    vi.resetModules()
  })

  it('loads successfully with a valid environment', async () => {
    const { env } = await import('../src/config/env.js')
    expect(env.DATABASE_URL).toBeTruthy()
    expect(env.JWT_ACCESS_SECRET).toBeTruthy()
  })

  it('throws when a required variable is missing', async () => {
    const original = process.env.DATABASE_URL
    delete process.env.DATABASE_URL
    vi.resetModules()
    await expect(import('../src/config/env.js')).rejects.toThrow()
    process.env.DATABASE_URL = original
  })

  it('throws when JWT_ACCESS_SECRET is too short', async () => {
    const original = process.env.JWT_ACCESS_SECRET
    process.env.JWT_ACCESS_SECRET = 'too-short'
    vi.resetModules()
    await expect(import('../src/config/env.js')).rejects.toThrow()
    process.env.JWT_ACCESS_SECRET = original
  })

  it('throws when access and refresh secrets are identical', async () => {
    const originalRefresh = process.env.JWT_REFRESH_SECRET
    process.env.JWT_REFRESH_SECRET = process.env.JWT_ACCESS_SECRET
    vi.resetModules()
    await expect(import('../src/config/env.js')).rejects.toThrow()
    process.env.JWT_REFRESH_SECRET = originalRefresh
  })
})
