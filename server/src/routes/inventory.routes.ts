import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { authorize } from '../middleware/authorize.js'
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
inventoryRouter.get('/', authenticate, authorize('ADMIN', 'CASHIER'), listInventoryHandler)
inventoryRouter.get('/:productId', authenticate, authorize('ADMIN', 'CASHIER'), getInventoryItemHandler)
inventoryRouter.get('/:productId/history', authenticate, authorize('ADMIN'), getInventoryHistoryHandler)

// Mutations: ADMIN only. Cashiers must never be able to change stock by hand.
inventoryRouter.patch(
  '/:productId',
  authenticate,
  authorize('ADMIN'),
  validate(updateReorderLevelSchema),
  updateReorderLevelHandler,
)
inventoryRouter.post(
  '/:productId/adjustments',
  authenticate,
  authorize('ADMIN'),
  validate(adjustInventorySchema),
  adjustInventoryHandler,
)
