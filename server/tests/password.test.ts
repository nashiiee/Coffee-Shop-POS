import { describe, expect, it } from 'vitest'
import { hashPassword, comparePassword } from '../src/lib/password.js'

describe('password', () => {
  it('hashes and verifies a matching password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple')
    await expect(comparePassword('correct-horse-battery-staple', hash)).resolves.toBe(true)
  })

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple')
    await expect(comparePassword('wrong-password', hash)).resolves.toBe(false)
  })
})
