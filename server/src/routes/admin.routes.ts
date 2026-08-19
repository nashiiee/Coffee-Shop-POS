import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { authorize } from '../middleware/authorize.js'
import { validate } from '../middleware/validate.js'
import { getDashboardHandler } from '../controllers/dashboard.controller.js'
import {
  getCancelledOrdersReportHandler,
  getCashierSalesReportHandler,
  getCategorySalesReportHandler,
  getDiscountsReportHandler,
  getInventoryMovementReportHandler,
  getPaymentMethodReportHandler,
  getProductSalesReportHandler,
  getSalesReportHandler,
} from '../controllers/reports.controller.js'
import {
  createCashierHandler,
  disableUserHandler,
  listCashiersHandler,
  reactivateUserHandler,
  resetPasswordHandler,
} from '../controllers/users.controller.js'
import { listAuditLogsHandler } from '../controllers/audit.controller.js'
import { createCashierSchema, resetPasswordSchema } from '../schemas/users.schema.js'

export const adminRouter = Router()

// Cashiers must never reach any route on this router — every dashboard and
// report endpoint below relies entirely on this one gate, not on anything
// per-route.
adminRouter.use(authenticate, authorize('ADMIN'))

adminRouter.get('/overview', (_req, res) => {
  res.status(200).json({ message: 'Admin area — product, inventory, and reporting features arrive in later phases' })
})

adminRouter.get('/dashboard', getDashboardHandler)

adminRouter.get('/reports/sales', getSalesReportHandler)
adminRouter.get('/reports/products', getProductSalesReportHandler)
adminRouter.get('/reports/categories', getCategorySalesReportHandler)
adminRouter.get('/reports/cashiers', getCashierSalesReportHandler)
adminRouter.get('/reports/payment-methods', getPaymentMethodReportHandler)
adminRouter.get('/reports/discounts', getDiscountsReportHandler)
adminRouter.get('/reports/cancelled-orders', getCancelledOrdersReportHandler)
adminRouter.get('/reports/inventory-movement', getInventoryMovementReportHandler)

adminRouter.get('/users', listCashiersHandler)
adminRouter.post('/users', validate(createCashierSchema), createCashierHandler)
adminRouter.patch('/users/:id/disable', disableUserHandler)
adminRouter.patch('/users/:id/reactivate', reactivateUserHandler)
adminRouter.patch('/users/:id/reset-password', validate(resetPasswordSchema), resetPasswordHandler)

adminRouter.get('/audit-logs', listAuditLogsHandler)
