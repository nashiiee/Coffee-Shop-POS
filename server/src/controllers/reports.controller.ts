import type { NextFunction, Request, Response } from 'express'
import * as reportsService from '../services/reports.service.js'
import { AppError } from '../lib/AppError.js'
import {
  cancelledOrdersQuerySchema,
  inventoryMovementQuerySchema,
  salesReportQuerySchema,
  validatedDateRangeQuerySchema,
} from '../schemas/reports.schema.js'

function badRequestFromZod(issues: { path: (string | number)[]; message: string }[]) {
  return AppError.validation(issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })))
}

export async function getSalesReportHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = salesReportQuerySchema.safeParse(req.query)
    if (!parsed.success) throw badRequestFromZod(parsed.error.issues)
    res.status(200).json(await reportsService.getSalesReport(parsed.data, req.user!.shopId))
  } catch (err) {
    next(err)
  }
}

export async function getProductSalesReportHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = validatedDateRangeQuerySchema.safeParse(req.query)
    if (!parsed.success) throw badRequestFromZod(parsed.error.issues)
    res.status(200).json(await reportsService.getProductSalesReport(parsed.data, req.user!.shopId))
  } catch (err) {
    next(err)
  }
}

export async function getCategorySalesReportHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = validatedDateRangeQuerySchema.safeParse(req.query)
    if (!parsed.success) throw badRequestFromZod(parsed.error.issues)
    res.status(200).json(await reportsService.getCategorySalesReport(parsed.data, req.user!.shopId))
  } catch (err) {
    next(err)
  }
}

export async function getCashierSalesReportHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = validatedDateRangeQuerySchema.safeParse(req.query)
    if (!parsed.success) throw badRequestFromZod(parsed.error.issues)
    res.status(200).json(await reportsService.getCashierSalesReport(parsed.data, req.user!.shopId))
  } catch (err) {
    next(err)
  }
}

export async function getPaymentMethodReportHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = validatedDateRangeQuerySchema.safeParse(req.query)
    if (!parsed.success) throw badRequestFromZod(parsed.error.issues)
    res.status(200).json(await reportsService.getPaymentMethodReport(parsed.data, req.user!.shopId))
  } catch (err) {
    next(err)
  }
}

export async function getDiscountsReportHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = validatedDateRangeQuerySchema.safeParse(req.query)
    if (!parsed.success) throw badRequestFromZod(parsed.error.issues)
    res.status(200).json(await reportsService.getDiscountsReport(parsed.data, req.user!.shopId))
  } catch (err) {
    next(err)
  }
}

export async function getCancelledOrdersReportHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = cancelledOrdersQuerySchema.safeParse(req.query)
    if (!parsed.success) throw badRequestFromZod(parsed.error.issues)
    res.status(200).json(await reportsService.getCancelledOrdersReport(parsed.data, req.user!.shopId))
  } catch (err) {
    next(err)
  }
}

export async function getInventoryMovementReportHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = inventoryMovementQuerySchema.safeParse(req.query)
    if (!parsed.success) throw badRequestFromZod(parsed.error.issues)
    res.status(200).json(await reportsService.getInventoryMovementReport(parsed.data, req.user!.shopId))
  } catch (err) {
    next(err)
  }
}
