import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { authorize } from '../middleware/authorize.js'
import { validate } from '../middleware/validate.js'
import { createModifierSchema, updateModifierSchema } from '../schemas/modifier.schema.js'
import { createModifierHandler, listModifiersHandler, updateModifierHandler } from '../controllers/modifier.controller.js'

export const modifierRouter = Router()

modifierRouter.get('/', authenticate, authorize('ADMIN', 'CASHIER'), listModifiersHandler)
modifierRouter.post('/', authenticate, authorize('ADMIN'), validate(createModifierSchema), createModifierHandler)
modifierRouter.patch('/:id', authenticate, authorize('ADMIN'), validate(updateModifierSchema), updateModifierHandler)
