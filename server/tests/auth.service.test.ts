import { beforeEach, describe, expect, it, vi } from 'vitest'

const findUnique = vi.fn()

vi.mock('../src/lib/prisma.js', () => ({
  prisma: { user: { findUnique: (...args: unknown[]) => findUnique(...args) } },
}))

const { login, refresh } = await import('../src/services/auth.service.js')
const { hashPassword } = await import('../src/lib/password.js')
const { signRefreshToken } = await import('../src/lib/jwt.js')

const baseUser = {
  id: 'user-1',
  name: 'Ada Admin',
  email: 'ada@coffeeshop.test',
  role: 'ADMIN' as const,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('auth.service login', () => {
  beforeEach(() => {
    findUnique.mockReset()
  })

  it('returns a user DTO and tokens for correct credentials', async () => {
    const passwordHash = await hashPassword('correct-horse-battery-staple')
    findUnique.mockResolvedValue({ ...baseUser, passwordHash })

    const result = await login('ada@coffeeshop.test', 'correct-horse-battery-staple')

    expect(result.user).toEqual({ id: 'user-1', name: 'Ada Admin', email: 'ada@coffeeshop.test', role: 'ADMIN' })
    expect(result.user).not.toHaveProperty('passwordHash')
    expect(result.tokens.accessToken).toBeTruthy()
    expect(result.tokens.refreshToken).toBeTruthy()
  })

  it('rejects with a generic message when the user does not exist', async () => {
    findUnique.mockResolvedValue(null)
    await expect(login('nobody@coffeeshop.test', 'whatever')).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid email or password',
    })
  })

  it('rejects with the same generic message for a wrong password', async () => {
    const passwordHash = await hashPassword('correct-horse-battery-staple')
    findUnique.mockResolvedValue({ ...baseUser, passwordHash })
    await expect(login('ada@coffeeshop.test', 'wrong-password')).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid email or password',
    })
  })

  it('rejects a deactivated user even with the correct password', async () => {
    const passwordHash = await hashPassword('correct-horse-battery-staple')
    findUnique.mockResolvedValue({ ...baseUser, passwordHash, isActive: false })
    await expect(login('ada@coffeeshop.test', 'correct-horse-battery-staple')).rejects.toMatchObject({
      statusCode: 401,
    })
  })
})

describe('auth.service refresh', () => {
  beforeEach(() => {
    findUnique.mockReset()
  })

  it('issues a new token pair for a valid refresh token and active user', async () => {
    findUnique.mockResolvedValue(baseUser)
    const token = signRefreshToken({ sub: 'user-1' })

    const result = await refresh(token)

    expect(result.user.id).toBe('user-1')
    expect(result.tokens.accessToken).toBeTruthy()
  })

  it('rejects an invalid refresh token', async () => {
    await expect(refresh('not-a-real-token')).rejects.toMatchObject({ statusCode: 401 })
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('rejects a valid token whose user is no longer active', async () => {
    findUnique.mockResolvedValue({ ...baseUser, isActive: false })
    const token = signRefreshToken({ sub: 'user-1' })
    await expect(refresh(token)).rejects.toMatchObject({ statusCode: 401 })
  })
})
