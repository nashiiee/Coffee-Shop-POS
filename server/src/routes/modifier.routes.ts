import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import { validate } from '../middleware/validate.js'
import { createModifierSchema, updateModifierSchema } from '../schemas/modifier.schema.js'
import { createModifierHandler, listModifiersHandler, updateModifierHandler } from '../controllers/modifier.controller.js'

export const modifierRouter = Router()

modifierRouter.get('/', ...requireAuth('ADMIN', 'CASHIER'), listModifiersHandler)
modifierRouter.post('/', ...requireAuth('ADMIN'), validate(createModifierSchema), createModifierHandler)
modifierRouter.patch('/:id', ...requireAuth('ADMIN'), validate(updateModifierSchema), updateModifierHandler)
