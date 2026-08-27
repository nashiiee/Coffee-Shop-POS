import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import { validate } from '../middleware/validate.js'
import { createDiscountSchema, updateDiscountSchema } from '../schemas/discount.schema.js'
import { createDiscountHandler, listDiscountsHandler, updateDiscountHandler } from '../controllers/discount.controller.js'

export const discountRouter = Router()

// Reads: ADMIN + CASHIER (checkout needs to list available discounts).
discountRouter.get('/', ...requireAuth('ADMIN', 'CASHIER'), listDiscountsHandler)
discountRouter.post('/', ...requireAuth('ADMIN'), validate(createDiscountSchema), createDiscountHandler)
discountRouter.patch('/:id', ...requireAuth('ADMIN'), validate(updateDiscountSchema), updateDiscountHandler)
