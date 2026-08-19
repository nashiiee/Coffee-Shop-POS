import { z } from 'zod'

export const discountTypeSchema = z.enum(['PERCENTAGE', 'FIXED'])

const baseValue = z.number().int().nonnegative()

export const createDiscountSchema = z
  .object({
    name: z.string().min(1).max(100),
    type: discountTypeSchema,
    value: baseValue,
    // Rejects an explicit `null` rather than silently coercing it to epoch
    // (1970-01-01) via `new Date(null)`, which the Date constructor treats
    // as valid input. Only PATCH supports clearing an expiry (via
    // updateDiscountSchema's `.nullable()` below) — creating a discount
    // that is immediately expired because `null` was sent here would be an
    // undetected footgun, not a meaningful "no expiry" request.
    expiresAt: z.preprocess((val) => (val === null ? NaN : val), z.coerce.date()).optional(),
  })
  .refine((data) => (data.type !== 'PERCENTAGE' ? true : data.value <= 100), {
    message: 'A percentage discount value cannot exceed 100',
    path: ['value'],
  })

export const updateDiscountSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    type: discountTypeSchema.optional(),
    value: baseValue.optional(),
    isActive: z.boolean().optional(),
    expiresAt: z.coerce.date().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' })
  .refine((data) => (data.type !== 'PERCENTAGE' || data.value === undefined ? true : data.value <= 100), {
    message: 'A percentage discount value cannot exceed 100',
    path: ['value'],
  })

export type CreateDiscountInput = z.infer<typeof createDiscountSchema>
export type UpdateDiscountInput = z.infer<typeof updateDiscountSchema>
