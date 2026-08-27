import type { NextFunction, Request, Response } from 'express'
import * as checkoutService from '../services/checkout.service.js'
import type { CheckoutInput } from '../schemas/checkout.schema.js'

export async function checkoutHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const order = await checkoutService.checkout(req.body as CheckoutInput, req.user!.id, req.user!.shopId)
    res.status(201).json(order)
  } catch (err) {
    next(err)
  }
}
