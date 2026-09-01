import { z } from 'zod'

export const createExpenseSchema = z.object({
  description: z.string().min(1).max(200),
  category: z.string().min(1).max(50),
  amount: z.number().int().positive(),
  incurredAt: z.coerce.date(),
  note: z.string().max(500).optional(),
})

export const updateExpenseSchema = z
  .object({
    description: z.string().min(1).max(200).optional(),
    category: z.string().min(1).max(50).optional(),
    amount: z.number().int().positive().optional(),
    incurredAt: z.coerce.date().optional(),
    note: z.string().max(500).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' })

export const listExpensesQuerySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  category: z.string().optional(),
})

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>
export type ListExpensesQuery = z.infer<typeof listExpensesQuerySchema>
