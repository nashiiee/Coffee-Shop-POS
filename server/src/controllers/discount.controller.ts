import type { NextFunction, Request, Response } from 'express'
import * as discountService from '../services/discount.service.js'
import type { CreateDiscountInput, UpdateDiscountInput } from '../schemas/discount.schema.js'

export async function listDiscountsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res
      .status(200)
      .json(await discountService.listDiscounts(req.query.activeOnly === 'true', req.user!.role))
  } catch (err) {
    next(err)
  }
}

export async function createDiscountHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const discount = await discountService.createDiscount(req.body as CreateDiscountInput, req.user!.id)
    res.status(201).json(discount)
  } catch (err) {
    next(err)
  }
}

export async function updateDiscountHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const discount = await discountService.updateDiscount(
      req.params.id as string,
      req.body as UpdateDiscountInput,
      req.user!.id,
    )
    res.status(200).json(discount)
  } catch (err) {
    next(err)
  }
}
