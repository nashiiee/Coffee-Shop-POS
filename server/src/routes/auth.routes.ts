import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { loginHandler, logoutHandler, refreshHandler } from '../controllers/auth.controller.js'
import { validate } from '../middleware/validate.js'
import { loginSchema } from '../schemas/auth.schema.js'

export const authRouter = Router()

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many attempts, please try again later' } },
})

authRouter.post('/login', authRateLimit, validate(loginSchema), loginHandler)
authRouter.post('/refresh', authRateLimit, refreshHandler)
authRouter.post('/logout', logoutHandler)
