import { z } from 'zod'

function dateOrderValid(data: { dateFrom?: Date | undefined; dateTo?: Date | undefined }): boolean {
  return !data.dateFrom || !data.dateTo || data.dateFrom <= data.dateTo
}

const dateOrderRefinement: { message: string; path: (string | number)[] } = {
  message: 'dateFrom must be on or before dateTo',
  path: ['dateFrom'],
}

export const salesReportQuerySchema = z
  .object({
    period: z.enum(['daily', 'weekly', 'monthly', 'custom']).default('daily'),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
  })
  .refine((data) => data.period !== 'custom' || (data.dateFrom && data.dateTo), {
    message: 'dateFrom and dateTo are required when period is "custom"',
    path: ['dateFrom'],
  })
  .refine(dateOrderValid, dateOrderRefinement)

// Kept as a plain (unrefined) ZodObject so it stays extendable by the two
// paginated schemas below — .refine() would turn it into a ZodEffects,
// which .extend() can't be called on. Direct callers (the five
// non-paginated report handlers) use validatedDateRangeQuerySchema instead,
// which layers the same ordering check on top.
export const dateRangeQuerySchema = z.object({
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
})

export const validatedDateRangeQuerySchema = dateRangeQuerySchema.refine(dateOrderValid, dateOrderRefinement)

export const cancelledOrdersQuerySchema = dateRangeQuerySchema
  .extend({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
  })
  .refine(dateOrderValid, dateOrderRefinement)

export const inventoryMovementQuerySchema = dateRangeQuerySchema
  .extend({
    type: z.enum(['STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT', 'WASTE', 'SALE']).optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
  })
  .refine(dateOrderValid, dateOrderRefinement)

export type SalesReportQuery = z.infer<typeof salesReportQuerySchema>
export type DateRangeQuery = z.infer<typeof dateRangeQuerySchema>
export type CancelledOrdersQuery = z.infer<typeof cancelledOrdersQuerySchema>
export type InventoryMovementQuery = z.infer<typeof inventoryMovementQuerySchema>
