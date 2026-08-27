import type { RequestHandler } from 'express'
import type { Role } from '@prisma/client'
import { authenticate } from './authenticate.js'
import { requireActiveShop } from './requireActiveShop.js'
import { authorize } from './authorize.js'

// Composes authenticate -> requireActiveShop -> (optional) authorize into
// one array, spreadable at a route/router. Routes previously wrote
// `authenticate, authorize(...)` by hand at 25+ call sites across 11 route
// files — bolting requireActiveShop onto each one individually is exactly
// how a kill-switch check gets forgotten somewhere. This is the one place
// it can't be skipped.
//
// requireAuth() with no roles = any authenticated user of an active shop
// (e.g. GET /me) — authorize() would reject everyone if called with zero
// roles, so it's omitted entirely rather than passed an empty list.
export function requireAuth(...roles: Role[]): RequestHandler[] {
  if (roles.length === 0) {
    return [authenticate, requireActiveShop]
  }
  return [authenticate, requireActiveShop, authorize(...roles)]
}
