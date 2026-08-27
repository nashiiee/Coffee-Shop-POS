import { describe, expect, it } from 'vitest'
import { signAccessToken, verifyAccessToken, signRefreshToken, verifyRefreshToken } from '../src/lib/jwt.js'

describe('jwt', () => {
  it('signs and verifies an access token round-trip', () => {
    const token = signAccessToken({ sub: 'user-1', role: 'ADMIN', shopId: 'shop-1' })
    const payload = verifyAccessToken(token)
    expect(payload.sub).toBe('user-1')
    expect(payload.role).toBe('ADMIN')
    expect(payload.shopId).toBe('shop-1')
  })

  it('signs and verifies a refresh token round-trip', () => {
    const token = signRefreshToken({ sub: 'user-2' })
    const payload = verifyRefreshToken(token)
    expect(payload.sub).toBe('user-2')
  })

  it('throws when verifying a tampered token', () => {
    const token = signAccessToken({ sub: 'user-3', role: 'CASHIER', shopId: 'shop-1' })
    expect(() => verifyAccessToken(token + 'tampered')).toThrow()
  })
})
