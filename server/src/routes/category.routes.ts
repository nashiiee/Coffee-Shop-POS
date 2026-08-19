import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { authorize } from '../middleware/authorize.js'
import { validate } from '../middleware/validate.js'
import { createCategorySchema, updateCategorySchema } from '../schemas/category.schema.js'
import { createCategoryHandler, listCategoriesHandler, updateCategoryHandler } from '../controllers/category.controller.js'

export const categoryRouter = Router()

categoryRouter.get('/', authenticate, authorize('ADMIN', 'CASHIER'), listCategoriesHandler)
categoryRouter.post('/', authenticate, authorize('ADMIN'), validate(createCategorySchema), createCategoryHandler)
categoryRouter.patch('/:id', authenticate, authorize('ADMIN'), validate(updateCategorySchema), updateCategoryHandler)
