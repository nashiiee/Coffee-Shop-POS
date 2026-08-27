import type { NextFunction, Request, Response } from 'express'
import { prisma } from '../lib/prisma.js'
import { AppError } from '../lib/AppError.js'

// This is the kill switch: a real DB read on every request (not a claim
// trusted from the JWT), because access tokens are stateless with a 15
// minute TTL — suspending a shop must block its very next request, not
// wait for already-issued tokens to expire naturally. login()/refresh() in
// auth.service.ts also check subscriptionStatus directly, so a suspended
// shop's staff can't even sign in in the first place; this middleware is
// what catches a token that was issued *before* the shop was suspended.
export async function requireActiveShop(req: Request, _res: Response, next: NextFunction) {
  const shop = await prisma.shop.findUnique({
    where: { id: req.user!.shopId },
    select: { subscriptionStatus: true },
  })
  if (!shop || shop.subscriptionStatus === 'SUSPENDED') {
    next(AppError.forbidden("This shop's access has been suspended"))
    return
  }
  next()
}
