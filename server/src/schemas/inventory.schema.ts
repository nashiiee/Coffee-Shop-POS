import { z } from 'zod'

export const inventoryTransactionTypeSchema = z.enum(['STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT', 'WASTE'])

const MAX_QUANTITY_MAGNITUDE = 1_000_000

export const adjustInventorySchema = z
  .object({
    type: inventoryTransactionTypeSchema,
    quantityChange: z
      .number()
      .int()
      .min(-MAX_QUANTITY_MAGNITUDE)
      .max(MAX_QUANTITY_MAGNITUDE)
      .refine((v) => v !== 0, { message: 'quantityChange must not be zero' }),
    reason: z.string().min(1).max(500).optional(),
    idempotencyKey: z.string().min(1).max(200).optional(),
  })
  .refine((data) => (data.type !== 'STOCK_IN' ? true : data.quantityChange > 0), {
    message: 'STOCK_IN requires a positive quantityChange',
    path: ['quantityChange'],
  })
  .refine((data) => (data.type !== 'STOCK_OUT' && data.type !== 'WASTE' ? true : data.quantityChange < 0), {
    message: 'STOCK_OUT and WASTE require a negative quantityChange',
    path: ['quantityChange'],
  })
  .refine((data) => (data.type !== 'ADJUSTMENT' && data.type !== 'WASTE' ? true : Boolean(data.reason)), {
    message: 'A reason is required for ADJUSTMENT and WASTE',
    path: ['reason'],
  })

export const updateReorderLevelSchema = z.object({
  reorderLevel: z.number().int().nonnegative().max(MAX_QUANTITY_MAGNITUDE),
})

export type AdjustInventoryInput = z.infer<typeof adjustInventorySchema>
export type UpdateReorderLevelInput = z.infer<typeof updateReorderLevelSchema>
