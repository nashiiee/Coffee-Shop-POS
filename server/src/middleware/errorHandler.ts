import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'
import { MulterError } from 'multer'
import { AppError } from '../lib/AppError.js'
import { env } from '../config/env.js'

interface ErrorBody {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    const body: ErrorBody = { error: { code: err.code, message: err.message, details: err.details } }
    res.status(err.statusCode).json(body)
    return
  }

  if (err instanceof MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Image is too large (max 5MB)' : err.message
    res.status(400).json({ error: { code: 'BAD_REQUEST', message } })
    return
  }

  if (err instanceof ZodError) {
    const body: ErrorBody = {
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: err.issues },
    }
    res.status(400).json(body)
    return
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: { code: 'CONFLICT', message: 'Resource already exists' } })
      return
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Resource not found' } })
      return
    }
  }

  console.error(err)
  const body: ErrorBody = {
    error: {
      code: 'INTERNAL_ERROR',
      message: env.NODE_ENV === 'production' ? 'Internal server error' : String(err instanceof Error ? err.message : err),
    },
  }
  res.status(500).json(body)
}
