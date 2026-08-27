import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { requireAuth } from '../middleware/requireAuth.js'
import { validate } from '../middleware/validate.js'
import { checkoutSchema } from '../schemas/checkout.schema.js'
import { checkoutHandler } from '../controllers/checkout.controller.js'

export const checkoutRouter = Router()

// Loose rate limit — not a brute-force target like login, but still a
// money-moving endpoint worth capping against runaway retry loops.
const checkoutRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
})

checkoutRouter.post(
  '/',
  ...requireAuth('ADMIN', 'CASHIER'),
  checkoutRateLimit,
  validate(checkoutSchema),
  checkoutHandler,
)
