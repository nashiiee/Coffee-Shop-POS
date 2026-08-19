import { z } from 'zod'

const AUDIT_ACTIONS = [
  'PRODUCT_CREATED',
  'PRODUCT_UPDATED',
  'PRICE_CHANGED',
  'INVENTORY_ADJUSTED',
  'USER_CREATED',
  'USER_DISABLED',
  'USER_REACTIVATED',
  'USER_PASSWORD_RESET',
  'ROLE_CHANGED',
  'DISCOUNT_CREATED',
  'DISCOUNT_UPDATED',
  'CONFIG_CHANGED',
] as const

export const auditLogQuerySchema = z
  .object({
    action: z.enum(AUDIT_ACTIONS).optional(),
    resource: z.string().min(1).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
  })
  .refine((data) => !data.dateFrom || !data.dateTo || data.dateFrom <= data.dateTo, {
    message: 'dateFrom must be on or before dateTo',
    path: ['dateFrom'],
  })

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>
