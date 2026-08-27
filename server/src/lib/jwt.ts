import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import type { Role } from '@prisma/client'

export interface AccessTokenPayload {
  sub: string
  role: Role
  shopId: string
}

export interface RefreshTokenPayload {
  sub: string
}

type ExpiresIn = NonNullable<jwt.SignOptions['expiresIn']>

const ROLES: readonly Role[] = ['ADMIN', 'CASHIER']

function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const options: jwt.SignOptions = { expiresIn: env.JWT_ACCESS_TTL as ExpiresIn, algorithm: 'HS256' }
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options)
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  const options: jwt.SignOptions = { expiresIn: env.JWT_REFRESH_TTL as ExpiresIn, algorithm: 'HS256' }
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, options)
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] })
  if (
    typeof decoded === 'string' ||
    typeof decoded.sub !== 'string' ||
    !isRole(decoded.role) ||
    typeof decoded.shopId !== 'string'
  ) {
    throw new Error('Malformed access token payload')
  }
  return { sub: decoded.sub, role: decoded.role, shopId: decoded.shopId }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] })
  if (typeof decoded === 'string' || typeof decoded.sub !== 'string') {
    throw new Error('Malformed refresh token payload')
  }
  return { sub: decoded.sub }
}
