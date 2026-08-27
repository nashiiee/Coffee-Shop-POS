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

export interface AuthShopDTO {
  id: string
  name: string
  logoUrl: string | null
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

function toShopDTO(shop: { id: string; name: string; logoUrl: string | null }): AuthShopDTO {
  return { id: shop.id, name: shop.name, logoUrl: shop.logoUrl }
}

function issueTokens(user: { id: string; role: Role; shopId: string }): TokenPair {
  return {
    accessToken: signAccessToken({ sub: user.id, role: user.role, shopId: user.shopId }),
    refreshToken: signRefreshToken({ sub: user.id }),
  }
}

export async function login(
  email: string,
  password: string,
): Promise<{ user: AuthUserDTO; shop: AuthShopDTO; tokens: TokenPair }> {
  const user = await prisma.user.findUnique({ where: { email }, include: { shop: true } })

  if (!user || !user.isActive || !user.shopId) {
    await comparePassword(password, DUMMY_HASH)
    throw AppError.unauthorized('Invalid email or password')
  }

  const valid = await comparePassword(password, user.passwordHash)
  if (!valid) {
    throw AppError.unauthorized('Invalid email or password')
  }

  // Checked only after the password is verified — a suspended shop's own
  // staff get told clearly why they're locked out (the whole point of the
  // kill switch is a clean, understandable cutoff), while an attacker
  // without valid credentials still learns nothing extra.
  if (!user.shop || user.shop.subscriptionStatus === 'SUSPENDED') {
    throw AppError.forbidden("This shop's access has been suspended. Contact support.")
  }

  return {
    user: toDTO(user),
    shop: toShopDTO(user.shop),
    tokens: issueTokens({ id: user.id, role: user.role, shopId: user.shop.id }),
  }
}

export async function refresh(
  refreshToken: string,
): Promise<{ user: AuthUserDTO; shop: AuthShopDTO; tokens: TokenPair }> {
  let payload: { sub: string }
  try {
    payload = verifyRefreshToken(refreshToken)
  } catch {
    throw AppError.unauthorized('Invalid or expired refresh token')
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub }, include: { shop: true } })
  if (!user || !user.isActive || !user.shopId) {
    throw AppError.unauthorized('Invalid or expired refresh token')
  }

  if (!user.shop || user.shop.subscriptionStatus === 'SUSPENDED') {
    throw AppError.forbidden("This shop's access has been suspended. Contact support.")
  }

  return {
    user: toDTO(user),
    shop: toShopDTO(user.shop),
    tokens: issueTokens({ id: user.id, role: user.role, shopId: user.shop.id }),
  }
}

