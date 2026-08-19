import type { NextFunction, Request, Response } from 'express'
import * as dashboardService from '../services/dashboard.service.js'

export async function getDashboardHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await dashboardService.getDashboard())
  } catch (err) {
    next(err)
  }
}
