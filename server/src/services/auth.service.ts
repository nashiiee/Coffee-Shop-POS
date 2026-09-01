import { prisma } from '../lib/prisma.js'
import { comparePassword } from '../lib/password.js'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt.js'
import { AppError } from '../lib/AppError.js'
import type { Role } from '@prisma/client'

export interface AuthUserDTO {
  id: string
  name: string
  email: string
  role: Role
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
}

// A precomputed bcrypt hash with no matching plaintext. Comparing against it
// when no user is found keeps login response time roughly constant whether
// or not the email exists, closing the user-enumeration timing gap.
const DUMMY_HASH = '$2a$12$CwTycUXWue0Thq9StjUM0uJ8Z7q0v4Gv0lF1S1D8b5j4W1s4y7q1O'

function toDTO(user: { id: string; name: string; email: string; role: Role }): AuthUserDTO {
  return { id: user.id, name: user.name, email: user.email, role: user.role }
}

function issueTokens(user: { id: string; role: Role }): TokenPair {
  return {
    accessToken: signAccessToken({ sub: user.id, role: user.role }),
    refreshToken: signRefreshToken({ sub: user.id }),
  }
}

export async function login(
  email: string,
  password: string,
): Promise<{ user: AuthUserDTO; tokens: TokenPair }> {
  const user = await prisma.user.findUnique({ where: { email } })

  if (!user || !user.isActive) {
    await comparePassword(password, DUMMY_HASH)
    throw AppError.unauthorized('Invalid email or password')
  }

  const valid = await comparePassword(password, user.passwordHash)
  if (!valid) {
    throw AppError.unauthorized('Invalid email or password')
  }

  return {
    user: toDTO(user),
    tokens: issueTokens({ id: user.id, role: user.role }),
  }
}

export async function refresh(
  refreshToken: string,
): Promise<{ user: AuthUserDTO; tokens: TokenPair }> {
  let payload: { sub: string }
  try {
    payload = verifyRefreshToken(refreshToken)
  } catch {
    throw AppError.unauthorized('Invalid or expired refresh token')
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } })
  if (!user || !user.isActive) {
    throw AppError.unauthorized('Invalid or expired refresh token')
  }

  return {
    user: toDTO(user),
    tokens: issueTokens({ id: user.id, role: user.role }),
  }
}
