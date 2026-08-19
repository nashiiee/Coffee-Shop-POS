import type { NextFunction, Request, Response } from 'express'
import type { Role } from '@prisma/client'
import { AppError } from '../lib/AppError.js'

export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(AppError.unauthorized())
      return
    }
    if (!roles.includes(req.user.role)) {
      next(AppError.forbidden('You do not have permission to perform this action'))
      return
    }
    next()
  }
}
