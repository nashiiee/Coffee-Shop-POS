import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import { validate } from '../middleware/validate.js'
import { createCategorySchema, updateCategorySchema } from '../schemas/category.schema.js'
import { createCategoryHandler, listCategoriesHandler, updateCategoryHandler } from '../controllers/category.controller.js'

export const categoryRouter = Router()

categoryRouter.get('/', ...requireAuth('ADMIN', 'CASHIER'), listCategoriesHandler)
categoryRouter.post('/', ...requireAuth('ADMIN'), validate(createCategorySchema), createCategoryHandler)
categoryRouter.patch('/:id', ...requireAuth('ADMIN'), validate(updateCategorySchema), updateCategoryHandler)
