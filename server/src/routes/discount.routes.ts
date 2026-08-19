import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { authorize } from '../middleware/authorize.js'
import { validate } from '../middleware/validate.js'
import { createDiscountSchema, updateDiscountSchema } from '../schemas/discount.schema.js'
import { createDiscountHandler, listDiscountsHandler, updateDiscountHandler } from '../controllers/discount.controller.js'

export const discountRouter = Router()

// Reads: ADMIN + CASHIER (checkout needs to list available discounts).
discountRouter.get('/', authenticate, authorize('ADMIN', 'CASHIER'), listDiscountsHandler)
discountRouter.post('/', authenticate, authorize('ADMIN'), validate(createDiscountSchema), createDiscountHandler)
discountRouter.patch('/:id', authenticate, authorize('ADMIN'), validate(updateDiscountSchema), updateDiscountHandler)
