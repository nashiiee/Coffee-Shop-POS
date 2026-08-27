import type { NextFunction, Request, Response } from 'express'
import * as dashboardService from '../services/dashboard.service.js'

export async function getDashboardHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await dashboardService.getDashboard(req.user!.shopId))
  } catch (err) {
    next(err)
  }
}
