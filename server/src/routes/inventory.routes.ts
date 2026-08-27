import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import { validate } from '../middleware/validate.js'
import { adjustInventorySchema, updateReorderLevelSchema } from '../schemas/inventory.schema.js'
import {
  adjustInventoryHandler,
  getInventoryHistoryHandler,
  getInventoryItemHandler,
  listInventoryHandler,
  updateReorderLevelHandler,
} from '../controllers/inventory.controller.js'

export const inventoryRouter = Router()

// Reads: ADMIN + CASHIER (a future POS grid needs to know low/out-of-stock
// status), except history, which is an audit/admin concern.
inventoryRouter.get('/', ...requireAuth('ADMIN', 'CASHIER'), listInventoryHandler)
inventoryRouter.get('/:productId', ...requireAuth('ADMIN', 'CASHIER'), getInventoryItemHandler)
inventoryRouter.get('/:productId/history', ...requireAuth('ADMIN'), getInventoryHistoryHandler)

// Mutations: ADMIN only. Cashiers must never be able to change stock by hand.
inventoryRouter.patch(
  '/:productId',
  ...requireAuth('ADMIN'),
  validate(updateReorderLevelSchema),
  updateReorderLevelHandler,
)
inventoryRouter.post(
  '/:productId/adjustments',
  ...requireAuth('ADMIN'),
  validate(adjustInventorySchema),
  adjustInventoryHandler,
)
