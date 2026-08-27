import type { NextFunction, Request, Response } from 'express'
import * as auditService from '../services/audit.service.js'
import { AppError } from '../lib/AppError.js'
import { auditLogQuerySchema } from '../schemas/audit.schema.js'

export async function listAuditLogsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = auditLogQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      throw AppError.validation(parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })))
    }
    res.status(200).json(await auditService.listAuditLogs(parsed.data, req.user!.shopId))
  } catch (err) {
    next(err)
  }
}
