import type { NextFunction, Request, Response } from 'express'
import { verifyAccessToken } from '../lib/jwt.js'
import { AppError } from '../lib/AppError.js'

// Deliberately stateless: this only verifies the JWT signature/claims, it
// does not re-check the user's `isActive` flag against the database on
// every request. A deactivated account keeps API access until its access
// token naturally expires (JWT_ACCESS_TTL, default 15m) — an accepted,
// bounded window given no session/revocation store exists yet. Routes that
// need a fresh DB-backed check (e.g. GET /api/users/me) query separately.
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    next(AppError.unauthorized('Missing bearer token'))
    return
  }

  const token = header.slice('Bearer '.length)
  try {
    const payload = verifyAccessToken(token)
    req.user = { id: payload.sub, role: payload.role, shopId: payload.shopId }
    next()
  } catch {
    next(AppError.unauthorized('Invalid or expired token'))
  }
}
