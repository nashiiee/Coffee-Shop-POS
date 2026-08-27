import type { NextFunction, Request, Response } from 'express'
import * as orderService from '../services/order.service.js'
import { AppError } from '../lib/AppError.js'
import { listOrdersQuerySchema } from '../schemas/order.schema.js'
import type { VoidOrderInput } from '../schemas/order.schema.js'

export async function listOrdersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = listOrdersQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      throw AppError.validation(parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })))
    }
    const result = await orderService.listOrders(parsed.data, req.user!, req.user!.shopId)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

export async function getOrderHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const order = await orderService.getOrderById(req.params.id as string, req.user!, req.user!.shopId)
    res.status(200).json(order)
  } catch (err) {
    next(err)
  }
}

export async function listCashiersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const cashiers = await orderService.listCashiers(req.user!.shopId)
    res.status(200).json(cashiers)
  } catch (err) {
    next(err)
  }
}

export async function cancelOrderHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { reason } = req.body as VoidOrderInput
    const order = await orderService.cancelOrder(req.params.id as string, req.user!.id, reason, req.user!.shopId)
    res.status(200).json(order)
  } catch (err) {
    next(err)
  }
}

export async function refundOrderHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { reason } = req.body as VoidOrderInput
    const order = await orderService.refundOrder(req.params.id as string, req.user!.id, reason, req.user!.shopId)
    res.status(200).json(order)
  } catch (err) {
    next(err)
  }
}
