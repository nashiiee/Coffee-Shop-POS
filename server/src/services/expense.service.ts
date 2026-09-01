import { prisma } from '../lib/prisma.js'
import { omitUndefined } from '../lib/omitUndefined.js'
import { AppError } from '../lib/AppError.js'
import { recordAudit } from './audit.service.js'
import type { CreateExpenseInput, ListExpensesQuery, UpdateExpenseInput } from '../schemas/expense.schema.js'

export function listExpenses(filters: ListExpensesQuery) {
  return prisma.expense.findMany({
    where: {
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.dateFrom || filters.dateTo
        ? {
            incurredAt: {
              ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
              // End-of-day so a dateTo of today includes expenses logged
              // today, not just ones before midnight.
              ...(filters.dateTo ? { lte: new Date(`${filters.dateTo}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    },
    include: { createdBy: { select: { name: true } } },
    orderBy: { incurredAt: 'desc' },
  })
}

export async function createExpense(data: CreateExpenseInput, actorId: string) {
  const created = await prisma.expense.create({
    data: { ...omitUndefined(data), createdByUserId: actorId },
    include: { createdBy: { select: { name: true } } },
  })
  await recordAudit({
    actorId,
    action: 'EXPENSE_CREATED',
    resource: 'Expense',
    resourceId: created.id,
    newState: { description: created.description, category: created.category, amount: created.amount },
  })
  return created
}

export async function updateExpense(id: string, data: UpdateExpenseInput, actorId: string) {
  const current = await prisma.expense.findUnique({ where: { id } })
  if (!current) {
    throw AppError.notFound('Expense not found')
  }

  const changes = omitUndefined(data)
  const updated = await prisma.expense.update({
    where: { id },
    data: changes,
    include: { createdBy: { select: { name: true } } },
  })

  const changedFields = Object.keys(changes) as (keyof typeof changes)[]
  if (changedFields.length > 0) {
    await recordAudit({
      actorId,
      action: 'EXPENSE_UPDATED',
      resource: 'Expense',
      resourceId: id,
      previousState: Object.fromEntries(changedFields.map((field) => [field, current[field]])),
      newState: changes,
    })
  }
  return updated
}

export async function deleteExpense(id: string, actorId: string) {
  const current = await prisma.expense.findUnique({ where: { id } })
  if (!current) {
    throw AppError.notFound('Expense not found')
  }
  await prisma.expense.delete({ where: { id } })
  await recordAudit({
    actorId,
    action: 'EXPENSE_DELETED',
    resource: 'Expense',
    resourceId: id,
    previousState: { description: current.description, category: current.category, amount: current.amount },
  })
}
