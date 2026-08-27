import { z } from 'zod'

export const listOrdersQuerySchema = z.object({
  search: z.string().max(100).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  cashierId: z.string().min(1).optional(),
  paymentMethod: z.enum(['CASH']).optional(),
  status: z.enum(['COMPLETED', 'CANCELLED', 'REFUNDED']).optional(),
  sortBy: z.enum(['newest', 'oldest', 'highest', 'lowest']).default('newest'),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
})

export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>

export const voidOrderSchema = z.object({
  reason: z.string().trim().min(3, 'A reason of at least 3 characters is required').max(500),
})

export type VoidOrderInput = z.infer<typeof voidOrderSchema>
