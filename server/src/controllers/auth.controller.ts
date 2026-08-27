import type { NextFunction, Request, Response } from 'express'
import * as authService from '../services/auth.service.js'
import { env } from '../config/env.js'
import { AppError } from '../lib/AppError.js'
import type { LoginInput } from '../schemas/auth.schema.js'

const REFRESH_COOKIE = 'refreshToken'

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
  })
}

export async function loginHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body as LoginInput
    const { user, shop, tokens } = await authService.login(email, password)
    setRefreshCookie(res, tokens.refreshToken)
    res.status(200).json({ user, shop, accessToken: tokens.accessToken })
  } catch (err) {
    next(err)
  }
}

export async function refreshHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined
    if (!token) {
      throw AppError.unauthorized('Missing refresh token')
    }
    const { user, shop, tokens } = await authService.refresh(token)
    setRefreshCookie(res, tokens.refreshToken)
    res.status(200).json({ user, shop, accessToken: tokens.accessToken })
  } catch (err) {
    next(err)
  }
}

export function logoutHandler(_req: Request, res: Response) {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' })
  res.status(204).send()
}
