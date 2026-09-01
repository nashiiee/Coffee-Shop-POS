import type { RequestHandler } from 'express'
import type { Role } from '@prisma/client'
import { authenticate } from './authenticate.js'
import { authorize } from './authorize.js'

// Composes authenticate -> (optional) authorize into one array, spreadable
// at a route/router. Routes previously wrote `authenticate, authorize(...)`
// by hand at 25+ call sites across 11 route files — this is the one place
// it can't be forgotten.
//
// requireAuth() with no roles = any authenticated user (e.g. GET /me) —
// authorize() would reject everyone if called with zero roles, so it's
// omitted entirely rather than passed an empty list.
export function requireAuth(...roles: Role[]): RequestHandler[] {
  if (roles.length === 0) {
    return [authenticate]
  }
  return [authenticate, authorize(...roles)]
}
