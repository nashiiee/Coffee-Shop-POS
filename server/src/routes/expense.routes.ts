import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import { validate } from '../middleware/validate.js'
import { createExpenseSchema, updateExpenseSchema } from '../schemas/expense.schema.js'
import {
  createExpenseHandler,
  deleteExpenseHandler,
  listExpensesHandler,
  updateExpenseHandler,
} from '../controllers/expense.controller.js'

export const expenseRouter = Router()

// Admin-only — expenses are operating-cost data, not something a cashier
// needs to see or record.
expenseRouter.get('/', ...requireAuth('ADMIN'), listExpensesHandler)
expenseRouter.post('/', ...requireAuth('ADMIN'), validate(createExpenseSchema), createExpenseHandler)
expenseRouter.patch('/:id', ...requireAuth('ADMIN'), validate(updateExpenseSchema), updateExpenseHandler)
expenseRouter.delete('/:id', ...requireAuth('ADMIN'), deleteExpenseHandler)
