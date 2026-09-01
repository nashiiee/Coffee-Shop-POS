import type { NextFunction, Request, Response } from 'express'
import * as expenseService from '../services/expense.service.js'
import type { CreateExpenseInput, ListExpensesQuery, UpdateExpenseInput } from '../schemas/expense.schema.js'

export async function listExpensesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const expenses = await expenseService.listExpenses(req.query as ListExpensesQuery)
    res.status(200).json(expenses)
  } catch (err) {
    next(err)
  }
}

export async function createExpenseHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const expense = await expenseService.createExpense(req.body as CreateExpenseInput, req.user!.id)
    res.status(201).json(expense)
  } catch (err) {
    next(err)
  }
}

export async function updateExpenseHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const expense = await expenseService.updateExpense(
      req.params.id as string,
      req.body as UpdateExpenseInput,
      req.user!.id,
    )
    res.status(200).json(expense)
  } catch (err) {
    next(err)
  }
}

export async function deleteExpenseHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await expenseService.deleteExpense(req.params.id as string, req.user!.id)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}
