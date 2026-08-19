import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { authorize } from '../middleware/authorize.js'
import { getOrderHandler, listCashiersHandler, listOrdersHandler } from '../controllers/order.controller.js'

export const orderRouter = Router()

// ADMIN sees everyone's orders; CASHIER sees only their own — enforced in
// order.service.ts's buildWhere/getOrderById, not just by hiding UI.
orderRouter.get('/', authenticate, authorize('ADMIN', 'CASHIER'), listOrdersHandler)
// Must be registered before '/:id' or Express would match "cashiers" as an id.
orderRouter.get('/cashiers', authenticate, authorize('ADMIN'), listCashiersHandler)
orderRouter.get('/:id', authenticate, authorize('ADMIN', 'CASHIER'), getOrderHandler)
