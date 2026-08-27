import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import { validate } from '../middleware/validate.js'
import { voidOrderSchema } from '../schemas/order.schema.js'
import {
  cancelOrderHandler,
  getOrderHandler,
  listCashiersHandler,
  listOrdersHandler,
  refundOrderHandler,
} from '../controllers/order.controller.js'

export const orderRouter = Router()

// ADMIN sees everyone's orders; CASHIER sees only their own — enforced in
// order.service.ts's buildWhere/getOrderById, not just by hiding UI.
orderRouter.get('/', ...requireAuth('ADMIN', 'CASHIER'), listOrdersHandler)
// Must be registered before '/:id' or Express would match "cashiers" as an id.
orderRouter.get('/cashiers', ...requireAuth('ADMIN'), listCashiersHandler)
orderRouter.get('/:id', ...requireAuth('ADMIN', 'CASHIER'), getOrderHandler)
// Cancel/refund are ADMIN-only by explicit product decision — a cashier
// asks an admin rather than being able to void their own completed sale.
// See order.service.ts's voidOrder for the shared guard/restock/audit logic.
orderRouter.patch('/:id/cancel', ...requireAuth('ADMIN'), validate(voidOrderSchema), cancelOrderHandler)
orderRouter.patch('/:id/refund', ...requireAuth('ADMIN'), validate(voidOrderSchema), refundOrderHandler)
