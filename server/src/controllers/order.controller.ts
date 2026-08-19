import type { NextFunction, Request, Response } from 'express'
import * as orderService from '../services/order.service.js'
import { AppError } from '../lib/AppError.js'
import { listOrdersQuerySchema } from '../schemas/order.schema.js'

export async function listOrdersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = listOrdersQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      throw AppError.validation(parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })))
    }
    const result = await orderService.listOrders(parsed.data, req.user!)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

export async function getOrderHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const order = await orderService.getOrderById(req.params.id as string, req.user!)
    res.status(200).json(order)
  } catch (err) {
    next(err)
  }
}

export async function listCashiersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const cashiers = await orderService.listCashiers()
    res.status(200).json(cashiers)
  } catch (err) {
    next(err)
  }
}
